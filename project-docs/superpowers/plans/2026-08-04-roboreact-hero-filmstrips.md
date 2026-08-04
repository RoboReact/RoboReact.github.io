# RoboReact Cinematic Hero Filmstrips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the oversized white RoboReact hero with the approved centered two-level title and four accessible, slowly scrolling cinematic filmstrips derived from the supplied human-reference and robot-keyframe sequences.

**Architecture:** Four reproducibly generated tall WebP assets live under the public hero-image directory. A purely decorative, `aria-hidden` HTML layer renders each asset twice as CSS-backed sheets; CSS translates the two-sheet tracks for seamless, staggered loops while the semantic hero content remains above a dark contrast veil. No runtime JavaScript or external font is added.

**Tech Stack:** Static HTML5, CSS, Bash, FFmpeg/ffprobe 4.2.2, cwebp 1.6.0, WebP, Node.js 24 built-in test runner, existing repository validator, GitHub Pages from `docs/`.

---

## File Structure

- Create `scripts/prepare-hero-filmstrips.sh`: validate the four source folders, interleave matched generated/keyframe PNGs into temporary PNG montages with FFmpeg, and atomically encode four tall WebPs with `cwebp`.
- Create `docs/assets/images/hero/sequence-cup-tray.webp`: 15 interleaved pairs, `320 × 6000`.
- Create `docs/assets/images/hero/sequence-open-box.webp`: 14 interleaved pairs, `320 × 5600`.
- Create `docs/assets/images/hero/sequence-drawer-object.webp`: 15 interleaved pairs, `320 × 6000`.
- Create `docs/assets/images/hero/sequence-small-box.webp`: 15 interleaved pairs, `320 × 6000`.
- Modify `docs/index.html`: add the decorative four-column layer and replace the duplicate wordmark/heading with one accessible two-level `<h1>`.
- Modify `docs/assets/css/styles.css`: implement the dark hero, Avenir-style title hierarchy, filmstrip motion, future release-node styling, responsive behavior, reduced motion, and print fallback.
- Modify `tests/site.test.mjs`: add title, filmstrip, generator, asset, and CSS contracts.
- Modify `scripts/validate-site.mjs`: allow safe parent-relative CSS assets, map the four exact hero strips, enforce size/dimensions/codec, and keep the existing figure count distinct.
- Modify `README.md`: document hero-strip regeneration and the four additional public assets.
- Preserve `docs/assets/js/config.js` and `docs/assets/js/main.js`; the hero requires no runtime data or JavaScript changes.

### Task 1: Add the Hero Contract Tests

**Files:**

- Modify: `tests/site.test.mjs:8-165`
- Modify: `tests/site.test.mjs:232-292`

- [ ] **Step 1: Add expected hero paths and markup-normalization helpers**

Add after `expectedTitle`:

```js
const expectedHeroStrips = [
  './assets/images/hero/sequence-cup-tray.webp',
  './assets/images/hero/sequence-open-box.webp',
  './assets/images/hero/sequence-drawer-object.webp',
  './assets/images/hero/sequence-small-box.webp',
];

const expectedHeroSubtitle =
  'Agentic Skill Distillation from Generated Egocentric Videos for Generalizable Whole-Body Manipulation';
```

Add these helpers after `getAttribute()`:

```js
function normalizeMarkupText(markup) {
  return markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .replace(/\s*:\s*/g, ': ')
    .trim();
}

function classTokens(tag) {
  return (getAttribute(tag, 'class') || '').split(/\s+/).filter(Boolean);
}
```

- [ ] **Step 2: Replace the coarse raw-HTML title assertion with semantic title assertions**

Replace `site exposes the exact paper title in HTML and config` with:

