const path = require('node:path');
const fs = require('node:fs/promises');
const { randomUUID } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  Menu,
  dialog,
  clipboard,
  safeStorage,
  session,
  nativeTheme,
} = require('electron');
const { BrowserStore } = require('./browser-store');
const { inspectUnpackedExtension } = require('./extension-manager');
const { resolveBrowserShortcut } = require('./keyboard-shortcuts');
const { evaluateRequest, isShieldException } = require('./shields');
const {
  describeNavigationError,
  isAllowedNavigation,
  isTrustedUiUrl,
  normalizeAddress,
} = require('./navigation');

const UI_URL = pathToFileURL(path.join(__dirname, 'index.html')).href;
const BOOKMARK_IMPORT_MAX_BYTES = 10 * 1024 * 1024;
const INTERNAL_PAGES = new Set(['home', 'history', 'bookmarks', 'settings', 'shields', 'extensions', 'tab-search', 'downloads']);
let BROWSER_SESSION_PARTITION = 'browser-session';
const LEGACY_SESSION_PARTITION = 'persist:browser';
const tabs = new Map();
const tabsByWebContentsId = new Map();
const shieldsUpdateTimers = new Map();
let shieldsStatsSaveTimer;
let browserWindow;
let activeTabId;
let nextTabId = 1;
let store;
let storeReady;
let savingOnQuit;
let extensionSupportRestartRequired = false;
const extensionInstallTickets = new Map();
const extensionRuntimeErrors = new Map();
const recentlyClosedTabs = [];
let findBarOpen = false;

function getToolbarHeight() {
  const compact = store?.state.settings.density === 'compact';
  const hasBookmarksBar = store?.state.settings.showBookmarksBar !== false;
  return (compact ? 112 : 124) - (hasBookmarksBar ? 0 : 30) + (findBarOpen ? 42 : 0);
}

function getWindowBackgroundColor() {
  const theme = store?.state.settings.theme || 'system';
  const useDark = theme === 'dark' || (theme === 'system' && nativeTheme.shouldUseDarkColors);
  return useDark ? '#08090c' : '#f2f4f8';
}

function syncBackgroundColor() {
  const color = getWindowBackgroundColor();
  if (browserWindow && !browserWindow.isDestroyed()) {
    browserWindow.setBackgroundColor(color);
  }
  for (const tab of tabs.values()) {
    if (tab.kind === 'web' && !tab.view.webContents.isDestroyed()) {
      tab.view.setBackgroundColor(color);
    }
  }
}

function getTabState(tab) {
  const url = tab.kind === 'internal' ? tab.url : tab.error?.url || tab.view.webContents.getURL();
  const shieldsActive = tab.kind === 'web'
    && store.state.settings.shieldsEnabled
    && !isShieldException(url, store.state.settings.shieldExceptions);
  return {
    id: tab.id,
    title: tab.error?.title || tab.title || 'New tab',
    url,
    isLoading: tab.isLoading,
    loadingPhase: tab.loadingPhase,
    isBookmarked: tab.kind === 'web'
      && store.state.bookmarks.some((bookmark) => bookmark.url === tab.view.webContents.getURL()),
    internalPage: tab.kind === 'internal' ? tab.page : null,
    error: tab.error
      ? { ...tab.error, canUseHttpFallback: Boolean(tab.pendingHttpFallback) }
      : null,
    shieldsActive,
    shieldsBlockedCount: tab.blockedRequestCount || 0,
    shieldsBlockedByCategory: { ...(tab.blockedByCategory || {}) },
    shieldsBlockedDomains: [...(tab.blockedDomains || [])].slice(0, 50),
    isInsecureFallback: Boolean(tab.insecureFallback),
  };
}

function scheduleShieldsState(tab) {
  const contentsId = tab.view.webContents.id;
  if (shieldsUpdateTimers.has(contentsId)) return;
  const timer = setTimeout(() => {
    shieldsUpdateTimers.delete(contentsId);
    sendState();
  }, 250);
  shieldsUpdateTimers.set(contentsId, timer);
}

function scheduleShieldsStatsSave() {
  if (shieldsStatsSaveTimer) return;
  shieldsStatsSaveTimer = setTimeout(() => {
    shieldsStatsSaveTimer = undefined;
    void persistStore().then((saved) => {
      if (saved) sendLibrary();
    });
  }, 1000);
}

function configureRequestProtection() {
  const browserSession = session.fromPartition(BROWSER_SESSION_PARTITION);
  browserSession.webRequest.onBeforeRequest(
    { urls: ['http://*/*', 'https://*/*'] },
    (details, callback) => {
      const contentsId = details.webContentsId ?? details.webContents?.id;
      const tab = tabsByWebContentsId.get(contentsId);
      const topLevelUrl = details.resourceType === 'mainFrame'
        ? details.url
        : tab?.topLevelUrl || tab?.view.webContents.getURL() || details.initiatorOrigin || details.referrer;
      let decision;
      try {
        decision = evaluateRequest(details, {
          ...store.state.settings,
          topLevelUrl,
        });
      } catch (error) {
        console.error('Shields request check failed:', error);
        callback({});
        return;
      }

      if (decision.type === 'block') {
        if (tab) {
          tab.blockedRequestCount = (tab.blockedRequestCount || 0) + 1;
          tab.blockedByCategory ||= {};
          tab.blockedByCategory[decision.category] = (tab.blockedByCategory[decision.category] || 0) + 1;
          tab.blockedDomains ||= new Set();
          tab.blockedDomains.add(decision.domain);
          store.recordBlockedRequest(decision.category);
          scheduleShieldsStatsSave();
          scheduleShieldsState(tab);
        }
        callback({ cancel: true });
      } else if (decision.type === 'redirect') {
        if (decision.reason === 'https-first' && tab) {
          tab.pendingHttpFallback = decision.fallbackUrl;
        }
        callback({ redirectURL: decision.redirectUrl });
      } else {
        callback({});
      }
    },
  );
}

function getLibraryState() {
  const library = store.snapshot();
  library.extensions = library.extensions.map((extension) => {
    const { path: extensionPath, ...publicExtension } = extension;
    void extensionPath;
    return {
      ...publicExtension,
      runtimeError: extensionRuntimeErrors.get(extension.key) || null,
      status: extensionSupportRestartRequired
        ? 'restart-required'
        : (extension.enabled ? (extensionRuntimeErrors.has(extension.key) ? 'error' : 'active') : 'disabled'),
    };
  });
  library.extensionSupportRestartRequired = extensionSupportRestartRequired;
  const wallpaperPath = library.startPage.wallpaperPath;
  delete library.startPage.wallpaperPath;
  if (wallpaperPath) {
    try {
      library.startPage.wallpaperUrl = pathToFileURL(wallpaperPath).href;
    } catch {
      library.startPage.wallpaperUrl = null;
    }
  } else {
    library.startPage.wallpaperUrl = null;
  }
  return library;
}

