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
    duration: '72s',
    direction: 'normal',
  },
  {
    modifier: 'open-box',
    publicPath: './assets/images/hero/sequence-open-box.webp',
    duration: '84s',
    direction: 'reverse',
  },
  {
    modifier: 'drawer-object',
    publicPath: './assets/images/hero/sequence-drawer-object.webp',
    duration: '78s',
    direction: 'normal',
  },
  {
    modifier: 'small-box',
    publicPath: './assets/images/hero/sequence-small-box.webp',
    duration: '96s',
    direction: 'reverse',
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

function getClassTokens(tag) {
  return (getAttribute(tag, 'class') ?? '').split(/\s+/).filter(Boolean);
}

function hasClass(tag, className) {
  return getClassTokens(tag).includes(className);
}

function getSingleElementByTag(source, tagName, label) {
  const elementPattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  const elements = Array.from(source.matchAll(elementPattern), (match) => ({
    innerHtml: match[1],
  }));

  assert.equal(elements.length, 1, `${label} must include exactly one <${tagName}> element`);
  return elements[0];
}

function getElementsByTagAndClass(source, tagName, className) {
  const elementPattern = new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'gi');
  const elements = [];

  for (const match of source.matchAll(elementPattern)) {
    const openingTag = match[0].match(/^<[^>]+>/)?.[0] ?? '';
    if (hasClass(openingTag, className)) {
      elements.push({
        openingTag,
        innerHtml: match[1],
        index: match.index,
      });
    }
  }

  return elements;
}

function getOpeningTagsByClass(source, className) {
  const tagPattern = /<[a-z][\w:-]*\b[^>]*>/gi;
  const tags = [];

  for (const match of source.matchAll(tagPattern)) {
    if (hasClass(match[0], className)) {
      tags.push({ tag: match[0], index: match.index });
    }
  }

  return tags;
}

function countClassOccurrences(source, className) {
  return getOpeningTagsByClass(source, className).length;
}

function countTagClassOccurrences(source, tagName, className) {
  const tagPattern = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
  let count = 0;

  for (const match of source.matchAll(tagPattern)) {
    if (hasClass(match[0], className)) {
      count += 1;
    }
  }
  return count;
}

function assertSourceMatch(source, pattern, message) {
  assert.ok(pattern.test(source), message);
}

function assertNotHidden(tag, label) {
  assert.doesNotMatch(tag, /\bhidden(?:\s|=|>)/i, `${label} must not be hidden`);
  assert.notEqual(
    (getAttribute(tag, 'aria-hidden') ?? '').toLowerCase(),
    'true',
    `${label} must not be aria-hidden`,
  );
}

function assertVisibleSpanText(source, className, expectedText) {
  const elements = getElementsByTagAndClass(source, 'span', className);

  assert.equal(elements.length, 1, `h1 must include exactly one .${className} span`);
  assertNotHidden(elements[0].openingTag, `.${className}`);
  assert.equal(
    getClassTokens(elements[0].openingTag).includes('sr-only'),
    false,
    `.${className} must be visible, not sr-only`,
  );
  assert.equal(normalizeMarkupText(elements[0].innerHtml), expectedText, `.${className} text must match`);

  return elements[0];
}

function assertAccessibleSrOnlyColon(source) {
  const elements = getElementsByTagAndClass(source, 'span', 'sr-only');

  assert.equal(elements.length, 1, 'h1 must include exactly one accessible .sr-only span');
  assertNotHidden(elements[0].openingTag, '.sr-only');
  assert.equal(normalizeMarkupText(elements[0].innerHtml), ':', '.sr-only text must be a colon');

  return elements[0];
}

function captureHeroFilmstrips(html) {
  const wrappers = getOpeningTagsByClass(html, 'hero__filmstrips');

  assert.equal(wrappers.length, 1, 'HTML must include exactly one .hero__filmstrips wrapper');
  assert.match(wrappers[0].tag, /^<div\b/i, '.hero__filmstrips must be a div');
  assert.equal(getAttribute(wrappers[0].tag, 'aria-hidden'), 'true');

  const followingHtml = html.slice(wrappers[0].index + wrappers[0].tag.length);
  const followingContentFrame = getOpeningTagsByClass(followingHtml, 'content-frame')[0];
  assert.ok(
    followingContentFrame,
    '.hero__filmstrips must be followed by the next .content-frame sibling',
  );

  return {
    segment: html.slice(
      wrappers[0].index,
      wrappers[0].index + wrappers[0].tag.length + followingContentFrame.index,
    ),
  };
}

