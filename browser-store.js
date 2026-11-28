const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { isAllowedNavigation } = require('./navigation');

const HISTORY_LIMIT = 1000;
const BOOKMARK_LIMIT = 500;
const ENCRYPTED_FILE_HEADER = 'ChromiumBrowserEncrypted:v1\n';
const SEARCH_ENGINES = new Set(['google', 'bing', 'duckduckgo']);
const THEMES = new Set(['system', 'light', 'dark', 'daylight', 'night', 'aurora', 'ember', 'green', 'high-contrast']);
const START_PAGE_WALLPAPERS = new Set(['aurora', 'sunset', 'forest', 'ocean', 'dune', 'custom']);
const START_PAGE_WIDGETS = new Set(['quote', 'bookmarks', 'recent', 'todo', 'notes']);

function defaultState() {
  return {
    history: [],
    bookmarks: [],
    settings: {
      searchEngine: 'google',
      profileName: 'Personal',
      theme: 'night',
      accent: '#496fe8',
      accentMode: 'theme',
      density: 'comfortable',
      roundness: 'default',
      reduceEffects: false,
      ambient: true,
      shieldsEnabled: true,
      adsBlocking: true,
      trackersBlocking: true,
      shieldExceptions: [],
      httpsFirst: true,
      urlCleaning: true,
      customBlockedHosts: [],
      reduceMotion: false,
      extensionSupportEnabled: false,
      showBookmarksBar: true,
      highContrast: false,
      startupBehavior: 'home',
    },
    extensions: [],
    lastSession: { tabs: [], activeIndex: 0 },
    shieldsStats: { ads: 0, trackers: 0, custom: 0 },
    startPage: {
      wallpaper: 'aurora',
      wallpaperPath: null,
      layout: 'clean',
      greetingName: '',
      showGreeting: true,
      showClock: true,
      use24Hour: false,
      showPrivacyStats: true,
      showShortcuts: true,
      widgets: [],
      shortcuts: [],
      todoItems: [],
      notes: '',
    },
  };
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validateEntries(entries, label) {
  if (!Array.isArray(entries)) {
    throw new TypeError(`Saved ${label} must be an array.`);
  }
  for (const entry of entries) {
    if (
      !isRecord(entry)
      || typeof entry.id !== 'string'
      || typeof entry.title !== 'string'
      || typeof entry.url !== 'string'
      || entry.title.length > 500
      || entry.url.length > 4096
      || !isAllowedNavigation(entry.url)
      || (label === 'history' && (
        !Number.isFinite(entry.visitedAt)
        || !Number.isInteger(entry.visits)
        || entry.visits < 1
      ))
      || (label === 'bookmarks' && !Number.isFinite(entry.createdAt))
    ) {
      throw new TypeError(`Saved ${label} contains an invalid entry.`);
    }
  }
}

function isValidExceptionHost(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 253 || value !== value.trim()) {
    return false;
  }
  const host = value.toLowerCase();
  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    return host.split('.').every((part) => Number(part) <= 255);
  }
  if (host.startsWith('.') || host.endsWith('.') || host.includes('..')) return false;
  return host.split('.').every((label) => (
    label.length <= 63
    && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label)
  ));
}

function normalizeShieldExceptions(value) {
  if (!Array.isArray(value) || value.length > 100 || value.some((host) => !isValidExceptionHost(host))) {
    throw new TypeError('Shield exceptions must be a list of valid host names.');
  }
  return [...new Set(value.map((host) => host.toLowerCase()))];
}

function normalizeCustomBlockedHosts(value) {
  if (!Array.isArray(value) || value.length > 200 || value.some((host) => !isValidExceptionHost(host))) {
    throw new TypeError('Custom Shields rules must be a list of valid host names.');
  }
  return [...new Set(value.map((host) => host.toLowerCase()))];
}

