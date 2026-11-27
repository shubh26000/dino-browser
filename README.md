# Chromium Desktop Browser

A lightweight Windows desktop browser built with Electron and its bundled
Chromium engine. It includes encrypted history and bookmarks, a customizable
search engine and theme, temporary website sessions, and a subtle ambient
toolbar effect. The browser uses a custom tab bar and window controls instead
of native File and Edit menus. New tabs show a minimal search/address bar;
they do not automatically open a search engine page.

History, bookmarks, settings, and extension metadata are encrypted using
Windows account encryption (DPAPI). The browser fails to start rather than
saving this data unencrypted if Windows encryption is unavailable. Website
cookies and storage are kept only for the current run by default, so websites
will sign out when the browser closes. Enabling unpacked extension support
requires a persistent session and retains cookies and website data between
launches; disabling it clears that extension-enabled profile before returning
to temporary website storage. This browser does not save website passwords.
Dark mode uses a pure
black browser interface for OLED displays. On first startup after upgrading,
existing browser records are encrypted before their plaintext file is removed,
and the old persistent website profile is cleared. Downloaded files are saved
to the chosen folder and are not encrypted by the browser.

Settings also include five accent presets, a custom `#RRGGBB` accent, and
comfortable or compact browser density. Existing saved settings receive the
default accent and comfortable density when upgraded.

Keyboard shortcuts:

- `Ctrl+L`, `Alt+D`: focus the address bar; `F6`: cycle focus between browser chrome, bookmarks, and page
- `Ctrl+T`, `Ctrl+W`, `Ctrl+Shift+T`: new, close, and restore a tab
- `Ctrl+Tab` / `Ctrl+Shift+Tab`, `Ctrl+1`–`Ctrl+8`, `Ctrl+9`: switch tabs
- `Ctrl+Shift+A`: search open tabs and recently closed tabs
- `Alt+Left` / `Alt+Right`, `F5`, `Ctrl+R`, `Ctrl+Shift+R`, `Escape`: navigate, reload, hard reload, and stop
- `Alt+Home`: open the start page
- `Ctrl+D`, `Ctrl+Shift+D`: bookmark the current page or all open web tabs
- `Ctrl+H`, `Ctrl+Shift+O`, `Ctrl+J`, `Ctrl+,`: history, bookmarks, downloads status page, and settings
- `Ctrl+F`, `Ctrl+G`, `Ctrl+Shift+G`: find text and move between matches
- `Ctrl+P`, `Ctrl+S`, `F12` / `Ctrl+Shift+I`: print, save a page, and open DevTools
- `Ctrl++`, `Ctrl+-`, `Ctrl+0`: zoom in, zoom out, and reset page zoom
- `Ctrl+Shift+B`: show or hide the bookmarks bar; `Ctrl+Shift+Delete`: clear browsing data
- `F11`: toggle full screen; press `F11` again to exit
- `Ctrl+Enter` in the address bar: append `.com` to a single-word address; `Alt+Enter`: open it in a new tab

Settings also includes a high-contrast browser UI option, reduced motion,
visible keyboard focus, and startup session restore. Session restore is off by
default and stores up to 20 web addresses in the encrypted browser library.
Downloads, private windows, multiple browser windows, and view-source are not
implemented in this Electron build; see `MANUAL_QA.md` for these gaps.

Slow navigations show a tab spinner after a short delay. The reload control
becomes Stop while a page is loading. Failed and crashed pages show a browser
recovery screen with a reload action and technical details; certificate
failures remain blocked and do not offer a bypass.

Shields use a small bundled set of blocked ad and analytics hosts. Request
blocking can be disabled globally or bypassed for selected sites. HTTPS-first
tries HTTPS for typed HTTP addresses; if the secure connection is refused, the
error page offers a deliberate HTTP fallback. Common tracking query parameters
are removed before navigation. These protections work at Electron's request
hook level and do not include cosmetic page filtering, scriptlets,
fingerprinting defenses, or remote filter-list updates.

The toolbar Shields popup shows the current page's blocked count and temporary
blocked-domain list. Settings > Shields contains global controls, a list of
site exceptions, and custom host rules (one hostname per line). Aggregate
category counts are stored locally. Start-page bandwidth and time savings are
labeled estimates, using a fixed heuristic of 50 KiB and 100 ms per blocked
request. The Windows package includes the Shields engine module and privacy
notes.

New tabs have five offline gradient backgrounds, optional local image wallpaper,
greeting and clock controls, top-site/custom shortcut tiles, and a Customize
drawer. The local widget gallery includes quotes, bookmarks, recent pages, a
to-do list, and quick notes. Start-page preferences and notes are stored with
the encrypted browser library; custom wallpaper images remain at their
user-selected file path and are loaded locally.

Extensions are experimental and limited to local unpacked Manifest V2/V3
folders. The browser reviews manifest permissions before install, and the
Chrome Web Store, CRX packages, extension action popups, and parts of Chrome's
extension API are not supported. Extension code may make its own network
requests. Electron's own request hook takes precedence over conflicting
`chrome.webRequest` extension handlers. Declarative Net Request is not listed
as a supported Electron API, so common Chrome extensions may not work. See
`PRIVACY.md` before enabling the persistent extension session.

## Install on Windows

Build the installer from this project directory:

```powershell
npm install
npm run build:win
```

Run `dist\Chromium-Browser-Setup-1.0.2.exe` to install Chromium Browser for
your Windows user. The installer adds a Desktop shortcut and a Start menu
entry, and no administrator access is required.

For development, use `npm start`. Run automated checks with `npm test` and
follow `MANUAL_QA.md` for manual checks and platform limitations.
