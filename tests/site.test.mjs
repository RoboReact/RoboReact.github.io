import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const docsRoot = path.join(root, 'docs');

const requiredFiles = {
  html: 'docs/index.html',
  css: 'docs/assets/css/styles.css',
  config: 'docs/assets/js/config.js',
  main: 'docs/assets/js/main.js',
};

const expectedHeroSubtitle =
  'Agentic Skill Distillation from Generated Egocentric Videos for Generalizable Whole-Body Manipulation';
const expectedTitle = `RoboReact: ${expectedHeroSubtitle}`;

const expectedHeroFilmstripAssets = [
  {
    modifier: 'cup-tray',
    publicPath: './assets/images/hero/sequence-cup-tray.webp',
  },
  {
    modifier: 'open-box',
    publicPath: './assets/images/hero/sequence-open-box.webp',
  },
  {
    modifier: 'drawer-object',
    publicPath: './assets/images/hero/sequence-drawer-object.webp',
  },
  {
    modifier: 'small-box',
    publicPath: './assets/images/hero/sequence-small-box.webp',
  },
];

const expectedTaskSuccessRates = {
  handOver: 85,
  openBox: 70,
  pourWater: 85,
  openDrawer: 85,
};

const forbiddenPublicPattern =
  /anonymous\s*submission|anonymized\s+submission|strictly\s+prohibited|public\s+sharing\s+of\s+this\s+manuscript|\+36\.3|TBD|RoboReact_Agentic_Skill_\.pdf/i;

function absolutePath(relativePath) {
  return path.join(root, relativePath);
}

function assertRequiredFilesExist() {
  for (const [label, relativePath] of Object.entries(requiredFiles)) {
    assert.ok(
      fs.existsSync(absolutePath(relativePath)),
      `Required ${label} file is missing: ${relativePath}`,
    );
  }
}

function readRequiredFiles() {
  assertRequiredFilesExist();

  return Object.fromEntries(
    Object.entries(requiredFiles).map(([label, relativePath]) => [
      label,
      fs.readFileSync(absolutePath(relativePath), 'utf8'),
    ]),
  );
}

