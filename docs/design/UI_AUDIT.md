# Dino Browser UI audit

**Date:** 28 November 2026  
**Branch:** `ui/redesign`  
**Baseline commit:** `1a277d1` (`Fix toolbar menus over web pages`)

## Scope and evidence

This is a Phase 0 read-only code audit plus a limited manual inspection of the installed Windows app. The installed app opened its local start page and loaded `https://example.com/`. Screenshots in [`screenshots/before`](screenshots/before/) document the clean start page, customization drawer, settings, Shields and extensions menus, browser menu, and a live page. Saved shortcut tiles are redacted in the published captures. The Shields and browser menus were also opened while the page was visible.

The project has no Playwright or `@playwright/test` dependency and no automated Electron smoke suite. I did not add one during the read-only audit. As a result, the full requested matrix was not captured: multiple tab/loading/audio/hover/drag states; every settings section and dialog; wallpaper variants; find bar and error/crash pages; high contrast; narrow window; and 125–200% scaling remain unverified. The computer-use capture reports a 1280×753 logical client screenshot; it does not control Windows display scaling. Native menus are visible in the screenshots, but page content is rendered by a separate `WebContentsView`, which this DOM-based app cannot inspect through Playwright alone. No claim is made for uncaptured states.

## Electron layering decision

The main process creates each web tab as a `WebContentsView`, then adds it to the BrowserWindow content view. `updateViewBounds()` positions that child below the browser chrome. The browser renderer itself is the BrowserWindow's base `webContents`, so arbitrary HTML popups in that renderer would be painted underneath the active page view. This was the cause of the toolbar-menu layering class of bug.

The current implementation routes the Shields, Extensions, browser, tab, bookmark, and page-context menus through Electron's native `Menu` popup API. In a live example.com tab, the Shields menu and browser menu were exposed as separate native menu panes above the page. That is the robust pattern already in use for anchored native menus; keep it for compact menus. Its trade-off is OS-native appearance and limited rich animation/theming. Any future rich floating surface (command palette, omnibox suggestions, custom large panels) should be rendered in a dedicated overlay `WebContentsView` above page views, with bounds tied to the window and explicit keyboard/focus handling. Do not add a DOM-only popup to the base renderer while a web view is active.

Other surfaces found in code: the find bar is part of browser chrome and increases the page-view top bound; settings, history, bookmarks, downloads, and other internal pages are shown only when an internal tab is active; the customization drawer and toast are base-renderer DOM. The toast may be obscured if shown over a normal web tab and needs a separate visibility review before extending toast usage. Omnibox suggestions and a command palette are not implemented. The old DOM popup elements/styles for browser, Shields, and extensions remain in the renderer/CSS despite menu actions being native; remove only after checking all selectors and handlers.

## Security baseline

- `index.html` sets a restrictive CSP: self-only scripts/styles, no connections or frames, no objects, and no base/form navigation.
- BrowserWindow and page `WebContentsView` use `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
- Theme and UI work should stay in the local renderer and existing validated settings IPC. No new network source, preload surface, or permission is needed for a local theme gallery.

## Visual findings

### Color and contrast

`styles.css` has a small token block at the top, but a rough static scan found 85 distinct hex colors (138 occurrences), and roughly 980 hard-coded color/size/motion matches across the stylesheet using the audit's broad search pattern. Browser chrome uses soft blue, violet and teal ambient glows over neutral surfaces; the glow is the strongest chromatic element while active states and surfaces remain mostly neutral, making the interface feel like a conventional utility shell rather than a coherent product identity. Start-page palette values are separately hard-coded.

Contrast ratios are calculations from current CSS token pairs, not a full rendered axe scan:

| Pair | Ratio | Result |
| --- | ---: | --- |
| Light primary `#20232b` on `#f2f4f8` | 14.27:1 | Pass |
| Light secondary `#687080` on `#f2f4f8` | 4.52:1 | Bare pass |
| Light disabled `#a6adba` on white | 2.26:1 | Below the requested 4.5:1 |
| White label on light accent `#496fe8` | 4.45:1 | Slightly below 4.5:1 |
| Dark primary `#f0f1f5` on `#08090c` | 17.64:1 | Pass |
| Dark secondary `#a7adba` on `#08090c` | 8.85:1 | Pass |
| Dark disabled `#676e7a` on `#08090c` | 3.88:1 | Below the requested 4.5:1 |
| White label on dark accent `#9cb4ff` | 2.02:1 | Fail; primary button forces white text |

