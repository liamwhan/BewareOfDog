import { useEffect, useState } from 'react'
import { useEnvironmentStore } from '../../stores/environmentStore'
import { KeyValueEditor } from '../RequestBuilder/KeyValueEditor'

export function VariablesPanel() {
  const [showEnvEditor, setShowEnvEditor] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const {
    environments,
    activeEnvironmentId,
    setActiveEnvironment,
    addEnvironment,
    removeEnvironment,
    updateEnvironment,
    importEnvironment,
    exportEnvironment
  } = useEnvironmentStore()

  const activeEnv = environments.find((e) => e.id === activeEnvironmentId)

  useEffect(() => {
    if (!activeEnv) {
      setShowDeleteConfirm(false)
    }
  }, [activeEnv])

  useEffect(() => {
    if (!showDeleteConfirm) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowDeleteConfirm(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showDeleteConfirm])

  useEffect(() => {
    if (!showEnvEditor) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !showDeleteConfirm) setShowEnvEditor(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showEnvEditor, showDeleteConfirm])

  return (
    <div className="flex items-center gap-4 relative">
      <div className="flex items-center gap-2">
        <span className="text-slate-600 dark:text-slate-400 text-sm">Environment:</span>
        <select
          value={activeEnvironmentId ?? ''}
          onChange={(e) => setActiveEnvironment(e.target.value || null)}
          className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-sm text-slate-900 dark:text-slate-100"
        >
          <option value="">None</option>
          {environments.map((env) => (
            <option key={env.id} value={env.id}>
              {env.name}
            </option>
          ))}
        </select>
        <button
          onClick={() => addEnvironment()}
          className="px-2 py-1 text-xs text-emerald-700 dark:text-emerald-400 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
        >
          + New
        </button>
        {activeEnv && (
          <button
            onClick={() => setShowEnvEditor(!showEnvEditor)}
            className="px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          >
            Edit
          </button>
        )}
      </div>

      {showEnvEditor && activeEnv && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="env-editor-title"
          onClick={() => setShowEnvEditor(false)}
        >
          <div
            className="w-[min(840px,94vw)] max-h-[min(85vh,720px)] flex flex-col rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-600 px-4 py-3 shrink-0">
              <h2 id="env-editor-title" className="sr-only">
                Edit environment
              </h2>
              <input
                type="text"
                value={activeEnv.name}
                onChange={(e) => updateEnvironment(activeEnv.id, { name: e.target.value })}
                className="flex-1 px-2 py-1.5 text-sm font-medium text-slate-900 dark:text-slate-300 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded min-w-0"
                placeholder="Environment name"
              />
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => {
                    const json = exportEnvironment(activeEnv.id)
                    const blob = new Blob([json], { type: 'application/json' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url
                    a.download = `${activeEnv.name}.json`
                    a.click()
                    URL.revokeObjectURL(url)
                  }}
                  className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  Export
                </button>
                <button
                  onClick={() => {
                    const input = document.createElement('input')
                    input.type = 'file'
                    input.accept = '.json'
                    input.onchange = async (e) => {
                      const file = (e.target as HTMLInputElement).files?.[0]
                      if (file) {
                        const text = await file.text()
                        importEnvironment(text)
                        setShowEnvEditor(false)
                      }
                    }
                    input.click()
                  }}
                  className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline"
                >
                  Import
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setShowEnvEditor(false)}
                  className="shrink-0 text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-200 px-2 py-1 rounded text-lg leading-none"
                  aria-label="Close"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <KeyValueEditor
                items={activeEnv.variables}
                onChange={(v) => updateEnvironment(activeEnv.id, { variables: v })}
                keyPlaceholder="Variable name"
                valuePlaceholder="Value"
                addLabel="Add Variable"
                variableContext={{ envVars: activeEnv.variables, collectionVars: [] }}
              />
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && activeEnv && (
        <>
          <div
            className="fixed inset-0 z-[110] bg-black/50"
            aria-hidden
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-env-title"
            className="fixed z-[111] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(420px,92vw)] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-4 shadow-xl"
          >
            <h2 id="delete-env-title" className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2">
              Delete environment?
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Permanently delete{' '}
              <span className="text-slate-800 dark:text-slate-200 font-medium">&quot;{activeEnv.name}&quot;</span>? This cannot be
              undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1.5 text-sm rounded border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  removeEnvironment(activeEnv.id)
                  setShowDeleteConfirm(false)
                  setShowEnvEditor(false)
                }}
                className="px-3 py-1.5 text-sm rounded bg-red-600 text-white hover:bg-red-500"
              >
                Delete
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