function getModifierFilmstripSegment(wrapperSegment, modifier) {
  const className = `hero__filmstrip--${modifier}`;
  const modifierTags = getOpeningTagsByClass(wrapperSegment, className);
  const allModifierTags = expectedHeroFilmstripAssets
    .flatMap((asset) => getOpeningTagsByClass(wrapperSegment, `hero__filmstrip--${asset.modifier}`))
    .sort((left, right) => left.index - right.index);

  assert.equal(modifierTags.length, 1, `HTML must include exactly one .${className} column`);

  const start = modifierTags[0].index;
  const nextModifier = allModifierTags.find((tag) => tag.index > start);
  return wrapperSegment.slice(start, nextModifier?.index ?? wrapperSegment.length);
}

function getCssRules(css) {
  const rulePattern = /([^{}]+)\{([^{}]*)\}/g;
  return Array.from(css.matchAll(rulePattern), (match) => ({
    selector: match[1].trim(),
    body: match[2],
  }));
}

function findCssRule(css, selectorPredicate, message) {
  const rule = getCssRules(css).find(({ selector }) => selectorPredicate(selector));

  assert.ok(rule, message);
  return rule;
}

function findCssAtRuleBlock(css, atRulePattern, message) {
  const match = css.match(atRulePattern);

  assert.ok(match, message);

  const openingBrace = css.indexOf('{', match.index + match[0].length);
  assert.notEqual(openingBrace, -1, `${message}: missing opening brace`);

  let depth = 0;
  for (let index = openingBrace; index < css.length; index += 1) {
    if (css[index] === '{') {
      depth += 1;
    } else if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return css.slice(openingBrace + 1, index);
      }
    }
  }

  assert.fail(`${message}: missing closing brace`);
}

function selectorHasClass(selector, className) {
  return new RegExp(`\\.${escapeRegExp(className)}(?![\\w-])`).test(selector);
}

function findModifierTrackRule(css, modifier) {
  return findCssRule(
    css,
    (selector) =>
      selectorHasClass(selector, `hero__filmstrip--${modifier}`) &&
      selectorHasClass(selector, 'hero__filmstrip-track'),
    `CSS must define a .hero__filmstrip--${modifier} .hero__filmstrip-track rule`,
  );
}

function assertModifierSheetBackground(css, modifier, publicPath) {
  const basename = path.basename(publicPath);
  const sheetRule = findCssRule(
    css,
    (selector) =>
      selectorHasClass(selector, `hero__filmstrip--${modifier}`) &&
      selectorHasClass(selector, 'hero__filmstrip-sheet'),
    `CSS must define a modifier-specific .hero__filmstrip-sheet rule for ${modifier}`,
  );

  assertSourceMatch(
    sheetRule.body,
    new RegExp(`\\bbackground-image\\s*:\\s*url\\(["']?\\.\\./images/hero/${escapeRegExp(basename)}["']?\\)`),
    `CSS .hero__filmstrip--${modifier} .hero__filmstrip-sheet must use ../images/hero/${basename}`,
  );
}

function assertModifierTrackMotion(css, modifier, duration, direction) {
  const trackRule = findModifierTrackRule(css, modifier);

  assertSourceMatch(
    trackRule.body,
    new RegExp(`\\banimation(?:-duration)?\\s*:[^;]*\\b${escapeRegExp(duration)}\\b`),
    `CSS .hero__filmstrip--${modifier} .hero__filmstrip-track must use ${duration}`,
  );
  assertSourceMatch(
    trackRule.body,
    new RegExp(`\\banimation(?:-direction)?\\s*:[^;]*\\b${escapeRegExp(direction)}\\b`),
    `CSS .hero__filmstrip--${modifier} .hero__filmstrip-track must use ${direction} direction`,
  );
}

test('required production files exist before contract assertions run', () => {
  assertRequiredFilesExist();
});

