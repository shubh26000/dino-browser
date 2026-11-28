const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('toastBridge', {
  onShow: (callback) => {
    if (typeof callback !== 'function') return;
    ipcRenderer.on('toast:show', (_event, payload) => callback(payload));
  },
  ready: () => ipcRenderer.send('toast:ready'),
  painted: (sequence) => ipcRenderer.send('toast:painted', sequence),
});
