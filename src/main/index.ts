import { app, BrowserWindow, nativeImage } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'
import { attachWindowStatePersistence, loadWindowState } from './windowState'

let mainWindow: BrowserWindow | null = null

function createWindow() {
  const preloadPath = join(__dirname, '../preload/index.cjs')
  const iconPath = join(__dirname, '../../public/bod.png')
  const icon = nativeImage.createFromPath(iconPath)
  const saved = loadWindowState()
  const x = saved.x
  const y = saved.y

  mainWindow = new BrowserWindow({
    width: saved.width,
    height: saved.height,
    ...(Number.isFinite(x) && Number.isFinite(y) ? { x, y } : {}),
    icon: icon.isEmpty() ? undefined : icon,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  if (saved.isMaximized) {
    mainWindow.maximize()
  }

  attachWindowStatePersistence(mainWindow)

  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
