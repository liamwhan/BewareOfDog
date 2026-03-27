import type { Variable } from '../../../shared/types'
import {
  InputWithVariableTooltips,
  type VariableTooltipContext
} from '../VariableFieldWithTooltips'

interface KeyValueEditorProps {
  items: Variable[]
  onChange: (items: Variable[]) => void
  keyPlaceholder?: string
  valuePlaceholder?: string
  addLabel?: string
  /** When set, value cells show {{var}} highlights and native tooltips with fully resolved values. */
  variableContext?: VariableTooltipContext
}

export function KeyValueEditor({
  items,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  addLabel = 'Add',
  variableContext
}: KeyValueEditorProps) {
  const update = (index: number, field: 'key' | 'value', value: string) => {
    const next = [...items]
    next[index] = { ...next[index], [field]: value }
    onChange(next)
  }

  const add = () => {
    onChange([...items, { key: '', value: '' }])
  }

  const remove = (index: number) => {
    onChange(items.filter((_, i) => i !== index))
  }

  return (
    <div className="space-y-1">
      {items.map((item, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            type="text"
            value={item.key}
            onChange={(e) => update(i, 'key', e.target.value)}
            placeholder={keyPlaceholder}
            className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-100 placeholder-slate-500"
          />
          {variableContext ? (
            <InputWithVariableTooltips
              value={item.value}
              onChange={(v) => update(i, 'value', v)}
              variableContext={variableContext}
              placeholder={valuePlaceholder}
              className="flex-1 min-w-0"
              inputClassName="px-2 py-1.5"
            />
          ) : (
            <input
              type="text"
              value={item.value}
              onChange={(e) => update(i, 'value', e.target.value)}
              placeholder={valuePlaceholder}
              className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-100 placeholder-slate-500"
            />
          )}
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
        {addLabel}
      </button>
    </div>
  )
}
