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

## 2026-11-28 — Phase 2, batch 1: tab and toolbar polish

- **Direction:** The user selected Dino Night as the design direction. Work continues on `ui/redesign`.
- **Tab strip:** Clarified the active tab with elevation and an accent marker. The close control fades in on hover/focus and remains visible for touch layouts. Tab position changes and the new-tab control use short FLIP transitions that respect the app's reduced-motion setting.
- **Tab interactions:** Added a 500 ms delayed title/URL hover card inside the browser chrome, with bounded positioning so it stays above the web contents area. Added Left/Right and Home/End keyboard movement across tab controls. Removed duplicated tab semantics from the wrapper while retaining the tab role on the actual tab button.
- **Toolbar polish:** The window-close hover state now uses semantic danger and surface tokens rather than fixed colors.
- **Verification:** `npm test` **33 passed, 0 failed**; `npm run check:theme-contrast` **54 checks, 0 failures**; `node --check renderer.js` and `git diff --check` passed.
- **Known limits:** Electron runtime QA is still unavailable in this checkout (the source launch exits with code 1 and no diagnostic, as recorded in Phase 1). The rendered tab card, keyboard flow, and interactions therefore need manual verification when the dev app can be launched. Legacy CSS values remain outside this batch's token migration.
- **Next:** Continue Phase 2 with the remaining toolbar and navigation states, then Phase 3 start page. Keep the known runtime and stylesheet migration gaps visible.

## 2026-11-28 — Phase 2, batch 2: toolbar and navigation states

- **Navigation controls:** Back, Forward, Reload/Stop, Bookmark, and New Tab now expose their implemented keyboard shortcuts in tooltips and `aria-keyshortcuts`. Bookmark state is conveyed with `aria-pressed`; a loading tab changes Reload to Stop and advertises Escape.
- **Connection indicator:** The address-bar marker now shows a lock for HTTPS, a warning for HTTP, and a neutral globe for browser/local pages, with a matching accessible label. This reflects the displayed URL scheme; it is not a certificate-validation indicator.
- **Toolbar feedback:** Enabled icon buttons receive brief hover/press motion; disabled controls no longer pick up hover backgrounds. Expanded popup buttons and saved bookmarks get an accent state. Shields count labels use the palette's foreground token.
- **Settings copy:** Removed the stale claim that tab hover cards are unavailable; vertical tabs and button visibility remain unavailable.
- **Verification:** `npm test` **33 passed, 0 failed**; `npm run check:theme-contrast` **54 checks, 0 failures**; `node --check renderer.js` and `git diff --check` passed.
- **Known limits:** Source Electron runtime QA remains unavailable, and full rendered contrast testing is pending. No navigation or privacy behavior was changed.
- **Next:** Verify this batch, then begin Phase 3 start-page polish under Dino Night.

## 2026-11-28 — Phase 3, batch 1: start-page motion and shortcut tiles

- **Background and entrance:** Added subtle pointer parallax to the wallpaper layer, local-image fade-in after load, and a one-time staggered fade-and-rise for the first start-page content. Parallax and entrance motion are disabled when reduced motion is active; the small motion targets only transform and opacity.
- **Shortcuts:** Letter tiles now use a stable domain-derived palette (all eight tested at **8.94:1 or better** against white). Tiles have lift/press/focus/drop states. User-added shortcuts can be reordered by drag or Ctrl+Left/Right; focus returns to the moved tile after the saved list rerenders. Built-in top-site ordering remains visit-based.
- **Verification:** `npm test` **33 passed, 0 failed**; `npm run check:theme-contrast` **54 checks, 0 failures**; `node --check renderer.js` and `git diff --check` passed. The shortcut color set was independently checked for white-text contrast.
- **Visual evidence and runtime:** Baseline capture remains [`03-start-page.jpg`](screenshots/before/03-start-page.jpg). I retried `npm start`; Electron still exits with code 1 without a diagnostic, so an after screenshot and performance measurements cannot be captured in this environment. Retake the after capture when the dev runtime launches.
- **Known limits:** Time-of-day wallpaper mode, real favicons, shortcut edit menu, and widget loading/empty-state polish remain. No external assets or network requests were added.
- **Next:** Continue Phase 3 with widgets and the customization drawer. Keep runtime capture/performance measurement listed as a QA gap.

