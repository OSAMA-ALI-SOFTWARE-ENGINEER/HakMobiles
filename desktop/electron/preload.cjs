const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('hakDesktop', {
  saveToken: (token) => ipcRenderer.invoke('token:save', token),
  readToken: () => ipcRenderer.invoke('token:read'),
})
