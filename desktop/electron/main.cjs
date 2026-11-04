const { app, BrowserWindow, ipcMain, protocol, safeStorage } = require('electron')
const { autoUpdater } = require('electron-updater')
const fs = require('fs')
const path = require('path')

const dist = path.resolve(__dirname, '../../app/dist')
const tokenFile = () => path.join(app.getPath('userData'), 'session.bin')

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
])

function contentType(file) {
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
    '.wasm': 'application/wasm',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
  }
  return types[path.extname(file).toLowerCase()] || 'application/octet-stream'
}

function serveApp(request) {
  const url = new URL(request.url)
  const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
  const file = path.normalize(path.join(dist, relative))
  if (!file.startsWith(dist)) return new Response('Not found', { status: 404 })
  if (!fs.existsSync(file)) return new Response('Not found', { status: 404 })
  return new Response(fs.readFileSync(file), {
    headers: {
      'content-type': contentType(file),
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless',
    },
  })
}

ipcMain.handle('token:save', (_event, token) => {
  const encrypted = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(String(token)) : Buffer.from(String(token))
  fs.writeFileSync(tokenFile(), encrypted)
})

ipcMain.handle('token:read', () => {
  const file = tokenFile()
  if (!fs.existsSync(file)) return ''
  const bytes = fs.readFileSync(file)
  return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(bytes) : bytes.toString()
})

app.whenReady().then(() => {
  protocol.handle('app', serveApp)
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  })
  window.loadURL('app://hak/index.html')
  autoUpdater.checkForUpdatesAndNotify().catch(() => {})
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
