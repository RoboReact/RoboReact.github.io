import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const docsRoot = fileURLToPath(new URL('../docs/', import.meta.url));
const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'roboreact-ui-tests-'));
const screenshotDirectory = process.env.SCREENSHOT_DIR;
const contentTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp4': 'video/mp4' };
let server, browser, debuggingUrl, baseUrl;

before(async () => {
  server = http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const filename = path.resolve(docsRoot, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!filename.startsWith(docsRoot) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
      response.writeHead(404).end();
      return;
    }
    const size = fs.statSync(filename).size;
    const range = request.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
    const start = range ? Number(range[1]) : 0;
    const end = range && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end) { response.writeHead(416).end(); return; }
    const headers = { 'Content-Type': contentTypes[path.extname(filename)] || 'application/octet-stream',
      'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes' };
    if (range) headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
    response.writeHead(range ? 206 : 200, headers);
    if (request.method === 'HEAD') response.end();
    else fs.createReadStream(filename, { start, end }).pipe(response);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  browser = spawn(process.env.CHROME_BIN || 'google-chrome', [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-extensions', '--remote-debugging-port=0',
    `--user-data-dir=${path.join(temporaryDirectory, 'chrome')}`, 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  debuggingUrl = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error(`Chrome startup timed out: ${output}`)), 15000);
    browser.once('error', error => { clearTimeout(timeout); reject(error); });
    browser.once('exit', code => { clearTimeout(timeout); reject(new Error(`Chrome exited ${code}: ${output}`)); });
    browser.stderr.on('data', chunk => {
      output += chunk.toString();
      const address = output.match(/DevTools listening on ws:\/\/([^/]+)/);
      if (address) { clearTimeout(timeout); resolve(`http://${address[1]}`); }
    });
  });
});

