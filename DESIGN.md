# Design

## Source of truth
- Status: Active
- Last refreshed: 2026-09-11
- Surface: the static research page under `docs/`.
- Evidence: `docs/index.html`, `docs/assets/css/styles.css`, `docs/assets/js/main.js`, `docs/assets/js/config.js`, existing hero design notes, and the user's approval of suggestions 1–3.

## Brand
- Warm, precise, editorial research presentation; dark cinematic hero, warm white body, copper accents.
- Trust comes from actual recordings, legible paper figures, preserved reported numbers and author information.

## Product goals
- Help a researcher understand the contribution, find a relevant experiment, and inspect visual evidence.
- Improve hierarchy and add task/condition filtering, enlarged video viewing, and figure zoom.
- Success: every existing demo remains accessible; filters combine correctly; enlarged media can be closed without losing reading position.
- Method retains the complete figure and four static step explanations; a small results chart links reported rates to task recordings.

## Personas and jobs
- Researchers surveying related work, inspecting manipulation behavior, and reading method figures.
- Desktop deep reading and mobile browsing; keyboard users can operate every new control.

## Information architecture
- Preserve the hero, featured result, teaser, overview, method, videos, results, and conditional citation sections.
- Give Read paper and Watch demo clear hero entry points.
- Filter the 15 gallery recordings by task and experimental condition; the featured highlight stays independent.

## Design principles
- Show evidence prominently and use concise controls.
- Retain complete figures and section explanations when JavaScript is unavailable.
- Reuse the site's assets, colors and native browser media controls.

## Visual language
- Preserve existing warm color tokens and dark hero palette.
- Clarify the title/summary/metadata hierarchy; use quieter metadata and more varied body layouts.
- Use consistent borders, generous spacing and restrained shadows; avoid motion on scroll.

## Components
- Existing: hero, sidebar/mobile index, video cards, paper figures, results table.
- New: two filter button groups, live result count, reset/empty states, expand buttons, one reusable native dialog with image zoom controls.
- Place the count and reset control beside the two filter rows on desktop, within the same panel; use one compact bottom row on mobile.
- Keep video expansion a small, quiet text control and start the hero directly with the paper title.
- Align video expansion to the bottom right; omit the redundant main-task gallery heading.
- Method: the original four static explanations and execution-boundary note, with figure enlargement retained.
- Results: reuse configured taskResults with a fixed 0–100% scale, exact labels, muted baseline bars and an accented RoboReact bar; retain the full original table.
- Align the selected task/rate label and task selectors in one centered row, wrapping only on narrow screens; omit the extra explanatory sentence.
- Reference: https://www.pi.website/ inspected directly. Borrow the off-white ground, compact monospaced controls and thin rules for new interactions while retaining RoboReact's established typography and copper accent.
- `styles.css` owns appearance; `main.js` owns progressive enhancements.

## Accessibility
- Visible focus, labeled button groups, aria-pressed filter choices, and polite result announcements.
- Dialog has a visible title, close button, native focus containment and Escape handling; return focus to its trigger.
- Pause hidden/background videos; preserve reduced-motion behavior and native controls.

## Responsive behavior
- Desktop keeps the research index and two-column gallery; mobile wraps filters and stacks videos.
- Viewer stays inside the viewport; enlarged figures scroll inside the viewer instead of widening the page.
- Primary controls are at least 44px high; secondary video expansion uses a compact 24px desktop control and a 44px touch target, without hover-only actions.

## Interaction states
- Initial: all 15 gallery recordings visible.
- Filtering: both dimensions apply; empty groups hide; hidden recordings pause.
- Empty: explain the combination has no recordings and offer reset.
- Viewer: loading/error feedback, fit/zoom for figures, preserved video position, close/backdrop/Escape dismissal.
- Closing returns to the same section and stops enlarged playback.

## Content voice
- English UI, matching the paper page; short action labels and factual captions.
- Retain source-encoded acceleration labels without changing playback speed.

## Implementation constraints
- Vanilla HTML/CSS/JavaScript, GitHub Pages and relative assets; no added dependencies.
- Preserve current video/poster mappings, the recent poster fix and original scientific content.
- Existing validator has unrelated failures from eight backup MP4s and replaced-video encoding; compare against that baseline.
- Validate with current contract tests, real Chromium interaction checks and desktop/mobile screenshots.

## Open questions
- None blocking the approved scope.
