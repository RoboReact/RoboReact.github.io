#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const docsRoot = path.join(repositoryRoot, 'docs');
const ffprobeMaxBuffer = 1024 * 1024;
const ffprobeVersionTimeoutMs = 15_000;
const ffprobeFileTimeoutMs = 30_000;

const expectedTitle =
  'RoboReact: Agentic Skill Distillation from Generated Egocentric Videos for Generalizable Whole-Body Manipulation';

const expectedReleaseAuthors = [
  { name: 'Shuliang He', affiliations: [1, 2] },
  { name: 'Shuai Wang', affiliations: [2] },
  { name: 'Bo Yue', affiliations: [1] },
  { name: 'Junchi Teng', affiliations: [2, 3] },
  { name: 'Changyu Wang', affiliations: [2] },
  { name: 'Guiliang Liu', affiliations: [1], corresponding: true },
];

const expectedReleaseAffiliations = [
  {
    id: 1,
    name: 'The Chinese University of Hong Kong, Shenzhen',
    logo: './assets/images/affiliations/cuhk-shenzhen.png',
    logoAlt: 'The Chinese University of Hong Kong, Shenzhen emblem',
    logoWidth: 145,
    logoHeight: 145,
  },
  {
    id: 2,
    name: 'JD Technology',
    logo: './assets/images/affiliations/jd-technology.svg',
    logoAlt: 'JD Technology logo',
    logoWidth: 313,
    logoHeight: 134,
  },
  {
    id: 3,
    name: 'Tsinghua University',
    logo: './assets/images/affiliations/tsinghua-university.jpg',
    logoAlt: 'Tsinghua University emblem',
    logoWidth: 260,
    logoHeight: 260,
  },
];
const expectedAffiliationLogoPaths = expectedReleaseAffiliations.map(
  (affiliation) => `docs/${affiliation.logo.replace(/^\.\//, '')}`,
);

const expectedVideos = [
  ['highlight-pour-water', 'featured'],
  ['main-hand-over', 'main'],
  ['main-open-box', 'main'],
  ['main-pour-water', 'main'],
  ['main-open-drawer', 'main'],
  ['cross-object-open-box-01', 'crossObject'],
  ['cross-object-open-box-02', 'crossObject'],
  ['cross-object-open-box-03', 'crossObject'],
  ['cross-object-open-box-04', 'crossObject'],
  ['cross-object-open-box-05', 'crossObject'],
  ['cross-object-open-drawer', 'crossObject'],
  ['varied-pose-pour-water-01', 'variedPose'],
  ['varied-pose-pour-water-02', 'variedPose'],
  ['varied-pose-open-drawer', 'variedPose'],
  ['squat-pour-water-01', 'squat'],
  ['squat-pour-water-02', 'squat'],
];

const expectedCategoryCounts = {
  featured: 1,
  main: 4,
  crossObject: 6,
  variedPose: 3,
  squat: 2,
};

const expectedHeroStrips = new Map([
  ['docs/assets/images/hero/sequence-cup-tray.webp', [320, 6000]],
  ['docs/assets/images/hero/sequence-open-box.webp', [320, 5600]],
  ['docs/assets/images/hero/sequence-drawer-object.webp', [320, 6000]],
  ['docs/assets/images/hero/sequence-small-box.webp', [320, 6000]],
]);

const heroStripBudgetBytes = Math.floor(2.5 * 1024 * 1024);

const requiredFiles = [
  'docs/index.html',
  'docs/.nojekyll',
  'docs/favicon.svg',
  'docs/assets/css/styles.css',
  'docs/assets/js/config.js',
  'docs/assets/js/main.js',
  'docs/assets/images/teaser.webp',
  'docs/assets/images/pipeline.webp',
  'docs/assets/images/affiliations/cuhk-shenzhen.png',
  'docs/assets/images/affiliations/jd-technology.svg',
  'docs/assets/images/affiliations/tsinghua-university.jpg',
  ...expectedHeroStrips.keys(),
];

const textExtensions = new Set([
  '.css',
  '.html',
  '.htm',
  '.js',
  '.json',
  '.svg',
  '.txt',
  '.xml',
]);

const errors = [];
let forbiddenArtifactCount = 0;
let videos = [];
let autoplayCount = 0;
let videoFiles = [];
let posterFiles = [];
let figureFiles = [];
let heroStripFiles = [];

function addError(message, isForbiddenArtifact = false) {
  errors.push(message);
  if (isForbiddenArtifact) {
    forbiddenArtifactCount += 1;
  }
}

