# Manual QA checklist

## Run status

- [ ] Complete interactive QA on Windows after `npm start` launches successfully.
- [ ] Capture light, dark, high-contrast, compact, and 200% scale screenshots.
- [ ] Run a screen-reader pass and automated accessibility scan.
- [ ] Record startup, new-tab, tab-switch, and Shields before/after measurements.

The current checkout's `npm start` exits with code 1 and no diagnostic text in
this environment, so the checks below are prepared but have not been performed
in the running application. Automated Node tests and syntax checks are reported
separately in the Phase 8 handoff.

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
- [ ] Check dialogs, popups, settings search highlights, errors, and focus rings
  for clipping and contrast.
- [ ] Run an axe-equivalent scan and manual NVDA/Windows Narrator review.
- [ ] Check RTL layouts, zoom to 200%, and a 360-pixel-wide responsive viewport.

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