function loadConfig() {
  const { config: configSource } = readRequiredFiles();
  const wrapper =
    /^\s*globalThis\.ROBOREACT_CONFIG\s*=\s*JSON\.parse\(String\.raw`\r?\n([\s\S]*?)\r?\n`\);\s*$/;
  const match = configSource.match(wrapper);

  assert.ok(match, 'config.js must contain only the declarative JSON.parse(String.raw`...`) wrapper');
  assert.doesNotMatch(match[1], /`|\$\{/, 'config JSON payload must not contain template syntax');
  return JSON.parse(match[1]);
}

function getVideos(config) {
  assert.ok(Array.isArray(config.videos), 'ROBOREACT_CONFIG.videos must be an array');
  return config.videos;
}

function getSpeedLabel(video) {
  return video.speedLabel ?? video.playbackSpeedLabel ?? video.rateLabel;
}

function getResultMetric(config, key) {
  if (config.results && Object.hasOwn(config.results, key)) {
    return config.results[key];
  }

  if (config.metrics && Object.hasOwn(config.metrics, key)) {
    return config.metrics[key];
  }

  return undefined;
}

function getTaskRates(config) {
  const candidates = [
    config.taskSuccessRates,
    config.table1?.taskSuccessRates,
    config.results?.taskSuccessRates,
    config.metrics?.taskSuccessRates,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

function assertUniqueNonEmpty(videos, propertyName) {
  const values = videos.map((video) => video[propertyName]);
  assert.equal(
    values.length,
    new Set(values).size,
    `videos must have unique ${propertyName} values`,
  );

  for (const value of values) {
    assert.equal(typeof value, 'string', `video ${propertyName} must be a string`);
    assert.notEqual(value.trim(), '', `video ${propertyName} must be non-empty`);
  }
}

function assertLocalDocsFile(publicPath, label) {
  assert.equal(typeof publicPath, 'string', `${label} must be a string`);
  assert.notEqual(publicPath.trim(), '', `${label} must be non-empty`);
  assert.equal(publicPath, publicPath.trim(), `${label} must not contain surrounding whitespace`);
  assert.doesNotMatch(publicPath, /^[a-z][a-z0-9+.-]*:/i, `${label} must be a local path`);
  assert.doesNotMatch(publicPath, /^\/\//, `${label} must not be protocol-relative`);
  assert.equal(path.isAbsolute(publicPath), false, `${label} must not be an absolute path`);
  assert.equal(publicPath.startsWith('/'), false, `${label} must not be root-relative`);
  assert.equal(publicPath.includes('\\'), false, `${label} must use URL-style forward slashes`);
  assert.equal(publicPath.includes('?'), false, `${label} must not include a query string`);
  assert.equal(publicPath.includes('#'), false, `${label} must not include a fragment`);
  assert.equal(
    publicPath.split('/').includes('..'),
    false,
    `${label} must not contain path traversal`,
  );

  const resolvedPath = path.resolve(docsRoot, publicPath);
  const relativeToDocs = path.relative(docsRoot, resolvedPath);
  assert.equal(
    relativeToDocs === '..' || relativeToDocs.startsWith(`..${path.sep}`) || path.isAbsolute(relativeToDocs),
    false,
    `${label} must resolve under docs/`,
  );
  assert.ok(fs.existsSync(resolvedPath), `${label} file must exist under docs/: ${publicPath}`);
  assert.ok(fs.statSync(resolvedPath).isFile(), `${label} must resolve to a file: ${publicPath}`);
}

function getAttribute(tag, attributeName) {
  const quotedPattern = new RegExp(`\\b${attributeName}\\s*=\\s*(["'])(.*?)\\1`, 'i');
  const quotedMatch = tag.match(quotedPattern);
  if (quotedMatch) {
    return quotedMatch[2];
  }

  const unquotedPattern = new RegExp(`\\b${attributeName}\\s*=\\s*([^\\s>]+)`, 'i');
  const unquotedMatch = tag.match(unquotedPattern);
  return unquotedMatch?.[1];
}

function normalizeMarkupText(markup) {
  return markup
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .replace(/\s*:\s*/g, ': ')
    .trim();
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getElementsByClass(source, className) {
  const elements = [];
  const elementPattern = /<([a-z][\w:-]*)\b[^>]*>[\s\S]*?<\/\1>/gi;

  for (const match of source.matchAll(elementPattern)) {
    const openingTag = match[0].match(/^<[^>]+>/)?.[0] ?? '';
    const classes = (getAttribute(openingTag, 'class') ?? '').split(/\s+/);
    if (classes.includes(className)) {
      elements.push(match[0]);
    }
  }

  return elements;
}

function countClassOccurrences(source, className) {
  const elementPattern = /<[a-z][\w:-]*\b[^>]*>/gi;
  let count = 0;

  for (const match of source.matchAll(elementPattern)) {
    const classes = (getAttribute(match[0], 'class') ?? '').split(/\s+/);
    count += classes.filter((classToken) => classToken === className).length;
  }

  return count;
}

function assertSourceMatch(source, pattern, message) {
  assert.ok(pattern.test(source), message);
}

function assertVisibleClassText(source, className, expectedText) {
  const elements = getElementsByClass(source, className);

  assert.equal(elements.length, 1, `HTML must include exactly one .${className} element`);

  const openingTag = elements[0].match(/^<[^>]+>/)?.[0] ?? '';
  assert.doesNotMatch(openingTag, /\bhidden(?:\s|=|>)/i, `.${className} must not be hidden`);
  assert.notEqual(
    (getAttribute(openingTag, 'aria-hidden') ?? '').toLowerCase(),
    'true',
    `.${className} must not be aria-hidden`,
  );
  assert.equal(normalizeMarkupText(elements[0]), expectedText, `.${className} text must match`);
}

test('required production files exist before contract assertions run', () => {
  assertRequiredFilesExist();
});

test('site exposes the two-level paper title in HTML and config', () => {
  const { html } = readRequiredFiles();
  const config = loadConfig();
  const h1Tags = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) ?? [];

  assert.equal(h1Tags.length, 1, 'HTML must include exactly one h1');
  assert.equal(normalizeMarkupText(h1Tags[0]), expectedTitle);
  assert.equal(config.title, expectedTitle);
  assertVisibleClassText(html, 'hero__title-brand', 'RoboReact');
  assertVisibleClassText(html, 'hero__title-subtitle', expectedHeroSubtitle);
  assert.match(html, new RegExp(escapeRegExp(expectedHeroSubtitle)));
});

test('video configuration has exactly 16 unique public videos', () => {
  const videos = getVideos(loadConfig());

  assert.equal(videos.length, 16, 'ROBOREACT_CONFIG.videos must contain exactly 16 videos');
  assertUniqueNonEmpty(videos, 'id');
  assertUniqueNonEmpty(videos, 'src');
  assertUniqueNonEmpty(videos, 'poster');
});

test('video source and poster assets are local files under docs', () => {
  const videos = getVideos(loadConfig());

  for (const video of videos) {
    assertLocalDocsFile(video.src, `${video.id} src`);
    assertLocalDocsFile(video.poster, `${video.id} poster`);
  }
});

test('only highlight-pour-water autoplays and speed labels match the paper site contract', () => {
  const videos = getVideos(loadConfig());
  const autoplayVideos = videos.filter((video) => video.autoplay === true);

  assert.deepEqual(
    Array.from(autoplayVideos, (video) => video.id),
    ['highlight-pour-water'],
    'only highlight-pour-water may autoplay',
  );

  for (const video of videos) {
    const expectedLabel =
      video.id === 'highlight-pour-water'
        ? '10x'
        : video.id === 'cross-object-open-drawer'
          ? '2x'
          : '5x';

    assert.equal(
      String(getSpeedLabel(video)).replace('×', 'x'),
      expectedLabel,
      `${video.id} must display speed label ${expectedLabel.replace('x', '×')}`,
    );
  }
});

test('release metadata remains hidden until public artifacts are ready', () => {
  const config = loadConfig();

  assert.ok(config.release, 'config.release must exist with explicit null metadata fields');
  assert.ok(Array.isArray(config.release.authors), 'release authors must be an array');
  assert.equal(config.release.authors.length, 0, 'release authors must stay hidden');
  assert.ok(Array.isArray(config.release.affiliations), 'release affiliations must be an array');
  assert.equal(config.release.affiliations.length, 0, 'release affiliations must stay hidden');
  assert.equal(config.release.venue, null, 'release venue must be null');
  assert.equal(config.release.contact, null, 'release contact must be null');
  assert.equal(config.release.bibtex, null, 'release BibTeX must be null');
  assert.ok(config.release.resources, 'config.release.resources must exist');
  assert.equal(config.release.resources.paper, null, 'paper resource URL must be null');
  assert.equal(config.release.resources.arxiv, null, 'arXiv resource URL must be null');
  assert.equal(config.release.resources.code, null, 'code resource URL must be null');
  assert.equal(config.release.resources.dataset, null, 'dataset resource URL must be null');
  assert.equal(
    config.release.resources.supplementary,
    null,
    'supplementary resource URL must be null',
  );
});

test('site publishes a local SVG favicon from the document head', () => {
  const { html } = readRequiredFiles();
  const faviconPath = absolutePath('docs/favicon.svg');

  assert.ok(fs.existsSync(faviconPath), 'docs/favicon.svg must exist');
  assert.ok(fs.statSync(faviconPath).isFile(), 'docs/favicon.svg must be a regular file');

  const favicon = fs.readFileSync(faviconPath, 'utf8');
  assert.notEqual(favicon.trim(), '', 'docs/favicon.svg must not be empty');
  assert.match(favicon, /<svg\b/i, 'docs/favicon.svg must be an SVG document');
  assert.doesNotMatch(favicon, /<script\b/i, 'docs/favicon.svg must not contain scripts');
  assert.doesNotMatch(favicon, /\b(?:href|src)\s*=\s*["'](?:https?:|\/\/|data:)/i);

  const linkTags = html.match(/<link\b[^>]*>/gi) ?? [];
  const iconLinks = linkTags.filter((tag) => (getAttribute(tag, 'rel') || '').toLowerCase() === 'icon');

  assert.equal(iconLinks.length, 1, 'HTML must include exactly one rel="icon" link');
  assert.equal(getAttribute(iconLinks[0], 'href'), './favicon.svg');
  assert.equal(getAttribute(iconLinks[0], 'type'), 'image/svg+xml');
});

test('hero publishes four decorative local filmstrips with seamless sheet pairs', () => {
  const { html, css } = readRequiredFiles();
  const filmstrips = getElementsByClass(html, 'hero__filmstrips');

  assert.equal(filmstrips.length, 1, 'HTML must include exactly one .hero__filmstrips wrapper');

  const openingTag = filmstrips[0].match(/^<div\b[^>]*>/i)?.[0] ?? '';
  assert.notEqual(openingTag, '', '.hero__filmstrips must be a div');
  assert.equal(getAttribute(openingTag, 'aria-hidden'), 'true');
  assert.equal(
    countClassOccurrences(html, 'hero__filmstrip-track'),
    4,
    'HTML must include exactly four hero filmstrip tracks',
  );
  assert.equal(
    countClassOccurrences(html, 'hero__filmstrip-sheet'),
    8,
    'HTML must include exactly eight hero filmstrip sheets',
  );

  let combinedBytes = 0;

  for (const { modifier, publicPath } of expectedHeroFilmstripAssets) {
    assert.match(
      html,
      new RegExp(`\\bhero__filmstrip--${escapeRegExp(modifier)}\\b`),
      `HTML must include hero__filmstrip--${modifier}`,
    );
    assertLocalDocsFile(publicPath, `hero ${modifier} filmstrip`);
    combinedBytes += fs.statSync(path.resolve(docsRoot, publicPath)).size;
    assertSourceMatch(
      css,
      new RegExp(`url\\(["']?\\.\\./images/hero/${escapeRegExp(path.basename(publicPath))}["']?\\)`),
      `CSS must reference ../images/hero/${path.basename(publicPath)}`,
    );
  }

  assert.ok(
    combinedBytes <= 2.5 * 1024 * 1024,
    'combined hero filmstrip assets must stay at or below 2.5 MiB',
  );
});

test('hero filmstrip motion is slow, staggered, reduced-motion safe, and printable', () => {
  const { css } = readRequiredFiles();
  const generatorPath = absolutePath('scripts/prepare-hero-filmstrips.sh');

  for (const duration of ['72s', '84s', '78s', '96s']) {
    assertSourceMatch(css, new RegExp(`\\b${duration}\\b`), `CSS must include ${duration} duration`);
  }

  assertSourceMatch(css, /@keyframes\s+hero-filmstrip-scroll\b/);
  assertSourceMatch(css, /\banimation-direction\s*:\s*reverse\b|animation\s*:[^;]*\breverse\b/);
  assertSourceMatch(css, /prefers-reduced-motion/);
  assertSourceMatch(
    css,
    /@media\s+print\s*\{[\s\S]*?[^{}]*\.hero__filmstrips[^{}]*\{[^{}]*\bdisplay\s*:\s*none\b[^{}]*\}/,
    'print CSS must hide .hero__filmstrips with display: none',
  );

  assert.ok(
    fs.existsSync(generatorPath),
    'scripts/prepare-hero-filmstrips.sh must exist as the reproducible generator',
  );

  const generator = fs.readFileSync(generatorPath, 'utf8');
  assert.match(generator, /^#!\/usr\/bin\/env bash\r?\n/);
  assert.match(generator, /\bset\s+-euo\s+pipefail\b/);

  for (const token of [
    'generated_reference_images',
    'keyframe_images',
    'cup-tray',
    'open-box',
    'drawer-object',
    'small-box',
  ]) {
    assert.match(generator, new RegExp(escapeRegExp(token)), `generator must mention ${token}`);
  }

  assert.match(generator, /\bffmpeg\b/);
  assert.match(generator, /\bcwebp\b/);
  assert.doesNotMatch(generator, /\blibwebp\b/);
  assert.doesNotMatch(generator, /\/Users\//);
});

test('release resource links are sanitized as HTTPS-only URLs', () => {
  const { main } = readRequiredFiles();

  assert.match(main, /\bfunction\s+safeHttpsUrl\s*\(/, 'main.js must expose a safeHttpsUrl helper');
  assert.ok(main.includes('^https:\\/\\/'), 'safeHttpsUrl must require an https:// prefix');
  assert.doesNotMatch(main, /\^https\?:\\\/\\\//, 'safeHttpsUrl must not allow http:// prefixes');
  assert.match(
    main,
    /\bparsed\.protocol\s*===\s*['"]https:['"]/,
    'safeHttpsUrl must verify the parsed protocol is https:',
  );
  assert.doesNotMatch(
    main,
    /\bparsed\.protocol\s*===\s*['"]http:['"]/,
    'safeHttpsUrl must not accept parsed http: URLs',
  );
});

test('README documents release media reference tooling and byte-level reproducibility limits', () => {
  const readme = fs.readFileSync(absolutePath('README.md'), 'utf8');

  assert.match(readme, /FFmpeg\/ffprobe 4\.2\.2/);
  assert.match(readme, /Ghostscript 10\.07\.1/);
  assert.match(readme, /cwebp 1\.6\.0/);
  assert.doesNotMatch(readme, /cwebp 1\.3\.2/);
  assert.match(readme, /exact bytes may differ/i);
  assert.match(readme, /builds\/platforms|platforms\/builds/i);
  assert.match(readme, /validator verifies/i);
  assert.match(readme, /counts/i);
  assert.match(readme, /mappings/i);
  assert.match(readme, /codecs/i);
  assert.match(readme, /public boundary/i);
  assert.match(readme, /future resource URLs must be HTTPS/i);
});

test('Table 1 metrics expose verified RoboReact results', () => {
  const { html } = readRequiredFiles();
  const config = loadConfig();
  const taskRates = getTaskRates(config);

  assert.ok(taskRates, 'config must expose Table 1 task success rates');
  assert.equal(getResultMetric(config, 'meanSuccessRate'), 81.3);
  assert.equal(getResultMetric(config, 'meanAverageCompletedLength'), 4.2);
  assert.match(html, /\b81\.3\b/, 'HTML must display the verified mean success rate 81.3');
  assert.match(html, /\b4\.20\b/, 'HTML must display the verified mean average completed length 4.20');

  for (const [taskId, successRate] of Object.entries(expectedTaskSuccessRates)) {
    assert.equal(taskRates[taskId], successRate, `Table 1 SR for ${taskId} must be ${successRate}`);
  }
});

test('main.js leaves playback speed to media files instead of forcing playbackRate', () => {
  const { main } = readRequiredFiles();

  assert.doesNotMatch(main, /\bplaybackRate\b/);
});

test('CSS supports reduced motion and visible keyboard focus', () => {
  const { css } = readRequiredFiles();

  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /:focus-visible/);
});

test('HTML includes semantic anchors and accessible figure hooks', () => {
  const { html } = readRequiredFiles();

  for (const anchor of [
    'teaser',
    'overview',
    'method',
    'videos',
    'results',
  ]) {
    assert.match(
      html,
      new RegExp(`<(?:section|article|main|div|nav|a)[^>]+id=["']${anchor}["']`, 'i'),
      `HTML must include semantic anchor #${anchor}`,
    );
  }

  assert.match(html, /<figure\b/i, 'HTML must include figure elements');
  const imageTags = html.match(/<img\b[^>]*>/gi) ?? [];
  assert.ok(imageTags.length > 0, 'HTML must include image elements');

  for (const [index, imageTag] of imageTags.entries()) {
    const alt = getAttribute(imageTag, 'alt');
    assert.equal(typeof alt, 'string', `image ${index + 1} must include an alt attribute`);
    assert.notEqual(alt.trim(), '', `image ${index + 1} alt attribute must be non-empty`);
  }
});

test('public source never includes private-review or placeholder strings', () => {
  const files = readRequiredFiles();

  for (const [label, source] of Object.entries(files)) {
    assert.doesNotMatch(source, forbiddenPublicPattern, `${label} contains forbidden public string`);
  }
});