function runCheck(label, callback) {
  try {
    callback();
  } catch (error) {
    addError(`${label}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function fromRepository(relativePath) {
  return path.join(repositoryRoot, ...relativePath.split('/'));
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function isRegularNonemptyFile(absolutePath, label) {
  if (!fs.existsSync(absolutePath)) {
    addError(`${label} is missing`);
    return false;
  }

  const stat = fs.lstatSync(absolutePath);
  if (!stat.isFile() || stat.isSymbolicLink()) {
    addError(`${label} must be a regular file`);
    return false;
  }
  if (stat.size === 0) {
    addError(`${label} must not be empty`);
    return false;
  }
  return true;
}

function inspectPublishTree() {
  if (!fs.existsSync(docsRoot)) {
    addError('docs/ is missing');
    return [];
  }

  const docsStat = fs.lstatSync(docsRoot);
  if (docsStat.isSymbolicLink() || !docsStat.isDirectory()) {
    addError('docs/ must be a real directory, not a symlink');
    return [];
  }

  const files = [];

  function visit(directory, relativeDirectory) {
    const names = fs.readdirSync(directory).sort((left, right) => left.localeCompare(right, 'en'));

    for (const name of names) {
      const absolutePath = path.join(directory, name);
      const relativePath = `${relativeDirectory}/${name}`;
      const normalizedPath = toPosix(relativePath);
      const stat = fs.lstatSync(absolutePath);
      const segments = normalizedPath.split('/');

      if (stat.isSymbolicLink()) {
        addError(`publish tree contains a symlink: ${normalizedPath}`, true);
        continue;
      }

      if (
        normalizedPath === 'docs/superpowers' ||
        normalizedPath.startsWith('docs/superpowers/') ||
        segments.includes('.omx') ||
        segments.includes('.superpowers')
      ) {
        addError(`publish tree contains a forbidden internal path: ${normalizedPath}`, true);
      }

      if (stat.isDirectory()) {
        visit(absolutePath, normalizedPath);
        continue;
      }

      if (!stat.isFile()) {
        addError(`publish tree contains a non-regular entry: ${normalizedPath}`, true);
        continue;
      }

      const extension = path.extname(name).toLowerCase();
      if (name === '.DS_Store') {
        addError(`publish tree contains .DS_Store: ${normalizedPath}`, true);
      }
      if (extension === '.pdf') {
        addError(`publish tree contains a PDF: ${normalizedPath}`, true);
      }
      if (extension === '.md' || extension === '.markdown') {
        addError(`publish tree contains Markdown: ${normalizedPath}`, true);
      }

      files.push(normalizedPath);
    }
  }

  visit(docsRoot, 'docs');
  return files;
}

function checkRequiredFiles() {
  for (const relativePath of requiredFiles) {
    const absolutePath = fromRepository(relativePath);
    if (!fs.existsSync(absolutePath)) {
      addError(`required publish file is missing: ${relativePath}`);
      continue;
    }
    const stat = fs.lstatSync(absolutePath);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      addError(`required publish file must be a regular file: ${relativePath}`);
    }
  }
}

function scanPublicText(files) {
  const forbiddenPatterns = [
    ['private source PDF filename', /RoboReact_Agentic_Skill_\.pdf/i],
    ['placeholder text TBD', /\bTBD\b/i],
    ['incorrect result +36.3', /\+36\.3/],
    ['review warning "anonymous submission"', /anonymous\s+submission/i],
    ['review warning "anonymized submission"', /anonymized\s+submission/i],
    ['review warning "strictly prohibited"', /strictly\s+prohibited/i],
    [
      'review warning "public sharing of this manuscript"',
      /public\s+sharing\s+of\s+this\s+manuscript/i,
    ],
    ['file URL', /file:\/\//i],
    ['macOS user filesystem path', /\/Users\//],
    ['Windows drive filesystem path', /(?:^|[\s"'(=])(?:[A-Za-z]:[\\/])/m],
  ];

  for (const relativePath of files) {
    const extension = path.extname(relativePath).toLowerCase();
    if (!textExtensions.has(extension)) {
      continue;
    }

    const source = fs.readFileSync(fromRepository(relativePath), 'utf8');
    for (const [description, pattern] of forbiddenPatterns) {
      if (pattern.test(source)) {
        addError(`${relativePath} contains forbidden ${description}`, true);
      }
    }
  }
}

function getAttribute(tag, attributeName) {
  const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(
    `\\b${escapedName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'=<>\u0060]+))`,
    'i',
  );
  const match = tag.match(pattern);
  return match ? (match[1] ?? match[2] ?? match[3]) : undefined;
}

function hasBooleanAttribute(tag, attributeName) {
  const escapedName = attributeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escapedName}(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?(?=\\s|/?>)`, 'i').test(
    tag,
  );
}

function validateExternalReference(reference) {
  if (/^https?:\/\//i.test(reference)) {
    try {
      const parsed = new URL(reference);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }
  if (/^mailto:/i.test(reference)) {
    return /^mailto:[^\s]+$/i.test(reference);
  }
  if (/^tel:/i.test(reference)) {
    return /^tel:[+()\d.\s-]+$/i.test(reference);
  }
  return false;
}

function isValidHttpsUrl(value) {
  if (typeof value !== 'string' || !/^https:\/\//i.test(value.trim())) {
    return false;
  }

  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function checkHtmlReferences(html) {
  const ids = new Set();
  const idPattern = /\bid\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"'=<>\u0060]+))/gi;
  let idMatch;
  while ((idMatch = idPattern.exec(html)) !== null) {
    ids.add(idMatch[1] ?? idMatch[2] ?? idMatch[3]);
  }

  const attributePattern = /\b(src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>\u0060]+))/gi;
  let match;
  while ((match = attributePattern.exec(html)) !== null) {
    const attributeName = match[1].toLowerCase();
    const reference = match[2] ?? match[3] ?? match[4] ?? '';
    const label = `${attributeName}="${reference}"`;

    if (!reference) {
      addError(`HTML contains an empty ${attributeName} reference`);
      continue;
    }

    if (reference.startsWith('#')) {
      const rawTarget = reference.slice(1);
      let target = rawTarget;
      try {
        target = decodeURIComponent(rawTarget);
      } catch {
        addError(`HTML contains an invalid encoded fragment: ${label}`);
        continue;
      }
      if (!target || !ids.has(target)) {
        addError(`HTML fragment does not resolve to an id: ${label}`);
      }
      continue;
    }

    if (validateExternalReference(reference)) {
      continue;
    }

    if (/^[a-z][a-z0-9+.-]*:/i.test(reference) || reference.startsWith('//')) {
      addError(`HTML contains a disallowed or invalid URL: ${label}`);
      continue;
    }
    if (reference.startsWith('/') || /^[A-Za-z]:[\\/]/.test(reference)) {
      addError(`HTML contains a root-relative or filesystem path: ${label}`);
      continue;
    }
    if (reference.includes('\\')) {
      addError(`HTML local references must use URL-style slashes: ${label}`);
      continue;
    }

    const hashIndex = reference.indexOf('#');
    const queryIndex = reference.indexOf('?');
    const endCandidates = [hashIndex, queryIndex].filter((index) => index >= 0);
    const pathEnd = endCandidates.length > 0 ? Math.min(...endCandidates) : reference.length;
    const encodedPath = reference.slice(0, pathEnd);
    let decodedPath = encodedPath;

    try {
      decodedPath = decodeURIComponent(encodedPath);
    } catch {
      addError(`HTML contains an invalid encoded local path: ${label}`);
      continue;
    }

    if (decodedPath.split('/').includes('..')) {
      addError(`HTML contains path traversal: ${label}`);
      continue;
    }

    const resolvedPath = path.resolve(docsRoot, decodedPath || 'index.html');
    if (!isInside(docsRoot, resolvedPath)) {
      addError(`HTML local reference escapes docs/: ${label}`);
      continue;
    }
    if (!fs.existsSync(resolvedPath) || !fs.lstatSync(resolvedPath).isFile()) {
      addError(`HTML local reference is missing: ${label}`);
      continue;
    }

    if (hashIndex >= 0 && path.basename(resolvedPath) === 'index.html') {
      const rawTarget = reference.slice(hashIndex + 1);
      let target = rawTarget;
      try {
        target = decodeURIComponent(rawTarget);
      } catch {
        addError(`HTML contains an invalid encoded fragment: ${label}`);
        continue;
      }
      if (!target || !ids.has(target)) {
        addError(`HTML fragment does not resolve to an id: ${label}`);
      }
    }
  }
}

function checkCssReferences(css) {
  const cssDirectory = path.join(docsRoot, 'assets/css');
  const urlPattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s]+))\s*\)/gi;
  let match;
  while ((match = urlPattern.exec(css)) !== null) {
    const reference = match[1] ?? match[2] ?? match[3] ?? '';

    if (!reference) {
      addError('CSS contains an empty url() reference');
      continue;
    }

    let decodedReference;
    try {
      decodedReference = decodeURIComponent(reference);
    } catch {
      addError(`CSS contains an invalid encoded asset URL: url(${reference})`);
      continue;
    }

    if (decodedReference.startsWith('#')) {
      const fragment = decodedReference.slice(1);
      if (!fragment || /[\s\\]/.test(fragment)) {
        addError(`CSS contains an invalid fragment-only URL: url(${reference})`);
      }
      continue;
    }

    if (/^[a-z][a-z0-9+.-]*:/i.test(decodedReference)) {
      addError(`CSS contains a disallowed URL scheme: url(${reference})`);
      continue;
    }
    if (decodedReference.startsWith('//')) {
      addError(`CSS contains a protocol-relative asset URL: url(${reference})`);
      continue;
    }
    if (decodedReference.startsWith('/') || /^[A-Za-z]:[\\/]/.test(decodedReference)) {
      addError(`CSS contains a root-relative or filesystem asset path: url(${reference})`);
      continue;
    }
    if (decodedReference.includes('\\')) {
      addError(`CSS asset URLs must use URL-style slashes: url(${reference})`);
      continue;
    }

    const localPath = decodedReference.split(/[?#]/, 1)[0];
    if (!localPath) {
      addError(`CSS asset URL must name a local file: url(${reference})`);
      continue;
    }
    const resolvedPath = path.resolve(cssDirectory, localPath);
    if (!isInside(docsRoot, resolvedPath)) {
      addError(`CSS asset URL escapes docs/: url(${reference})`);
      continue;
    }
    if (!fs.existsSync(resolvedPath)) {
      addError(`CSS asset URL is missing: url(${reference})`);
      continue;
    }

    const stat = fs.lstatSync(resolvedPath);
    if (stat.isSymbolicLink() || !stat.isFile()) {
      addError(`CSS asset URL must resolve to a regular file: url(${reference})`);
    }
  }
}

function loadConfig() {
  const configPath = path.join(docsRoot, 'assets/js/config.js');
  if (!fs.existsSync(configPath)) {
    return null;
  }

  const source = fs.readFileSync(configPath, 'utf8');
  const wrapper =
    /^\s*globalThis\.ROBOREACT_CONFIG\s*=\s*JSON\.parse\(String\.raw`\r?\n([\s\S]*?)\r?\n`\);\s*$/;
  const match = source.match(wrapper);

  if (!match) {
    addError('config.js must contain only the declarative JSON.parse(String.raw`...`) wrapper');
    return null;
  }
  if (/`|\$\{/.test(match[1])) {
    addError('config.js JSON payload must not contain template syntax');
    return null;
  }

  try {
    return JSON.parse(match[1]);
  } catch (error) {
    addError(`config.js contains invalid JSON: ${error.message}`);
    return null;
  }
}

function requireExact(value, expected, label) {
  if (value !== expected) {
    addError(`${label} must be ${JSON.stringify(expected)}; received ${JSON.stringify(value)}`);
  }
}

function requireExactStructure(value, expected, label) {
  if (Array.isArray(expected)) {
    if (!Array.isArray(value)) {
      addError(`${label} must be an array`);
      return;
    }
    requireExact(value.length, expected.length, `${label}.length`);
    for (let index = 0; index < expected.length; index += 1) {
      requireExactStructure(value[index], expected[index], `${label}[${index}]`);
    }
    return;
  }

  if (expected && typeof expected === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      addError(`${label} must be an object`);
      return;
    }

    const actualKeys = Object.keys(value).sort();
    const expectedKeys = Object.keys(expected).sort();
    if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
      addError(`${label} keys must be ${expectedKeys.join(', ')}; received ${actualKeys.join(', ')}`);
    }
    for (const key of Object.keys(expected)) {
      requireExactStructure(value[key], expected[key], `${label}.${key}`);
    }
    return;
  }

  requireExact(value, expected, label);
}