```js
test('site exposes the exact paper title with the approved two-level hero hierarchy', () => {
  const { html } = readRequiredFiles();
  const config = loadConfig();
  const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)];

  assert.equal(headings.length, 1, 'HTML must contain exactly one h1');
  assert.equal(normalizeMarkupText(headings[0][1]), expectedTitle);
  assert.equal(config.title, expectedTitle);
  assert.match(
    headings[0][1],
    /<span\b[^>]*class=["'][^"']*hero__title-brand[^"']*["'][^>]*>\s*RoboReact\s*<\/span>/i,
  );
  assert.match(
    headings[0][1],
    new RegExp(
      `<span\\b[^>]*class=["'][^"']*hero__title-subtitle[^"']*["'][^>]*>\\s*${expectedHeroSubtitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*<\\/span>`,
      'i',
    ),
  );
});
```

- [ ] **Step 3: Add a failing decorative-filmstrip and asset contract**

Add after the favicon test:

```js
test('hero publishes four decorative local filmstrips with seamless sheet pairs', () => {
  const { html, css } = readRequiredFiles();
  const layerTag = html.match(/<div\b[^>]*class=["'][^"']*hero__filmstrips[^"']*["'][^>]*>/i)?.[0];

  assert.ok(layerTag, 'hero filmstrip layer must exist');
  assert.equal(getAttribute(layerTag, 'aria-hidden'), 'true');

  for (const modifier of ['cup-tray', 'open-box', 'drawer-object', 'small-box']) {
    assert.match(html, new RegExp(`hero__filmstrip--${modifier}\\b`));
  }

  assert.equal((html.match(/hero__filmstrip-track/g) ?? []).length, 4);
  assert.equal((html.match(/hero__filmstrip-sheet/g) ?? []).length, 8);

  let totalBytes = 0;
  for (const publicPath of expectedHeroStrips) {
    assertLocalDocsFile(publicPath, `hero strip ${publicPath}`);
    const relativeFile = publicPath.replace(/^\.\//, 'docs/');
    totalBytes += fs.statSync(absolutePath(relativeFile)).size;
    const cssReference = `../images/hero/${path.basename(publicPath)}`;
    assert.ok(css.includes(cssReference), `CSS must map ${cssReference}`);
  }
  assert.ok(totalBytes <= 2.5 * 1024 * 1024, 'combined hero strips must not exceed 2.5 MiB');
});
```

- [ ] **Step 4: Add a failing motion, fallback, and generator contract**

```js
test('hero filmstrip motion is slow, staggered, reduced-motion safe, and printable', () => {
  const { css } = readRequiredFiles();
  const generator = fs.readFileSync(absolutePath('scripts/prepare-hero-filmstrips.sh'), 'utf8');

  for (const duration of ['72s', '84s', '78s', '96s']) {
    assert.match(css, new RegExp(`\\b${duration.replace('.', '\\.')}\\b`));
  }
  assert.match(css, /@keyframes\s+hero-filmstrip-scroll/);
  assert.match(css, /animation-direction:\s*reverse/);
  assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  assert.match(css, /@media\s+print[\s\S]*hero__filmstrips/);

  assert.match(generator, /^#!\/usr\/bin\/env bash/m);
  assert.match(generator, /set -euo pipefail/);
  assert.match(generator, /generated_reference_images/);
  assert.match(generator, /keyframe_images/);
  assert.match(generator, /ffmpeg/i);
  assert.match(generator, /cwebp/i);
  assert.doesNotMatch(generator, /libwebp/i, 'generator must use cwebp instead of an unavailable FFmpeg WebP encoder');
  assert.doesNotMatch(generator, /\/Users\//, 'generator must not hard-code a local home path');
});
```

- [ ] **Step 5: Run the tests and confirm the expected RED state**

Run:

```bash
/Users/bobyue/.nvm/versions/node/v24.13.1/bin/node --test tests/site.test.mjs
```

Expected: existing tests pass; new tests fail because hero markup, strip assets, CSS animation, and `scripts/prepare-hero-filmstrips.sh` do not exist yet.

- [ ] **Step 6: Commit the RED tests**

```bash
git add tests/site.test.mjs
git commit -m "test: specify cinematic hero contract" \
  -m "Define the two-level title, four decorative strip assets, motion behavior, asset budget, and reproducible generator before implementation." \
  -m "Constraint: Preserve the existing release and media contracts." \
  -m "Tested: New hero tests fail for the expected missing implementation." \
  -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

### Task 2: Build the Reproducible Filmstrip Generator and Assets

**Files:**

- Create: `scripts/prepare-hero-filmstrips.sh`
- Create: `docs/assets/images/hero/sequence-cup-tray.webp`
- Create: `docs/assets/images/hero/sequence-open-box.webp`
- Create: `docs/assets/images/hero/sequence-drawer-object.webp`
- Create: `docs/assets/images/hero/sequence-small-box.webp`

- [ ] **Step 1: Create the generator with explicit mappings and atomic output**

Implement `scripts/prepare-hero-filmstrips.sh` with this structure:

```bash
#!/usr/bin/env bash

set -euo pipefail

die() {
  printf 'prepare-hero-filmstrips: %s\n' "$*" >&2
  exit 1
}

require_tool() {
  local tool_name="$1"
  local resolved_path
  resolved_path="$(command -v "$tool_name" 2>/dev/null || true)"
  [[ -n "$resolved_path" ]] || die "required tool '$tool_name' was not found on PATH"
  printf '%s' "$resolved_path"
}

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repository_root="$(cd "$script_dir/.." && pwd)"

[[ "$#" -eq 1 ]] || die 'usage: scripts/prepare-hero-filmstrips.sh <source-material-root>'
source_input="$1"
[[ -d "$source_input" ]] || die "source root does not exist: $source_input"
source_root="$(cd "$source_input" && pwd)"
ffmpeg_bin="$(require_tool ffmpeg)"
ffprobe_bin="$(require_tool ffprobe)"
cwebp_bin="$(require_tool cwebp)"

output_dir="$repository_root/docs/assets/images/hero"
scratch_dir="$(mktemp -d "${TMPDIR:-/tmp}/roboreact-hero.XXXXXX")"
cleanup() { rm -rf -- "$scratch_dir"; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

strip_specs=(
  'sequence-cup-tray|20260626_161027|15|6000'
  'sequence-open-box|20260723_190045|14|5600'
  'sequence-drawer-object|20260725_203953|15|6000'
  'sequence-small-box|20260725_214552|15|6000'
)

mkdir -p "$output_dir"

for spec in "${strip_specs[@]}"; do
  IFS='|' read -r slug source_folder pair_count expected_height <<< "$spec"
  input_args=()
  filter_parts=()
  stack_labels=''
  input_index=0

  for ((frame_index = 0; frame_index < pair_count; frame_index += 1)); do
    printf -v frame '%03d' "$frame_index"
    generated="$source_root/$source_folder/generated_reference_images/gen_ref_$frame.png"
    keyframe="$source_root/$source_folder/keyframe_images/kf${frame}_src${frame}.png"

    for source_file in "$generated" "$keyframe"; do
      [[ -f "$source_file" ]] || die "required source frame is missing: $source_file"
      input_args+=(-i "$source_file")
      filter_parts+=("[$input_index:v]scale=320:200:force_original_aspect_ratio=increase,crop=320:200,setsar=1[f$input_index]")
      stack_labels+="[f$input_index]"
      input_index=$((input_index + 1))
    done
  done

  filter_graph="$(IFS=';'; printf '%s' "${filter_parts[*]}")"
  filter_graph+=";$stack_labels"
  filter_graph+="vstack=inputs=$input_index[out]"
  temp_png="$scratch_dir/$slug.png"
  temp_output="$scratch_dir/$slug.webp"

  "$ffmpeg_bin" -nostdin -hide_banner -loglevel error -y \
    "${input_args[@]}" \
    -filter_complex "$filter_graph" -map '[out]' -frames:v 1 \
    -map_metadata -1 "$temp_png"

  "$cwebp_bin" -quiet -q 62 -m 6 -metadata none \
    "$temp_png" -o "$temp_output"

  dimensions="$("$ffprobe_bin" -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$temp_output")"
  [[ "$dimensions" == "320x$expected_height" ]] || die "$slug has dimensions $dimensions, expected 320x$expected_height"
  mv "$temp_output" "$output_dir/$slug.webp"
done

strip_count="$(find "$output_dir" -maxdepth 1 -type f -name '*.webp' -print | wc -l | tr -d '[:space:]')"
[[ "$strip_count" -eq 4 ]] || die "expected exactly 4 hero WebPs, found $strip_count"

printf 'Hero filmstrips complete: 4 WebPs in %s\n' "$output_dir"
```

- [ ] **Step 2: Verify shell syntax before running media generation**

Run:

```bash
bash -n scripts/prepare-hero-filmstrips.sh
```

Expected: exit 0 with no output.

- [ ] **Step 3: Generate the four public strips from the user-provided source root**

Run from the isolated worktree:

```bash
bash scripts/prepare-hero-filmstrips.sh /Users/bobyue/Downloads/videos/素材
```

Expected: four successful strip outputs with the documented FFmpeg 4.2.2 and cwebp 1.6.0 toolchain. Before generation, run `cwebp -version` and confirm the active executable reports `1.6.0`; this repository already documents and tests that version.

- [ ] **Step 4: Verify exact paths, codec, dimensions, and budget**

Run:

```bash
find docs/assets/images/hero -maxdepth 1 -type f -name '*.webp' -print | sort
ffprobe -v error -show_entries stream=codec_name,width,height -of csv=p=0 docs/assets/images/hero/sequence-cup-tray.webp
ffprobe -v error -show_entries stream=codec_name,width,height -of csv=p=0 docs/assets/images/hero/sequence-open-box.webp
ffprobe -v error -show_entries stream=codec_name,width,height -of csv=p=0 docs/assets/images/hero/sequence-drawer-object.webp
ffprobe -v error -show_entries stream=codec_name,width,height -of csv=p=0 docs/assets/images/hero/sequence-small-box.webp
du -ck docs/assets/images/hero/*.webp
```

Expected: codec `webp`; heights `6000`, `5600`, `6000`, `6000`; combined total no more than 2560 KiB.

- [ ] **Step 5: Rerun the tests to measure the partial GREEN state**

Run:

```bash
/Users/bobyue/.nvm/versions/node/v24.13.1/bin/node --test tests/site.test.mjs
```

Expected: generator/asset existence and budget assertions pass; title/markup/CSS assertions still fail.

- [ ] **Step 6: Commit the generator and derived assets**

```bash
git add scripts/prepare-hero-filmstrips.sh docs/assets/images/hero
git commit -m "feat: add reproducible hero filmstrips" \
  -m "Generate four optimized chronological human-to-robot WebP strips from the supplied source folders." \
  -m "Constraint: Keep original PNG source material outside the public tree." \
  -m "Tested: Shell syntax, ffprobe dimensions and codec, and 2.5 MiB asset budget." \
  -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

### Task 3: Implement the Semantic Hero and Cinematic Motion

**Files:**

- Modify: `docs/index.html:67-133`
- Modify: `docs/assets/css/styles.css:1-29`
- Modify: `docs/assets/css/styles.css:164-447`
- Modify: `docs/assets/css/styles.css:960-1325`

- [ ] **Step 1: Add the four-column decorative layer and two-level title**

Make `.hero` contain the filmstrip layer before `.content-frame`:

```html
<header class="hero" id="top">
  <div class="hero__filmstrips" aria-hidden="true">
    <div class="hero__filmstrip hero__filmstrip--cup-tray">
      <div class="hero__filmstrip-track">
        <span class="hero__filmstrip-sheet"></span>
        <span class="hero__filmstrip-sheet"></span>
      </div>
    </div>
    <div class="hero__filmstrip hero__filmstrip--open-box">
      <div class="hero__filmstrip-track">
        <span class="hero__filmstrip-sheet"></span>
        <span class="hero__filmstrip-sheet"></span>
      </div>
    </div>
    <div class="hero__filmstrip hero__filmstrip--drawer-object">
      <div class="hero__filmstrip-track">
        <span class="hero__filmstrip-sheet"></span>
        <span class="hero__filmstrip-sheet"></span>
      </div>
    </div>
    <div class="hero__filmstrip hero__filmstrip--small-box">
      <div class="hero__filmstrip-track">
        <span class="hero__filmstrip-sheet"></span>
        <span class="hero__filmstrip-sheet"></span>
      </div>
    </div>
  </div>

  <div class="content-frame content-frame--wide">
    <div class="hero__heading">
      <p class="eyebrow">Generated-video skill distillation</p>
      <h1 class="hero__title">
        <span class="hero__title-brand">RoboReact</span><span class="sr-only">:</span>
        <span class="hero__title-subtitle">Agentic Skill Distillation from Generated Egocentric Videos for Generalizable Whole-Body Manipulation</span>
      </h1>
    </div>
    <!-- Preserve summary, release nodes, tags, and metrics exactly. -->
  </div>
</header>
```

Remove only the duplicate `<p class="hero__wordmark">` and the old plain-text `<h1>`.

- [ ] **Step 2: Add the dark hero stacking context and exact filmstrip mappings**

Replace the current `.hero` surface declaration and add:

```css
.hero {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  border: 1px solid rgba(255, 250, 243, 0.18);
  border-radius: var(--radius-lg);
  color: #fffaf3;
  background: #151310;
  box-shadow: 0 18px 45px rgba(22, 17, 12, 0.18);
}

.hero::after {
  position: absolute;
  z-index: 1;
  inset: 0;
  background: linear-gradient(
    180deg,
    rgba(15, 13, 11, 0.62) 0%,
    rgba(15, 13, 11, 0.68) 58%,
    rgba(15, 13, 11, 0.76) 100%
  );
  content: "";
  pointer-events: none;
}

.hero > .content-frame {
  position: relative;
  z-index: 2;
}

.hero__filmstrips {
  position: absolute;
  z-index: 0;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 0.35rem;
  padding: 0.35rem;
  opacity: 0.78;
  pointer-events: none;
}

.hero__filmstrip {
  overflow: hidden;
  border-radius: calc(var(--radius-lg) - 0.25rem);
}

.hero__filmstrip-track {
  display: flex;
  flex-direction: column;
  width: 100%;
  animation: hero-filmstrip-scroll 72s linear infinite;
  will-change: transform;
}

.hero__filmstrip-sheet {
  display: block;
  flex: 0 0 auto;
  width: 100%;
  aspect-ratio: 320 / 6000;
  background-position: center;
  background-repeat: no-repeat;
  background-size: 100% 100%;
}

.hero__filmstrip--cup-tray .hero__filmstrip-sheet {
  background-image: url("../images/hero/sequence-cup-tray.webp");
}

.hero__filmstrip--open-box .hero__filmstrip-track {
  animation-duration: 84s;
  animation-direction: reverse;
}

.hero__filmstrip--open-box .hero__filmstrip-sheet {
  aspect-ratio: 320 / 5600;
  background-image: url("../images/hero/sequence-open-box.webp");
}

.hero__filmstrip--drawer-object .hero__filmstrip-track {
  animation-duration: 78s;
}

.hero__filmstrip--drawer-object .hero__filmstrip-sheet {
  background-image: url("../images/hero/sequence-drawer-object.webp");
}

.hero__filmstrip--small-box .hero__filmstrip-track {
  animation-duration: 96s;
  animation-direction: reverse;
}

.hero__filmstrip--small-box .hero__filmstrip-sheet {
  background-image: url("../images/hero/sequence-small-box.webp");
}

@keyframes hero-filmstrip-scroll {
  from { transform: translateY(0); }
  to { transform: translateY(-50%); }
}
```

- [ ] **Step 3: Implement the centered Avenir-style title and dark content surfaces**

Replace the old `.hero__wordmark` and `.hero h1` rules with:

```css
.hero__heading { text-align: center; }

.hero .eyebrow {
  margin-bottom: 0.85rem;
  color: #f2ae86;
}

.hero__title {
  max-width: 70rem;
  margin: 0 auto;
  font-family: "Avenir Next", Avenir, "Helvetica Neue", var(--font-sans);
  text-wrap: balance;
}

.hero__title-brand,
.hero__title-subtitle { display: block; }

.hero__title-brand {
  font-size: clamp(3rem, 6vw, 5.25rem);
  font-weight: 760;
  letter-spacing: 0;
  line-height: 0.96;
}

.hero__title-subtitle {
  max-width: 64rem;
  margin: 0.9rem auto 0;
  font-size: clamp(1.2rem, 2.2vw, 1.9rem);
  font-weight: 560;
  letter-spacing: 0;
  line-height: 1.25;
  overflow-wrap: break-word;
}

.hero__summary { color: #e8e1d8; }

.hero .fact-tags { justify-content: center; }

.hero .headline-metrics { text-align: center; }

.hero .fact-tags li,
.hero .metric-card,
.hero .release-metadata,
.hero .resource-links a,
.hero .resource-links span {
  border-color: rgba(255, 250, 243, 0.2);
  color: #e8e1d8;
  background: rgba(20, 18, 16, 0.54);
  backdrop-filter: blur(6px);
}

.hero .metric-card dt { color: #d8cfc4; }
.hero .metric-card dd,
.hero .release-metadata [data-release-authors],
.hero .resource-links a { color: #fffaf3; }
.hero .release-metadata [data-release-venue] { color: #f2ae86; }
```

Keep the summary paragraphs left-aligned. Center the heading, fact-tag row, and headline-metric text explicitly with the scoped rules above.

- [ ] **Step 4: Add responsive, reduced-motion, and print safeguards**

At `max-width: 720px`, add:

```css
.hero__filmstrips { gap: 0.2rem; padding: 0.2rem; opacity: 0.64; }
.hero__title-brand { font-size: clamp(2.65rem, 14vw, 4rem); }
.hero__title-subtitle { font-size: clamp(1rem, 5.2vw, 1.35rem); }
```

At `max-width: 420px`, add:

```css
.hero__title-brand { font-size: 2.55rem; }
.hero__title-subtitle { font-size: 1rem; line-height: 1.3; }
```

Inside the existing reduced-motion media query, add:

```css
.hero__filmstrip-track {
  animation: none !important;
  transform: translateY(-12%);
}
```

Inside `@media print`, add:

```css
.hero__filmstrips,
.hero::after { display: none !important; }

.hero {
  color: #000000;
  background: #ffffff;
}

.hero .eyebrow,
.hero__summary,
.hero .metric-card dt,
.hero .metric-card dd { color: #000000; }

.hero .fact-tags li,
.hero .metric-card,
.hero .release-metadata {
  border-color: #bdbdbd;
  color: #000000;
  background: #ffffff;
  backdrop-filter: none;
}
```

- [ ] **Step 5: Run the unit tests**

Run:

```bash
/Users/bobyue/.nvm/versions/node/v24.13.1/bin/node --test tests/site.test.mjs
```

Expected: the hero title, asset, motion, accessibility, and existing tests pass.

- [ ] **Step 6: Commit the hero implementation**

```bash
git add docs/index.html docs/assets/css/styles.css
git commit -m "feat: add cinematic scrolling hero" \
  -m "Center the two-level paper title over four slow human-to-robot filmstrips with dark-glass summary and metric surfaces." \
  -m "Constraint: Preserve semantic content, future release hooks, reduced motion, and print readability." \
  -m "Tested: Hero contract and full Node site test suite." \
  -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

### Task 4: Harden the Release Validator and Regeneration Documentation

**Files:**

- Modify: `scripts/validate-site.mjs:45-74`
- Modify: `scripts/validate-site.mjs:390-445`
- Modify: `scripts/validate-site.mjs:781-943`
- Modify: `scripts/validate-site.mjs:1135-1153`
- Modify: `README.md:5-55`

- [ ] **Step 1: Declare exact expected hero paths and dimensions**

Add near the existing expected-media constants:

```js
const expectedHeroStrips = new Map([
  ['docs/assets/images/hero/sequence-cup-tray.webp', [320, 6000]],
  ['docs/assets/images/hero/sequence-open-box.webp', [320, 5600]],
  ['docs/assets/images/hero/sequence-drawer-object.webp', [320, 6000]],
  ['docs/assets/images/hero/sequence-small-box.webp', [320, 6000]],
]);
const heroStripBudgetBytes = Math.floor(2.5 * 1024 * 1024);
```

Add every map key to `requiredFiles`, and add `let heroStripFiles = [];` beside `figureFiles`.

- [ ] **Step 2: Permit safe parent-relative CSS references while preserving containment**

Delete only this overly broad branch from `checkCssReferences()`:

```js
if (localPath.split('/').includes('..')) {
  addError(`CSS asset URL contains path traversal: url(${reference})`);
  continue;
}
```

Retain the subsequent `path.resolve(cssDirectory, localPath)` plus `isInside(docsRoot, resolvedPath)` check. This permits `../images/hero/...` but still rejects every path that escapes `docs/`.

- [ ] **Step 3: Extend the exact image inventory without changing paper-figure semantics**

Inside `validateMediaTree(files)`:

```js
const allHeroDirectoryFiles = files.filter((relativePath) =>
  relativePath.startsWith('docs/assets/images/hero/'),
);

heroStripFiles = allHeroDirectoryFiles.filter(
  (relativePath) => path.extname(relativePath).toLowerCase() === '.webp',
);

requireExact(heroStripFiles.length, 4, 'WebP count under docs/assets/images/hero');
const expectedHeroPaths = [...expectedHeroStrips.keys()];
comparePathSets(heroStripFiles, expectedHeroPaths, 'hero strip directory');
comparePathSets(allHeroDirectoryFiles, expectedHeroPaths, 'hero strip directory contents');
```

Keep `figureFiles.length === 2`, then change the overall image-directory comparison to:

```js
comparePathSets(
  allImageFiles,
  [...expectedPosterPaths, ...expectedFigurePaths, ...expectedHeroPaths],
  'image directory contents',
);
```

Run `isRegularNonemptyFile()` across `heroStripFiles`, sum `fs.statSync(...).size`, and require the result to be no more than `heroStripBudgetBytes`.

Use this exact budget block after the path-set checks:

```js
let heroStripBytes = 0;
for (const relativePath of heroStripFiles) {
  const absolutePath = fromRepository(relativePath);
  if (isRegularNonemptyFile(absolutePath, relativePath)) {
    heroStripBytes += fs.statSync(absolutePath).size;
  }
}
if (heroStripBytes > heroStripBudgetBytes) {
  addError(
    `hero strip assets use ${heroStripBytes} bytes, budget is ${heroStripBudgetBytes} bytes`,
  );
}
```

- [ ] **Step 4: Probe each hero strip's codec and dimensions**

After the video loop in `validateMediaEncoding()`, probe the four strips with this complete loop:

```js
for (const [relativePath, [expectedWidth, expectedHeight]] of expectedHeroStrips) {
  const result = spawnSync(
    ffprobe,
    [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'stream=codec_type,codec_name,width,height',
      '-of', 'json',
      fromRepository(relativePath),
    ],
    {
      encoding: 'utf8',
      timeout: ffprobeFileTimeoutMs,
      maxBuffer: ffprobeMaxBuffer,
      shell: false,
    },
  );

  if (result.error?.code === 'ETIMEDOUT') {
    addError(`ffprobe timed out while inspecting ${relativePath}`);
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
  requireExact(streams.length, 1, `${relativePath} stream count`);
  if (streams.length === 1) {
    requireExact(streams[0].codec_type, 'video', `${relativePath} stream type`);
    requireExact(streams[0].codec_name, 'webp', `${relativePath} codec`);
    requireExact(streams[0].width, expectedWidth, `${relativePath} width`);
    requireExact(streams[0].height, expectedHeight, `${relativePath} height`);
  }
}
```

- [ ] **Step 5: Extend HTML/CSS behavioral validation**

In `validateHtmlStructure(html)`, add:

```js
const heroLayers = openingTags(html, 'div').filter((tag) =>
  (getAttribute(tag, 'class') || '').split(/\s+/).includes('hero__filmstrips'),
);
requireExact(heroLayers.length, 1, 'HTML hero filmstrip layer count');
if (heroLayers.length === 1) {
  requireExact(getAttribute(heroLayers[0], 'aria-hidden'), 'true', 'HTML hero filmstrip aria-hidden');
}
requireExact((html.match(/hero__filmstrip-track/g) ?? []).length, 4, 'HTML hero track count');
requireExact((html.match(/hero__filmstrip-sheet/g) ?? []).length, 8, 'HTML hero sheet count');

const h1Match = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
if (h1Match) {
  if (!/hero__title-brand/.test(h1Match[1])) {
    addError('HTML h1 is missing hero__title-brand');
  }
  if (!/hero__title-subtitle/.test(h1Match[1])) {
    addError('HTML h1 is missing hero__title-subtitle');
  }
}
```

In `validateCss(css)`, add:

```js
const heroPatterns = [
  ['hero filmstrip keyframes', /@keyframes\s+hero-filmstrip-scroll/],
  ['cup-tray strip', /sequence-cup-tray\.webp/],
  ['open-box strip', /sequence-open-box\.webp/],
  ['drawer-object strip', /sequence-drawer-object\.webp/],
  ['small-box strip', /sequence-small-box\.webp/],
  ['72 second strip duration', /\b72s\b/],
  ['84 second strip duration', /\b84s\b/],
  ['78 second strip duration', /\b78s\b/],
  ['96 second strip duration', /\b96s\b/],
  ['reverse strip direction', /animation-direction\s*:\s*reverse/],
  [
    'reduced-motion hero fallback',
    /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?hero__filmstrip-track/,
  ],
  ['print hero fallback', /@media\s+print[\s\S]*?hero__filmstrips/],
];

for (const [label, pattern] of heroPatterns) {
  if (!pattern.test(css)) {
    addError(`CSS is missing ${label}`);
  }
}
```

- [ ] **Step 6: Update the success summary and README**

Change the validator success line to:

```js
`Validation passed: ${videoFiles.length} videos, ${posterFiles.length} posters, ${figureFiles.length} figures, ${heroStripFiles.length} hero strips, ${autoplayCount} autoplay, ${forbiddenArtifactCount} forbidden artifacts.`
```

In README:

- add `docs/assets/images/hero/` to Docs Structure;
- add this regeneration command:

```bash
bash scripts/prepare-hero-filmstrips.sh /path/to/source-material-root
```

- state that the four derived WebPs interleave generated-reference and robot-keyframe sequences while original PNGs remain private/unpublished;
- keep the existing FFmpeg 4.2.2 reference toolchain statement.

- [ ] **Step 7: Run all static and release checks**

Run:

```bash
/Users/bobyue/.nvm/versions/node/v24.13.1/bin/node --test tests/site.test.mjs
/Users/bobyue/.nvm/versions/node/v24.13.1/bin/node scripts/validate-site.mjs
/Users/bobyue/.nvm/versions/node/v24.13.1/bin/node --check scripts/validate-site.mjs
bash -n scripts/prepare-media.sh
bash -n scripts/prepare-hero-filmstrips.sh
git diff --check
```

Expected: all tests pass; validator reports `16 videos, 16 posters, 2 figures, 4 hero strips, 1 autoplay, 0 forbidden artifacts`; all syntax/diff checks exit 0.

- [ ] **Step 8: Commit validator and documentation hardening**

```bash
git add scripts/validate-site.mjs README.md
git commit -m "test: validate cinematic hero release assets" \
  -m "Map the four exact WebP strips, verify their dimensions and budget, permit safe local CSS references, and document regeneration." \
  -m "Constraint: Keep two paper figures distinct from four decorative hero strips." \
  -m "Tested: Full site suite, release validator, JavaScript syntax, and shell syntax." \
  -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

### Task 5: Browser, Responsive, Motion, and Final Integration QA

**Files:**

- Modify only if QA proves necessary: `docs/assets/css/styles.css`, `docs/index.html`, `tests/site.test.mjs`, `scripts/validate-site.mjs`

- [ ] **Step 1: Start an isolated local preview**

Run from the feature worktree in a retained terminal:

```bash
python3 -m http.server 8002 --bind 127.0.0.1 --directory docs
```

Expected: `Serving HTTP on 127.0.0.1 port 8002`.

- [ ] **Step 2: Inspect desktop layout and motion**

At `1280 × 720`, verify in the browser:

- `RoboReact` is centered and visibly primary;
- the subtitle is smaller and centered;
- all four source columns are visible;
- adjacent columns alternate direction and move slowly;
- summaries, tags, metrics, and hidden release nodes preserve their contracts;
- no broken images, console errors, horizontal overflow, or text clipping.

- [ ] **Step 3: Inspect mobile and reduced-motion layout**

At `390 × 844`, verify four decorative columns remain, title/subtitle wrap without overflow, summary/metrics follow existing breakpoints, and touch navigation remains usable.

Emulate `prefers-reduced-motion: reduce` and verify every filmstrip transform stays static while the hero remains visually balanced.

- [ ] **Step 4: Inspect print fallback**

Use print emulation or print preview. Verify no filmstrip/veil is printed, the hero is white with black text, and content remains readable.

- [ ] **Step 5: Fix only evidence-backed visual defects and repeat the relevant checks**

Any polish edit must address a specific observed issue such as insufficient contrast, clipping, excess speed, unreadable mobile wrapping, or print leakage. Add or tighten a contract test whenever the issue is mechanically testable.

- [ ] **Step 6: Run the final verification set**

Run:

```bash
/Users/bobyue/.nvm/versions/node/v24.13.1/bin/node --test tests/site.test.mjs
/Users/bobyue/.nvm/versions/node/v24.13.1/bin/node scripts/validate-site.mjs
/Users/bobyue/.nvm/versions/node/v24.13.1/bin/node --check docs/assets/js/config.js
/Users/bobyue/.nvm/versions/node/v24.13.1/bin/node --check docs/assets/js/main.js
/Users/bobyue/.nvm/versions/node/v24.13.1/bin/node --check scripts/validate-site.mjs
bash -n scripts/prepare-media.sh
bash -n scripts/prepare-hero-filmstrips.sh
find docs -type l -print
find docs -name '.DS_Store' -o -name '*.pdf' -o -name '*.tex' -o -name '*.bib'
git diff --check
git status --short
```

Expected: complete test/validator success; no symlinks, forbidden public artifacts, diff errors, or uncommitted feature changes. The design specification and this implementation plan are committed before Task 1 begins, so both planning artifacts are part of the clean-state contract rather than untracked exceptions.

- [ ] **Step 7: Request independent functional, security, and code-quality review**

Reviewers must confirm:

- exact approved design/spec coverage;
- no original source-material publication;
- no unsafe external or traversal paths;
- no animation accessibility regression;
- no hidden-release regression;
- adequate test and validator enforcement;
- acceptable asset size and browser behavior.

- [ ] **Step 8: Commit any review-backed polish**

If review produces changes, commit only the reviewed files with a focused message and rerun Step 6. If no changes are needed, do not create an empty commit.

- [ ] **Step 9: Merge locally and re-verify `main`**

Fast-forward the reviewed feature branch into `main` without staging or modifying the user's existing root `.gitignore` and `素材/` changes. Run Step 6 again from the main checkout, then remove the clean worktree and merged branch.
