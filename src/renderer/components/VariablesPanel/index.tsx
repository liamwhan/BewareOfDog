import { useState } from 'react'
import { useEnvironmentStore } from '../../stores/environmentStore'
import { useCollectionStore } from '../../stores/collectionStore'
import { KeyValueEditor } from '../RequestBuilder/KeyValueEditor'
import type { Variable } from '../../../shared/types'

export function VariablesPanel() {
  const [showEnvEditor, setShowEnvEditor] = useState(false)
  const [showCollEditor, setShowCollEditor] = useState(false)

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

  const { collections, selectedRequestId, updateCollection } = useCollectionStore()

  const activeEnv = environments.find((e) => e.id === activeEnvironmentId)
  const selectedCollection = collections.find((c) =>
    c.requests.some((r) => r.id === selectedRequestId)
  )

  return (
    <div className="flex items-center gap-4 relative">
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-sm">Environment:</span>
        <select
          value={activeEnvironmentId ?? ''}
          onChange={(e) => setActiveEnvironment(e.target.value || null)}
          className="px-3 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-100"
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
          className="px-2 py-1 text-xs text-amber-400 hover:bg-slate-700 rounded"
        >
          + New
        </button>
        {activeEnv && (
          <button
            onClick={() => setShowEnvEditor(!showEnvEditor)}
            className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
          >
            Edit
          </button>
        )}
      </div>

      {selectedCollection && (
        <button
          onClick={() => setShowCollEditor(!showCollEditor)}
          className="px-2 py-1 text-xs text-slate-400 hover:text-slate-200"
        >
          Collection vars
        </button>
      )}

      {showEnvEditor && activeEnv && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowEnvEditor(false)}
          />
          <div className="absolute right-0 top-full mt-1 p-3 border border-slate-600 rounded bg-slate-800 shadow-xl z-50 min-w-72">
            <div className="flex items-center justify-between mb-2 gap-2">
              <input
                type="text"
                value={activeEnv.name}
                onChange={(e) => updateEnvironment(activeEnv.id, { name: e.target.value })}
                className="flex-1 px-2 py-1 text-sm font-medium text-slate-300 bg-slate-700 border border-slate-600 rounded min-w-0"
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
                  className="text-xs text-amber-400 hover:underline"
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
                  className="text-xs text-amber-400 hover:underline"
                >
                  Import
                </button>
                <button
                  onClick={() => {
                    removeEnvironment(activeEnv.id)
                    setShowEnvEditor(false)
                  }}
                  className="text-xs text-red-400 hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
            <KeyValueEditor
              items={activeEnv.variables}
              onChange={(v) => updateEnvironment(activeEnv.id, { variables: v })}
              keyPlaceholder="Variable name"
              valuePlaceholder="Value"
              addLabel="Add Variable"
            />
          </div>
        </>
      )}

      {showCollEditor && selectedCollection && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowCollEditor(false)}
          />
          <div className="absolute right-0 top-full mt-1 p-3 border border-slate-600 rounded bg-slate-800 shadow-xl z-50 min-w-72">
            <span className="text-sm font-medium text-slate-300 block mb-2">
              {selectedCollection.name} variables
            </span>
            <KeyValueEditor
              items={selectedCollection.variables}
              onChange={(v) => {
                const i = collections.findIndex((c) => c.name === selectedCollection.name)
                if (i >= 0) updateCollection(i, { variables: v })
              }}
              keyPlaceholder="Variable name"
              valuePlaceholder="Value"
              addLabel="Add Variable"
            />
          </div>
        </>
      )}
    </div>
  )
}