function requireNonemptyString(value, label) {
  if (typeof value !== 'string' || value.trim() === '') {
    addError(`${label} must be a nonempty string`);
    return false;
  }
  return true;
}

function resolveConfigAsset(publicPath, label) {
  if (typeof publicPath !== 'string' || !publicPath.startsWith('./assets/')) {
    addError(`${label} must start with ./assets/`);
    return null;
  }
  if (publicPath.includes('\\') || publicPath.split('/').includes('..')) {
    addError(`${label} must not contain backslashes or path traversal`);
    return null;
  }

  const absolutePath = path.resolve(docsRoot, publicPath);
  if (!isInside(docsRoot, absolutePath)) {
    addError(`${label} must resolve inside docs/`);
    return null;
  }
  if (!fs.existsSync(absolutePath) || !fs.lstatSync(absolutePath).isFile()) {
    addError(`${label} does not resolve to a file: ${publicPath}`);
    return null;
  }
  return absolutePath;
}

function validateConfig(config) {
  if (!config) {
    return;
  }

  requireExact(config.title, expectedTitle, 'config.title');

  const release = config.release;
  if (!release || typeof release !== 'object' || Array.isArray(release)) {
    addError('config.release must be an object');
  } else {
    requireExactStructure(release.authors, expectedReleaseAuthors, 'config.release.authors');
    requireExactStructure(
      release.affiliations,
      expectedReleaseAffiliations,
      'config.release.affiliations',
    );
    for (const [index, affiliation] of expectedReleaseAffiliations.entries()) {
      resolveConfigAsset(affiliation.logo, `config.release.affiliations[${index}].logo`);
    }
    requireExact(release.venue, null, 'config.release.venue');
    requireExact(release.contact, null, 'config.release.contact');
    requireExact(release.bibtex, null, 'config.release.bibtex');

    if (!release.resources || typeof release.resources !== 'object') {
      addError('config.release.resources must be an object');
    } else {
      const expectedResources = {
        paper: null,
        arxiv: 'https://arxiv.org/pdf/2608.03387',
        code: null,
        dataset: null,
        supplementary: null,
      };

      for (const [resource, expectedValue] of Object.entries(expectedResources)) {
        if (release.resources[resource] !== null && !isValidHttpsUrl(release.resources[resource])) {
          addError(`config.release.resources.${resource} must be an HTTPS URL when present`);
        }
        requireExact(
          release.resources[resource],
          expectedValue,
          `config.release.resources.${resource}`,
        );
      }
    }
  }

  const results = config.results;
  if (!results || typeof results !== 'object') {
    addError('config.results must be an object');
  } else {
    requireExact(results.meanSuccessRate, 81.3, 'config.results.meanSuccessRate');
    requireExact(
      results.meanAverageCompletedLength,
      4.2,
      'config.results.meanAverageCompletedLength',
    );
    const rates = results.taskSuccessRates;
    if (!rates || typeof rates !== 'object') {
      addError('config.results.taskSuccessRates must be an object');
    } else {
      requireExact(rates.handOver, 85, 'config.results.taskSuccessRates.handOver');
      requireExact(rates.openBox, 70, 'config.results.taskSuccessRates.openBox');
      requireExact(rates.pourWater, 85, 'config.results.taskSuccessRates.pourWater');
      requireExact(rates.openDrawer, 85, 'config.results.taskSuccessRates.openDrawer');
    }

    requireExactStructure(
      results.taskResults,
      [
        { method: 'ReKep', handOver: 35, openBox: 15, pourWater: 40, openDrawer: 20 },
        { method: 'YOTO', handOver: 75, openBox: 65, pourWater: 80, openDrawer: 75 },
        {
          method: 'One-Shot Real Prior',
          handOver: 85,
          openBox: 70,
          pourWater: 80,
          openDrawer: 85,
        },
        { method: 'RoboReact', handOver: 85, openBox: 70, pourWater: 85, openDrawer: 85 },
      ],
      'config.results.taskResults',
    );
    requireExactStructure(
      results.refinement,
      {
        rounds: [0, 5, 10, 15],
        handOverAverageLength: [0.08, 2.31, 3.77, 4.69],
        pourWaterAverageLength: [0.54, 2.23, 4.15, 5.38],
        terminalCompletionsAt15: { handOver: '11/13', pourWater: '11/13' },
      },
      'config.results.refinement',
    );
    requireExactStructure(
      results.editorAt15Rounds,
      {
        mini: {
          name: '5.1-mini',
          pourWater: { successRate: 69.2, averageLength: 4.54 },
          openBox: { successRate: 53.8, averageLength: 2.46 },
        },
        ultra: {
          name: '5.6-ultra',
          pourWater: { successRate: 84.6, averageLength: 5.38 },
          openBox: { successRate: 76.9, averageLength: 3.23 },
        },
      },
      'config.results.editorAt15Rounds',
    );
    requireExactStructure(
      results.ablationAverageLength,
      {
        withoutKeyframeSelection: 3.69,
        withoutMemory: 3.92,
        withoutThirdPerson: 4.77,
        full: 5.62,
      },
      'config.results.ablationAverageLength',
    );
    requireExactStructure(
      results.videoGenerator,
      {
        seedance15: {
          name: 'Seedance 1.5 Pro',
          pourWater: { successRate: 84.6, averageLength: 5.23 },
          openDrawer: { successRate: 69.2, averageLength: 3.0 },
        },
        seedance20: {
          name: 'Seedance 2.0',
          pourWater: { successRate: 92.3, averageLength: 5.62 },
          openDrawer: { successRate: 84.6, averageLength: 3.54 },
        },
      },
      'config.results.videoGenerator',
    );
    requireExactStructure(
      results.robustness,
      {
        averageLengthByCase: [5.23, 5.54, 6.15, 6.54],
        terminalCompletionsByCase: ['9/13', '10/13', '11/13', '12/13'],
        retainedNominalLength: '80–94%',
      },
      'config.results.robustness',
    );
  }

  if (!Array.isArray(config.videos)) {
    addError('config.videos must be an array');
    return;
  }
  videos = config.videos;
  requireExact(videos.length, 16, 'config.videos.length');

  const configuredIds = videos.map((video) => video?.id);
  const expectedIds = expectedVideos.map(([id]) => id);
  if (JSON.stringify(configuredIds) !== JSON.stringify(expectedIds)) {
    addError(`config video IDs must exactly match: ${expectedIds.join(', ')}`);
  }

  for (const property of ['id', 'src', 'poster']) {
    const values = videos.map((video) => video?.[property]);
    if (values.some((value) => typeof value !== 'string' || value.trim() === '')) {
      addError(`every config video must have a nonempty ${property}`);
    }
    if (new Set(values).size !== values.length) {
      addError(`config video ${property} values must be unique`);
    }
  }

  const categoryCounts = Object.fromEntries(Object.keys(expectedCategoryCounts).map((key) => [key, 0]));

  for (let index = 0; index < videos.length; index += 1) {
    const video = videos[index];
    if (!video || typeof video !== 'object' || Array.isArray(video)) {
      addError(`config.videos[${index}] must be an object`);
      continue;
    }

    const id = typeof video.id === 'string' && video.id ? video.id : `index ${index}`;
    for (const property of ['title', 'caption', 'accessibleLabel', 'category', 'speedLabel']) {
      requireNonemptyString(video[property], `${id}.${property}`);
    }

    const expectedEntry = expectedVideos[index];
    if (expectedEntry) {
      requireExact(video.id, expectedEntry[0], `config.videos[${index}].id`);
      requireExact(video.category, expectedEntry[1], `${id}.category`);
      requireExact(video.src, `./assets/videos/${expectedEntry[0]}.mp4`, `${id}.src`);
      requireExact(
        video.poster,
        `./assets/images/posters/${expectedEntry[0]}.webp`,
        `${id}.poster`,
      );
    }

    if (Object.hasOwn(categoryCounts, video.category)) {
      categoryCounts[video.category] += 1;
    } else {
      addError(`${id}.category is not a recognized category`);
    }

    resolveConfigAsset(video.src, `${id}.src`);
    resolveConfigAsset(video.poster, `${id}.poster`);

    const expectedSpeed =
      video.id === 'highlight-pour-water'
        ? '10x'
        : video.id === 'cross-object-open-drawer'
          ? '2x'
          : '5x';
    const normalizedSpeed =
      typeof video.speedLabel === 'string'
        ? video.speedLabel.replaceAll('×', 'x').replaceAll(/\s/g, '').toLowerCase()
        : '';
    requireExact(normalizedSpeed, expectedSpeed, `${id}.speedLabel`);

    requireExact(video.autoplay, video.id === 'highlight-pour-water', `${id}.autoplay`);
    requireExact(video.loop, true, `${id}.loop`);
    requireExact(video.muted, true, `${id}.muted`);
  }

  for (const [category, expectedCount] of Object.entries(expectedCategoryCounts)) {
    requireExact(categoryCounts[category], expectedCount, `video category count for ${category}`);
  }

  autoplayCount = videos.filter((video) => video?.autoplay === true).length;
  requireExact(autoplayCount, 1, 'autoplay video count');
}

