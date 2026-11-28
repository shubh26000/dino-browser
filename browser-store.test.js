const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { BrowserStore } = require('./browser-store');

function makeEncryption() {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (value) => Buffer.from(`encrypted:${Buffer.from(value).toString('base64')}`),
    decryptString: (value) => Buffer.from(value.toString().slice('encrypted:'.length), 'base64').toString(),
  };
}

test('persists settings, history, and bookmarks across loads', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'chromium-browser-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'browser-data.enc');

  const encryption = makeEncryption();
  const store = new BrowserStore(filePath, encryption);
  await store.load();
  store.recordVisit('https://example.com/', 'Example', 100);
  store.toggleBookmark('https://example.com/', 'Example');
  store.updateSettings({ searchEngine: 'duckduckgo', ambient: false });
  await store.save();
  store.recordVisit('https://example.com/', 'Updated example', 200);
  await store.save();

  const savedText = await fs.readFile(filePath, 'utf8');
  assert.equal(savedText.includes('example.com'), false);

  const loaded = new BrowserStore(filePath, encryption);
  const state = await loaded.load();
  assert.equal(state.history[0].url, 'https://example.com/');
  assert.equal(state.history[0].title, 'Updated example');
  assert.equal(state.history[0].visits, 2);
  assert.equal(state.bookmarks[0].title, 'Example');
  assert.equal(state.settings.searchEngine, 'duckduckgo');
  assert.equal(state.settings.ambient, false);
});

test('migrates plaintext browser data to encryption before removing the old file', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'chromium-browser-migration-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const encryptedPath = path.join(directory, 'browser-data.enc');
  const legacyPath = path.join(directory, 'browser-data.json');
  const oldStore = new BrowserStore(path.join(directory, 'unused.enc'), makeEncryption());
  oldStore.recordVisit('https://example.com/', 'Example', 100);
  oldStore.toggleBookmark('https://example.com/', 'Example');
  await fs.writeFile(legacyPath, JSON.stringify(oldStore.snapshot()), 'utf8');

  const migrated = new BrowserStore(encryptedPath, makeEncryption(), legacyPath);
  const state = await migrated.load();

  assert.equal(state.history[0].url, 'https://example.com/');
  assert.equal(state.bookmarks[0].url, 'https://example.com/');
  await assert.rejects(fs.access(legacyPath), { code: 'ENOENT' });
  assert.equal((await fs.readFile(encryptedPath, 'utf8')).includes('example.com'), false);
});

test('preserves legacy data if encryption fails during migration', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'chromium-browser-migration-failure-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const legacyPath = path.join(directory, 'browser-data.json');
  await fs.writeFile(legacyPath, JSON.stringify({
    history: [],
    bookmarks: [],
    settings: { searchEngine: 'google', theme: 'system', ambient: true },
  }), 'utf8');
  const encryption = {
    isEncryptionAvailable: () => true,
    encryptString: () => {
      throw new Error('Encryption failed.');
    },
  };
  const store = new BrowserStore(path.join(directory, 'browser-data.enc'), encryption, legacyPath);

  await assert.rejects(store.load(), /Encryption failed/);
  assert.equal(await fs.readFile(legacyPath, 'utf8').then(Boolean), true);
});

test('fails closed when encryption is unavailable', async () => {
  const store = new BrowserStore(path.join(os.tmpdir(), 'unused-encrypted-data.enc'), {
    isEncryptionAvailable: () => false,
  });
  await assert.rejects(store.load(), /encryption is unavailable/);
  await assert.rejects(store.save(), /encryption is unavailable/);
});

test('does not accept plaintext at the encrypted store path', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'chromium-browser-plaintext-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'browser-data.enc');
  await fs.writeFile(filePath, JSON.stringify({
    history: [],
    bookmarks: [],
    settings: { searchEngine: 'google', theme: 'system', ambient: true },
  }), 'utf8');

  await assert.rejects(new BrowserStore(filePath, makeEncryption()).load(), /not encrypted/);
});

test('updates duplicate visits and rejects unsafe bookmarks', async () => {
  const store = new BrowserStore(path.join(os.tmpdir(), 'unused-browser-data.json'));
  store.recordVisit('https://example.com/', 'Old title', 100);
  store.recordVisit('https://example.com/', 'Updated title', 200);

  assert.equal(store.snapshot().history.length, 1);
  assert.equal(store.snapshot().history[0].title, 'Updated title');
  assert.equal(store.snapshot().history[0].visits, 2);
  assert.throws(() => store.toggleBookmark('javascript:alert(1)', 'Unsafe'), /HTTP and HTTPS/);
});

