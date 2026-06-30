const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('notch', {
  onDisplay: (cb) => ipcRenderer.on('notch:display', (_e, payload) => cb(payload)),
  onHover: (cb) => ipcRenderer.on('notch:hover', (_e, v) => cb(v)),
});