function decodeImportedText(value) {
  return value
    .replace(/&#x([0-9a-f]{1,6});/gi, (match, code) => {
      const number = Number.parseInt(code, 16);
      return number <= 0x10ffff ? String.fromCodePoint(number) : match;
    })
    .replace(/&#(\d{1,7});/g, (match, code) => {
      const number = Number.parseInt(code, 10);
      return number <= 0x10ffff ? String.fromCodePoint(number) : match;
    })
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function parseBookmarkImport(contents, extension) {
  const entries = [];
  if (extension === '.json') {
    let parsed;
    try { parsed = JSON.parse(contents); } catch (error) {
      throw new Error('The selected bookmarks JSON could not be parsed.', { cause: error });
    }
    const pending = [parsed.roots || parsed];
    let examined = 0;
    while (pending.length && entries.length < 2000 && examined < 50000) {
      const item = pending.pop();
      examined += 1;
      if (!item || typeof item !== 'object') continue;
      if (Array.isArray(item)) {
        pending.push(...item.filter((child) => child && typeof child === 'object'));
        continue;
      }
      if (item.type === 'url' && typeof item.url === 'string') {
        entries.push({ title: typeof item.name === 'string' ? item.name : item.url, url: item.url });
      }
      const children = Array.isArray(item.children)
        ? item.children
        : Object.values(item).filter((child) => child && typeof child === 'object');
      pending.push(...children);
    }
    return entries;
  }

  const anchorPattern = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a\s*>/gi;
  for (const match of contents.matchAll(anchorPattern)) {
    if (entries.length >= 2000) break;
    const rawUrl = match[1] ?? match[2] ?? match[3] ?? '';
    const title = decodeImportedText((match[4] || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
    entries.push({ title: title || rawUrl, url: decodeImportedText(rawUrl) });
  }
  if (!entries.length) throw new Error('No HTTP or HTTPS bookmarks were found in that file.');
  return entries;
}

function sendLibrary() {
  if (browserWindow && !browserWindow.isDestroyed()) {
    browserWindow.webContents.send('browser:library', getLibraryState());
  }
}

function sendError(message) {
  if (browserWindow && !browserWindow.isDestroyed()) {
    browserWindow.webContents.send('browser:error', message);
  }
}

async function persistStore() {
  try {
    await store.save();
    return true;
  } catch (error) {
    console.error('Unable to save browser data:', error);
    sendError('Could not save browser data. Your latest changes may be lost.');
    return false;
  }
}

async function persistAndSendLibrary() {
  const saved = await persistStore();
  sendLibrary();
  sendState();
  return saved;
}

function sendState() {
  if (!browserWindow || browserWindow.isDestroyed()) {
    return;
  }

  const activeTab = tabs.get(activeTabId);
  browserWindow.webContents.send('browser:state', {
    tabs: [...tabs.values()].map(getTabState),
    recentlyClosedTabs: recentlyClosedTabs.map((tab) => ({ ...tab })),
    activeTabId,
    canGoBack: activeTab?.kind === 'web' && activeTab.view.webContents.canGoBack(),
    canGoForward: activeTab?.kind === 'web' && activeTab.view.webContents.canGoForward(),
    internalPage: activeTab?.kind === 'internal'
      ? activeTab.page
      : activeTab?.error ? 'error' : null,
    error: activeTab?.error || null,
    isMaximized: browserWindow.isMaximized(),
    isFullScreen: browserWindow.isFullScreen(),
  });
}

function updateViewBounds() {
  if (!browserWindow || browserWindow.isDestroyed()) {
    return;
  }

  const { width, height } = browserWindow.getContentBounds();
  const activeTab = tabs.get(activeTabId);
  if (activeTab?.kind === 'web' && !activeTab.error) {
    const toolbarHeight = getToolbarHeight();
    activeTab.view.setBounds({
      x: 0,
      y: toolbarHeight,
      width,
      height: Math.max(0, height - toolbarHeight),
    });
  }
}

function activateTab(id) {
  const tab = tabs.get(id);
  if (!tab || !browserWindow) {
    return;
  }

  const previousTab = tabs.get(activeTabId);
  if (previousTab?.kind === 'web' && previousTab.id !== id) {
    browserWindow.contentView.removeChildView(previousTab.view);
  }

  activeTabId = id;
  if (tab.kind === 'web' && !tab.error) {
    browserWindow.contentView.addChildView(tab.view);
  }
  updateViewBounds();
  if (tab.kind === 'web' && !tab.error) {
    tab.view.webContents.focus();
  } else {
    browserWindow.webContents.focus();
  }
  sendState();
}

function createTab(address, existingId) {
  if (address === undefined && !existingId) {
    return createInternalTab('home');
  }
  if (typeof address !== 'string') {
    throw new TypeError('A web tab requires an address.');
  }

  const id = existingId || String(nextTabId++);
  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      partition: BROWSER_SESSION_PARTITION,
    },
  });
  const tab = {
    id,
    view,
    kind: 'web',
    title: 'Loading…',
    isLoading: true,
    loadingPhase: 'waiting',
    failedNavigation: false,
    error: null,
    blockedRequestCount: 0,
    blockedByCategory: {},
    blockedDomains: new Set(),
  };
  tabs.set(id, tab);

  const contents = view.webContents;
  view.setBackgroundColor(getWindowBackgroundColor());
  tabsByWebContentsId.set(contents.id, tab);
  contents.on('before-input-event', (event, input) => handleShortcut(event, input, contents));
  contents.setZoomMode('isolated');
  void contents.setVisualZoomLevelLimits(1, 3).catch((error) => console.warn('Pinch zoom is unavailable:', error));
  contents.on('context-menu', (_event, params) => showPageContextMenu(contents, params));
  contents.on('found-in-page', (_event, result) => {
    if (browserWindow && !browserWindow.isDestroyed()) {
      browserWindow.webContents.send('browser:find-result', {
        matchCount: result.matches,
        activeMatchOrdinal: result.activeMatchOrdinal,
      });
    }
  });
  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedNavigation(url)) {
      createTab(url);
    }
    return { action: 'deny' };
  });
  contents.on('will-navigate', (event, url) => {
    if (!isAllowedNavigation(url)) {
      event.preventDefault();
    }
  });
  contents.on('page-title-updated', (_event, title) => {
    tab.title = title || 'New tab';
    const url = contents.getURL();
    if (store.updateHistoryTitle(url, tab.title)) {
      void persistAndSendLibrary();
    }
    sendState();
  });
  contents.on('did-start-loading', () => {
    const wasShowingError = Boolean(tab.error);
    tab.isLoading = true;
    tab.loadingPhase = 'waiting';
    tab.failedNavigation = false;
    tab.error = null;
    if (wasShowingError && activeTabId === id && browserWindow && !browserWindow.isDestroyed()) {
      browserWindow.contentView.addChildView(view);
      updateViewBounds();
      contents.focus();
    }
    sendState();
  });
  contents.on('did-stop-loading', () => {
    tab.isLoading = false;
    tab.loadingPhase = null;
    if (!tab.failedNavigation) {
      store.recordVisit(contents.getURL(), tab.title);
      void persistAndSendLibrary();
    }
    sendState();
  });
  contents.on('did-start-navigation', (_event, navigationUrl, _isInPlace, isMainFrame) => {
    if (!isMainFrame) return;
    tab.topLevelUrl = navigationUrl;
    tab.blockedRequestCount = 0;
    tab.blockedByCategory = {};
    tab.blockedDomains = new Set();
    const navigationHost = (() => {
      try { return new URL(navigationUrl).hostname; } catch { return ''; }
    })();
    let navigationProtocol = '';
    try { navigationProtocol = new URL(navigationUrl).protocol; } catch {}
    const sameInsecureSite = navigationProtocol === 'http:'
      && tab.insecureFallback
      && tab.insecureFallbackHost
      && navigationHost === tab.insecureFallbackHost;
    if (tab.markNextNavigationInsecure) {
      tab.insecureFallback = true;
      tab.insecureFallbackHost = navigationHost;
    } else if (!sameInsecureSite) {
      tab.insecureFallback = false;
      tab.insecureFallbackHost = null;
    }
    tab.markNextNavigationInsecure = false;
    sendState();
  });
  contents.on('did-navigate', () => {
    tab.loadingPhase = tab.isLoading ? 'loading' : null;
    tab.topLevelUrl = contents.getURL();
    tab.pendingHttpFallback = null;
    sendState();
  });
  contents.on('did-navigate-in-page', () => {
    store.recordVisit(contents.getURL(), tab.title);
    void persistAndSendLibrary();
    sendState();
  });
  contents.on('did-fail-load', (_event, errorCode, errorDescription, failingUrl, isMainFrame) => {
    if (isMainFrame && errorCode !== -3) {
      tab.failedNavigation = true;
      tab.isLoading = false;
      tab.loadingPhase = null;
      const canUseHttpFallback = errorCode === -102
        && Boolean(tab.pendingHttpFallback)
        && /^https:/i.test(failingUrl || '');
      tab.error = canUseHttpFallback
        ? {
          title: 'Secure connection unavailable',
          description: 'This site refused an encrypted connection. You can retry over HTTP, but that connection will not be encrypted.',
          code: errorDescription || 'ERR_CONNECTION_REFUSED',
          url: failingUrl || contents.getURL(),
        }
        : describeNavigationError(errorCode, errorDescription, failingUrl || contents.getURL());
      tab.title = tab.error.title;
      if (activeTabId === id && browserWindow && !browserWindow.isDestroyed()) {
        browserWindow.contentView.removeChildView(view);
        browserWindow.webContents.focus();
      }
      console.error(`Navigation failed (${errorCode}): ${errorDescription}`);
      sendState();
    }
  });
  contents.on('render-process-gone', (_event, details) => {
    tab.failedNavigation = true;
    tab.isLoading = false;
    tab.loadingPhase = null;
    const outOfMemory = details?.reason === 'oom';
    tab.error = {
      title: outOfMemory ? 'This tab ran out of memory' : 'This tab crashed',
      description: outOfMemory
        ? 'The page used more memory than Windows could provide. Reload the tab to try again.'
        : 'The page stopped responding. Reload the tab to try again.',
      code: details?.reason || 'render-process-gone',
      url: contents.getURL(),
    };
    tab.title = tab.error.title;
    if (activeTabId === id && browserWindow && !browserWindow.isDestroyed()) {
      browserWindow.contentView.removeChildView(view);
      browserWindow.webContents.focus();
    }
    sendState();
  });
  contents.on('destroyed', () => {
    tabs.delete(id);
    tabsByWebContentsId.delete(contents.id);
    clearTimeout(shieldsUpdateTimers.get(contents.id));
    shieldsUpdateTimers.delete(contents.id);
    if (activeTabId === id) {
      activeTabId = undefined;
      const nextTab = tabs.values().next().value;
      if (nextTab) {
        activateTab(nextTab.id);
      } else if (browserWindow && !browserWindow.isDestroyed()) {
        createTab();
      }
    }
    sendState();
  });

  activateTab(id);
  contents.loadURL(normalizeAddress(address, store.state.settings.searchEngine)).catch((error) => {
    console.error('Unable to navigate:', error);
  });
  return id;
}

