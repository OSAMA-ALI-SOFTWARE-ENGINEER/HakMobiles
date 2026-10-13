const { app, BrowserWindow, ipcMain, protocol, safeStorage } = require('electron')
const path = require('path')

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })

  const devUrl = process.env.HAK_DEV_URL
  if (devUrl) win.loadURL(devUrl)
  else win.loadURL('app://tracker/')
}

app.whenReady().then(() => {
  protocol.handle('app', () => new Response('HAK Wholesales desktop shell', { headers: { 'content-type': 'text/plain' } }))
  ipcMain.handle('token:set', (_event, token) => {
    return safeStorage.encryptString(String(token)).toString('base64')
  })
  createWindow()
})