after(async () => {
  if (browser && browser.exitCode === null) {
    const stopped = new Promise(resolve => browser.once('exit', resolve));
    browser.kill();
    await stopped;
  }
  if (server) {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
  fs.rmSync(temporaryDirectory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

async function page(t, width = 1440, height = 1000, reducedMotion = true) {
  const target = await fetch(`${debuggingUrl}/json/new`, { method: 'PUT' }).then(response => response.json());
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  const pending = new Map();
  const errors = [];
  let sequence = 0;
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
    if (!pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
  };
  function cdp(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async function evaluate(expression) {
    const response = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  }
  async function waitFor(expression) {
    return evaluate(`(async () => {
      const deadline = Date.now() + 15000;
      while (!(${expression})) {
        if (Date.now() > deadline) throw new Error(${JSON.stringify(`Timed out: ${expression}`)});
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      return true;
    })()`);
  }
  t.after(async () => {
    socket.close();
    await fetch(`${debuggingUrl}/json/close/${target.id}`);
    assert.deepEqual(errors, [], 'no uncaught browser errors');
  });
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 600 });
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : 'no-preference' }] });
  await cdp('Page.navigate', { url: baseUrl });
  await waitFor(`document.querySelectorAll('.video-card').length === 16`);
  async function screenshot(name) {
    if (!screenshotDirectory) return;
    fs.mkdirSync(screenshotDirectory, { recursive: true });
    const capture = await cdp('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(path.join(screenshotDirectory, name), Buffer.from(capture.data, 'base64'));
  }
  const paint = () => evaluate(`new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))))`);
  async function hoverContrast(selector) {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block: 'center'})`);
    await paint();
    const point = await evaluate(`(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      const rect = node.getBoundingClientRect();
      return {x: rect.x + rect.width / 2, y: rect.y + rect.height / 2};
    })()`);
    await cdp('Input.dispatchMouseEvent', { type: 'mouseMoved', ...point });
    await paint();
    const result = await evaluate(`(() => {
      const node = document.querySelector(${JSON.stringify(selector)});
      const style = getComputedStyle(node);
      const rgba = color => color.match(/[0-9.]+/g).map(Number);
      // Translucent controls must be composited over the dialog, not opaque white.
      function background(element) {
        if (!element) return [255, 255, 255];
        const color = rgba(getComputedStyle(element).backgroundColor);
        const alpha = color[3] ?? 1;
        const beneath = alpha < 1 ? background(element.parentElement) : [0, 0, 0];
        return color.slice(0, 3).map((channel, i) => channel * alpha + beneath[i] * (1 - alpha));
      }
      function luminance(color) {
        const channels = color.slice(0, 3).map(value => {
          const c = Number(value) / 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      }
      const values = [luminance(rgba(style.color)), luminance(background(node))].sort((a, b) => a - b);
      return {ratio: (values[1] + 0.05) / (values[0] + 0.05), hovered: node.matches(':hover'), color: style.color, background: style.backgroundColor};
    })()`);
    assert.equal(result.hovered, true, JSON.stringify(result));
    assert.ok(result.ratio >= 4.5, JSON.stringify(result));
    return result.ratio;
  }
  return { cdp, evaluate, waitFor, screenshot, paint, hoverContrast };
}

test('gallery combines task/condition filters, pauses hidden videos and resets empty results', { timeout: 45000 }, async t => {
  const p = await page(t);
  assert.equal(await p.evaluate(`document.querySelectorAll('.gallery-filters').length`), 1);
  await p.screenshot('desktop-hero.png');
  assert.equal(await p.evaluate(`document.querySelectorAll('#videos .video-card:not([hidden])').length`), 15);
  await p.evaluate(`document.querySelector('[data-video-id="main-hand-over"]').scrollIntoView();`);
  await p.waitFor(`document.querySelector('[data-video-id="main-hand-over"] video').readyState >= 2`);
  await p.evaluate(`document.querySelector('[data-video-id="main-hand-over"] video').play()`);
  await p.evaluate(`document.querySelector('[data-filter="task"] [data-value="pour-water"]').click()`);
  assert.equal(await p.evaluate(`document.querySelector('[data-video-id="main-hand-over"] video').paused`), true);
  assert.equal(await p.evaluate(`document.querySelectorAll('#videos .video-card:not([hidden])').length`), 5);
  await p.evaluate(`document.querySelector('[data-filter="condition"] [data-value="squat"]').click()`);
  assert.equal(await p.evaluate(`document.querySelectorAll('#videos .video-card:not([hidden])').length`), 2);
  assert.equal(await p.evaluate(`document.querySelectorAll('#videos .video-group:not([hidden])').length`), 1);
  await p.evaluate(`document.querySelector('[data-filter="task"] [data-value="hand-over"]').click()`);
  assert.equal(await p.evaluate(`document.querySelector('.gallery-empty').hidden`), false);
  assert.equal(await p.evaluate(`document.querySelectorAll('#videos .video-group:not([hidden])').length`), 0);
  await p.evaluate(`document.querySelector('.gallery-reset').click()`);
  assert.equal(await p.evaluate(`document.querySelectorAll('#videos .video-card:not([hidden])').length`), 15);
  assert.equal(await p.evaluate(`document.querySelector('.gallery-empty').hidden`), true);
  assert.equal(await p.evaluate(`document.querySelectorAll('.filter-chip[aria-pressed="true"][data-value="all"]').length`), 2);
  assert.match(await p.evaluate(`document.querySelector('.gallery-count').textContent`), /15/);
  await p.evaluate(`document.querySelector('#videos').scrollIntoView()`);
  await p.screenshot('desktop-gallery.png');
  assert.ok(await p.hoverContrast('.filter-chip[aria-pressed="true"]') >= 4.5, 'selected filter remains readable on hover');
  await p.evaluate(`document.querySelector('#overview').scrollIntoView()`);
  await p.screenshot('desktop-overview.png');
});

test('video viewer preserves the source and position, closes with Escape and restores focus', { timeout: 45000 }, async t => {
  const p = await page(t);
  assert.equal(await p.evaluate(`document.querySelectorAll('.media-expand').length`), 16);
  assert.equal(
    await p.evaluate(`document.querySelectorAll('.video-card__heading > .media-expand').length`),
    16,
    'every video expand control shares the title row',
  );
  await p.evaluate(`document.querySelector('[data-video-id="main-hand-over"]').scrollIntoView()`);
  await p.waitFor(`document.querySelector('[data-video-id="main-hand-over"] video').readyState >= 2`);
  await p.evaluate(`window.testVideo = document.querySelector('[data-video-id="main-hand-over"] video'); testVideo.currentTime = 1`);
  await p.waitFor(`!testVideo.seeking`);
  const scroll = await p.evaluate(`window.scrollY`);
  await p.evaluate(`window.testTrigger = document.querySelector('[data-video-id="main-hand-over"] .media-expand'); testTrigger.focus(); testTrigger.click()`);
  assert.equal(await p.evaluate(`document.querySelector('dialog[open] video') === testVideo`), true);
  assert.equal(await p.evaluate(`document.querySelectorAll('video').length`), 16);
  await p.waitFor(`testVideo.readyState >= 2 && Math.abs(testVideo.currentTime - 1) < 0.2`);
  await p.evaluate(`testVideo.play()`);
  await p.waitFor(`testVideo.currentTime > 1.05`);
  await p.screenshot('desktop-video-viewer.png');
  await p.cdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await p.cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  await p.waitFor(`!document.querySelector('dialog[open]')`);
  assert.equal(await p.evaluate(`testVideo.closest('[data-video-id]').dataset.videoId`), 'main-hand-over');
  assert.equal(await p.evaluate(`testVideo.paused`), true);
  assert.equal(await p.evaluate(`document.activeElement === testTrigger`), true);
  assert.ok(Math.abs(await p.evaluate(`window.scrollY`) - scroll) < 3, 'reading position preserved');
  assert.equal(await p.evaluate(`document.body.classList.contains('media-viewer-open')`), false);
});

test('both paper figures zoom, reset, dismiss and preserve accessible captions', { timeout: 45000 }, async t => {
  const p = await page(t);
  assert.equal(await p.evaluate(`document.querySelectorAll('.figure-trigger').length`), 2);
  for (const section of ['teaser', 'method']) {
    await p.evaluate(`document.querySelector('#${section} .figure-trigger').click()`);
    await p.waitFor(`document.querySelector('.media-viewer__image')?.naturalWidth > 0 && document.querySelector('.media-viewer__status').hidden`);
    await p.paint();
    assert.equal(await p.evaluate(`document.querySelector('dialog[open]').dataset.kind`), 'image');
    assert.ok(await p.hoverContrast('.media-viewer__close') >= 4.5, 'viewer close button remains readable on hover');
    await p.cdp('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    await p.cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    assert.equal(await p.evaluate(`document.querySelector('dialog[open]').contains(document.activeElement)`), true,
      await p.evaluate(`document.activeElement.outerHTML.slice(0, 300)`));
    assert.ok(await p.evaluate(`document.querySelector('.media-viewer__caption').textContent.length > 30`));
    const beforeWidth = await p.evaluate(`document.querySelector('.media-viewer__image').getBoundingClientRect().width`);
    await p.evaluate(`document.querySelector('[data-viewer-action="zoom-in"]').click()`);
    await p.paint();
    await p.screenshot(`desktop-${section}-zoomed.png`);
    assert.ok(await p.evaluate(`document.querySelector('.media-viewer__image').getBoundingClientRect().width`) > beforeWidth,
      'Zoom in increases the displayed figure size');
    await p.evaluate(`document.querySelector('[data-viewer-action="fit"]').click()`);
    await p.paint();
    assert.ok(Math.abs(await p.evaluate(`document.querySelector('.media-viewer__image').getBoundingClientRect().width`) - beforeWidth) < 2,
      `Fit restores ${section}: initial ${beforeWidth}, final ${await p.evaluate(`document.querySelector('.media-viewer__image').getBoundingClientRect().width`)}`);
    await p.screenshot(`desktop-${section}-viewer.png`);
    await p.evaluate(`document.querySelector('.media-viewer__close').click()`);
    await p.waitFor(`!document.querySelector('dialog[open]')`);
    assert.equal(await p.evaluate(`document.activeElement === document.querySelector('#${section} .figure-trigger')`), true);
  }
  await p.evaluate(`document.querySelector('#method .figure-trigger').click()`);
  await p.cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: 1, y: 1, button: 'left', clickCount: 1 });
  await p.cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 1, y: 1, button: 'left', clickCount: 1 });
  await p.waitFor(`!document.querySelector('dialog[open]')`);
});

test('mobile viewer and filters fit the viewport; reduced motion remains respected', { timeout: 45000 }, async t => {
  const p = await page(t, 390, 844);
  assert.equal(await p.evaluate(`document.querySelector('#featured video').autoplay`), false);
  assert.equal(await p.evaluate(`getComputedStyle(document.querySelector('.hero__filmstrip-track')).animationName`), 'none');
  assert.ok(await p.evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`));
  await p.screenshot('mobile-hero.png');
  await p.evaluate(`document.querySelector('#videos').scrollIntoView()`);
  assert.ok(await p.evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`));
  await p.screenshot('mobile-gallery.png');
  await p.evaluate(`document.querySelector('#method .figure-trigger').click()`);
  await p.waitFor(`document.querySelector('.media-viewer__image')?.naturalWidth > 0 && document.querySelector('.media-viewer__status').hidden`);
  await p.evaluate(`document.querySelector('[data-viewer-action="zoom-in"]').click()`);
  await p.paint();
  await p.screenshot('mobile-figure-viewer.png');
  assert.ok(await p.evaluate(`document.querySelector('dialog[open]').getBoundingClientRect().width <= innerWidth`));
  assert.ok(await p.evaluate(`document.querySelector('.media-viewer__stage').scrollWidth > document.querySelector('.media-viewer__stage').clientWidth`),
    await p.evaluate(`JSON.stringify({stage: document.querySelector('.media-viewer__stage').getBoundingClientRect().toJSON(), image: document.querySelector('.media-viewer__image').getBoundingClientRect().toJSON(), zoom: document.querySelector('.media-viewer__zoom').textContent})`));
  await p.evaluate(`document.querySelector('.media-viewer__close').click()`);
  assert.equal(await p.evaluate(`document.body.classList.contains('media-viewer-open')`), false);
});

test('results chart matches every configured rate and links to the selected task recordings', { timeout: 45000 }, async t => {
  const p = await page(t);
  assert.equal(await p.evaluate(`document.querySelectorAll('[data-results-task]').length`), 4);
  for (const task of ['handOver', 'openBox', 'pourWater', 'openDrawer']) {
    await p.evaluate(`document.querySelector('[data-results-task="${task}"]').click()`);
    assert.equal(await p.evaluate(`document.querySelector('[data-results-task="${task}"]').getAttribute('aria-pressed')`), 'true');
    const actual = await p.evaluate(`Array.from(document.querySelectorAll('[data-result-method]'), row => [row.dataset.resultMethod, Number(row.dataset.successRate)])`);
    const expected = await p.evaluate(`ROBOREACT_CONFIG.results.taskResults.map(row => [row.method, row['${task}']])`);
    assert.deepEqual(actual, expected);
    const proportions = await p.evaluate(`Array.from(document.querySelectorAll('[data-result-method]'), row => ({
      rate: Number(row.dataset.successRate),
      width: row.querySelector('.results-chart__fill').getBoundingClientRect().width / row.querySelector('.results-chart__track').clientWidth * 100
    }))`);
    assert.ok(proportions.every(row => Math.abs(row.rate - row.width) < 0.5));
  }
  assert.equal(await p.evaluate(`document.querySelectorAll('#results table tbody tr').length`), 4);
  await p.evaluate(`document.querySelector('[data-results-task="pourWater"]').click(); document.querySelector('#results').scrollIntoView()`);
  await p.screenshot('desktop-results-chart.png');
  await p.evaluate(`document.querySelector('[data-filter="condition"] [data-value="crossObject"]').click(); document.querySelector('.results-watch').click()`);
  assert.equal(await p.evaluate(`document.querySelector('[data-filter="task"] [aria-pressed="true"]').dataset.value`), 'pour-water');
  assert.equal(await p.evaluate(`document.querySelector('[data-filter="condition"] [aria-pressed="true"]').dataset.value`), 'all');
  assert.equal(await p.evaluate(`document.querySelectorAll('#videos .video-card:not([hidden])').length`), 5);
});

test('research interactions fit mobile without hiding the figure or original results table', { timeout: 45000 }, async t => {
  const p = await page(t, 390, 844);
  await p.evaluate(`document.querySelector('#method').scrollIntoView()`);
  assert.ok(await p.evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`));
  await p.screenshot('mobile-method.png');
  await p.evaluate(`document.querySelector('[data-results-task="openBox"]').click(); document.querySelector('#results').scrollIntoView()`);
  assert.ok(await p.evaluate(`document.documentElement.scrollWidth <= innerWidth + 1`));
  assert.ok(await p.evaluate(`(() => {
    const axis = document.querySelector('.results-chart__scale').getBoundingClientRect();
    const track = document.querySelector('.results-chart__track').getBoundingClientRect();
    return Math.abs(axis.left - track.left) < 2 && Math.abs(axis.right - track.right) < 2;
  })()`));
  await p.screenshot('mobile-results-chart.png');
});

