import { useCallback, useEffect, useRef, useState } from 'react'
import { RequestBuilder } from './components/RequestBuilder'
import { ResponseView } from './components/ResponseView'
import { CollectionsPanel } from './components/CollectionsPanel'
import { CollectionSettingsPanel } from './components/CollectionSettingsPanel'
import { HorizontalResizeHandle } from './components/HorizontalResizeHandle'
import { VerticalResizeHandle } from './components/VerticalResizeHandle'
import { VariablesPanel } from './components/VariablesPanel'
import { PersistenceManager } from './components/PersistenceManager'
import { HttpConsolePanel } from './components/HttpConsolePanel'
import { WorkspaceSyncModal } from './components/WorkspaceSyncModal'
import { useThemeStore } from './stores/themeStore'
import { useCollectionStore } from './stores/collectionStore'
import { loadLayout, saveLayout } from './lib/layoutStorage'

const LEFT_MIN = 160
const LEFT_MAX = 560
const LEFT_DEFAULT = 256
const RIGHT_MIN = 220
const RIGHT_MAX = 560
const RIGHT_DEFAULT = 320

/** Height of HorizontalResizeHandle (must match `h-3` in Tailwind). */
const MAIN_SPLIT_HANDLE_PX = 12
const MAIN_SPLIT_MIN_TOP = 120
const MAIN_SPLIT_MIN_BOTTOM = 120
const MAIN_SPLIT_DEFAULT = 320

function clampLeft(w: number): number {
  return Math.min(LEFT_MAX, Math.max(LEFT_MIN, Math.round(w)))
}

function clampRight(w: number): number {
  return Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, Math.round(w)))
}

function clampRequestPanelHeight(h: number, sectionEl: HTMLElement | null): number {
  const rounded = Math.round(h)
  if (!sectionEl) return Math.max(MAIN_SPLIT_MIN_TOP, rounded)
  const total = sectionEl.clientHeight - MAIN_SPLIT_HANDLE_PX
  if (total <= MAIN_SPLIT_MIN_TOP + MAIN_SPLIT_MIN_BOTTOM) {
    return MAIN_SPLIT_MIN_TOP
  }
  return Math.min(Math.max(MAIN_SPLIT_MIN_TOP, rounded), total - MAIN_SPLIT_MIN_BOTTOM)
}

