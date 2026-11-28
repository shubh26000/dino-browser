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

## 2026-11-28 — Phase 3, batch 2: shortcuts and widgets

- **Shortcut editing:** User-added tiles now have a disclosure menu for Edit and Remove. The existing validated HTTP/HTTPS dialog now supports editing in place, keeps shortcut identity/order, rejects blank names, and reports save success or failure.
- **Widget feedback:** Notes show a polite “Saving…” / “Saved locally” status and report persistence failures. To-do rows now animate into their completed state, and the empty list gives a next action. Widget cards get a restrained hover/focus lift and accent heading marker.
- **Verification:** `npm test` **33 passed, 0 failed**; `npm run check:theme-contrast` **54 checks, 0 failures**; `node --check renderer.js` and `git diff --check` passed.
- **Known limits:** No new dependency or remote content. Browser runtime still exits without a diagnostic; visual widget/dialog verification and after screenshots are pending.
- **Next:** Continue Phase 3 with customization-drawer states and widget layout polish, then revisit the runtime capture gap.

## 2026-11-28 — Phase 3, batch 3: live start-page customization

- **Controls:** Added live sliders for background dim, wallpaper blur, and privacy/widget card opacity. Values preview while dragging, then persist through the existing start-page IPC and encrypted store.
- **Compatibility and validation:** Older profiles receive defaults (dim 18%, blur 0px, card opacity 13%). The store validates ranges (0–65%, 0–8px, 8–45%) and rejects malformed values. Reset restores those defaults. Wallpaper blur is disabled when Reduce effects is enabled; parallax, wallpaper filtering, glass blur, and drawer motion are also suppressed by that setting while the drawer backdrop remains available to close the panel.
- **Verification:** `npm test` **33 passed, 0 failed** (including persistence, defaults and range validation); `npm run check:theme-contrast` **54 checks, 0 failures**; `node --check renderer.js`, `node --check browser-store.js`, and `git diff --check` passed.
- **Visual evidence:** `03-start-page.jpg` remains the baseline. The app still exits on `npm start` with code 1 and no diagnostic, so the after screenshot cannot be responsibly captured from the actual renderer yet. Performance measurements remain uncollected.
- **Next:** Continue Phase 3 with the remaining drawer and widget details; return to Phase 4 after the start page is covered. Revisit visual capture as soon as the development runtime is available.

## 2026-11-28 — Phase 3, batch 4: local seven-day Shields chart

- **Data:** Added a bounded seven-day daily count to the existing encrypted local Shields statistics. Existing aggregate totals remain; older profiles default to an empty recent-history window and are not backfilled.
- **Start page:** The privacy card now shows a small seven-day activity chart with weekday labels, hover counts, a screen-reader summary, and animated bar changes. Empty days are shown as near-zero bars so the full week remains legible.
- **Verification:** `npm test` **33 passed, 0 failed**, including persisted daily counts and migration defaults; `npm run check:theme-contrast` **54 checks, 0 failures**; `node --check renderer.js`, `node --check browser-store.js`, and `git diff --check` passed.
- **Known limits:** Weekly bars only include data recorded after this update; older aggregate totals are retained separately. The UI still needs a real-renderer screenshot and performance check because `npm start` exits 1 without diagnostics.
- **Next:** Complete the remaining start-page customization/widget polish, then move to Phase 4.

## 2026-11-28 — Phase 3, batch 5: time wallpaper and widget layout

- **Wallpaper:** Added a local “Time of day” preset with distinct morning, day, evening and night gradients. It updates once per minute using the Windows local clock; no images or external assets are loaded.
- **Widgets:** Added validated per-widget Small/Medium/Large sizing controls and visible-on-hover drag handles. Widget order persists through the existing local `widgets` list and can also be changed with Ctrl+Up/Down while a handle is focused. The drawer toggles widgets on/off. Existing profiles default to Medium without a migration prompt.
- **Lifecycle:** The clock and time-wallpaper timers stop when leaving the start page.
- **Verification:** `npm test` **33 passed, 0 failed**; `npm run check:theme-contrast` **54 checks, 0 failures**; `node --check renderer.js`, `node --check browser-store.js`, and `git diff --check` passed.
- **Known limits:** Actual rendering, accessibility inspection at 200% zoom, and performance measurements remain pending because Electron exits before opening its window. No after screenshot is available.
- **Next:** Phase 3 features are covered at the code level; proceed to Phase 4 settings and internal pages while keeping visual QA tracked.

## 2026-11-28 — Phase 3, batch 6: theme selection in the customize drawer

- **Change:** Added a theme selector to the start-page drawer, including System, Daylight, Dino Night, Aurora, Ember, Dino Green, and High contrast. Legacy Light/Dark settings are normalized in the control, and changing the theme applies through the existing settings flow.
- **Verification:** `npm test` **33 passed, 0 failed**; `npm run check:theme-contrast` **54 checks, 0 failures**; `node --check renderer.js`, `node --check browser-store.js`, and `git diff --check` passed.
- **Phase 3 gaps:** No real favicons are loaded; shortcut tiles use readable local letter tiles to honor the no-remote-assets rule. Widget data loads synchronously from local storage, so loading skeletons and remote error/retry states are not applicable yet. Full visual review, reduced-motion rendering, and performance measurements are pending an Electron runtime that opens successfully.
- **Next:** Begin Phase 4 settings and internal-page polish, then Phase 5 cross-surface QA. Preserve these runtime and screenshot limitations in every report until resolved.

## 2026-11-28 — Phase 4, batch 1: settings navigation and internal lists

- **Settings navigation:** Added a motion-aware active marker and roving keyboard navigation with Up/Down/Home/End. Filtering moves the active section to the first visible result if the previous section disappears.
- **History and bookmarks:** History is grouped under sticky day headings. Bookmarks now have local title/URL search. Search query and focus persist when local data changes and the page rerenders. Remove buttons have item-specific accessible names.
- **Verification:** `npm test` **33 passed, 0 failed**; `npm run check:theme-contrast` **54 checks, 0 failures**; `node --check renderer.js` and `git diff --check` passed.
- **Known limits:** Rendered keyboard/screen-reader checks and screenshot evidence require a working Electron runtime. Multi-select rows and custom icons remain for a later pass.
- **Next:** Continue Phase 4 with internal-page empty states, settings controls, and confirmation dialogs.