function parseStartPage(value) {
  const saved = value === undefined ? defaultState().startPage : value;
  if (!isRecord(saved)) throw new TypeError('Saved start page settings are invalid.');
  const defaults = defaultState().startPage;
  const startPage = { ...defaults, ...saved };
  if (
    !START_PAGE_WALLPAPERS.has(startPage.wallpaper)
    || (startPage.wallpaperPath !== null && (typeof startPage.wallpaperPath !== 'string' || startPage.wallpaperPath.length > 4096))
    || (startPage.wallpaper === 'custom' && !startPage.wallpaperPath)
    || !['clean', 'cards'].includes(startPage.layout)
    || typeof startPage.greetingName !== 'string'
    || startPage.greetingName.length > 40
    || ['showGreeting', 'showClock', 'use24Hour', 'showPrivacyStats', 'showShortcuts'].some((key) => typeof startPage[key] !== 'boolean')
    || !Array.isArray(startPage.widgets)
    || startPage.widgets.length > START_PAGE_WIDGETS.size
    || startPage.widgets.some((widget) => !START_PAGE_WIDGETS.has(widget))
    || new Set(startPage.widgets).size !== startPage.widgets.length
    || !Array.isArray(startPage.shortcuts)
    || startPage.shortcuts.length > 20
    || startPage.shortcuts.some((shortcut) => (
      !isRecord(shortcut)
      || typeof shortcut.id !== 'string'
      || shortcut.id.length > 80
      || typeof shortcut.title !== 'string'
      || shortcut.title.trim().length < 1
      || shortcut.title.length > 50
      || typeof shortcut.url !== 'string'
      || shortcut.url.length > 4096
      || !isAllowedNavigation(shortcut.url)
    ))
    || new Set(startPage.shortcuts.map((shortcut) => shortcut.id)).size !== startPage.shortcuts.length
    || !Array.isArray(startPage.todoItems)
    || startPage.todoItems.length > 50
    || startPage.todoItems.some((item) => (
      !isRecord(item)
      || typeof item.id !== 'string'
      || item.id.length > 80
      || typeof item.text !== 'string'
      || item.text.trim().length < 1
      || item.text.length > 140
      || typeof item.done !== 'boolean'
    ))
    || new Set(startPage.todoItems.map((item) => item.id)).size !== startPage.todoItems.length
    || typeof startPage.notes !== 'string'
    || startPage.notes.length > 5000
  ) throw new TypeError('Saved start page settings are invalid.');

  return {
    wallpaper: startPage.wallpaper,
    wallpaperPath: startPage.wallpaperPath,
    layout: startPage.layout,
    greetingName: startPage.greetingName,
    showGreeting: startPage.showGreeting,
    showClock: startPage.showClock,
    use24Hour: startPage.use24Hour,
    showPrivacyStats: startPage.showPrivacyStats,
    showShortcuts: startPage.showShortcuts,
    widgets: [...startPage.widgets],
    shortcuts: startPage.shortcuts.map((shortcut) => ({ ...shortcut })),
    todoItems: startPage.todoItems.map((item) => ({ ...item })),
    notes: startPage.notes,
  };
}

class BrowserStore {
  constructor(filePath, encryption, legacyFilePath) {
    this.filePath = filePath;
    this.encryption = encryption;
    this.legacyFilePath = legacyFilePath;
    this.state = defaultState();
    this.writeQueue = Promise.resolve();
  }

