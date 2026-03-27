/**
 * GitHub Releases–based updates via electron-updater (same stack as electron-builder).
 * Version is package.json at build time → app.getVersion() in packaged apps.
 *
 * Requires release assets to include electron-builder update metadata (*.yml) next to installers.
 */
import { app, dialog, type BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import { ipcMain } from 'electron'

let started = false

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
}

export function setupAutoUpdater(mainWindow: BrowserWindow | null): void {
  if (!app.isPackaged || started) return
  started = true

  autoUpdater.autoDownload = true
  autoUpdater.allowDowngrade = false

  autoUpdater.on('update-available', (info) => {
    console.log('[BewareOfDog] Update available:', info.version)
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[BewareOfDog] App is up to date')
  })

  autoUpdater.on('error', (err) => {
    console.error('[BewareOfDog] autoUpdater error:', err)
  })

  autoUpdater.on('update-downloaded', (info) => {
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
