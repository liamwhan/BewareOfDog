import { useCollectionStore } from '../../stores/collectionStore'
import { AuthEditor } from '../AuthEditor'
import { KeyValueEditor } from '../RequestBuilder/KeyValueEditor'

const DEFAULT_WIDTH_PX = 320

export function CollectionSettingsPanel({ widthPx = DEFAULT_WIDTH_PX }: { widthPx?: number }) {
  const selectedIndex = useCollectionStore((s) => s.selectedCollectionSettingsIndex)
  const collections = useCollectionStore((s) => s.collections)
  const updateCollection = useCollectionStore((s) => s.updateCollection)

  if (selectedIndex === null || !collections[selectedIndex]) return null

  const collection = collections[selectedIndex]

  return (
    <div
      className="flex flex-col h-full min-h-0 bg-slate-50 dark:bg-slate-900/80 shrink-0"
      style={{ width: widthPx }}
    >
      <div className="px-3 py-2 border-b border-slate-300 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate" title={collection.name}>
          {collection.name}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Collection settings</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="px-3 py-2 border-b border-slate-300 dark:border-slate-700">
          <span className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Authorization
          </span>
        </div>
        <div className="p-3 border-b border-slate-300 dark:border-slate-700">
          <AuthEditor
            mode="collection"
            value={collection.auth}
            onChange={(auth) => updateCollection(selectedIndex, { auth })}
          />
        </div>

        <div className="px-3 py-2 border-b border-slate-300 dark:border-slate-700">
          <span className="text-xs font-medium uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Variables
          </span>
        </div>
        <div className="p-3">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Available as <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded">{'{{name}}'}</code> in URLs,
            headers, bodies, and auth. Active environment variables load first; collection variables override when the
            same key exists.
          </p>
          <KeyValueEditor
            items={collection.variables}
            onChange={(variables) => updateCollection(selectedIndex, { variables })}
            keyPlaceholder="Variable name"
            valuePlaceholder="Value"
            addLabel="Add variable"
          />
        </div>
      </div>
    </div>
  )
}
