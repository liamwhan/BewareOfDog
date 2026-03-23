import type { Variable } from '../../../shared/types'

export interface QueryParam extends Variable {
  enabled: boolean
}

interface QueryParamsEditorProps {
  params: QueryParam[]
  onChange: (params: QueryParam[]) => void
}

export function QueryParamsEditor({ params, onChange }: QueryParamsEditorProps) {
  const update = (index: number, field: 'key' | 'value' | 'enabled', value: string | boolean) => {
    const next = [...params]
    next[index] = { ...next[index], [field]: value }
    onChange(next)
  }

  const add = () => {
    onChange([...params, { key: '', value: '', enabled: true }])
  }

  const remove = (index: number) => {
    onChange(params.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-1">
      {params.map((item, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            type="checkbox"
            checked={item.enabled}
            onChange={(e) => update(i, 'enabled', e.target.checked)}
            className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-emerald-500"
          />
          <input
            type="text"
            value={item.key}
            onChange={(e) => update(i, 'key', e.target.value)}
            placeholder="Key"
            className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-100 placeholder-slate-500"
          />
          <input
            type="text"
            value={item.value}
            onChange={(e) => update(i, 'value', e.target.value)}
            placeholder="Value"
            className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-100 placeholder-slate-500"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="px-2 py-1.5 text-red-400 hover:bg-slate-700 rounded text-sm"
          >
            Remove
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="px-3 py-1.5 text-sm text-emerald-400 hover:bg-slate-700 rounded border border-slate-600"
      >
        Add
      </button>
    </div>
  )
}
