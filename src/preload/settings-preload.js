const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('api', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (partial) => ipcRenderer.invoke('settings:set', partial),
  listDisplays: () => ipcRenderer.invoke('displays:list'),
  hooksStatus: () => ipcRenderer.invoke('hooks:status'),
  hooksInstall: () => ipcRenderer.invoke('hooks:install'),
  testEvent: (name) => ipcRenderer.invoke('test:event', name),
});
