# RoboReact Cinematic Hero Filmstrips Design

> This planning artifact intentionally lives outside `docs/`, the GitHub Pages publish root.

## Status

Approved visual direction: option C, the cinematic dark overlay.

This design changes only the opening hero. Navigation, release-metadata behavior, teaser, method, videos, results, citation behavior, and footer remain unchanged.

## Goals

- Center the paper identity and reduce the current oversized heading.
- Present `RoboReact` as the primary title line and the paper subtitle as a smaller second semantic line.
- Replace the plain white hero surface with four slowly scrolling filmstrips derived from the supplied generated-reference and robot-keyframe sequences.
- Keep every hero paragraph, tag, metric, future release field, and resource link readable over the moving imagery.
- Preserve accessibility, responsive behavior, GitHub Pages compatibility, and the strict public-asset boundary.

## Non-goals

- No changes outside the hero except tests, validation, documentation, and reproducible asset preparation required by the hero.
- No third-party font service, JavaScript UI dependency, runtime image service, or generated imagery.
- No publication of the original `素材/` source tree.
- No change to the hidden prerelease author, venue, resource, contact, or BibTeX contract.

## Title and Typography

The existing duplicate `hero__wordmark` is removed. The hero keeps one semantic `<h1>` with three children:

1. `.hero__title-brand`: visible `RoboReact` on its own line.
2. An accessible, visually hidden colon so the heading's normalized text remains the exact paper title.
3. `.hero__title-subtitle`: visible `Agentic Skill Distillation from Generated Egocentric Videos for Generalizable Whole-Body Manipulation` as the smaller second semantic line.

The brand line uses the local system stack `"Avenir Next", Avenir, "Helvetica Neue", var(--font-sans)` with a medium-heavy weight and restrained negative tracking. The subtitle uses the same stack at a lighter weight. No web-font request is introduced.

Desktop values:

- Brand: `clamp(3rem, 6vw, 5.25rem)`.
- Subtitle: `clamp(1.2rem, 2.2vw, 1.9rem)`.
- Centered heading with a `70rem` maximum width.

The subtitle is one semantic line, not a promise of one physical line at every viewport. It may wrap into two or more physical lines on narrow screens rather than becoming illegibly small.

## Filmstrip Sources and Ordering

Each supplied folder owns one visual column, left to right:

1. `20260626_161027` — cup and tray.
2. `20260723_190045` — opening and packing a cardboard box.
3. `20260725_203953` — drawer/box and object manipulation.
4. `20260725_214552` — small-box robot manipulation.

For every available index in a folder, the public strip interleaves:

1. `generated_reference_images/gen_ref_NNN.png`
2. `keyframe_images/kfNNN_srcNNN.png`

The order remains chronological. Three folders contain 15 matched pairs and one contains 14 matched pairs. The duplicate generated-reference context in the third and fourth source folders is retained because their robot-keyframe executions differ and the approved layout assigns one column to each supplied folder.

The dark overlay and small column scale intentionally suppress incidental lab clutter and the small source watermark visible in some first-sequence frames. No face is visible in the reviewed sources.

## Derived Public Assets

The implementation creates exactly four public WebP strip assets:

- `docs/assets/images/hero/sequence-cup-tray.webp`
- `docs/assets/images/hero/sequence-open-box.webp`
- `docs/assets/images/hero/sequence-drawer-object.webp`
- `docs/assets/images/hero/sequence-small-box.webp`

Each matched input frame is center-cropped and scaled to a common `320 × 200` tile. Tiles are stacked vertically in the approved interleaved order. Resulting dimensions are therefore:

- 15-pair strips: `320 × 6000`.
- 14-pair strip: `320 × 5600`.

`scripts/prepare-hero-filmstrips.sh` accepts the source-material root as its only argument and uses the existing FFmpeg toolchain to regenerate the strips. It must not contain an absolute local path. The original PNGs remain outside `docs/` and outside the commit.

The combined four-strip budget is 2.5 MiB or less. Validation rejects a missing, extra, empty, oversized, or incorrectly dimensioned strip.

## Hero Structure

The hero gains a decorative layer before its content:

```html
<div class="hero__filmstrips" aria-hidden="true">
  <div class="hero__filmstrip hero__filmstrip--cup-tray">
    <div class="hero__filmstrip-track">
      <span class="hero__filmstrip-sheet"></span>
      <span class="hero__filmstrip-sheet"></span>
    </div>
  </div>
  <!-- Three more columns with the same structure. -->
</div>
```

The four strip assets are CSS backgrounds on the sheet elements, not semantic `<img>` content. The layer is `aria-hidden="true"`, has no pointer interaction, and sits behind the hero content.

Each track contains two identical sheets. Translating the track by one sheet height produces a seamless loop without duplicating asset downloads. Columns one and three travel upward; columns two and four travel downward. Their respective linear loop durations are `72s`, `84s`, `78s`, and `96s` so the background feels ambient rather than synchronized.

## Cinematic Treatment

The hero uses a `#151310` base. The filmstrip layer renders at `0.78` opacity under this exact vertical veil: `linear-gradient(180deg, rgba(15, 13, 11, 0.62) 0%, rgba(15, 13, 11, 0.68) 58%, rgba(15, 13, 11, 0.76) 100%)`. The stronger lower coverage protects the metric area.

Content treatment:

- Heading and primary metrics use `#fffaf3`.
- Supporting copy uses `#e8e1d8`, with a required contrast ratio of at least `4.5:1` against the rendered hero background.
- Tags, metric cards, release metadata, and future resource links use restrained translucent dark surfaces and light borders.
- The current hero border, rounded corners, and shadow remain, retuned for the dark surface.
- Text stays above the decorative layer through a single local stacking context; background elements never receive focus or pointer events.

The heading is centered. The existing two-column summary remains left-aligned inside a centered grid for easier paragraph reading. Tags and headline metrics remain centered within the hero width.

## Responsive and Motion Behavior

- Four columns remain present at all supported widths so every supplied sequence is represented.
- The hero title scales down at the existing breakpoints; the subtitle wraps safely.
- The summary changes to one column at the existing tablet breakpoint.
- Metrics remain four columns on desktop, two on small screens, and one on the narrowest screens.
- Filmstrip opacity becomes `0.64` at `720px` and below to protect text against tighter wrapping.
- `prefers-reduced-motion: reduce` disables all track animation and shows a stable representative section of each strip.
- Print hides the filmstrip layer, removes the dark overlay, and restores dark text on a white hero.

## Data Flow and Failure Behavior

The filmstrips are static publication assets. They require no runtime configuration and no JavaScript. If CSS is unavailable, the source order and semantic hero content remain readable. If a strip asset fails to load, the dark base and overlay still preserve text contrast; the validator prevents this state in a release checkout.

Future author, venue, contact, resource-link, and BibTeX data continue to flow from `docs/assets/js/config.js` through the current renderer. Dark-hero styles must cover those optional nodes even though the current release block is intentionally empty.

## Validation and Tests

The implementation is complete only when all of the following hold:

- One `<h1>` remains, and its normalized accessible text equals the exact paper title.
- The brand and subtitle spans exist in the approved order.
- The decorative filmstrip container is `aria-hidden="true"`.
- The four expected strip classes and four exact local WebP paths are present.
- The public image inventory recognizes exactly 16 posters, 2 paper figures, and 4 hero strips; the original source PNGs remain outside `docs/`.
- Each strip is a nonempty regular WebP with its exact expected dimensions, and the combined size is at most 2.5 MiB.
- CSS contains seamless track animation, staggered/reversed columns, reduced-motion disabling, and print removal.
- Existing release embargo, video, figure, result, security, favicon, and public-boundary checks continue to pass.
- Browser QA covers desktop, tablet/mobile, reduced-motion, no horizontal overflow, no broken resources, readable contrast, and an error-free console.

## Scope and Preservation

Implementation touches only the hero markup/styles, the four derived public assets, their reproducible preparation script, site tests, the release validator, and relevant README guidance. Existing unrelated `.gitignore` edits and the untracked `素材/` source folders belong to the user and must not be modified, staged, or committed.