  async load() {
    if (
      !this.encryption
      || typeof this.encryption.isEncryptionAvailable !== 'function'
      || !this.encryption.isEncryptionAvailable()
    ) {
      throw new Error('Windows account encryption is unavailable; browser data was not opened.');
    }

    let encryptedText;
    try {
      encryptedText = await fs.readFile(this.filePath, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return this.loadLegacyData();
    }

    if (!encryptedText.startsWith(ENCRYPTED_FILE_HEADER)) {
      throw new Error('Browser data is not encrypted. The file was not changed.');
    }

    let plaintext;
    try {
      const encrypted = Buffer.from(encryptedText.slice(ENCRYPTED_FILE_HEADER.length), 'base64');
      if (encrypted.length === 0) throw new Error('Encrypted browser data is empty.');
      plaintext = this.encryption.decryptString(encrypted);
    } catch (error) {
      throw new Error('Browser data could not be decrypted for this Windows account.', { cause: error });
    }

    this.state = parseState(plaintext);
    if (this.legacyFilePath) {
      await fs.rm(this.legacyFilePath, { force: true });
    }
    return this.snapshot();
  }

  async loadLegacyData() {
    if (!this.legacyFilePath) return this.snapshot();

    let text;
    try {
      text = await fs.readFile(this.legacyFilePath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') return this.snapshot();
      throw error;
    }

    this.state = parseState(text);
    await this.save();
    await fs.rm(this.legacyFilePath, { force: true });
    return this.snapshot();
  }

  snapshot() {
    return {
      history: this.state.history.map((entry) => ({ ...entry })),
      bookmarks: this.state.bookmarks.map((entry) => ({ ...entry })),
      settings: {
        ...this.state.settings,
        shieldExceptions: [...this.state.settings.shieldExceptions],
        customBlockedHosts: [...this.state.settings.customBlockedHosts],
      },
      extensions: this.state.extensions.map((extension) => ({
        ...extension,
        permissions: [...extension.permissions],
        hostPermissions: [...extension.hostPermissions],
      })),
      lastSession: {
        tabs: this.state.lastSession.tabs.map((tab) => ({ ...tab })),
        activeIndex: this.state.lastSession.activeIndex,
      },
      shieldsStats: { ...this.state.shieldsStats },
      startPage: {
        ...this.state.startPage,
        widgets: [...this.state.startPage.widgets],
        shortcuts: this.state.startPage.shortcuts.map((shortcut) => ({ ...shortcut })),
        todoItems: this.state.startPage.todoItems.map((item) => ({ ...item })),
      },
    };
  }

  recordBlockedRequest(category) {
    if (category === 'ads' || category === 'trackers' || category === 'custom') {
      this.state.shieldsStats[category] += 1;
    }
  }

  recordVisit(url, title, visitedAt = Date.now()) {
    if (!isAllowedNavigation(url) || url.length > 4096) return;
    const safeTitle = typeof title === 'string' ? title.slice(0, 500) : url;

    const existing = this.state.history.find((entry) => entry.url === url);
    if (existing) {
      existing.title = safeTitle || url;
      existing.visitedAt = visitedAt;
      existing.visits += 1;
    } else {
      this.state.history.unshift({
        id: randomUUID(),
        title: safeTitle || url,
        url,
        visitedAt,
        visits: 1,
      });
    }
    this.state.history.sort((first, second) => second.visitedAt - first.visitedAt);
    this.state.history.length = Math.min(this.state.history.length, HISTORY_LIMIT);
  }

  updateHistoryTitle(url, title) {
    const entry = this.state.history.find((item) => item.url === url);
    if (!entry || typeof title !== 'string' || !title) return false;
    entry.title = title.slice(0, 500);
    return true;
  }

  toggleBookmark(url, title) {
    if (!isAllowedNavigation(url) || url.length > 4096) {
      throw new TypeError('Only HTTP and HTTPS pages can be bookmarked.');
    }

    const index = this.state.bookmarks.findIndex((entry) => entry.url === url);
    if (index >= 0) {
      this.state.bookmarks.splice(index, 1);
      return false;
    }
    if (this.state.bookmarks.length >= BOOKMARK_LIMIT) {
      throw new Error(`The bookmark limit of ${BOOKMARK_LIMIT} has been reached.`);
    }
    const safeTitle = typeof title === 'string' ? title.slice(0, 500) : url;
    this.state.bookmarks.unshift({
      id: randomUUID(),
      title: safeTitle || url,
      url,
      createdAt: Date.now(),
    });
    return true;
  }

  removeBookmark(id) {
    const oldLength = this.state.bookmarks.length;
    this.state.bookmarks = this.state.bookmarks.filter((entry) => entry.id !== id);
    return this.state.bookmarks.length !== oldLength;
  }

  importBookmarks(entries) {
    if (!Array.isArray(entries) || entries.length > 2000) {
      throw new TypeError('Bookmark import must be a list of at most 2000 entries.');
    }
    const existingUrls = new Set(this.state.bookmarks.map((entry) => entry.url));
    let imported = 0;
    for (const entry of entries) {
      if (
        !isRecord(entry)
        || typeof entry.title !== 'string'
        || typeof entry.url !== 'string'
        || entry.url.length > 4096
        || !isAllowedNavigation(entry.url)
        || existingUrls.has(entry.url)
        || this.state.bookmarks.length >= BOOKMARK_LIMIT
      ) continue;
      const title = entry.title.trim().slice(0, 500) || entry.url;
      this.state.bookmarks.push({ id: randomUUID(), title, url: entry.url, createdAt: Date.now() });
      existingUrls.add(entry.url);
      imported += 1;
    }
    return imported;
  }

  resetSettings() {
    const defaults = defaultState().settings;
    this.state.settings = {
      ...defaults,
      extensionSupportEnabled: this.state.settings.extensionSupportEnabled,
      shieldExceptions: [],
      customBlockedHosts: [],
    };
  }

  updateSettings(patch) {
    if (!isRecord(patch)) {
      throw new TypeError('Settings update must be an object.');
    }
    const next = { ...this.state.settings };
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'searchEngine' && SEARCH_ENGINES.has(value)) {
        next.searchEngine = value;
      } else if (key === 'profileName' && typeof value === 'string' && value.trim().length <= 40) {
        next.profileName = value.trim() || 'Personal';
      } else if (key === 'theme' && THEMES.has(value)) {
        next.theme = value;
      } else if (key === 'accent' && typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value)) {
        next.accent = value.toLowerCase();
      } else if (key === 'accentMode' && ['theme', 'custom', 'wallpaper'].includes(value)) {
        next.accentMode = value;
      } else if (key === 'density' && ['comfortable', 'compact'].includes(value)) {
        next.density = value;
      } else if (key === 'roundness' && ['sharp', 'default', 'round'].includes(value)) {
        next.roundness = value;
      } else if (key === 'reduceEffects' && typeof value === 'boolean') {
        next.reduceEffects = value;
      } else if (key === 'shieldsEnabled' && typeof value === 'boolean') {
        next.shieldsEnabled = value;
      } else if ((key === 'adsBlocking' || key === 'trackersBlocking') && typeof value === 'boolean') {
        next[key] = value;
      } else if (key === 'shieldExceptions') {
        next.shieldExceptions = normalizeShieldExceptions(value);
      } else if (key === 'customBlockedHosts') {
        next.customBlockedHosts = normalizeCustomBlockedHosts(value);
      } else if (key === 'httpsFirst' && typeof value === 'boolean') {
        next.httpsFirst = value;
      } else if (key === 'urlCleaning' && typeof value === 'boolean') {
        next.urlCleaning = value;
      } else if (key === 'ambient' && typeof value === 'boolean') {
        next.ambient = value;
      } else if (key === 'reduceMotion' && typeof value === 'boolean') {
        next.reduceMotion = value;
      } else if (key === 'extensionSupportEnabled' && typeof value === 'boolean') {
        next.extensionSupportEnabled = value;
      } else if (key === 'showBookmarksBar' && typeof value === 'boolean') {
        next.showBookmarksBar = value;
      } else if (key === 'highContrast' && typeof value === 'boolean') {
        next.highContrast = value;
      } else if (key === 'startupBehavior' && ['home', 'continue'].includes(value)) {
        next.startupBehavior = value;
      } else {
        throw new TypeError(`Invalid browser setting: ${key}.`);
      }
    }
    this.state.settings = next;
  }

  updateStartPage(patch) {
    if (!isRecord(patch)) throw new TypeError('Start page update must be an object.');
    this.state.startPage = parseStartPage({ ...this.state.startPage, ...patch });
  }

  clearHistory() {
    this.state.history = [];
  }

  clearHistorySince(cutoff) {
    if (!Number.isFinite(cutoff)) throw new TypeError('History cutoff must be a timestamp.');
    const previousLength = this.state.history.length;
    this.state.history = this.state.history.filter((entry) => entry.visitedAt < cutoff);
    return previousLength - this.state.history.length;
  }

  addExtension(extension) {
    if (
      !isRecord(extension)
      || typeof extension.path !== 'string'
      || !path.isAbsolute(extension.path)
      || typeof extension.name !== 'string'
      || extension.name.trim().length < 1
      || extension.name.length > 120
      || typeof extension.version !== 'string'
      || extension.version.length > 80
      || ![2, 3].includes(extension.manifestVersion)
      || !Array.isArray(extension.permissions)
      || !Array.isArray(extension.hostPermissions)
      || [...extension.permissions, ...extension.hostPermissions].some((permission) => typeof permission !== 'string' || permission.length > 300)
    ) {
      throw new TypeError('An extension must have an absolute folder path.');
    }
    if (this.state.extensions.some((entry) => entry.path.toLowerCase() === extension.path.toLowerCase())) {
      throw new Error('That extension folder is already installed.');
    }
    const entry = {
      key: randomUUID(),
      path: extension.path,
      name: extension.name,
      version: extension.version,
      manifestVersion: extension.manifestVersion,
      permissions: [...extension.permissions],
      hostPermissions: [...extension.hostPermissions],
      enabled: true,
      electronId: typeof extension.electronId === 'string' ? extension.electronId : null,
    };
    this.state.extensions.push(entry);
    return { ...entry, permissions: [...entry.permissions], hostPermissions: [...entry.hostPermissions] };
  }

  updateExtension(key, patch) {
    const extension = this.state.extensions.find((entry) => entry.key === key);
    if (!extension || !isRecord(patch)) return false;
    if (typeof patch.enabled === 'boolean') extension.enabled = patch.enabled;
    if (patch.electronId === null || typeof patch.electronId === 'string') extension.electronId = patch.electronId;
    return true;
  }

  removeExtension(key) {
    const previousLength = this.state.extensions.length;
    this.state.extensions = this.state.extensions.filter((entry) => entry.key !== key);
    return this.state.extensions.length !== previousLength;
  }

  addBookmark(url, title) {
    if (!isAllowedNavigation(url) || url.length > 4096) return false;
    if (this.state.bookmarks.some((entry) => entry.url === url)) return false;
    if (this.state.bookmarks.length >= BOOKMARK_LIMIT) throw new Error(`The bookmark limit of ${BOOKMARK_LIMIT} has been reached.`);
    this.state.bookmarks.unshift({
      id: randomUUID(),
      title: typeof title === 'string' ? title.slice(0, 500) || url : url,
      url,
      createdAt: Date.now(),
    });
    return true;
  }

  setLastSession(urls, activeIndex = 0) {
    if (!Array.isArray(urls) || urls.length > 20 || !Number.isInteger(activeIndex)) {
      throw new TypeError('Saved session information is invalid.');
    }
    const tabs = urls.filter((url) => typeof url === 'string' && isAllowedNavigation(url) && url.length <= 4096)
      .map((url) => ({ url }));
    this.state.lastSession = {
      tabs,
      activeIndex: tabs.length ? Math.min(Math.max(0, activeIndex), tabs.length - 1) : 0,
    };
  }

  async save() {
    if (
      !this.encryption
      || typeof this.encryption.isEncryptionAvailable !== 'function'
      || !this.encryption.isEncryptionAvailable()
    ) {
      throw new Error('Windows account encryption is unavailable; browser data was not saved.');
    }

    const snapshot = this.snapshot();
    const tempPath = `${this.filePath}.${randomUUID()}.tmp`;
    const nextWrite = this.writeQueue.catch(() => {}).then(async () => {
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      const encrypted = this.encryption.encryptString(JSON.stringify(snapshot));
      const contents = `${ENCRYPTED_FILE_HEADER}${encrypted.toString('base64')}`;
      await fs.writeFile(tempPath, contents, { encoding: 'utf8', mode: 0o600 });
      await fs.rename(tempPath, this.filePath);
    });
    this.writeQueue = nextWrite;
    try {
      await nextWrite;
    } catch (error) {
      await fs.rm(tempPath, { force: true }).catch((cleanupError) => {
        console.error('Unable to clean up temporary browser data:', cleanupError);
      });
      throw error;
    }
  }
}

