const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('glabs', {
  listProfiles: () => ipcRenderer.invoke('profiles:list'),
  addProfile: name => ipcRenderer.invoke('profiles:add', name),
  removeProfile: id => ipcRenderer.invoke('profiles:remove', id),
  loginProfile: id => ipcRenderer.invoke('profiles:login', id),
  openProfile: id => ipcRenderer.invoke('profiles:open', id),
  stopProfile: id => ipcRenderer.invoke('profiles:stop', id),
  runQueue: payload => ipcRenderer.invoke('queue:run', payload),
  stopQueue: () => ipcRenderer.invoke('queue:stop'),
  queueStatus: () => ipcRenderer.invoke('queue:status'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: s => ipcRenderer.invoke('settings:set', s),
  openFolder: f => ipcRenderer.invoke('open-folder', f),
  on: (event, fn) => ipcRenderer.on(event, (_, data) => fn(data))
});
