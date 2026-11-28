# Manual QA checklist

## Self-updates (1.0.5+ packaged builds)

- [ ] Install a prior version, install 1.0.5 once, then publish a higher version
  as a public, non-draft GitHub release with generated `latest.yml` metadata.
- [ ] Verify the packaged app checks for updates after startup and can also check
  from Settings → About; development runs should clearly report that updates
  require an installed build.
- [ ] Verify a current install reports up to date, and an offline or unavailable
  release reports a recoverable error without interrupting browsing.
- [ ] Confirm a newer installer downloads in the background, progress updates,
  and the browser only installs after clicking “Restart to update”.
- [ ] Confirm normal app close does not install an update automatically, and the
  downloaded update installs successfully after the explicit restart action.
- [ ] Verify browser data, bookmarks, and the existing per-user install survive
  an in-app update. Test an interrupted download and retry after reconnecting.
- [ ] Confirm Windows SmartScreen/signing behavior for the current unsigned
  installer; configure Authenticode signing before treating releases as trusted.

## Run status

- [x] In the installed 1.0.3 app, open example.com and verify the Shields,
  Extensions, and three-dot menus appear above the active web page.
- [x] Install and launch the 1.0.4 app; the start page rendered successfully.
- [ ] On 1.0.4, verify the toast overlay and menu behavior over a live web page;
  this source review did not exercise those interactions.
- [ ] Complete interactive QA on Windows after npm start launches successfully;
  the base-profile and fresh temporary-profile launches currently exit with code 1.
- [ ] Capture light, dark, high-contrast, compact, and 200% scale screenshots.
- [ ] Run a screen-reader pass and automated accessibility scan.
- [ ] Record startup, new-tab, tab-switch, and Shields before/after measurements.

The development checkout's npm start exits with code 1 and no diagnostic text,
including with a fresh `--user-data-dir` and verbose Electron logging. Electron
45.5.0 is installed. The installed-app menu check above is baseline evidence;
full interactive QA for the current source remains in progress.
## Windows keyboard

- [ ] Ctrl+T, Ctrl+W, Ctrl+Shift+T create, close, and restore tabs.
- [ ] Ctrl+Tab, Ctrl+Shift+Tab, Ctrl+PgDn/PgUp, Ctrl+1–8, and Ctrl+9 switch tabs.
- [ ] Ctrl+Shift+A searches tabs and lists recently closed tabs.
- [ ] Ctrl+L, F6, and Alt+D focus the address bar; F6 cycles through browser chrome,
  bookmarks, and page; Shift+F6 cycles backward.
- [ ] Alt+Left/Right, F5, Ctrl+R, Ctrl+Shift+R, and Escape navigate, reload,
  hard-reload, and stop.
- [ ] Alt+Home opens the start page. Ctrl+Enter appends `.com`; Alt+Enter opens
  the address in a new tab.
- [ ] Ctrl+D and Ctrl+Shift+D bookmark the current page and all open web tabs.
- [ ] Ctrl+F, Ctrl+G, and Ctrl+Shift+G find text and move through matches.
- [ ] Ctrl+P, Ctrl+S, F12/Ctrl+Shift+I, Ctrl+Plus/Minus/0, F11, Ctrl+Shift+B,
  Ctrl+H, Ctrl+J, Ctrl+Shift+Delete, Ctrl+Shift+O, and Ctrl+, perform their
  documented actions.
- [ ] Ctrl+N and Ctrl+Shift+N clearly report that multiple and private windows
  are not supported. Ctrl+U reports that view-source is not supported.

## Pointer, touchpad, and tabs

- [ ] Middle-click closes a tab; middle-clicking the new-tab button opens a tab.
- [ ] Dragging a tab reorders it; scrolling over the tab strip scrolls its tab list.
- [ ] Double-clicking empty tab-strip space maximizes/restores the window.
- [ ] Right-clicking a tab offers new, reload, close, and close-other-tabs actions.
- [ ] Right-clicking a bookmark offers open and remove actions.
- [ ] Page context menus show safe link actions, text search/copy, editing actions,
  navigation, reload, and Inspect where applicable.