function createInternalTab(page) {
  if (!INTERNAL_PAGES.has(page)) {
    throw new TypeError('Unknown browser page.');
  }
  const id = String(nextTabId++);
  const isHome = page === 'home';
  tabs.set(id, {
    id,
    kind: 'internal',
    page,
    url: isHome ? '' : `browser://${page}`,
    title: isHome ? 'New tab' : page[0].toUpperCase() + page.slice(1),
    isLoading: false,
  });
  activateTab(id);
  return id;
}

function navigateActiveTab(address) {
  const tab = tabs.get(activeTabId);
  if (!tab) {
    throw new Error('There is no active browser tab.');
  }
  if (tab.kind === 'internal') {
    return createTab(address, tab.id);
  }
  const contents = tab.view.webContents;
  tab.pendingHttpFallback = null;
  tab.markNextNavigationInsecure = false;
  contents.focus();
  return contents.loadURL(normalizeAddress(address, store.state.settings.searchEngine)).catch((error) => {
    console.error('Unable to navigate:', error);
    sendError('The page could not be opened.');
  });
}

function closeTab(id) {
  const tab = tabs.get(id);
  if (!tab) {
    return;
  }

  if (tab.kind === 'web') {
    const url = tab.error?.url || tab.view.webContents.getURL();
    if (isAllowedNavigation(url)) {
      recentlyClosedTabs.unshift({ url, title: tab.title || url });
      recentlyClosedTabs.length = Math.min(recentlyClosedTabs.length, 10);
    }
  }

  const wasActive = activeTabId === id;
  if (wasActive && tab.kind === 'web') {
    browserWindow.contentView.removeChildView(tab.view);
  }
  tabs.delete(id);
  if (wasActive) activeTabId = undefined;
  if (tab.kind === 'web') {
    tab.view.webContents.close();
  }

  if (wasActive) {
    const remaining = [...tabs.values()];
    if (remaining.length) {
      activateTab(remaining[remaining.length - 1].id);
    } else {
      createTab();
    }
  }
  sendState();
}

function switchTabByOffset(offset) {
  const ids = [...tabs.keys()];
  if (ids.length < 2) return;
  const current = Math.max(0, ids.indexOf(activeTabId));
  const next = (current + offset + ids.length) % ids.length;
  activateTab(ids[next]);
}

function selectTabIndex(index) {
  const ids = [...tabs.keys()];
  if (!ids.length) return;
  activateTab(ids[index < 0 ? ids.length - 1 : Math.min(index, ids.length - 1)]);
}

function restoreClosedTab() {
  const closed = recentlyClosedTabs.shift();
  if (closed) createTab(closed.url);
  else sendError('There are no recently closed tabs to restore.');
}