function comparePathSets(actualPaths, expectedPaths, label) {
  const actual = new Set(actualPaths);
  const expected = new Set(expectedPaths);

  for (const relativePath of expected) {
    if (!actual.has(relativePath)) {
      addError(`${label} is missing mapped file: ${relativePath}`);
    }
  }
  for (const relativePath of actual) {
    if (!expected.has(relativePath)) {
      addError(`${label} contains an unmapped extra: ${relativePath}`);
    }
  }
}

function validateMediaTree(files) {
  const allVideoDirectoryFiles = files.filter((relativePath) =>
    relativePath.startsWith('docs/assets/videos/'),
  );
  const allPosterDirectoryFiles = files.filter((relativePath) =>
    relativePath.startsWith('docs/assets/images/posters/'),
  );
  const allHeroDirectoryFiles = files.filter((relativePath) =>
    relativePath.startsWith('docs/assets/images/hero/'),
  );
  const allAffiliationDirectoryFiles = files.filter((relativePath) =>
    relativePath.startsWith('docs/assets/images/affiliations/'),
  );
  const allImageFiles = files.filter((relativePath) =>
    relativePath.startsWith('docs/assets/images/'),
  );

  videoFiles = allVideoDirectoryFiles.filter(
    (relativePath) => path.extname(relativePath).toLowerCase() === '.mp4',
  );
  posterFiles = allPosterDirectoryFiles.filter(
    (relativePath) => path.extname(relativePath).toLowerCase() === '.webp',
  );
  figureFiles = allImageFiles.filter(
    (relativePath) =>
      path.dirname(relativePath) === 'docs/assets/images' &&
      path.extname(relativePath).toLowerCase() === '.webp',
  );
  heroStripFiles = allHeroDirectoryFiles.filter(
    (relativePath) => path.extname(relativePath).toLowerCase() === '.webp',
  );

  requireExact(videoFiles.length, 16, 'MP4 count under docs/assets/videos');
  requireExact(posterFiles.length, 16, 'WebP poster count under docs/assets/images/posters');
  requireExact(figureFiles.length, 2, 'top-level WebP figure count under docs/assets/images');
  requireExact(heroStripFiles.length, 4, 'hero WebP strip count under docs/assets/images/hero');

  const expectedVideoPaths = videos
    .filter((video) => typeof video?.src === 'string')
    .map((video) => `docs/${video.src.replace(/^\.\//, '')}`);
  const expectedPosterPaths = videos
    .filter((video) => typeof video?.poster === 'string')
    .map((video) => `docs/${video.poster.replace(/^\.\//, '')}`);
  const expectedFigurePaths = [
    'docs/assets/images/pipeline.webp',
    'docs/assets/images/teaser.webp',
  ];
  const expectedHeroPaths = [...expectedHeroStrips.keys()];

  comparePathSets(videoFiles, expectedVideoPaths, 'video directory');
  comparePathSets(posterFiles, expectedPosterPaths, 'poster directory');
  comparePathSets(figureFiles, expectedFigurePaths, 'figure directory');
  comparePathSets(heroStripFiles, expectedHeroPaths, 'hero directory');
  comparePathSets(
    allVideoDirectoryFiles,
    expectedVideoPaths,
    'video directory contents',
  );
  comparePathSets(
    allPosterDirectoryFiles,
    expectedPosterPaths,
    'poster directory contents',
  );
  comparePathSets(
    allHeroDirectoryFiles,
    expectedHeroPaths,
    'hero directory contents',
  );
  comparePathSets(
    allAffiliationDirectoryFiles,
    expectedAffiliationLogoPaths,
    'affiliation logo directory contents',
  );
  comparePathSets(
    allImageFiles,
    [
      ...expectedPosterPaths,
      ...expectedFigurePaths,
      ...expectedHeroPaths,
      ...expectedAffiliationLogoPaths,
    ],
    'image directory contents',
  );

  let heroStripBytes = 0;
  for (const relativePath of [
    ...videoFiles,
    ...posterFiles,
    ...figureFiles,
    ...heroStripFiles,
    ...expectedAffiliationLogoPaths,
  ]) {
    isRegularNonemptyFile(fromRepository(relativePath), relativePath);
  }
  for (const relativePath of heroStripFiles) {
    heroStripBytes += fs.statSync(fromRepository(relativePath)).size;
  }
  if (heroStripBytes > heroStripBudgetBytes) {
    addError(
      `hero WebP strips exceed ${heroStripBudgetBytes} byte budget: ${heroStripBytes} bytes`,
    );
  }
}