test('caps saved history to the most recent 1000 unique pages', () => {
  const store = new BrowserStore(path.join(os.tmpdir(), 'unused-history.json'));
  for (let index = 0; index < 1005; index += 1) {
    store.recordVisit(`https://example.com/${index}`, `Page ${index}`, index);
  }

  const history = store.snapshot().history;
  assert.equal(history.length, 1000);
  assert.equal(history[0].url, 'https://example.com/1004');
  assert.equal(history[history.length - 1].url, 'https://example.com/5');
});

test('rejects unsupported settings instead of persisting unsafe values', () => {
  const store = new BrowserStore(path.join(os.tmpdir(), 'unused-settings.json'));
  assert.throws(() => store.updateSettings({ theme: 'custom-url' }), /Invalid browser setting/);
  assert.equal(store.snapshot().settings.theme, 'night');
});

test('persists accent color and density while rejecting malformed values', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'chromium-browser-appearance-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'browser-data.enc');
  const encryption = makeEncryption();
  const store = new BrowserStore(filePath, encryption);
  await store.load();

  store.updateSettings({
    theme: 'aurora', accent: '#AABBCC', accentMode: 'custom', density: 'compact',
    roundness: 'round', reduceEffects: true,
  });
  await store.save();

  const loaded = await new BrowserStore(filePath, encryption).load();
  assert.equal(loaded.settings.accent, '#aabbcc');
  assert.equal(loaded.settings.theme, 'aurora');
  assert.equal(loaded.settings.accentMode, 'custom');
  assert.equal(loaded.settings.density, 'compact');
  assert.equal(loaded.settings.roundness, 'round');
  assert.equal(loaded.settings.reduceEffects, true);
  assert.throws(() => store.updateSettings({ accent: 'red' }), /Invalid browser setting/);
  assert.throws(() => store.updateSettings({ density: 'dense' }), /Invalid browser setting/);
  assert.throws(() => store.updateSettings({ theme: 'neon' }), /Invalid browser setting/);
  assert.throws(() => store.updateSettings({ roundness: 'wobbly' }), /Invalid browser setting/);
  store.updateSettings({ accentMode: 'wallpaper' });
  assert.equal(store.snapshot().settings.accentMode, 'wallpaper');
  assert.throws(() => store.updateSettings({ accentMode: 'remote-image' }), /Invalid browser setting/);
});

test('persists Shields controls and validates site exceptions', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'chromium-browser-shields-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'browser-data.enc');
  const encryption = makeEncryption();
  const store = new BrowserStore(filePath, encryption);
  await store.load();
  store.updateSettings({
    shieldsEnabled: false,
    shieldExceptions: ['Example.com', 'news.example.com', 'example.com'],
    httpsFirst: false,
    urlCleaning: false,
  });
  await store.save();

  const loaded = await new BrowserStore(filePath, encryption).load();
  assert.equal(loaded.settings.shieldsEnabled, false);
  assert.deepEqual(loaded.settings.shieldExceptions, ['example.com', 'news.example.com']);
  assert.equal(loaded.settings.httpsFirst, false);
  assert.equal(loaded.settings.urlCleaning, false);
  assert.throws(() => store.updateSettings({ shieldExceptions: ['https://example.com'] }), /valid host names/);
});

test('persists local Shields statistics and validates custom host rules', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'chromium-browser-shields-stats-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'browser-data.enc');
  const store = new BrowserStore(filePath, makeEncryption());
  await store.load();
  store.recordBlockedRequest('ads');
  store.recordBlockedRequest('trackers');
  store.updateSettings({ customBlockedHosts: ['Ads.Example.test', 'ads.example.test'] });
  await store.save();

  const loaded = new BrowserStore(filePath, makeEncryption());
  const snapshot = await loaded.load();
  const today = new Date().toISOString().slice(0, 10);
  assert.deepEqual(snapshot.shieldsStats, {
    ads: 1,
    trackers: 1,
    custom: 0,
    daily: [{ date: today, ads: 1, trackers: 1, custom: 0 }],
  });
  assert.deepEqual(snapshot.settings.customBlockedHosts, ['ads.example.test']);
  assert.throws(() => loaded.updateSettings({ customBlockedHosts: ['||ads.example.test^'] }), /valid host names/);
  assert.throws(() => loaded.updateSettings({ adsBlocking: 'false' }), /Invalid browser setting/);
});

