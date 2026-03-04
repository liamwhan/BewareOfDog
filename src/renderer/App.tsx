import { useEffect } from 'react'
import { RequestBuilder } from './components/RequestBuilder'
import { ResponseView } from './components/ResponseView'
import { CollectionsPanel } from './components/CollectionsPanel'
import { VariablesPanel } from './components/VariablesPanel'
import { PersistenceManager } from './components/PersistenceManager'
import { useThemeStore } from './stores/themeStore'

export default function App() {
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return (
    <>
      <PersistenceManager />
      <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-slate-100 flex flex-col">
      <header className="border-b border-slate-300 dark:border-slate-700 px-4 py-2 flex items-center gap-4">
        <img src="/bod.png" alt="BewareOfDog" className="w-8 h-8 rounded-full shrink-0" />
        <h1 className="text-lg font-semibold">BewareOfDog</h1>
        <span className="text-slate-500 dark:text-slate-400 text-sm">REST API Debugger</span>
        <div className="flex-1" />
        <VariablesPanel />
        <button
          onClick={toggleTheme}
          className="px-2 py-1 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
          title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
        >
          {theme === 'dark' ? '☀' : '☽'}
        </button>
      </header>
      <main className="flex-1 flex overflow-hidden">
        <aside className="w-64 border-r border-slate-300 dark:border-slate-700 p-2 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900/50">
          <CollectionsPanel />
        </aside>
        <section className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-300 dark:border-slate-700 flex-1 min-h-0 flex flex-col">
            <RequestBuilder />
          </div>
          <div className="flex-1 p-4 overflow-auto min-h-0 flex flex-col border-t border-slate-300 dark:border-slate-700">
            <ResponseView />
          </div>
        </section>
      </main>
    </div>
    </>
  )
}