function validateMediaEncoding() {
  if (videos.length === 0) {
    return;
  }

  const ffprobe = process.env.FFPROBE?.trim() || 'ffprobe';
  const version = spawnSync(ffprobe, ['-version'], {
    encoding: 'utf8',
    timeout: ffprobeVersionTimeoutMs,
    maxBuffer: ffprobeMaxBuffer,
    shell: false,
  });
  if (version.error?.code === 'ETIMEDOUT') {
    addError(
      `ffprobe version check timed out (ETIMEDOUT after ${ffprobeVersionTimeoutMs} ms): ${ffprobe}`,
    );
    return;
  }
  if (version.error) {
    addError(
      `ffprobe prerequisite is unavailable (${ffprobe}): ${version.error.message}. Install ffprobe or set FFPROBE to its executable path.`,
    );
    return;
  }
  if (version.status !== 0) {
    addError(
      `ffprobe prerequisite failed (${ffprobe}, exit ${version.status}): ${(version.stderr || version.stdout || '').trim()}`,
    );
    return;
  }

  for (const video of videos) {
    if (!video || typeof video.src !== 'string') {
      continue;
    }
    const absolutePath = resolveConfigAsset(video.src, `${video.id || 'unknown video'}.src for ffprobe`);
    if (!absolutePath) {
      continue;
    }

    const result = spawnSync(
      ffprobe,
      [
        '-v',
        'error',
        '-show_entries',
        'stream=index,codec_type,codec_name,pix_fmt,profile',
        '-of',
        'json',
        absolutePath,
      ],
      {
        encoding: 'utf8',
        timeout: ffprobeFileTimeoutMs,
        maxBuffer: ffprobeMaxBuffer,
        shell: false,
      },
    );

    if (result.error?.code === 'ETIMEDOUT') {
      addError(
        `ffprobe timed out while inspecting ${video.id} (ETIMEDOUT after ${ffprobeFileTimeoutMs} ms)`,
      );
      continue;
    }
    if (result.error) {
      addError(`ffprobe could not inspect ${video.id}: ${result.error.message}`);
      continue;
    }
    if (result.status !== 0) {
      addError(`ffprobe failed for ${video.id}: ${(result.stderr || result.stdout || '').trim()}`);
      continue;
    }

    let payload;
    try {
      payload = JSON.parse(result.stdout);
    } catch (error) {
      addError(`ffprobe returned invalid JSON for ${video.id}: ${error.message}`);
      continue;
    }

    const streams = Array.isArray(payload.streams) ? payload.streams : [];
    const videoStreams = streams.filter((stream) => stream.codec_type === 'video');
    const audioStreams = streams.filter((stream) => stream.codec_type === 'audio');
    requireExact(videoStreams.length, 1, `${video.id} video stream count`);
    requireExact(audioStreams.length, 0, `${video.id} audio stream count`);

    if (videoStreams.length === 1) {
      requireExact(videoStreams[0].codec_name, 'h264', `${video.id} codec`);
      requireExact(videoStreams[0].pix_fmt, 'yuv420p', `${video.id} pixel format`);
      requireExact(videoStreams[0].profile, 'High', `${video.id} H.264 profile`);
    }
  }

  for (const [relativePath, [expectedWidth, expectedHeight]] of expectedHeroStrips) {
    const absolutePath = fromRepository(relativePath);
    const result = spawnSync(
      ffprobe,
      [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=codec_type,codec_name,width,height',
        '-of',
        'json',
        absolutePath,
      ],
      {
        encoding: 'utf8',
        timeout: ffprobeFileTimeoutMs,
        maxBuffer: ffprobeMaxBuffer,
        shell: false,
      },
    );

    if (result.error?.code === 'ETIMEDOUT') {
      addError(
        `ffprobe timed out while inspecting ${relativePath} (ETIMEDOUT after ${ffprobeFileTimeoutMs} ms)`,
      );
      continue;
    }
    if (result.error) {
      addError(`ffprobe could not inspect ${relativePath}: ${result.error.message}`);
      continue;
    }
    if (result.status !== 0) {
      addError(`ffprobe failed for ${relativePath}: ${(result.stderr || result.stdout || '').trim()}`);
      continue;
    }

    let payload;
    try {
      payload = JSON.parse(result.stdout);
    } catch (error) {
      addError(`ffprobe returned invalid JSON for ${relativePath}: ${error.message}`);
      continue;
    }

    const streams = Array.isArray(payload.streams) ? payload.streams : [];
    requireExact(streams.length, 1, `${relativePath} selected stream count`);
    if (streams.length === 1) {
      requireExact(streams[0].codec_type, 'video', `${relativePath} stream type`);
      requireExact(streams[0].codec_name, 'webp', `${relativePath} codec`);
      requireExact(streams[0].width, expectedWidth, `${relativePath} width`);
      requireExact(streams[0].height, expectedHeight, `${relativePath} height`);
    }
  }
}