function reorderTab(fromId, toId) {
  if (typeof fromId !== 'string' || typeof toId !== 'string' || fromId === toId) return false;
  const entries = [...tabs.entries()];
  const fromIndex = entries.findIndex(([id]) => id === fromId);
  const toIndex = entries.findIndex(([id]) => id === toId);
  if (fromIndex < 0 || toIndex < 0) return false;
  const [entry] = entries.splice(fromIndex, 1);
  entries.splice(toIndex, 0, entry);
  tabs.clear();
  for (const [id, tab] of entries) tabs.set(id, tab);
  sendState();
  return true;
}

function showPageContextMenu(contents, params) {
  const template = [];
  if (params.isEditable) {
    template.push(
      { role: 'undo' }, { role: 'redo' }, { type: 'separator' },
      { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
    );
  } else {
    if (params.linkURL && isAllowedNavigation(params.linkURL)) {
      template.push(
        { label: 'Open link in new tab', click: () => createTab(params.linkURL) },
        { label: 'Copy link address', click: () => clipboard.writeText(params.linkURL) },
        { type: 'separator' },
      );
    }
    if (params.selectionText) {
      template.push(
        { label: 'Search for selected text', click: () => createTab(normalizeAddress(params.selectionText, store.state.settings.searchEngine)) },
        { role: 'copy' },
        { type: 'separator' },
      );
    }
    template.push(
      { label: 'Back', enabled: contents.canGoBack(), click: () => contents.goBack() },
      { label: 'Forward', enabled: contents.canGoForward(), click: () => contents.goForward() },
      { label: 'Reload', click: () => contents.reload() },
      { type: 'separator' },
      { label: 'Inspect', click: () => { contents.openDevTools({ mode: 'detach' }); contents.inspectElement(params.x, params.y); } },
    );
  }
  if (template.length) Menu.buildFromTemplate(template).popup({ window: browserWindow });
}

function showTabContextMenu(id) {
  if (!tabs.has(id)) return;
  Menu.buildFromTemplate([
    { label: 'New tab', click: () => createTab() },
    { label: 'Reload tab', enabled: tabs.get(id).kind === 'web', click: () => tabs.get(id)?.view.webContents.reload() },
    { type: 'separator' },
    { label: 'Close tab', click: () => closeTab(id) },
    { label: 'Close other tabs', click: () => {
      for (const tabId of [...tabs.keys()]) if (tabId !== id) closeTab(tabId);
      if (tabs.has(id)) activateTab(id);
    } },
  ]).popup({ window: browserWindow });
}

function showBookmarkContextMenu(id) {
  const bookmark = store.state.bookmarks.find((entry) => entry.id === id);
  if (!bookmark) return;
  Menu.buildFromTemplate([
    { label: 'Open bookmark', click: () => createTab(bookmark.url) },
    { label: 'Remove bookmark', click: async () => { store.removeBookmark(id); await persistAndSendLibrary(); } },
  ]).popup({ window: browserWindow });
}

function showToolbarMenu(template, kind, position, preferredWidth) {
  const menu = Menu.buildFromTemplate(template);
  menu.on('menu-will-close', () => {
    if (browserWindow && !browserWindow.isDestroyed()) {
      browserWindow.webContents.send('browser:toolbar-menu-closed', kind);
    }
  });
  const { width } = browserWindow.getContentBounds();
  const options = { window: browserWindow };
  if (position && Number.isFinite(position.x) && Number.isFinite(position.y)) {
    options.x = Math.max(0, Math.min(width - preferredWidth, Math.round(position.x)));
    options.y = Math.max(0, Math.round(position.y));
  }
  menu.popup(options);
}

function saveToolbarMenuSettings(patch, reload = true) {
  store.updateSettings(patch);
  void persistAndSendLibrary().then((saved) => {
    const tab = tabs.get(activeTabId);
    if (saved && reload && tab?.kind === 'web' && !tab.error) {
      tab.view.webContents.reload();
    }
  });
}

function getActiveWebSite() {
  const tab = tabs.get(activeTabId);
  if (tab?.kind !== 'web' || tab.error) return null;
  try {
    const url = new URL(tab.view.webContents.getURL());
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return { tab, url: url.href, host: url.hostname.toLowerCase() };
  } catch {
    return null;
  }
}

function setActiveSiteShields(enabled) {
  const site = getActiveWebSite();
  if (!site) return;
  const oldExceptions = store.state.settings.shieldExceptions || [];
  const shieldExceptions = enabled
    ? oldExceptions.filter((domain) => site.host !== domain && !site.host.endsWith('.' + domain))
    : [...new Set([...oldExceptions, site.host])];
  saveToolbarMenuSettings({ shieldExceptions });
}

function showBrowserToolbarMenu(position) {
  const pages = [
    ['History', 'history', 'Ctrl+H'],
    ['Bookmarks', 'bookmarks', 'Ctrl+Shift+O'],
    ['Shields', 'shields'],
    ['Extensions', 'extensions'],
    ['Downloads', 'downloads'],
    ['Settings', 'settings', 'Ctrl+,'],
  ];
  const template = pages.map(([label, page, accelerator]) => ({
    label,
    accelerator,
    click: () => createInternalTab(page),
  }));
  showToolbarMenu(template, 'browser', position, 240);
}

function showShieldsToolbarMenu(position) {
  const settings = store.state.settings;
  const site = getActiveWebSite();
  const template = [];
  if (site) {
    const siteEnabled = settings.shieldsEnabled
      && !isShieldException(site.url, settings.shieldExceptions);
    template.push(
      { label: site.host, enabled: false },
      { label: (site.tab.blockedRequestCount || 0) + ' requests blocked on this page', enabled: false },
      { type: 'separator' },
      {
        label: 'Enable Shields for this site',
        type: 'checkbox',
        checked: siteEnabled,
        enabled: settings.shieldsEnabled,
        click: (item) => setActiveSiteShields(item.checked),
      },
      {
        label: 'Report a broken site · turn Shields off here',
        enabled: siteEnabled,
        click: () => setActiveSiteShields(false),
      },
      { type: 'separator' },
    );
  } else {
    template.push({ label: 'Open a website to see protection details', enabled: false });
  }
  template.push(
    {
      label: 'Enable Shields globally',
      type: 'checkbox',
      checked: settings.shieldsEnabled,
      click: (item) => saveToolbarMenuSettings({ shieldsEnabled: item.checked }),
    },
    { type: 'separator' },
    {
      label: 'Advanced protections',
      submenu: [
        {
          label: 'Ads',
          type: 'checkbox',
          checked: settings.adsBlocking,
          click: (item) => saveToolbarMenuSettings({ adsBlocking: item.checked }),
        },
        {
          label: 'Trackers',
          type: 'checkbox',
          checked: settings.trackersBlocking,
          click: (item) => saveToolbarMenuSettings({ trackersBlocking: item.checked }),
        },
        {
          label: 'HTTPS-first',
          type: 'checkbox',
          checked: settings.httpsFirst,
          click: (item) => saveToolbarMenuSettings({ httpsFirst: item.checked }),
        },
        {
          label: 'URL cleaning',
          type: 'checkbox',
          checked: settings.urlCleaning,
          click: (item) => saveToolbarMenuSettings({ urlCleaning: item.checked }, false),
        },
      ],
    },
  );
  const categoryCounts = site?.tab.blockedByCategory || {};
  template.push(
    { type: 'separator' },
    {
      label: 'Ads ' + (categoryCounts.ads || 0)
        + ' · Trackers ' + (categoryCounts.trackers || 0)
        + ' · Custom ' + (categoryCounts.custom || 0),
      enabled: false,
    },
  );
  const domains = [...(site?.tab.blockedDomains || [])].slice(0, 8);
  if (domains.length) {
    template.push(
      { type: 'separator' },
      ...domains.map((domain) => ({ label: domain, enabled: false })),
    );
  }
  template.push(
    { type: 'separator' },
    { label: 'Open Shields settings', click: () => createInternalTab('shields') },
  );
  showToolbarMenu(template, 'shields', position, 360);
}

function showExtensionsToolbarMenu(position) {
  const installed = (store.state.extensions || []).filter((extension) => extension.enabled);
  const template = [{ label: 'Extensions', enabled: false }];
  if (installed.length) {
    template.push(
      { type: 'separator' },
      ...installed.map((extension) => ({
        label: extension.name + (
          extensionSupportRestartRequired || extensionRuntimeErrors.has(extension.key)
            ? ' · Needs attention'
            : ' · Enabled'
        ),
        enabled: false,
      })),
    );
  } else {
    template.push({ label: 'No enabled extensions', enabled: false });
  }
  template.push(
    { type: 'separator' },
    { label: 'Manage extensions', click: () => createInternalTab('extensions') },
  );
  showToolbarMenu(template, 'extensions', position, 320);
}

async function toggleActiveBookmark() {
  const tab = tabs.get(activeTabId);
  if (tab?.kind !== 'web') {
    throw new Error('Only web pages can be bookmarked.');
  }
  const contents = tab.view.webContents;
  const isBookmarked = store.toggleBookmark(contents.getURL(), tab.title);
  await persistAndSendLibrary();
  return isBookmarked;
}

function handleShortcut(event, input, sourceContents) {
  const shortcut = resolveBrowserShortcut(input);
  if (!shortcut) return;
  const activeTab = tabs.get(activeTabId);
  if (
    shortcut.action === 'stop'
    && !findBarOpen
    && !(activeTab?.kind === 'web' && activeTab.isLoading)
  ) return;
  event.preventDefault();
  const contents = activeTab?.kind === 'web' ? activeTab.view.webContents : null;
  switch (shortcut.action) {
    case 'focusAddress':
      browserWindow.webContents.focus();
      browserWindow.webContents.send('browser:focus-address');
      break;
    case 'focusCycle':
      if (sourceContents && sourceContents !== browserWindow.webContents) {
        browserWindow.webContents.focus();
        browserWindow.webContents.send(shortcut.reverse && store.state.settings.showBookmarksBar
          ? 'browser:focus-bookmarks'
          : 'browser:focus-address');
      } else {
        browserWindow.webContents.send('browser:cycle-focus', { reverse: shortcut.reverse });
      }
      break;
    case 'newTab': createTab(); break;
    case 'closeTab': closeTab(activeTabId); break;
    case 'restoreClosedTab': restoreClosedTab(); break;
    case 'nextTab': switchTabByOffset(1); break;
    case 'previousTab': switchTabByOffset(-1); break;
    case 'selectTab': selectTabIndex(shortcut.index); break;
    case 'history': createInternalTab('history'); break;
    case 'bookmarks': createInternalTab('bookmarks'); break;
    case 'settings': createInternalTab('settings'); break;
    case 'tabSearch': createInternalTab('tab-search'); break;
    case 'downloads': createInternalTab('downloads'); break;
    case 'home': createInternalTab('home'); break;
    case 'bookmark': toggleActiveBookmark().catch((error) => sendError(error.message)); break;
    case 'bookmarkAllTabs': {
      for (const tab of tabs.values()) {
        if (tab.kind === 'web') store.addBookmark(tab.view.webContents.getURL(), tab.title);
      }
      void persistAndSendLibrary();
      break;
    }
    case 'reload':
      if (contents) contents.reload();
      else sendLibrary();
      break;
    case 'hardReload':
      if (contents) contents.reloadIgnoringCache();
      else sendLibrary();
      break;
    case 'back': if (contents?.canGoBack()) contents.goBack(); break;
    case 'forward': if (contents?.canGoForward()) contents.goForward(); break;
    case 'find': browserWindow.webContents.send('browser:show-find'); break;
    case 'findNext': browserWindow.webContents.send('browser:find-next', { reverse: shortcut.reverse }); break;
    case 'clearBrowsingData': browserWindow.webContents.send('browser:clear-data'); break;
    case 'toggleBookmarksBar':
      store.updateSettings({ showBookmarksBar: !store.state.settings.showBookmarksBar });
      void persistAndSendLibrary().then(() => updateViewBounds());
      break;
    case 'print':
      if (contents) contents.print();
      else sendError('Print is available for web pages only.');
      break;
    case 'savePage':
      if (contents) {
        void dialog.showSaveDialog(browserWindow, {
          title: 'Save page',
          defaultPath: `${(activeTab.title || 'page').replace(/[<>:"/\\|?*]/g, '_').slice(0, 80)}.html`,
          filters: [{ name: 'Complete web page', extensions: ['html'] }],
        }).then(({ canceled, filePath }) => {
          if (!canceled && filePath) return contents.savePage(filePath, 'HTMLComplete');
          return undefined;
        }).catch((error) => sendError(error.message || 'The page could not be saved.'));
      }
      break;
    case 'viewSource': sendError('View source is not available in this Electron build.'); break;
    case 'devTools': if (contents) contents.openDevTools({ mode: 'detach' }); break;
    case 'zoomIn': contents?.setZoomLevel(Math.min(8, contents.getZoomLevel() + 1)); break;
    case 'zoomOut': contents?.setZoomLevel(Math.max(-7, contents.getZoomLevel() - 1)); break;
    case 'zoomReset': contents?.setZoomLevel(0); break;
    case 'fullscreen': browserWindow.setFullScreen(!browserWindow.isFullScreen()); sendState(); break;
    case 'stop':
      if (findBarOpen) {
        contents?.stopFindInPage('clearSelection');
        findBarOpen = false;
        browserWindow.webContents.send('browser:find-closed');
        updateViewBounds();
      } else if (activeTab?.kind === 'web' && activeTab.isLoading) {
        contents.stop();
      }
      break;
    case 'newWindow': sendError('Multiple browser windows are not supported yet.'); break;
    case 'privateWindow': sendError('Private windows are not supported yet.'); break;
    default: break;
  }
}

function getActiveTab(event) {
  assertTrustedUiSender(event);
  const tab = tabs.get(activeTabId);
  if (!tab) {
    throw new Error('There is no active browser tab.');
  }
  return tab;
}

function assertTrustedUiSender(event) {
  if (
    !browserWindow
    || browserWindow.isDestroyed()
    || event.sender !== browserWindow.webContents
    || !event.senderFrame
    || event.senderFrame !== browserWindow.webContents.mainFrame
    || !isTrustedUiUrl(event.senderFrame.url, UI_URL)
  ) {
    throw new Error('Browser action came from an untrusted sender.');
  }
}

ipcMain.handle('browser:navigate', (event, address) => {
  if (typeof address !== 'string') {
    throw new TypeError('Address must be a string.');
  }
  assertTrustedUiSender(event);
  return navigateActiveTab(address);
});
ipcMain.handle('browser:new-tab', (event, address) => {
  assertTrustedUiSender(event);
  if (address === undefined || address === '') createTab();
  else if (typeof address === 'string') createTab(address);
  else throw new TypeError('New tab address must be text.');
});
ipcMain.handle('browser:reorder-tab', (event, fromId, toId) => {
  assertTrustedUiSender(event);
  return reorderTab(fromId, toId);
});
ipcMain.handle('browser:show-tab-menu', (event, id) => {
  assertTrustedUiSender(event);
  showTabContextMenu(id);
});
ipcMain.handle('browser:show-bookmark-menu', (event, id) => {
  assertTrustedUiSender(event);
  showBookmarkContextMenu(id);
});
ipcMain.handle('browser:show-browser-menu', (event, position) => {
  assertTrustedUiSender(event);
  showBrowserToolbarMenu(position);
});
ipcMain.handle('browser:show-shields-menu', (event, position) => {
  assertTrustedUiSender(event);
  showShieldsToolbarMenu(position);
});
ipcMain.handle('browser:show-extensions-menu', (event, position) => {
  assertTrustedUiSender(event);
  showExtensionsToolbarMenu(position);
});
ipcMain.handle('browser:focus-page', (event) => {
  assertTrustedUiSender(event);
  const tab = tabs.get(activeTabId);
  if (tab?.kind === 'web' && !tab.error) tab.view.webContents.focus();
  else browserWindow.webContents.send('browser:focus-internal-page');
});
ipcMain.handle('browser:set-find-open', (event, open) => {
  assertTrustedUiSender(event);
  if (typeof open !== 'boolean') throw new TypeError('Find bar state must be boolean.');
  findBarOpen = open;
  updateViewBounds();
});
ipcMain.handle('browser:find-page', (event, query, options = {}) => {
  assertTrustedUiSender(event);
  if (typeof query !== 'string' || query.length > 500) throw new TypeError('Find text must be under 500 characters.');
  if (!options || typeof options !== 'object' || Array.isArray(options)) throw new TypeError('Find options are invalid.');
  const tab = tabs.get(activeTabId);
  const contents = tab?.kind === 'web' ? tab.view.webContents : browserWindow.webContents;
  if (!query) {
    contents.stopFindInPage('clearSelection');
    return null;
  }
  return contents.findInPage(query, {
    forward: options.forward !== false,
    findNext: options.findNext !== false,
    matchCase: options.matchCase === true,
  });
});
ipcMain.handle('browser:stop-find', (event) => {
  assertTrustedUiSender(event);
  const tab = tabs.get(activeTabId);
  const contents = tab?.kind === 'web' ? tab.view.webContents : browserWindow.webContents;
  contents.stopFindInPage('clearSelection');
});
ipcMain.handle('browser:switch-tab', (event, id) => {
  assertTrustedUiSender(event);
  activateTab(id);
});
ipcMain.handle('browser:close-tab', (event, id) => {
  assertTrustedUiSender(event);
  closeTab(id);
});
ipcMain.handle('browser:restore-closed-tab', (event) => {
  assertTrustedUiSender(event);
  restoreClosedTab();
});
ipcMain.handle('browser:back', (event) => {
  const tab = getActiveTab(event);
  if (tab.kind === 'web') {
    if (tab.view.webContents.canGoBack()) tab.view.webContents.goBack();
    tab.view.webContents.focus();
  }
});
ipcMain.handle('browser:forward', (event) => {
  const tab = getActiveTab(event);
  if (tab.kind === 'web') {
    if (tab.view.webContents.canGoForward()) tab.view.webContents.goForward();
    tab.view.webContents.focus();
  }
});
ipcMain.handle('browser:reload', (event) => {
  const tab = getActiveTab(event);
  if (tab.kind === 'web') {
    tab.view.webContents.reload();
    tab.view.webContents.focus();
  } else if (tab.kind === 'internal') {
    sendLibrary();
  }
});
ipcMain.handle('browser:stop', (event) => {
  const tab = getActiveTab(event);
  if (tab.kind === 'web' && tab.isLoading) {
    tab.view.webContents.stop();
    tab.view.webContents.focus();
  }
});
ipcMain.handle('browser:open-http-fallback', (event) => {
  const tab = getActiveTab(event);
  if (tab.kind !== 'web' || !tab.pendingHttpFallback || !tab.error) {
    throw new Error('An HTTP fallback is not available for this page.');
  }
  tab.markNextNavigationInsecure = true;
  return tab.view.webContents.loadURL(tab.pendingHttpFallback).catch((error) => {
    console.error('Unable to open HTTP fallback:', error);
    sendError('The HTTP version of this page could not be opened.');
  });
});
ipcMain.handle('browser:open-internal', (event, page) => {
  assertTrustedUiSender(event);
  createInternalTab(page);
});
ipcMain.handle('browser:toggle-bookmark', (event) => {
  assertTrustedUiSender(event);
  return toggleActiveBookmark();
});
ipcMain.handle('browser:remove-bookmark', async (event, id) => {
  assertTrustedUiSender(event);
  if (typeof id !== 'string') throw new TypeError('Bookmark id must be a string.');
  store.removeBookmark(id);
  await persistAndSendLibrary();
});
ipcMain.handle('browser:get-library', (event) => {
  assertTrustedUiSender(event);
  return getLibraryState();
});
ipcMain.handle('browser:get-about', (event) => {
  assertTrustedUiSender(event);
  return {
    version: app.getVersion(),
    electron: process.versions.electron,
    chromium: process.versions.chrome,
  };
});
ipcMain.handle('browser:inspect-extension', async (event) => {
  assertTrustedUiSender(event);
  const result = await dialog.showOpenDialog(browserWindow, {
    title: 'Choose an unpacked extension folder',
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length !== 1) return null;
  const inspected = await inspectUnpackedExtension(result.filePaths[0]);
  if (store.state.extensions.some((extension) => extension.path.toLowerCase() === inspected.path.toLowerCase())) {
    throw new Error('That extension folder is already installed.');
  }
  const ticket = randomUUID();
  extensionInstallTickets.set(ticket, inspected);
  setTimeout(() => extensionInstallTickets.delete(ticket), 5 * 60 * 1000).unref?.();
  const { path: extensionPath, ...details } = inspected;
  void extensionPath;
  return { ticket, ...details };
});
ipcMain.handle('browser:install-extension', async (event, ticket) => {
  assertTrustedUiSender(event);
  if (typeof ticket !== 'string') throw new TypeError('Extension install ticket is invalid.');
  const inspected = extensionInstallTickets.get(ticket);
  extensionInstallTickets.delete(ticket);
  if (!inspected) throw new Error('Choose the extension folder again before installing it.');
  let electronId = null;
  if (store.state.settings.extensionSupportEnabled && !extensionSupportRestartRequired) {
    const loaded = await session.fromPartition(BROWSER_SESSION_PARTITION).extensions.loadExtension(inspected.path, { allowFileAccess: false });
    electronId = loaded.id;
  }
  store.addExtension({ ...inspected, electronId });
  if (!store.state.settings.extensionSupportEnabled) {
    store.updateSettings({ extensionSupportEnabled: true });
    extensionSupportRestartRequired = true;
  }
  if (!await persistAndSendLibrary()) throw new Error('The extension could not be saved.');
  return { restartRequired: extensionSupportRestartRequired };
});
ipcMain.handle('browser:set-extension-enabled', async (event, key, enabled) => {
  assertTrustedUiSender(event);
  if (typeof key !== 'string' || typeof enabled !== 'boolean') throw new TypeError('Extension update is invalid.');
  if (extensionSupportRestartRequired) throw new Error('Restart the browser before changing extensions.');
  const extension = store.state.extensions.find((entry) => entry.key === key);
  if (!extension) throw new Error('That extension is no longer installed.');
  if (extension.enabled === enabled) return true;
  if (enabled) {
    try {
      const loaded = await session.fromPartition(BROWSER_SESSION_PARTITION).extensions.loadExtension(extension.path, { allowFileAccess: false });
      store.updateExtension(key, { enabled: true, electronId: loaded.id });
      extensionRuntimeErrors.delete(key);
    } catch (error) {
      extensionRuntimeErrors.set(key, 'Could not load this extension. Check that its folder still exists and is compatible.');
      throw new Error('Electron could not load this extension. It may use APIs this browser does not support.', { cause: error });
    }
  } else {
    if (extension.electronId) session.fromPartition(BROWSER_SESSION_PARTITION).extensions.removeExtension(extension.electronId);
    store.updateExtension(key, { enabled: false, electronId: null });
    extensionRuntimeErrors.delete(key);
  }
  await persistAndSendLibrary();
  return true;
});
ipcMain.handle('browser:remove-extension', async (event, key) => {
  assertTrustedUiSender(event);
  if (typeof key !== 'string') throw new TypeError('Extension key is invalid.');
  if (extensionSupportRestartRequired) throw new Error('Restart the browser before changing extensions.');
  const extension = store.state.extensions.find((entry) => entry.key === key);
  if (!extension) return false;
  if (extension.electronId) session.fromPartition(BROWSER_SESSION_PARTITION).extensions.removeExtension(extension.electronId);
  extensionRuntimeErrors.delete(key);
  store.removeExtension(key);
  return persistAndSendLibrary();
});
ipcMain.handle('browser:disable-extension-support', async (event) => {
  assertTrustedUiSender(event);
  if (extensionSupportRestartRequired) throw new Error('Restart the browser before changing extension support.');
  for (const extension of store.state.extensions) {
    if (extension.electronId) session.fromPartition(BROWSER_SESSION_PARTITION).extensions.removeExtension(extension.electronId);
  }
  if (store.state.settings.extensionSupportEnabled) {
    const extensionSession = session.fromPartition('persist:browser-session');
    await extensionSession.clearStorageData();
    await extensionSession.clearCache();
  }
  store.state.extensions = [];
  store.updateSettings({ extensionSupportEnabled: false });
  extensionRuntimeErrors.clear();
  extensionSupportRestartRequired = true;
  if (!await persistAndSendLibrary()) throw new Error('Extension settings could not be saved.');
  return true;
});
ipcMain.handle('browser:restart', (event) => {
  assertTrustedUiSender(event);
  app.relaunch();
  app.quit();
});
ipcMain.handle('browser:import-bookmarks', async (event) => {
  assertTrustedUiSender(event);
  const result = await dialog.showOpenDialog(browserWindow, {
    title: 'Import exported bookmarks',
    properties: ['openFile'],
    filters: [{ name: 'Bookmarks', extensions: ['html', 'htm', 'json'] }],
  });
  if (result.canceled || result.filePaths.length !== 1) return 0;
  const selectedPath = result.filePaths[0];
  const stats = await fs.stat(selectedPath);
  if (!stats.isFile() || stats.size > BOOKMARK_IMPORT_MAX_BYTES) {
    throw new Error('Choose a bookmarks file smaller than 10 MB.');
  }
  const extension = path.extname(selectedPath).toLowerCase();
  const entries = parseBookmarkImport(await fs.readFile(selectedPath, 'utf8'), extension);
  const imported = store.importBookmarks(entries);
  if (imported) await persistAndSendLibrary();
  return imported;
});
ipcMain.handle('browser:update-settings', async (event, settings) => {
  assertTrustedUiSender(event);
  store.updateSettings(settings);
  await persistAndSendLibrary();
  updateViewBounds();
  syncBackgroundColor();
  return store.snapshot().settings;
});
ipcMain.handle('browser:reset-settings', async (event) => {
  assertTrustedUiSender(event);
  store.resetSettings();
  await persistAndSendLibrary();
  updateViewBounds();
  syncBackgroundColor();
  return store.snapshot().settings;
});
ipcMain.handle('browser:update-start-page', async (event, patch) => {
  assertTrustedUiSender(event);
  store.updateStartPage(patch);
  await persistAndSendLibrary();
  return getLibraryState().startPage;
});
ipcMain.handle('browser:pick-wallpaper', async (event) => {
  assertTrustedUiSender(event);
  const result = await dialog.showOpenDialog(browserWindow, {
    title: 'Choose a start page wallpaper',
    properties: ['openFile'],
    filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'avif'] }],
  });
  if (result.canceled || result.filePaths.length !== 1) return null;
  const selectedPath = result.filePaths[0];
  const stats = await fs.stat(selectedPath);
  if (!stats.isFile() || stats.size > 12 * 1024 * 1024) {
    throw new Error('Choose an image smaller than 12 MB.');
  }
  store.updateStartPage({ wallpaper: 'custom', wallpaperPath: selectedPath });
  await persistAndSendLibrary();
  return getLibraryState().startPage;
});
ipcMain.handle('browser:clear-browsing-data', async (event, options = {}) => {
  assertTrustedUiSender(event);
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Clear data options must be an object.');
  }
  const timeRange = ['hour', 'day', 'week', 'month', 'all'].includes(options.timeRange) ? options.timeRange : 'all';
  const selected = {
    history: options.history !== false,
    websiteData: options.websiteData !== false,
    cache: options.cache !== false,
  };
  if (!Object.values(selected).some(Boolean)) throw new TypeError('Select at least one type of browsing data to clear.');
  if (selected.history) {
    const durations = { hour: 60 * 60 * 1000, day: 24 * 60 * 60 * 1000, week: 7 * 24 * 60 * 60 * 1000, month: 30 * 24 * 60 * 60 * 1000 };
    if (timeRange === 'all') store.clearHistory();
    else store.clearHistorySince(Date.now() - durations[timeRange]);
  }
  const saved = await persistAndSendLibrary();
  if (!saved) return false;
  try {
    const browserSession = session.fromPartition(BROWSER_SESSION_PARTITION);
    if (selected.websiteData) await browserSession.clearStorageData();
    if (selected.cache) await browserSession.clearCache();
  } catch (error) {
    console.error('Unable to clear site data:', error);
    sendError('History was cleared, but some site data could not be removed.');
    return false;
  }
  sendLibrary();
  return true;
});
ipcMain.handle('browser:minimize', (event) => {
  assertTrustedUiSender(event);
  browserWindow.minimize();
});
ipcMain.handle('browser:toggle-maximize', (event) => {
  assertTrustedUiSender(event);
  if (browserWindow.isMaximized()) browserWindow.unmaximize();
  else browserWindow.maximize();
});
ipcMain.handle('browser:close-window', (event) => {
  assertTrustedUiSender(event);
  browserWindow.close();
});

