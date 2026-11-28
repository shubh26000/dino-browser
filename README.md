<div align="center">
  <img src="assets/browser-icon.png" alt="Dino Browser icon" width="112" />
  <h1>Dino Browser</h1>
  <p><strong>A lightweight Windows desktop browser built with Electron and Chromium.</strong></p>
  <p>
    <img src="https://img.shields.io/badge/platform-Windows-0078D4?logo=windows&logoColor=white" alt="Platform: Windows" />
    <img src="https://img.shields.io/badge/version-1.0.5-5B6CFF" alt="Version 1.0.5" />
    <img src="https://img.shields.io/badge/engine-Electron%20%2B%20Chromium-47848F?logo=electron&logoColor=white" alt="Electron and Chromium" />
  </p>
  <p>
    <a href="#features">Features</a> ·
    <a href="#install-on-windows">Install</a> ·
    <a href="#privacy-at-a-glance">Privacy</a> ·
    <a href="#known-limitations">Limitations</a>
  </p>
</div>

> **App name:** The Windows app and installer are currently branded **Chromium Browser**. **Dino Browser** is the repository name.

Dino Browser brings everyday browsing into a focused desktop app: a custom tab bar, a flexible start page, encrypted browser-library data, and a small set of built-in privacy controls.

## At a glance

| | |
|---|---|
| **Platform** | Windows desktop |
| **Built with** | Electron and its bundled Chromium engine |
| **Current version** | 1.0.5 |
| **Data storage** | Browser library encrypted with Windows DPAPI; website storage is temporary by default |
| **Project status** | Early build; see the [manual QA checklist](MANUAL_QA.md) for verification status and known gaps |

## Features

| **Browse your way** | **Make the start page yours** |
|---|---|
| Tabs, address/search bar, back and forward, reload and stop, page find, zoom, print, save page, and DevTools. | Offline backgrounds, local wallpaper, shortcuts, greeting and clock, plus local widgets for bookmarks, recent pages, tasks, and notes. |

| **Keep control** | **Use the keyboard** |
|---|---|
| Temporary website sessions by default, encrypted history and bookmarks, per-site Shields controls, and clear privacy settings. | Familiar shortcuts for tabs, navigation, bookmarks, history, search, focus, and display controls. |

### Selected shortcuts

| Action | Shortcut |
|---|---|
| Focus the address bar | Ctrl+L or Alt+D |
| New / close / restore a tab | Ctrl+T / Ctrl+W / Ctrl+Shift+T |
| Move between tabs | Ctrl+Tab / Ctrl+Shift+Tab |
| Search open and recent tabs | Ctrl+Shift+A |
| Find in page | Ctrl+F; next/previous match: Ctrl+G / Ctrl+Shift+G |
| Bookmark this page | Ctrl+D |
| Open history / bookmarks | Ctrl+H / Ctrl+Shift+O |
| Reload / hard reload / stop | F5 or Ctrl+R / Ctrl+Shift+R / Escape |
| Zoom in / out / reset | Ctrl++ / Ctrl+- / Ctrl+0 |
| Toggle full screen | F11 |

## Privacy at a glance

- **Encrypted browser library:** History, bookmarks, settings, extension metadata, and start-page preferences use Windows DPAPI encryption. The app is designed to fail closed if encryption is unavailable.
- **Temporary site data by default:** Cookies and website storage are kept for the current run, so sites may sign out when the browser closes.
- **Extensions change that choice:** Local extension support requires a persistent session and retains cookies and site data between launches. Turning extension support off clears that profile.
- **No saved website passwords:** Password saving is not implemented.
- **Local Shields:** A small bundled set of ad and analytics hosts can be blocked. You can turn Shields off, add site exceptions, or add hostname rules.
- **No remote filter updates:** The browser does not fetch filter lists. Search queries go to your selected search engine; extension code may make its own network requests.

Read [PRIVACY.md](PRIVACY.md) for details, including what Shields does not protect against. Downloaded files and wallpaper image files themselves are not encrypted by the browser.

## Install and update on Windows

Build the installer from a Windows checkout:

1. Install [Node.js](https://nodejs.org/) and npm.
2. Open PowerShell in the project folder.
3. Run:

   - Install dependencies: npm install
   - Build the installer: npm run build:win

4. Launch the generated installer from the dist folder. Version 1.0.5 is named `Chromium-Browser-Setup-1.0.5.exe`.

The installer is configured for the current Windows user and adds a Desktop shortcut and Start menu entry; administrator access is not required. Existing 1.0.4 installs need this one-time installer update because 1.0.4 did not include an updater.

After 1.0.5 is installed, Dino Browser checks for public GitHub releases at startup and every six hours. Open **Settings → About** to check manually or see download progress. Updates download in the background; click **Restart to update** when ready to apply one. Closing the browser does not silently install a downloaded update.

To publish a future Windows update, increment the `package.json` version, push a matching `v<version>` tag, and let [the Windows release workflow](.github/workflows/release-windows.yml) build and publish the installer. The updater requires a public, non-draft GitHub release so it can read the generated `latest.yml` metadata. Keep the installer name and app ID stable so updates replace the existing per-user install.

**Signing:** Current installers are unsigned. Update downloads come from GitHub over HTTPS and electron-updater checks the downloaded asset against its SHA-512 release metadata, but the browser cannot authenticate a publisher identity with Authenticode until the project obtains and configures a Windows code-signing certificate.

## Develop and check

From the project folder:

- **Start the app:** npm start
- **Run automated tests:** npm test
- **Build the Windows installer:** npm run build:win

Interactive Windows checks are tracked in [MANUAL_QA.md](MANUAL_QA.md). The checklist includes keyboard and pointer workflows, accessibility, display scaling, privacy behavior, navigation failures, and performance checks.

## Known limitations

This is an early Electron browser build, and it does not implement every Chromium feature.

- Downloads management, private windows, multiple browser windows, and view-source are not implemented.
- Native page permissions, tab groups, vertical tabs, tab hover cards, and moving tabs between windows are not implemented.
- Extensions are experimental and limited to user-selected unpacked Manifest V2/V3 folders. There is no Chrome Web Store, CRX, extension action popup, or full Chrome extension API support.
- Shields uses a small starter list. It does not include cosmetic filtering, scriptlets, fingerprint defenses, remote lists, or ABP/uBlock rule syntax.
- Start-page bandwidth and time savings are estimates, not measurements.
- Automatic updates require an installed, packaged build and a published GitHub release; `npm start` development runs do not update.

See [MANUAL_QA.md](MANUAL_QA.md) for the broader gap list and outstanding manual checks.

## Project files

- [Privacy notes](PRIVACY.md)
- [Manual QA checklist](MANUAL_QA.md)
- [Build and source](https://github.com/shubh26000/dino-browser)

---

<div align="center">
  <sub>Built for Windows · Electron + Chromium</sub>
</div>