function openingTags(html, tagName) {
  return html.match(new RegExp(`<${tagName}\\b[^>]*>`, 'gi')) ?? [];
}

function findOpeningTagWithAttribute(html, attributeName) {
  return (
    (html.match(new RegExp(`<[^>]+\\b${attributeName}(?:\\s*=|\\s|/?>)[^>]*>`, 'i')) ?? [])[0] ??
    null
  );
}

function validateHtmlStructure(html) {
  const links = openingTags(html, 'link');
  const iconLinks = links.filter((tag) => (getAttribute(tag, 'rel') || '').toLowerCase() === 'icon');
  requireExact(iconLinks.length, 1, 'HTML favicon link count');
  if (iconLinks.length === 1) {
    requireExact(getAttribute(iconLinks[0], 'href'), './favicon.svg', 'HTML favicon href');
    requireExact(getAttribute(iconLinks[0], 'type'), 'image/svg+xml', 'HTML favicon type');
  }

  const anchors = openingTags(html, 'a');
  const hasSkipLink = anchors.some((tag) => {
    const classes = (getAttribute(tag, 'class') || '').split(/\s+/);
    return classes.includes('skip-link') && getAttribute(tag, 'href') === '#main-content';
  });
  if (!hasSkipLink) {
    addError('HTML must include a skip link to #main-content');
  }

  requireExact(openingTags(html, 'main').length, 1, 'HTML <main> count');
  const h1Tags = openingTags(html, 'h1');
  requireExact(h1Tags.length, 1, 'HTML <h1> count');
  const h1Match = html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/i);
  if (h1Match) {
    if (!/\bhero__title-brand\b/.test(h1Match[0])) {
      addError('HTML <h1> must include .hero__title-brand');
    }
    if (!/\bhero__title-subtitle\b/.test(h1Match[0])) {
      addError('HTML <h1> must include .hero__title-subtitle');
    }
  }

  const heroFilmstripTags = openingTags(html, 'div').filter((tag) =>
    (getAttribute(tag, 'class') || '').split(/\s+/).includes('hero__filmstrips'),
  );
  requireExact(heroFilmstripTags.length, 1, 'HTML .hero__filmstrips count');
  if (heroFilmstripTags.length === 1) {
    requireExact(getAttribute(heroFilmstripTags[0], 'aria-hidden'), 'true', 'HTML .hero__filmstrips aria-hidden');
  }
  requireExact(
    (html.match(/\bhero__filmstrip-track\b/g) ?? []).length,
    4,
    'HTML hero filmstrip track count',
  );
  requireExact(
    (html.match(/\bhero__filmstrip-sheet\b/g) ?? []).length,
    8,
    'HTML hero filmstrip sheet count',
  );

  for (const id of ['featured', 'teaser', 'overview', 'method', 'videos', 'results']) {
    const section = openingTags(html, 'section').find((tag) => getAttribute(tag, 'id') === id);
    if (!section) {
      addError(`HTML must include semantic section #${id}`);
    }
  }

  const featuredIndex = html.indexOf('id="featured"');
  const teaserIndex = html.indexOf('id="teaser"');
  if (featuredIndex < 0 || teaserIndex < 0 || featuredIndex >= teaserIndex) {
    addError('HTML section #featured must appear before #teaser');
  }
  requireExact(
    (html.match(/data-video-category=["']featured["']/g) ?? []).length,
    1,
    'HTML featured video mount count',
  );

  const images = openingTags(html, 'img');
  requireExact(images.length, 2, 'HTML image count');
  for (const [index, image] of images.entries()) {
    const alt = getAttribute(image, 'alt');
    if (typeof alt !== 'string' || alt.trim() === '') {
      addError(`HTML image ${index + 1} must have nonempty alt text`);
    }
  }

  const tables = html.match(/<table\b[\s\S]*?<\/table>/gi) ?? [];
  if (tables.length === 0) {
    addError('HTML must include a results table');
  }
  for (const [index, table] of tables.entries()) {
    if (!/<caption\b[^>]*>[\s\S]*?<\/caption>/i.test(table)) {
      addError(`HTML table ${index + 1} must include a caption`);
    }
    const headers = openingTags(table, 'th');
    if (headers.length === 0) {
      addError(`HTML table ${index + 1} must include header cells`);
    }
    for (const header of headers) {
      if (!['col', 'row'].includes((getAttribute(header, 'scope') || '').toLowerCase())) {
        addError(`every table header must declare scope="col" or scope="row": ${header}`);
      }
    }
  }

  const metadataMount = findOpeningTagWithAttribute(html, 'data-release-metadata');
  const resourceMount = findOpeningTagWithAttribute(html, 'data-resource-links');
  const citationMount = findOpeningTagWithAttribute(html, 'data-citation-mount');
  const citationSection = openingTags(html, 'section').find(
    (tag) => getAttribute(tag, 'id') === 'citation',
  );

  if (!metadataMount || !hasBooleanAttribute(metadataMount, 'hidden')) {
    addError('release metadata mount must exist and be hidden by default');
  }
  if (!resourceMount || !hasBooleanAttribute(resourceMount, 'hidden')) {
    addError('resource link mount must exist and be hidden by default');
  }
  if (!citationMount || !citationSection || !hasBooleanAttribute(citationSection, 'hidden')) {
    addError('citation mount must exist inside a citation section hidden by default');
  }

  const configScriptIndex = html.search(
    /<script\b[^>]*\bsrc\s*=\s*(?:"[^"]*config\.js"|'[^']*config\.js')[^>]*>/i,
  );
  const mainScriptIndex = html.search(
    /<script\b[^>]*\bsrc\s*=\s*(?:"[^"]*main\.js"|'[^']*main\.js')[^>]*>/i,
  );
  if (configScriptIndex < 0 || mainScriptIndex < 0 || configScriptIndex >= mainScriptIndex) {
    addError('HTML must load config.js before main.js');
  }
}

function validateCss(css) {
  if (!/:focus-visible\b/.test(css)) {
    addError('CSS must provide visible :focus-visible styles');
  }
  if (!/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/i.test(css)) {
    addError('CSS must include a prefers-reduced-motion: reduce media query');
  }
  if (!/min-(?:height|width)\s*:\s*(?:44px|2\.75rem)\b/i.test(css)) {
    addError('CSS must declare at least one 44px-equivalent interactive target size');
  }
  if (!/[^{}]*video[^{}]*\{[^{}]*object-fit\s*:\s*contain\b[^{}]*\}/i.test(css)) {
    addError('CSS must use object-fit: contain for video media');
  }
  if (!/\.table-region\s*\{[^{}]*overflow-x\s*:\s*(?:auto|scroll)\b[^{}]*\}/i.test(css)) {
    addError('CSS must horizontally contain overflowing result tables');
  }
  if (!/\.mobile-nav\s*\{[^{}]*overflow-x\s*:\s*(?:auto|scroll)\b[^{}]*\}/i.test(css)) {
    addError('CSS must horizontally contain the mobile navigation');
  }
  if (!/\.mobile-nav\s*\{[^{}]*overscroll-behavior-inline\s*:\s*contain\b[^{}]*\}/i.test(css)) {
    addError('CSS mobile navigation must contain horizontal overscroll');
  }

  const requiredPatterns = [
    ['hero filmstrip keyframes', /@keyframes\s+hero-filmstrip-scroll\b/i],
    ['cup-tray hero strip filename', /sequence-cup-tray\.webp/],
    ['open-box hero strip filename', /sequence-open-box\.webp/],
    ['drawer-object hero strip filename', /sequence-drawer-object\.webp/],
    ['small-box hero strip filename', /sequence-small-box\.webp/],
    ['72s hero track duration', /animation-duration\s*:\s*72s\b/],
    ['84s hero track duration', /animation-duration\s*:\s*84s\b/],
    ['78s hero track duration', /animation-duration\s*:\s*78s\b/],
    ['96s hero track duration', /animation-duration\s*:\s*96s\b/],
    ['reverse hero track direction', /animation-direction\s*:\s*reverse\b/],
    [
      'reduced-motion hero track fallback',
      /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)[\s\S]*\.hero__filmstrip-track\s*\{[\s\S]*animation\s*:\s*none(?:\s*!important)?\b/i,
    ],
    [
      'print hero filmstrip fallback',
      /@media\s+print\b[\s\S]*\.hero__filmstrips[\s\S]*display\s*:\s*none(?:\s*!important)?\b/i,
    ],
  ];

  for (const [label, pattern] of requiredPatterns) {
    if (!pattern.test(css)) {
      addError(`CSS is missing ${label}`);
    }
  }
}

function validateMainScript(mainSource) {
  const requiredPatterns = [
    ['safe text insertion through textContent', /\btextContent\b/],
    ['IntersectionObserver-based lazy behavior', /\bIntersectionObserver\b/],
    ['dataset-backed lazy video source', /\bdataset\.src\b/],
    ['lazy video preload policy', /\bpreload\s*=\s*['"]none['"]/],
    ['explicit media load after lazy attachment', /\.load\s*\(\s*\)/],
    ['native video controls', /\.controls\s*=\s*true\b/],
    ['inline mobile playback', /(?:\.playsInline\s*=\s*true\b|['"]playsinline['"])/],
    ['poster assignment', /\.poster\s*=/],
    ['video error listener', /addEventListener\s*\(\s*['"]error['"]/],
    ['accessible error status', /setAttribute\s*\(\s*['"]role['"]\s*,\s*['"]status['"]\s*\)/],
    [
      'reduced-motion preference query',
      /matchMedia\s*\(\s*['"]\(prefers-reduced-motion:\s*reduce\)['"]\s*\)/,
    ],
    ['active navigation aria-current', /['"]aria-current['"]/],
    ['BibTeX release hook', /\brelease\.bibtex\b/],
    ['citation copy hook', /\bdataset\.copyCitation\b/],
    ['clipboard copy support', /navigator\?*\.clipboard\?*\.writeText|navigator\.clipboard\.writeText/],
    ['HTTPS-only resource URL helper', /\bfunction\s+safeHttpsUrl\s*\(/],
    ['HTTPS-only prefix check', /\^https:\\\/\\\//],
    ['parsed HTTPS protocol check', /\bparsed\.protocol\s*===\s*['"]https:['"]/],
  ];

  if (/playbackRate/i.test(mainSource)) {
    addError('main.js must not contain the media-speed mutation identifier playbackRate');
  }
  if (/\.innerHTML\b/.test(mainSource)) {
    addError('main.js must not use innerHTML');
  }
  if (/\bdocument\.write\s*\(/.test(mainSource)) {
    addError('main.js must not use document.write');
  }
  if (/(?:^|[^.$\w])eval\s*\(/m.test(mainSource)) {
    addError('main.js must not use eval');
  }
  if (/\^https\?:\\\/\\\//.test(mainSource)) {
    addError('main.js must not allow http:// release resource prefixes');
  }
  if (/\bparsed\.protocol\s*===\s*['"]http:['"]/.test(mainSource)) {
    addError('main.js must not accept parsed http: release resource URLs');
  }

  for (const [label, pattern] of requiredPatterns) {
    if (!pattern.test(mainSource)) {
      addError(`main.js is missing ${label}`);
    }
  }
}

const publishFiles = inspectPublishTree();
runCheck('required files', checkRequiredFiles);
runCheck('public text scan', () => scanPublicText(publishFiles));

let html = '';
let css = '';
let mainSource = '';
runCheck('read public sources', () => {
  html = fs.readFileSync(path.join(docsRoot, 'index.html'), 'utf8');
  css = fs.readFileSync(path.join(docsRoot, 'assets/css/styles.css'), 'utf8');
  mainSource = fs.readFileSync(path.join(docsRoot, 'assets/js/main.js'), 'utf8');
});

if (html) {
  runCheck('HTML references', () => checkHtmlReferences(html));
  runCheck('HTML structure', () => validateHtmlStructure(html));
}
if (css) {
  runCheck('CSS references', () => checkCssReferences(css));
  runCheck('CSS behavior', () => validateCss(css));
}
if (mainSource) {
  runCheck('main.js behavior', () => validateMainScript(mainSource));
}

let config = null;
runCheck('config evaluation', () => {
  config = loadConfig();
});
runCheck('config contract', () => validateConfig(config));
runCheck('media tree', () => validateMediaTree(publishFiles));
runCheck('media encoding', validateMediaEncoding);

if (errors.length > 0) {
  console.error(`Site validation failed with ${errors.length} error${errors.length === 1 ? '' : 's'}:`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Validation passed: ${videoFiles.length} videos, ${posterFiles.length} posters, ${figureFiles.length} figures, ${heroStripFiles.length} hero strips, ${autoplayCount} autoplay, ${forbiddenArtifactCount} forbidden artifacts.`,
  );
}