The current high-contrast mode is app-controlled and does not demonstrate forced-colors behavior. Accent and high-contrast colors are split between CSS and renderer logic.

### Scale, shape, motion, depth

- 17 distinct declared `font-size` pixel values (8 through 28px); 8, 9 and 10px text is present. The requested floor is 11px.
- 20 distinct border-radius declarations and 13 timing/transition declarations were found by a static scan; radii and timings are not consistently routed through tokens.
- Root spacing tokens are 2, 4, 8, 12, 16, 24 and 32px, so the scale starts off-grid relative to the requested 4px base.
- Three neutral shadows exist, but many component surfaces still use flat borders/solid fills. Some focus/hover states exist; feedback, movement and elevation vary by component.
- Typography uses the Windows system font stack, which is appropriate for offline use; no bundled font license notice is needed at baseline.
- Icons are inline SVGs with a shared 18px class in many controls, but emoji/text glyphs and individually authored SVGs remain elsewhere.

### Product and component gaps

- Only `system`, `light`, and `dark` are selectable. The custom accent exists, but there are no named palette previews or live theme gallery.
- Theme UI is a select, density select, accent dots/hex field, ambient glow switch, and bookmarks-bar switch. There is no effects reduction setting or independent corner-roundness control.
- Several settings explicitly describe unavailable product behavior. Search suggestions, private windows, command palette, and private profile are not implemented.
- The installed start page already has a greeting/clock, shortcuts, local privacy stats, wallpaper selection, and a customization drawer. The drawer screen is captured; wallpaper and widgets variants were not exhaustively exercised.
- Main chrome icon buttons have labels/tooltips and some focus/hover styling. Complete hover, pressed, keyboard and forced-colors coverage was not exercised during this audit.

## Prioritized problems

1. **P0 — Keep the page/menu layering invariant.** Do not implement future floating UI as base-renderer DOM over web pages. Compact native menus currently work above the page; use a top overlay `WebContentsView` for rich custom overlays.
2. **P1 — Fix contrast tokens before theme expansion.** White labels on the current dark accent measure 2.02:1; disabled text and the current light primary button also miss the requested contrast targets.
3. **P1 — Establish named theme palettes and previews.** Current `system/light/dark` modes and freeform accent do not communicate a distinct visual identity or let users compare palettes.
4. **P1 — Consolidate design values.** Color, radius, spacing, type and motion declarations are widely hard-coded; root spacing starts at 2px and text below 11px exists.
5. **P2 — Audit lower-layer notices and transitions.** The toast is a BrowserWindow DOM element and may be behind a web `WebContentsView`; inspect it on a web tab. Add accessible feedback states consistently.
6. **P2 — Complete visual QA coverage.** Install/implement an approved local Electron screenshot/smoke harness in a later batch and cover scaling, forced colors, narrow windows, internal pages, loading/errors and multi-tab states.

## Baseline verification

`npm test`: **33 passed, 0 failed**. No Playwright/E2E suite is present, so this count covers the repository's Node test suite only.

## Screenshot index

| File | State |
| --- | --- |
| `01-new-tab.jpg` | Existing baseline capture of the new tab |
| `02-customize-drawer.jpg` | Customization drawer |
| `03-start-page.jpg` | Clean start page in the installed app |
| `04-shields-menu.jpg` | Shields menu on the new tab |
| `05-browser-menu.jpg` | Browser menu on the new tab |
| `06-example-page.jpg` | example.com loaded in a page `WebContentsView` |
| `07-shields-on-page.jpg` | Native Shields menu above example.com |
| `08-browser-menu-on-page.jpg` | Native browser menu above example.com |
| `09-extensions-menu.jpg` | Extensions menu above example.com |
| `10-settings.jpg` | Settings page |
| `11-appearance.jpg` | Appearance section capture; sidebar activation did not change section during this inspection |