test('failed enlarged media has a usable error state and can be closed', { timeout: 45000 }, async t => {
  const p = await page(t);
  await p.evaluate(`document.querySelector('#method').scrollIntoView(); document.querySelector('#method .paper-figure img').src = '/missing-figure.webp'`);
  await p.waitFor(`document.querySelector('#method .paper-figure img').complete`);
  await p.evaluate(`document.querySelector('#method .figure-trigger').click()`);
  await p.waitFor(`document.querySelector('.media-viewer__status').textContent.includes('Figure unavailable')`);
  await p.evaluate(`document.querySelector('.media-viewer__close').click()`);
  await p.waitFor(`!document.querySelector('dialog[open]')`);
  await p.evaluate(`const video = document.querySelector('[data-video-id="main-hand-over"] video');
    delete video.dataset.src; video.src = '/missing-video.mp4'; video.load();`);
  await p.waitFor(`document.querySelector('[data-video-id="main-hand-over"] video').error`);
  await p.evaluate(`document.querySelector('[data-video-id="main-hand-over"] .media-expand').click()`);
  await p.waitFor(`document.querySelector('.media-viewer__status').textContent.includes('Video unavailable')`);
  await p.evaluate(`document.querySelector('.media-viewer__close').click()`);
  await p.waitFor(`!document.querySelector('dialog[open]')`);
  assert.equal(await p.evaluate(`document.body.classList.contains('media-viewer-open')`), false);
});