export default function App() {
  const [appVersion, setAppVersion] = useState<string | null>(null)
  const [updateChecking, setUpdateChecking] = useState(false)
  const [updateFeedback, setUpdateFeedback] = useState<string | null>(null)
  const [updateReadyVersion, setUpdateReadyVersion] = useState<string | null>(null)
  const [updateProgress, setUpdateProgress] = useState<number | null>(null)
  const [installingUpdate, setInstallingUpdate] = useState(false)
  const updateFeedbackClearRef = useRef<number | null>(null)
  const [syncOpen, setSyncOpen] = useState(false)
  const [leftWidth, setLeftWidth] = useState(() => {
    const s = loadLayout()
    return clampLeft(typeof s.leftWidth === 'number' ? s.leftWidth : LEFT_DEFAULT)
  })
  const [rightWidth, setRightWidth] = useState(() => {
    const s = loadLayout()
    return clampRight(typeof s.rightWidth === 'number' ? s.rightWidth : RIGHT_DEFAULT)
  })
  const [requestPanelHeight, setRequestPanelHeight] = useState(() => {
    const s = loadLayout()
    const v =
      typeof s.requestPanelHeight === 'number' ? s.requestPanelHeight : MAIN_SPLIT_DEFAULT
    return Math.round(v)
  })
  const mainSplitSectionRef = useRef<HTMLElement>(null)
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const rightPanelOpen = useCollectionStore((s) => s.selectedCollectionSettingsIndex !== null)

  const onResizeLeft = useCallback((deltaPx: number) => {
    setLeftWidth((w) => Math.min(LEFT_MAX, Math.max(LEFT_MIN, w + deltaPx)))
  }, [])

  const onResizeRight = useCallback((deltaPx: number) => {
    setRightWidth((w) => Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, w - deltaPx)))
  }, [])

  const onResizeMainSplit = useCallback((deltaY: number) => {
    setRequestPanelHeight((prev) =>
      clampRequestPanelHeight(prev + deltaY, mainSplitSectionRef.current)
    )
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  useEffect(() => {
    void window.electron.appGetVersion().then(setAppVersion)
  }, [])

  const onCheckForUpdates = useCallback(async () => {
    if (updateFeedbackClearRef.current != null) {
      window.clearTimeout(updateFeedbackClearRef.current)
      updateFeedbackClearRef.current = null
    }
    setUpdateFeedback(null)
    setUpdateReadyVersion(null)
    setUpdateProgress(null)
    setUpdateChecking(true)
    try {
      const r = await window.electron.checkForUpdates()
      if (!r.ok) {
        if (r.reason === 'development') {
          setUpdateFeedback('Updates apply to installed builds only.')
        } else {
          setUpdateFeedback(r.reason)
        }
      } else if (r.isUpdateAvailable && r.availableVersion) {
        setUpdateFeedback(`Update v${r.availableVersion} found - downloading...`)
      } else {
        setUpdateFeedback("You're on the latest version.")
      }
    } catch {
      setUpdateFeedback('Could not check for updates.')
    } finally {
      setUpdateChecking(false)
    }
    updateFeedbackClearRef.current = window.setTimeout(() => {
      setUpdateFeedback(null)
      updateFeedbackClearRef.current = null
    }, 8000)
  }, [])

  const onInstallUpdate = useCallback(async () => {
    setInstallingUpdate(true)
    try {
      const result = await window.electron.installUpdate()
      if (!result.ok) {
        setUpdateFeedback(
          result.reason === 'development' ? 'Updates apply to installed builds only.' : result.reason
        )
        return
      }
      setUpdateFeedback('Installing update...')
    } catch {
      setUpdateFeedback('Could not start update install.')
    } finally {
      setInstallingUpdate(false)
    }
  }, [])

  useEffect(() => {
    const unsubscribe = window.electron.onUpdaterEvent((event) => {
      switch (event.type) {
        case 'checking':
          setUpdateChecking(true)
          break
        case 'available':
          setUpdateFeedback(
            event.version
              ? `Update v${event.version} found - downloading...`
              : 'Update found - downloading...'
          )
          setUpdateReadyVersion(null)
          setUpdateProgress(0)
          break
        case 'download-progress':
          setUpdateChecking(false)
          setUpdateProgress(Math.max(0, Math.min(100, event.percent)))
          setUpdateFeedback('Downloading update…')
          break
        case 'downloaded':
          setUpdateChecking(false)
          setUpdateProgress(100)
          setUpdateReadyVersion(event.version ?? 'latest')
          setUpdateFeedback(
            event.version
              ? `Update v${event.version} is ready to install.`
              : 'Update downloaded and ready to install.'
          )
          break
        case 'not-available':
          setUpdateChecking(false)
          setUpdateProgress(null)
          setUpdateReadyVersion(null)
          break
        case 'error':
          if (updateFeedbackClearRef.current != null) {
            window.clearTimeout(updateFeedbackClearRef.current)
            updateFeedbackClearRef.current = null
          }
          setUpdateChecking(false)
          setUpdateProgress(null)
          setUpdateFeedback(event.message)
          console.error('[BewareOfDog] updater:', event.message)
          updateFeedbackClearRef.current = window.setTimeout(() => {
            setUpdateFeedback(null)
            updateFeedbackClearRef.current = null
          }, 120_000)
          break
      }
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const el = mainSplitSectionRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setRequestPanelHeight((h) => clampRequestPanelHeight(h, el))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const t = window.setTimeout(() => {
      saveLayout({ leftWidth, rightWidth, requestPanelHeight })
    }, 300)
    return () => window.clearTimeout(t)
  }, [leftWidth, rightWidth, requestPanelHeight])

  return (
    <>
      <PersistenceManager />
      <WorkspaceSyncModal open={syncOpen} onClose={() => setSyncOpen(false)} />
      <div className="h-screen min-h-0 flex flex-col overflow-hidden bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-300 dark:border-slate-700 px-4 py-2 flex items-center gap-4">
        <img src="./bod.png" alt="BewareOfDog" className="w-8 h-8 rounded-full shrink-0" />
        <h1 className="text-lg font-semibold">BewareOfDog</h1>
        <span className="text-slate-600 dark:text-slate-400 text-sm">REST API Debugger</span>
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          {appVersion != null && (
            <span className="text-slate-600 dark:text-slate-500 text-xs tabular-nums" title="Installed version">
              v{appVersion}
            </span>
          )}
          <button
            type="button"
            onClick={() => void onCheckForUpdates()}
            disabled={updateChecking || installingUpdate}
            className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline disabled:opacity-60 disabled:no-underline disabled:cursor-wait"
            title="Check GitHub Releases for a newer build"
          >
            {updateChecking ? 'Checking...' : 'Check for updates'}
          </button>
          {updateReadyVersion != null && (
            <button
              type="button"
              onClick={() => void onInstallUpdate()}
              disabled={installingUpdate}
              className="text-xs text-amber-600 dark:text-amber-400 hover:underline disabled:opacity-60"
              title="Restart now and install downloaded update"
            >
              {installingUpdate ? 'Installing...' : 'Install update'}
            </button>
          )}
          {updateFeedback != null && (
            <span
              className="text-xs text-slate-700 dark:text-slate-400 max-w-[min(520px,55vw)] whitespace-normal break-words leading-snug"
              title={updateFeedback}
            >
              {updateFeedback}
            </span>
          )}
          {updateProgress != null && updateProgress > 0 && updateProgress < 100 && (
            <span className="text-xs text-slate-700 dark:text-slate-400 tabular-nums">
              {Math.round(updateProgress)}%
            </span>
          )}
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => setSyncOpen(true)}
          className="px-2 py-1 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
        >
          Workspace sync
        </button>
        <VariablesPanel />
        <button
          onClick={toggleTheme}
          className="px-2 py-1 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        >
          {theme === 'dark' ? '☀' : '☽'}
        </button>
      </header>
      <main className="flex-1 flex overflow-hidden min-h-0">
        <aside
          className="border-r border-slate-300 dark:border-slate-700 p-2 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900/50 shrink-0"
          style={{ width: leftWidth }}
        >
          <CollectionsPanel />
        </aside>
        <VerticalResizeHandle onResize={onResizeLeft} label="Resize collections sidebar" />
        <section
          ref={mainSplitSectionRef}
          className="flex-1 flex flex-col overflow-hidden min-w-0 min-h-0"
        >
          <div
            className="p-4 min-h-0 flex flex-col overflow-hidden shrink-0"
            style={{ height: requestPanelHeight }}
          >
            <RequestBuilder />
          </div>
          <HorizontalResizeHandle
            onResize={onResizeMainSplit}
            label="Resize request and response panels"
          />
          <div className="flex-1 min-h-0 p-4 overflow-auto flex flex-col">
            <ResponseView />
          </div>
        </section>
        {rightPanelOpen && (
          <>
            <VerticalResizeHandle onResize={onResizeRight} label="Resize collection settings panel" />
            <CollectionSettingsPanel widthPx={rightWidth} />
          </>
        )}
      </main>
      <HttpConsolePanel />
    </div>
    </>
  )
}