test('persists start page layout, custom shortcuts, widgets, tasks, and notes', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'chromium-browser-start-page-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'browser-data.enc');
  const store = new BrowserStore(filePath, makeEncryption());
  await store.load();
  store.updateStartPage({
    wallpaper: 'custom',
    wallpaperPath: 'C:\\Users\\SHUBHAM\\Pictures\\wallpaper.jpg',
    wallpaperDim: 34,
    wallpaperBlur: 3,
    cardOpacity: 24,
    layout: 'cards',
    greetingName: 'Shubham',
    showClock: false,
    widgets: ['quote', 'todo', 'notes'],
    widgetSizes: { quote: 's', todo: 'l' },
    shortcuts: [{ id: 'shortcut-1', title: 'Example', url: 'https://example.com/' }],
    todoItems: [{ id: 'todo-1', text: 'Review browser', done: true }],
    notes: 'Keep this note private.',
  });
  await store.save();

  const loaded = new BrowserStore(filePath, makeEncryption());
  const snapshot = await loaded.load();
  assert.equal(snapshot.startPage.layout, 'cards');
  assert.equal(snapshot.startPage.wallpaperPath, 'C:\\Users\\SHUBHAM\\Pictures\\wallpaper.jpg');
  assert.equal(snapshot.startPage.wallpaperDim, 34);
  assert.equal(snapshot.startPage.wallpaperBlur, 3);
  assert.equal(snapshot.startPage.cardOpacity, 24);
  assert.deepEqual(snapshot.startPage.widgets, ['quote', 'todo', 'notes']);
  assert.deepEqual(snapshot.startPage.widgetSizes, { quote: 's', todo: 'l' });
  assert.deepEqual(snapshot.startPage.shortcuts, [{ id: 'shortcut-1', title: 'Example', url: 'https://example.com/' }]);
  assert.deepEqual(snapshot.startPage.todoItems, [{ id: 'todo-1', text: 'Review browser', done: true }]);
  assert.equal(snapshot.startPage.notes, 'Keep this note private.');
  assert.throws(() => loaded.updateStartPage({ widgets: ['not-a-widget'] }), /invalid/);
  assert.throws(() => loaded.updateStartPage({ widgetSizes: { unknown: 'm' } }), /invalid/);
  assert.throws(() => loaded.updateStartPage({ widgetSizes: { quote: 'xl' } }), /invalid/);
  assert.throws(() => loaded.updateStartPage({ wallpaper: 'custom', wallpaperPath: null }), /invalid/);
  assert.throws(() => loaded.updateStartPage({ wallpaperDim: 66 }), /invalid/);
  assert.throws(() => loaded.updateStartPage({ wallpaperBlur: 9 }), /invalid/);
  assert.throws(() => loaded.updateStartPage({ cardOpacity: 7 }), /invalid/);
  assert.doesNotThrow(() => loaded.updateStartPage({ wallpaper: 'time' }));
  assert.throws(() => loaded.updateStartPage({ shortcuts: [{ id: 'bad', title: 'Bad', url: 'file:///etc/passwd' }] }), /invalid/);
  assert.throws(() => loaded.updateStartPage({ notes: 'x'.repeat(5001) }), /invalid/);
});

test('imports safe bookmark entries once and restores setting defaults', async () => {
  const store = new BrowserStore(path.join(os.tmpdir(), 'unused-browser-data.json'));
  const imported = store.importBookmarks([
    { title: 'Example', url: 'https://example.com/' },
    { title: 'Duplicate', url: 'https://example.com/' },
    { title: 'Unsafe', url: 'javascript:alert(1)' },
  ]);
  assert.equal(imported, 1);
  assert.equal(store.state.bookmarks[0].title, 'Example');
  store.updateSettings({ profileName: 'Work', reduceMotion: true });
  store.resetSettings();
  assert.equal(store.state.settings.profileName, 'Personal');
  assert.equal(store.state.settings.reduceMotion, false);
  assert.equal(store.state.settings.shieldsEnabled, true);
});

