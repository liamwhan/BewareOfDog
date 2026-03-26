import { useCallback, useEffect, useState } from 'react'
import { RequestBuilder } from './components/RequestBuilder'
import { ResponseView } from './components/ResponseView'
import { CollectionsPanel } from './components/CollectionsPanel'
import { CollectionSettingsPanel } from './components/CollectionSettingsPanel'
import { VerticalResizeHandle } from './components/VerticalResizeHandle'
import { VariablesPanel } from './components/VariablesPanel'
import { PersistenceManager } from './components/PersistenceManager'
import { WorkspaceSyncModal } from './components/WorkspaceSyncModal'
import { useThemeStore } from './stores/themeStore'
import { useCollectionStore } from './stores/collectionStore'

const LEFT_MIN = 160
const LEFT_MAX = 560
const LEFT_DEFAULT = 256
const RIGHT_MIN = 220
const RIGHT_MAX = 560
const RIGHT_DEFAULT = 320

export default function App() {
  const [syncOpen, setSyncOpen] = useState(false)
  const [leftWidth, setLeftWidth] = useState(LEFT_DEFAULT)
  const [rightWidth, setRightWidth] = useState(RIGHT_DEFAULT)
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const rightPanelOpen = useCollectionStore((s) => s.selectedCollectionSettingsIndex !== null)

  const onResizeLeft = useCallback((deltaPx: number) => {
    setLeftWidth((w) => Math.min(LEFT_MAX, Math.max(LEFT_MIN, w + deltaPx)))
  }, [])

  const onResizeRight = useCallback((deltaPx: number) => {
    setRightWidth((w) => Math.min(RIGHT_MAX, Math.max(RIGHT_MIN, w - deltaPx)))
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <>
      <PersistenceManager />
      <WorkspaceSyncModal open={syncOpen} onClose={() => setSyncOpen(false)} />
      <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="border-b border-slate-300 dark:border-slate-700 px-4 py-2 flex items-center gap-4">
        <img src="./bod.png" alt="BewareOfDog" className="w-8 h-8 rounded-full shrink-0" />
        <h1 className="text-lg font-semibold">BewareOfDog</h1>
        <span className="text-slate-500 dark:text-slate-400 text-sm">REST API Debugger</span>
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
          className="px-2 py-1 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
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
        <section className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="p-4 border-b border-slate-300 dark:border-slate-700 flex-1 min-h-0 flex flex-col">
            <RequestBuilder />
          </div>
          <div className="flex-1 p-4 overflow-auto min-h-0 flex flex-col border-t border-slate-300 dark:border-slate-700">
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
    </div>
    </>
  )
}