- [ ] Ctrl-click/Shift-click links, middle-click links, and two-finger back/forward
  behave acceptably on Windows touchpads.
- [ ] Pinch zoom works between 100% and 300%; touch long-press opens the page menu.
- [ ] Dragging links/files onto tabs, dragging tabs between windows, and tab groups
  are documented as unsupported.

## Accessibility and display

- [ ] Every toolbar button and tab has a useful accessible name, state, and role.
- [ ] The full browser can be operated without a mouse; focus order remains visible
  and logical across toolbar, bookmarks, dialogs, and page content.
- [ ] High Contrast and Reduce Motion settings persist and apply immediately.
- [ ] Test system/light/dark/high-contrast themes at 100%, 125%, 150%, and 200%.
- [ ] Check native Shields, Extensions, and browser menus open above a live
  `WebContentsView`, and close cleanly by Escape, outside click, and selection.
- [ ] Verify a toast appears above a live page, does not steal focus or block
  mouse clicks, updates when another message arrives, and disappears after four
  seconds. Move, resize, maximize, minimize, and restore the browser during a
  toast; confirm internal-page toasts remain in browser chrome and theme/reduce-
  motion preferences apply. Confirm a screen reader announces the status once.
- [ ] Check settings search highlights and no-result state; test active-section
  fallback after filtering, Arrow Up/Down/Home/End navigation, and section links.
- [ ] Check history day grouping, history/bookmark search, empty-state layout,
  and query/focus retention after local data refresh.
- [ ] For each destructive confirmation, test Cancel, Escape, initial focus,
  confirm, focus return, progress state, and completion/error feedback.
- [ ] Check dialogs, internal pages, errors, and focus rings for clipping and
  contrast, including after the popup layering cleanup.
- [ ] Run an axe-equivalent scan and manual NVDA/Windows Narrator review.
- [ ] Check RTL layouts, zoom to 200%, and the narrowest supported 720-pixel
  window width; current BrowserWindow minimum width is 720 pixels.

## Persistence, privacy, and errors

- [ ] Default startup opens the start page. "Continue where you left off" restores
  up to 20 HTTP/HTTPS tabs and the selected web tab.
- [ ] Default website storage remains temporary. Extension support requires
  explicit confirmation before it changes to persistent storage.
- [ ] Disabling extension support removes extensions and clears the persistent
  extension profile before returning to the temporary session.
- [ ] History, bookmarks, settings, startup URLs, and extension metadata remain
  encrypted with Windows DPAPI.
- [ ] Clear-data checkbox and time-range combinations preserve bookmarks and
  settings while clearing only the selected data.
- [ ] Check offline navigation, DNS failure, connection reset, certificate
  failure, blocked requests, crashed tabs, and recovery actions.
- [ ] Verify the browser makes no telemetry calls. Search queries go only to the
  selected search engine; extension code can make its own requests.

## Performance and security

- [ ] Record cold-start-to-interactive and new-tab-open timings on a mid-range
  Windows machine; no measurements have been collected for this phase.
- [ ] Compare page load and blocked-request counts before/after Shields on five
  ad-heavy sites, plus an adblock and privacy test page.
- [ ] Confirm state updates are frame-coalesced and tab DOM does not rebuild when
  tab identity/title/loading state has not changed.
- [ ] Review Electron sandbox, context isolation, CSP, safe navigation allowlists,
  DPAPI storage, and extension permission prompts after each code change.
- [ ] Do not claim Chromium-only features until interactive browser tests exist.

## Current Electron gaps

Downloads management, view-source, multiple browser windows, private windows,
native page permissions, tab groups, vertical tabs, tab hover cards, extension
action popups, cross-window tab movement, full-page tab/link drag-and-drop, and
auto-hiding fullscreen chrome are not implemented. The extension manager is
limited to unpacked local folders and Electron's supported extension APIs.
