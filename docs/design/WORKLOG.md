# Design work log

## 2026-11-28 — Phase 0 audit

- **Branch:** `ui/redesign` (created from `1a277d1 Fix toolbar menus over web pages`).
- **Scope:** Read-only source audit and manual inspection of selected screens in the installed Windows application. The audit is in [`UI_AUDIT.md`](UI_AUDIT.md), and captures are in [`screenshots/before`](screenshots/before/).
- **Evidence:** Start page, customize drawer, settings, Shields/Extensions/browser menus, example.com page content, plus Shields/browser menus opened over web content. `WebContentsView` page bounds begin below the browser chrome; compact menus are native Electron `Menu` instances and were exposed above page content.
- **Baseline:** `npm test` passed **33/33**. The repository has no Playwright or E2E harness. A 1280×753 app screenshot was captured; Windows display scaling and every requested interaction/state were not covered.
- **Audit findings:** Current themes are `system/light/dark`; the white-on-dark-accent button pair is 2.02:1; 85 hex colors, 17 font-size values, 20 radius values, and 13 motion timing declarations were found in a static stylesheet scan. See audit for contrast pairs and further limitations.
- **Assumptions:** Keep existing behavior and CSP/security settings intact; prefer local CSS and data only. Preserve native `Menu` for compact native-like popups. Any rich popup needs a top overlay view before it can be used over page content.
- **Next:** Phase 1 design tokens, named theme palettes, selectable appearance previews, and local theme gallery. Capture gallery states before seeking the requested theme review. Do not begin Phase 2 chrome changes until the user selects/approves the visual direction.

## 2026-11-28 — Phase 1 theme foundation

- **Implementation:** Added `tokens.css` with semantic palette/surface/text/status/interaction/shape/elevation/motion tokens. New profiles default to Dino Night; Daylight, Aurora, Ember, Dino Green, System and High contrast are selectable. Older `light` and `dark` settings remain supported. Appearance now uses mini browser previews, custom/theme/wallpaper accent options, roundness, and reduce-effects controls. Wallpaper sampling is local-only; custom accent labels choose a contrasting light/dark foreground.
- **Gallery:** Added the source-only `npm run theme-gallery` preview and screenshots in [`screenshots/themes`](screenshots/themes/). The gallery window does not load the preload script. Static gallery rendering was manually inspected in a local Chrome file tab because Electron exits immediately with code 1 and no diagnostic in this checkout. The installed app was not changed.
- **Screenshot privacy:** Before captures had saved website shortcut names, and gallery captures included Chrome's bookmark strip. I replaced the published working-tree images with opaque redactions. Earlier pushed commits still contain the original image blobs until the branch history is rewritten.
- **Contrast:** `npm run check:theme-contrast` reports **54 checks, 0 failures**, including text and accent-label pairs in all palettes, focus and strong-boundary pairs, and the built-in wallpaper accents. This is a token check, not a complete rendered accessibility audit.
- **Verification:** `npm test` **33 passed, 0 failed**; `npm run check:theme-contrast` **54 checks, 0 failures**; `node --check` passed for `main.js`, `renderer.js`, `browser-store.js`, and the contrast checker; `git diff --check` passed. The source Electron command exits 1 without logging, so the gallery was visually checked by loading its local HTML directly in Chrome.
- **Known limits:** A full rendered screenshot suite, forced-colors mode, OS DPI variants, dynamic accent sampling of a real user wallpaper, and Electron runtime QA still need verification. Legacy component CSS still has direct style values, so token migration is not yet complete across all older components.
- **Decision requested next:** Review the gallery and choose the default color direction. The app remains on the user's existing saved theme until they change it; new profiles use Dino Night.

