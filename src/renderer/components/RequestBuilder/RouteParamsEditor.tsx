import { useEffect, useRef } from 'react'
import { extractRouteParams } from '../../../shared/variableResolver'
import type { Variable } from '../../../shared/types'

interface RouteParamsEditorProps {
  url: string
  params: Variable[]
  onChange: (params: Variable[]) => void
}

export function RouteParamsEditor({ url, params, onChange }: RouteParamsEditorProps) {
  const paramsRef = useRef(params)
  paramsRef.current = params

  useEffect(() => {
    const keys = extractRouteParams(url)
    const current = paramsRef.current
    const existing = new Map(current.map((p) => [p.key, p.value]))
    const next: Variable[] = keys.map((key) => ({
      key,
      value: existing.get(key) ?? ''
    }))
    const keysChanged =
      next.length !== current.length || next.some((n, i) => n.key !== current[i]?.key)
    if (keysChanged) onChange(next)
  }, [url, onChange])

  const update = (index: number, value: string) => {
    const next = [...params]
    next[index] = { ...next[index], value }
    onChange(next)
  }

  if (params.length === 0) {
    return (
      <p className="text-slate-500 text-sm py-2">No route parameters in URL (use :param in URL)</p>
    )
  }

  return (
    <div className="space-y-1">
      {params.map((p, i) => (
        <div key={p.key} className="flex gap-2 items-center">
          <span className="w-24 text-slate-400 text-sm font-mono">:{p.key}</span>
          <input
            type="text"
            value={p.value}
            onChange={(e) => update(i, e.target.value)}
            placeholder={`Value for ${p.key}`}
            className="flex-1 px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-sm text-slate-100 placeholder-slate-500"
          />
        </div>
      ))}
    </div>
  )
}