function createWindow() {
  browserWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 720,
    minHeight: 480,
    icon: path.join(__dirname, 'assets', 'browser-icon.ico'),
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: getWindowBackgroundColor(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  browserWindow.setMenuBarVisibility(false);

  browserWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  browserWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedUiUrl(url, UI_URL)) {
      event.preventDefault();
      console.warn('Blocked navigation away from the trusted browser UI:', url);
    }
  });
  browserWindow.webContents.on('will-redirect', (event, url) => {
    if (!isTrustedUiUrl(url, UI_URL)) {
      event.preventDefault();
      console.warn('Blocked redirect away from the trusted browser UI:', url);
    }
  });
  browserWindow.loadFile(path.join(__dirname, 'index.html'));
  browserWindow.webContents.on('before-input-event', (event, input) => handleShortcut(event, input, browserWindow.webContents));
  browserWindow.webContents.on('context-menu', (_event, params) => showPageContextMenu(browserWindow.webContents, params));
  browserWindow.webContents.on('found-in-page', (_event, result) => {
    browserWindow.webContents.send('browser:find-result', {
      matchCount: result.matches,
      activeMatchOrdinal: result.activeMatchOrdinal,
    });
  });
  browserWindow.on('resize', updateViewBounds);
  browserWindow.on('maximize', sendState);
  browserWindow.on('unmaximize', sendState);
  browserWindow.on('enter-full-screen', () => {
    sendState();
    sendError('Press F11 to exit full screen.');
  });
  browserWindow.on('leave-full-screen', sendState);
  browserWindow.on('app-command', (_event, command) => {
    if (command === 'browser-back' || command === 'back') {
      const tab = tabs.get(activeTabId);
      if (tab?.kind === 'web' && tab.view.webContents.canGoBack()) tab.view.webContents.goBack();
    } else if (command === 'browser-forward' || command === 'forward') {
      const tab = tabs.get(activeTabId);
      if (tab?.kind === 'web' && tab.view.webContents.canGoForward()) tab.view.webContents.goForward();
    }
  });
  browserWindow.on('closed', () => {
    const openTabs = [...tabs.values()];
    browserWindow = undefined;
    tabs.clear();
    activeTabId = undefined;
    for (const tab of openTabs) {
      if (tab.kind === 'web' && !tab.view.webContents.isDestroyed()) {
        tab.view.webContents.close();
      }
    }
  });
  browserWindow.webContents.once('did-finish-load', () => {
    sendLibrary();
    const savedSession = store.state.lastSession;
    if (store.state.settings.startupBehavior === 'continue' && savedSession.tabs.length) {
      const restored = savedSession.tabs.map((tab) => createTab(tab.url));
      activateTab(restored[Math.min(savedSession.activeIndex, restored.length - 1)]);
    } else {
      createInternalTab('home');
    }
  });
}