test('clears history from a selected cutoff while preserving older visits', () => {
  const store = new BrowserStore(path.join(os.tmpdir(), 'unused-browser-data.json'));
  store.recordVisit('https://older.example/', 'Older', 100);
  store.recordVisit('https://newer.example/', 'Newer', 300);
  assert.equal(store.clearHistorySince(200), 1);
  assert.deepEqual(store.state.history.map((entry) => entry.url), ['https://older.example/']);
  assert.throws(() => store.clearHistorySince(Number.NaN), /timestamp/);
});

test('persists unpacked extension metadata and the explicit persistent-session choice', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'chromium-browser-extension-state-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'browser-data.enc');
  const store = new BrowserStore(filePath, makeEncryption());
  await store.load();
  store.addExtension({
    path: path.join(directory, 'extension'),
    name: 'Local extension',
    version: '1.0.0',
    manifestVersion: 3,
    permissions: ['storage'],
    hostPermissions: ['https://example.com/*'],
  });
  store.updateSettings({ extensionSupportEnabled: true });
  await store.save();

  const loaded = new BrowserStore(filePath, makeEncryption());
  const snapshot = await loaded.load();
  assert.equal(snapshot.settings.extensionSupportEnabled, true);
  assert.equal(snapshot.extensions[0].name, 'Local extension');
  assert.equal(snapshot.extensions[0].enabled, true);
  assert.equal(snapshot.extensions[0].electronId, null);
  loaded.resetSettings();
  assert.equal(loaded.state.settings.extensionSupportEnabled, true);
});

test('persists accessible settings and restores only safe web tabs', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'chromium-browser-session-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const filePath = path.join(directory, 'browser-data.enc');
  const store = new BrowserStore(filePath, makeEncryption());
  await store.load();
  store.updateSettings({ showBookmarksBar: false, highContrast: true, startupBehavior: 'continue' });
  store.setLastSession(['https://one.example/', 'file:///private.txt', 'https://two.example/'], 1);
  store.addBookmark('https://one.example/', 'One');
  await store.save();

  const loaded = new BrowserStore(filePath, makeEncryption());
  const snapshot = await loaded.load();
  assert.equal(snapshot.settings.showBookmarksBar, false);
  assert.equal(snapshot.settings.highContrast, true);
  assert.equal(snapshot.settings.startupBehavior, 'continue');
  assert.deepEqual(snapshot.lastSession.tabs, [{ url: 'https://one.example/' }, { url: 'https://two.example/' }]);
  assert.equal(snapshot.lastSession.activeIndex, 1);
  assert.equal(loaded.addBookmark('https://one.example/', 'Duplicate'), false);
  assert.throws(() => loaded.updateSettings({ startupBehavior: 'restore-any-file' }), /Invalid browser setting/);
});

test('fills appearance defaults when loading settings saved by an older version', async (context) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'chromium-browser-old-settings-'));
  context.after(() => fs.rm(directory, { recursive: true, force: true }));
  const encryptedPath = path.join(directory, 'browser-data.enc');
  const legacyPath = path.join(directory, 'browser-data.json');
  await fs.writeFile(legacyPath, JSON.stringify({
    history: [],
    bookmarks: [],
    settings: { searchEngine: 'google', theme: 'dark', ambient: false },
  }), 'utf8');

  const loaded = await new BrowserStore(encryptedPath, makeEncryption(), legacyPath).load();
  assert.equal(loaded.settings.accent, '#496fe8');
  assert.equal(loaded.settings.accentMode, 'theme');
  assert.equal(loaded.settings.density, 'comfortable');
  assert.equal(loaded.settings.roundness, 'default');
  assert.equal(loaded.settings.reduceEffects, false);
  assert.equal(loaded.settings.shieldsEnabled, true);
  assert.equal(loaded.settings.httpsFirst, true);
  assert.equal(loaded.settings.urlCleaning, true);
  assert.equal(loaded.startPage.layout, 'clean');
  assert.equal(loaded.startPage.wallpaper, 'aurora');
  assert.deepEqual(loaded.shieldsStats.daily, []);
  assert.equal(loaded.startPage.wallpaperDim, 18);
  assert.equal(loaded.startPage.wallpaperBlur, 0);
  assert.equal(loaded.startPage.cardOpacity, 13);
  assert.deepEqual(loaded.startPage.widgetSizes, {});
});