test('site exposes the two-level paper title in HTML and config', () => {
  const { html } = readRequiredFiles();
  const config = loadConfig();
  const h1 = getSingleElementByTag(html, 'h1', 'HTML');
  const brand = assertVisibleSpanText(h1.innerHtml, 'hero__title-brand', 'RoboReact');
  const colon = assertAccessibleSrOnlyColon(h1.innerHtml);
  const subtitle = assertVisibleSpanText(
    h1.innerHtml,
    'hero__title-subtitle',
    expectedHeroSubtitle,
  );

  assert.ok(
    brand.index < colon.index && colon.index < subtitle.index,
    'h1 title spans must appear in order: brand, accessible colon, subtitle',
  );
  assert.equal(normalizeMarkupText(h1.innerHtml), expectedTitle);
  assert.equal(config.title, expectedTitle);
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
  const { segment: filmstripMarkup } = captureHeroFilmstrips(html);

  assert.doesNotMatch(filmstripMarkup, /<img\b/i, '.hero__filmstrips must stay decorative without img elements');
  assert.equal(
    countClassOccurrences(filmstripMarkup, 'hero__filmstrip-track'),
    4,
    'HTML must include exactly four hero filmstrip tracks',
  );
  assert.equal(
    countClassOccurrences(filmstripMarkup, 'hero__filmstrip-sheet'),
    8,
    'HTML must include exactly eight hero filmstrip sheets',
  );

  let combinedBytes = 0;

  for (const { modifier, publicPath } of expectedHeroFilmstripAssets) {
    const modifierMarkup = getModifierFilmstripSegment(filmstripMarkup, modifier);

    assert.equal(
      countClassOccurrences(modifierMarkup, 'hero__filmstrip-track'),
      1,
      `.hero__filmstrip--${modifier} must contain exactly one nested track`,
    );
    assert.equal(
      countTagClassOccurrences(modifierMarkup, 'span', 'hero__filmstrip-sheet'),
      2,
      `.hero__filmstrip--${modifier} must contain exactly two sheet spans`,
    );
    assertLocalDocsFile(publicPath, `hero ${modifier} filmstrip`);
    combinedBytes += fs.statSync(path.resolve(docsRoot, publicPath)).size;
    assertModifierSheetBackground(css, modifier, publicPath);
  }

  assert.ok(
    combinedBytes <= 2.5 * 1024 * 1024,
    'combined hero filmstrip assets must stay at or below 2.5 MiB',
  );
});

test('hero filmstrip motion is slow, staggered, reduced-motion safe, and printable', () => {
  const { css } = readRequiredFiles();
  const generatorPath = absolutePath('scripts/prepare-hero-filmstrips.sh');

  for (const { modifier, duration, direction } of expectedHeroFilmstripAssets) {
    assertModifierTrackMotion(css, modifier, duration, direction);
  }

  assertSourceMatch(
    css,
    /@keyframes\s+hero-filmstrip-scroll\b/,
    'CSS must define @keyframes hero-filmstrip-scroll for filmstrip motion',
  );

  const reducedMotionCss = findCssAtRuleBlock(
    css,
    /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/,
    'CSS must define @media (prefers-reduced-motion: reduce)',
  );
  const reducedMotionTrackRule = findCssRule(
    reducedMotionCss,
    (selector) => selectorHasClass(selector, 'hero__filmstrip-track'),
    'reduced-motion CSS must target .hero__filmstrip-track',
  );
  assertSourceMatch(
    reducedMotionTrackRule.body,
    /\banimation\s*:\s*none(?:\s*!important)?\b/,
    'reduced-motion .hero__filmstrip-track rule must set animation: none',
  );

  const printCss = findCssAtRuleBlock(css, /@media\s+print\b/, 'CSS must define @media print');
  const printFilmstripRule = findCssRule(
    printCss,
    (selector) => selectorHasClass(selector, 'hero__filmstrips'),
    'print CSS must target .hero__filmstrips',
  );
  assertSourceMatch(
    printFilmstripRule.body,
    /\bdisplay\s*:\s*none\b/,
    'print .hero__filmstrips rule must set display: none',
  );

  assert.ok(
    fs.existsSync(generatorPath),
    'scripts/prepare-hero-filmstrips.sh must exist as the reproducible generator',
  );

  const generator = fs.readFileSync(generatorPath, 'utf8');
  assert.match(
    generator,
    /^#!\/usr\/bin\/env bash\r?\n/,
    'scripts/prepare-hero-filmstrips.sh must use a Bash shebang',
  );
  assert.match(
    generator,
    /\bset\s+-euo\s+pipefail\b/,
    'scripts/prepare-hero-filmstrips.sh must enable set -euo pipefail',
  );

  for (const token of [
    'generated_reference_images',
    'keyframe_images',
    'cup-tray',
    'open-box',
    'drawer-object',
    'small-box',
  ]) {
    assert.match(
      generator,
      new RegExp(escapeRegExp(token)),
      `scripts/prepare-hero-filmstrips.sh must mention source token ${token}`,
    );
  }

  assert.match(generator, /\bffmpeg\b/, 'scripts/prepare-hero-filmstrips.sh must invoke ffmpeg');
  assert.match(generator, /\bcwebp\b/, 'scripts/prepare-hero-filmstrips.sh must invoke cwebp');
  assert.doesNotMatch(
    generator,
    /\blibwebp\b/,
    'scripts/prepare-hero-filmstrips.sh must not require libwebp directly',
  );
  assert.doesNotMatch(
    generator,
    /\/Users\//,
    'scripts/prepare-hero-filmstrips.sh must not contain local /Users/ paths',
  );
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