async function loadBrowserStore() {
  const userDataPath = app.getPath('userData');
  const filePath = path.join(userDataPath, 'browser-data.enc');
  const legacyFilePath = path.join(userDataPath, 'browser-data.json');
  store = new BrowserStore(filePath, safeStorage, legacyFilePath);
  await store.load();

  if (store.state.settings.extensionSupportEnabled) {
    BROWSER_SESSION_PARTITION = 'persist:browser-session';
    const extensionSession = session.fromPartition(BROWSER_SESSION_PARTITION);
    for (const extension of store.state.extensions) {
      if (!extension.enabled) continue;
      try {
        const loaded = await extensionSession.extensions.loadExtension(extension.path, { allowFileAccess: false });
        store.updateExtension(extension.key, { electronId: loaded.id });
        extensionRuntimeErrors.delete(extension.key);
      } catch (error) {
        extensionRuntimeErrors.set(extension.key, 'Could not load this extension. Check that its folder still exists and is compatible.');
        console.error(`Could not load extension ${extension.name}:`, error);
      }
    }
    if (!await persistStore()) throw new Error('Extension state could not be saved securely.');
  }

  const legacySession = session.fromPartition(LEGACY_SESSION_PARTITION);
  await legacySession.clearStorageData();
  await legacySession.clearCache();
  await legacySession.clearAuthCache();
  legacySession.flushStorageData();
  storeReady = true;
}

