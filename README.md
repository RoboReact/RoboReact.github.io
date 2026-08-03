# RoboReact Project Page

Static project page for RoboReact, intended for GitHub Pages publication from the `docs/` directory.

## Docs Structure

- `docs/index.html` is the page shell.
- `docs/favicon.svg` is the local SVG favicon linked from the document head.
- `docs/assets/css/styles.css` holds the site styling.
- `docs/assets/js/config.js` stores the rendered content, results, and release metadata.
- `docs/assets/js/main.js` handles page behavior.
- `docs/assets/images/` contains the teaser image, pipeline figure, and poster frames.
- `docs/assets/videos/` contains the public MP4 assets referenced by the page.

## Local Preview

Serve `docs/` from the repository root with:

```bash
python3 -m http.server 8000 --directory docs
```

Then open `http://localhost:8000/`.

## Verification

- `node --test tests/site.test.mjs`
- `node scripts/validate-site.mjs`
- `git diff --check`

## Media Regeneration

Rebuild the public media from a local source directory with:

```bash
bash scripts/prepare-media.sh /path/to/source-directory
```

Reference toolchain for the committed public media assets:

- FFmpeg/ffprobe 4.2.2
- Ghostscript 10.07.1
- cwebp 1.6.0

The script regenerates the public videos, poster frames, and paper figures under `docs/assets/`. The private manuscript/source-media bundle is intentionally excluded from the publish tree, and the source PDF must never be published.

Use the same versions and builds for the closest reproducibility. Exact bytes may differ across builds/platforms and tool builds, so the validator verifies publish contract details such as counts, mappings, codecs, and the public boundary rather than hashes.

## Release Metadata

Release metadata lives only in `docs/assets/js/config.js`. The current empty/null release block keeps authors, affiliations, venue, contact, resources, and BibTeX hidden until real release data is ready. When you populate those fields, update the explicit null-release assertions in `tests/site.test.mjs` and `scripts/validate-site.mjs`.

Future resource URLs must be HTTPS. The page script and validator reject non-HTTPS release resource URLs.

## GitHub Pages

Configure GitHub Pages as `Settings > Pages > Deploy from a branch > main > /docs`.

Relative paths are used throughout so the site works from a repository subpath. The expected public URL is `https://<owner>.github.io/<repository>/`.

This README does not claim a live deployment or remote publishing state.
