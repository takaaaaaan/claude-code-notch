const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('notch', {
  onDisplay: (cb) => ipcRenderer.on('notch:display', (_e, payload) => cb(payload)),
  onHover: (cb) => ipcRenderer.on('notch:hover', (_e, v) => cb(v)),
  onPos: (cb) => ipcRenderer.on('notch:pos', (_e, preset) => cb(preset)),
  onLang: (cb) => ipcRenderer.on('notch:lang', (_e, lang) => cb(lang)),
});
