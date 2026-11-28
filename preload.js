const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('browser', {
  navigate: (address) => ipcRenderer.invoke('browser:navigate', address),
  newTab: (address) => ipcRenderer.invoke('browser:new-tab', address),
  reorderTab: (fromId, toId) => ipcRenderer.invoke('browser:reorder-tab', fromId, toId),
  showTabContextMenu: (id) => ipcRenderer.invoke('browser:show-tab-menu', id),
  showBookmarkContextMenu: (id) => ipcRenderer.invoke('browser:show-bookmark-menu', id),
  showBrowserMenu: (position) => ipcRenderer.invoke('browser:show-browser-menu', position),
  showShieldsMenu: (position) => ipcRenderer.invoke('browser:show-shields-menu', position),
  showExtensionsMenu: (position) => ipcRenderer.invoke('browser:show-extensions-menu', position),
  focusPage: () => ipcRenderer.invoke('browser:focus-page'),
  setFindOpen: (open) => ipcRenderer.invoke('browser:set-find-open', open),
  findPage: (query, options) => ipcRenderer.invoke('browser:find-page', query, options),
  stopFind: () => ipcRenderer.invoke('browser:stop-find'),
  switchTab: (id) => ipcRenderer.invoke('browser:switch-tab', id),
  closeTab: (id) => ipcRenderer.invoke('browser:close-tab', id),
  restoreClosedTab: () => ipcRenderer.invoke('browser:restore-closed-tab'),
  back: () => ipcRenderer.invoke('browser:back'),
  forward: () => ipcRenderer.invoke('browser:forward'),
  reload: () => ipcRenderer.invoke('browser:reload'),
  stop: () => ipcRenderer.invoke('browser:stop'),
  openHttpFallback: () => ipcRenderer.invoke('browser:open-http-fallback'),
  openInternal: (page) => ipcRenderer.invoke('browser:open-internal', page),
  toggleBookmark: () => ipcRenderer.invoke('browser:toggle-bookmark'),
  removeBookmark: (id) => ipcRenderer.invoke('browser:remove-bookmark', id),
  getLibrary: () => ipcRenderer.invoke('browser:get-library'),
  updateSettings: (settings) => ipcRenderer.invoke('browser:update-settings', settings),
  resetSettings: () => ipcRenderer.invoke('browser:reset-settings'),
  importBookmarks: () => ipcRenderer.invoke('browser:import-bookmarks'),
  getAbout: () => ipcRenderer.invoke('browser:get-about'),
  inspectExtension: () => ipcRenderer.invoke('browser:inspect-extension'),
  installExtension: (ticket) => ipcRenderer.invoke('browser:install-extension', ticket),
  setExtensionEnabled: (key, enabled) => ipcRenderer.invoke('browser:set-extension-enabled', key, enabled),
  removeExtension: (key) => ipcRenderer.invoke('browser:remove-extension', key),
  disableExtensionSupport: () => ipcRenderer.invoke('browser:disable-extension-support'),
  restart: () => ipcRenderer.invoke('browser:restart'),
  updateStartPage: (patch) => ipcRenderer.invoke('browser:update-start-page', patch),
  pickWallpaper: () => ipcRenderer.invoke('browser:pick-wallpaper'),
  clearBrowsingData: (options) => ipcRenderer.invoke('browser:clear-browsing-data', options),
  minimize: () => ipcRenderer.invoke('browser:minimize'),
  toggleMaximize: () => ipcRenderer.invoke('browser:toggle-maximize'),
  closeWindow: () => ipcRenderer.invoke('browser:close-window'),
  showToast: (message) => ipcRenderer.invoke('browser:show-toast', message),
  onState: (callback) => {
    ipcRenderer.on('browser:state', (_event, state) => callback(state));
  },
  onLibrary: (callback) => {
    ipcRenderer.on('browser:library', (_event, data) => callback(data));
  },
  onToolbarMenuClosed: (callback) => {
    ipcRenderer.on('browser:toolbar-menu-closed', (_event, kind) => callback(kind));
  },
  onError: (callback) => {
    ipcRenderer.on('browser:error', (_event, message) => callback(message));
  },
  onFocusAddress: (callback) => {
    ipcRenderer.on('browser:focus-address', callback);
  },
  onFocusBookmarks: (callback) => ipcRenderer.on('browser:focus-bookmarks', callback),
  onShowFind: (callback) => ipcRenderer.on('browser:show-find', callback),
  onFindNext: (callback) => ipcRenderer.on('browser:find-next', (_event, options) => callback(options)),
  onFindResult: (callback) => ipcRenderer.on('browser:find-result', (_event, result) => callback(result)),
  onFindClosed: (callback) => ipcRenderer.on('browser:find-closed', callback),
  onClearData: (callback) => ipcRenderer.on('browser:clear-data', callback),
  onFocusCycle: (callback) => ipcRenderer.on('browser:cycle-focus', (_event, options) => callback(options)),
  onFocusInternalPage: (callback) => ipcRenderer.on('browser:focus-internal-page', callback),
});