app.whenReady().then(async () => {
  try {
    await loadBrowserStore();
    configureRequestProtection();
    Menu.setApplicationMenu(null);
    createWindow();
  } catch (error) {
    console.error('Unable to load browser data:', error);
    dialog.showErrorBox(
      'Chromium Browser could not start',
      'Browser data could not be protected or previous website data could not be cleared. The browser stopped instead of starting with insecure storage.',
    );
    app.quit();
  }
});
nativeTheme.on('updated', () => {
  if (
    browserWindow
    && !browserWindow.isDestroyed()
    && store?.state.settings.theme === 'system'
  ) {
    syncBackgroundColor();
  }
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
app.on('before-quit', (event) => {
  if (!storeReady || savingOnQuit) return;
  event.preventDefault();
  savingOnQuit = true;
  clearTimeout(shieldsStatsSaveTimer);
  const webTabs = [...tabs.values()].filter((tab) => tab.kind === 'web' && isAllowedNavigation(tab.error?.url || tab.view.webContents.getURL()));
  const activeIndex = webTabs.findIndex((tab) => tab.id === activeTabId);
  store.setLastSession(webTabs.slice(0, 20).map((tab) => tab.error?.url || tab.view.webContents.getURL()), Math.max(0, activeIndex));
  void persistStore().finally(() => app.quit());
});
