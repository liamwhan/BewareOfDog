/**
 * GitHub Releases–based updates via electron-updater (same stack as electron-builder).
 * Version is package.json at build time → app.getVersion() in packaged apps.
 *
 * Requires release assets to include electron-builder update metadata (*.yml) next to installers.
 */
import { app, dialog, type BrowserWindow } from 'electron'
import { ipcMain } from 'electron'
import { createRequire } from 'node:module'

/** CJS-only package: named ESM imports fail at runtime; use require interop. */
const require = createRequire(import.meta.url)
const { autoUpdater } = require('electron-updater') as typeof import('electron-updater')

let started = false
let appWindow: BrowserWindow | null = null

type UpdaterEventPayload =
  | { type: 'checking' }
  | { type: 'available'; version?: string }
  | { type: 'not-available' }
  | { type: 'download-progress'; percent: number; bytesPerSecond: number }
  | { type: 'downloaded'; version?: string }
  | { type: 'error'; message: string }

function emitUpdaterEvent(payload: UpdaterEventPayload): void {
  const wc = appWindow?.webContents
  if (!wc || wc.isDestroyed()) return
  wc.send('updater:event', payload)
}

export function registerAutoUpdateIpc(): void {
  ipcMain.handle('app:getVersion', (): string => app.getVersion())

  ipcMain.handle(
    'app:checkForUpdates',
    async (): Promise<
      | { ok: true; isUpdateAvailable: boolean; availableVersion?: string }
      | { ok: false; reason: string }
    > => {
      if (!app.isPackaged) {
        return { ok: false, reason: 'development' }
      }
      try {
        emitUpdaterEvent({ type: 'checking' })
        const result = await autoUpdater.checkForUpdates()
        return {
          ok: true,
          isUpdateAvailable: result?.isUpdateAvailable ?? false,
          availableVersion: result?.updateInfo?.version
        }
      } catch (e) {
        console.error('[BewareOfDog] checkForUpdates', e)
        return { ok: false, reason: e instanceof Error ? e.message : String(e) }
      }
    }
  )

  ipcMain.handle('app:installUpdate', (): { ok: true } | { ok: false; reason: string } => {
    if (!app.isPackaged) {
      return { ok: false, reason: 'development' }
    }
    try {
      setImmediate(() => {
        autoUpdater.quitAndInstall(false, true)
      })
      return { ok: true }
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : String(e) }
    }
  })
}

export function setupAutoUpdater(mainWindow: BrowserWindow | null): void {
  if (!app.isPackaged || started) return
  started = true
  appWindow = mainWindow ?? null

  autoUpdater.autoDownload = true
  autoUpdater.allowDowngrade = false

  autoUpdater.on('checking-for-update', () => {
    emitUpdaterEvent({ type: 'checking' })
  })

  autoUpdater.on('update-available', (info) => {
    console.log('[BewareOfDog] Update available:', info.version)
    emitUpdaterEvent({ type: 'available', version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[BewareOfDog] App is up to date')
    emitUpdaterEvent({ type: 'not-available' })
  })

  autoUpdater.on('download-progress', (progress) => {
    emitUpdaterEvent({
      type: 'download-progress',
      percent: progress.percent,
      bytesPerSecond: progress.bytesPerSecond
    })
  })

  autoUpdater.on('error', (err: Error & { cause?: unknown }) => {
    const parts = [err?.message ?? String(err)]
    if (err?.stack) parts.push(err.stack)
    if (err?.cause != null) parts.push(`cause: ${String(err.cause)}`)
    console.error('[BewareOfDog] autoUpdater error:\n', parts.join('\n'))
    emitUpdaterEvent({ type: 'error', message: err?.message ?? String(err) })
  })

  autoUpdater.on('update-downloaded', (info) => {
    emitUpdaterEvent({ type: 'downloaded', version: info.version })
    const parent = mainWindow ?? undefined
    void dialog
      .showMessageBox(parent, {
        type: 'info',
        title: 'Update ready',
        message: `BewareOfDog ${info.version} is ready to install.`,
        detail: 'Restart now to finish updating.',
        buttons: ['Restart now', 'Later'],
        defaultId: 0,
        cancelId: 1
      })
      .then(({ response }) => {
        if (response === 0) {
          setImmediate(() => {
            autoUpdater.quitAndInstall(false, true)
          })
        }
      })
  })

  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch((e) => {
      console.error('[BewareOfDog] Initial update check failed:', e)
    })
  }, 5000)
}
