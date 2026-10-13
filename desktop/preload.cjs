const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('hakDesktop', {
  protectToken: (token) => ipcRenderer.invoke('token:set', token),
})