function parseState(text) {
  let saved;
  try {
    saved = JSON.parse(text);
  } catch (error) {
    throw new Error('Browser data could not be parsed.', { cause: error });
  }
  if (!isRecord(saved)) {
    throw new TypeError('Browser data must be an object.');
  }
  if (!isRecord(saved.settings)) {
    throw new TypeError('Saved browser settings are invalid.');
  }
  const accent = saved.settings.accent ?? '#496fe8';
  const accentMode = saved.settings.accentMode ?? (accent.toLowerCase() === '#496fe8' ? 'theme' : 'custom');
  const density = saved.settings.density ?? 'comfortable';
  const roundness = saved.settings.roundness ?? 'default';
  const reduceEffects = saved.settings.reduceEffects ?? false;
  const shieldsEnabled = saved.settings.shieldsEnabled ?? true;
  const adsBlocking = saved.settings.adsBlocking ?? true;
  const trackersBlocking = saved.settings.trackersBlocking ?? true;
  const shieldExceptions = normalizeShieldExceptions(saved.settings.shieldExceptions ?? []);
  const httpsFirst = saved.settings.httpsFirst ?? true;
  const urlCleaning = saved.settings.urlCleaning ?? true;
  const customBlockedHosts = normalizeCustomBlockedHosts(saved.settings.customBlockedHosts ?? []);
  const shieldsStats = saved.shieldsStats ?? { ads: 0, trackers: 0, custom: 0 };
  const startPage = parseStartPage(saved.startPage);
  const profileName = saved.settings.profileName ?? 'Personal';
  const reduceMotion = saved.settings.reduceMotion ?? false;
  const extensionSupportEnabled = saved.settings.extensionSupportEnabled ?? false;
  const extensions = saved.extensions ?? [];
  const showBookmarksBar = saved.settings.showBookmarksBar ?? true;
  const highContrast = saved.settings.highContrast ?? false;
  const startupBehavior = saved.settings.startupBehavior ?? 'home';
  const lastSession = saved.lastSession ?? { tabs: [], activeIndex: 0 };
  validateEntries(saved.history, 'history');
  validateEntries(saved.bookmarks, 'bookmarks');
  if (
    !SEARCH_ENGINES.has(saved.settings.searchEngine)
    || !THEMES.has(saved.settings.theme)
    || typeof accent !== 'string'
    || !/^#[0-9a-fA-F]{6}$/.test(accent)
    || !['theme', 'custom', 'wallpaper'].includes(accentMode)
    || !['comfortable', 'compact'].includes(density)
    || !['sharp', 'default', 'round'].includes(roundness)
    || typeof reduceEffects !== 'boolean'
    || typeof shieldsEnabled !== 'boolean'
    || typeof adsBlocking !== 'boolean'
    || typeof trackersBlocking !== 'boolean'
    || typeof httpsFirst !== 'boolean'
    || typeof urlCleaning !== 'boolean'
    || typeof saved.settings.ambient !== 'boolean'
    || typeof profileName !== 'string'
    || profileName.length > 40
    || typeof reduceMotion !== 'boolean'
    || typeof extensionSupportEnabled !== 'boolean'
    || typeof showBookmarksBar !== 'boolean'
    || typeof highContrast !== 'boolean'
    || !['home', 'continue'].includes(startupBehavior)
    || !Array.isArray(extensions)
    || extensions.length > 100
    || extensions.some((extension) => (
      !isRecord(extension)
      || typeof extension.key !== 'string'
      || extension.key.length > 80
      || typeof extension.path !== 'string'
      || extension.path.length > 4096
      || !path.isAbsolute(extension.path)
      || typeof extension.name !== 'string'
      || extension.name.length < 1
      || extension.name.length > 120
      || typeof extension.version !== 'string'
      || extension.version.length > 80
      || ![2, 3].includes(extension.manifestVersion)
      || !Array.isArray(extension.permissions)
      || extension.permissions.length > 100
      || extension.permissions.some((permission) => typeof permission !== 'string' || permission.length > 300)
      || !Array.isArray(extension.hostPermissions)
      || extension.hostPermissions.length > 100
      || extension.hostPermissions.some((permission) => typeof permission !== 'string' || permission.length > 300)
      || typeof extension.enabled !== 'boolean'
      || (extension.electronId !== null && typeof extension.electronId !== 'string')
    ))
    || !isRecord(lastSession)
    || !Array.isArray(lastSession.tabs)
    || lastSession.tabs.length > 20
    || !Number.isInteger(lastSession.activeIndex)
    || lastSession.activeIndex < 0
    || (lastSession.tabs.length > 0 && lastSession.activeIndex >= lastSession.tabs.length)
    || lastSession.tabs.some((tab) => (
      !isRecord(tab)
      || typeof tab.url !== 'string'
      || tab.url.length > 4096
      || !isAllowedNavigation(tab.url)
    ))
    || !isRecord(shieldsStats)
    || ['ads', 'trackers', 'custom'].some((key) => !Number.isSafeInteger(shieldsStats[key]) || shieldsStats[key] < 0)
  ) {
    throw new TypeError('Saved browser settings are invalid.');
  }

  return {
    history: saved.history.slice(0, HISTORY_LIMIT),
    bookmarks: saved.bookmarks.slice(0, BOOKMARK_LIMIT),
    settings: {
      searchEngine: saved.settings.searchEngine,
      profileName,
      theme: saved.settings.theme,
      accent: accent.toLowerCase(),
      accentMode,
      density,
      roundness,
      reduceEffects,
      ambient: saved.settings.ambient,
      shieldsEnabled,
      adsBlocking,
      trackersBlocking,
      shieldExceptions,
      httpsFirst,
      urlCleaning,
      customBlockedHosts,
      reduceMotion,
      extensionSupportEnabled,
      showBookmarksBar,
      highContrast,
      startupBehavior,
    },
    extensions: extensions.map((extension) => ({
      ...extension,
      permissions: [...extension.permissions],
      hostPermissions: [...extension.hostPermissions],
    })),
    lastSession: {
      tabs: lastSession.tabs.map((tab) => ({ ...tab })),
      activeIndex: lastSession.activeIndex,
    },
    shieldsStats: {
      ads: shieldsStats.ads,
      trackers: shieldsStats.trackers,
      custom: shieldsStats.custom,
    },
    startPage,
  };
}

module.exports = { BrowserStore };
