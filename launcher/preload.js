const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('launcherAPI', {
  getApps: () => ipcRenderer.invoke('get-apps'),
  openApp: (slug) => ipcRenderer.invoke('open-app', slug)
});
