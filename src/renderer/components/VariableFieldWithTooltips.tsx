import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Variable } from '../../shared/types'
import {
  findVariablePlaceholderAtIndex,
  resolveVariableTooltipWithPath,
  splitTemplateParts
} from '../../shared/variableResolver'

export interface VariableTooltipContext {
  envVars: Variable[]
  collectionVars: Variable[]
}

function MirrorParts({ value }: { value: string }) {
  const parts = splitTemplateParts(value)
  if (parts.length === 0) return null
  return (
    <>
      {parts.map((p, i) =>
        p.type === 'text' ? (
          <span key={i}>{p.content}</span>
        ) : (
          <span
            key={i}
            className="text-sky-700 dark:text-sky-400 underline decoration-dotted decoration-slate-500/80 underline-offset-2"
          >
            {p.content}
          </span>
        )
      )}
    </>
  )
}

/** Map pointer X to a character index in the input value (canvas text metrics, matches field font). */
function charIndexFromClientX(input: HTMLInputElement, clientX: number): number {
  const text = input.value
  if (text.length === 0) return -1
  const rect = input.getBoundingClientRect()
  const cs = getComputedStyle(input)
  const borderLeft = parseFloat(cs.borderLeftWidth) || 0
  const padLeft = parseFloat(cs.paddingLeft) || 0
  const relX = clientX - rect.left - borderLeft - padLeft + input.scrollLeft

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return -1
  ctx.font = cs.font || `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`

  const total = ctx.measureText(text).width
  if (relX < 0 || relX > total) return -1
  if (relX <= 0) return 0

  for (let i = 0; i < text.length; i++) {
    const w = ctx.measureText(text.slice(0, i + 1)).width
    if (relX < w) return i
  }
  return text.length - 1
}

const inputOverlayClass =
  'absolute inset-0 z-10 w-full h-full bg-transparent text-transparent caret-emerald-600 dark:caret-emerald-400 border-0 outline-none focus:outline-none focus:ring-0 rounded box-border placeholder:text-slate-500 dark:placeholder:text-slate-500 text-inherit'

const mirrorBaseClass =
  'pointer-events-none absolute inset-0 z-0 text-slate-900 dark:text-slate-100 box-border text-inherit'

type TooltipState = {
  x: number
  y: number
  pathLine: string
  resolved: string
}

/** Single-line field: transparent input over a styled mirror; custom tooltip on hover over {{var}} (native title does not fire through the input layer). */
export function InputWithVariableTooltips({
  value,
  onChange,
  variableContext,
  className = '',
  inputClassName,
  placeholder,
  'aria-label': ariaLabel,
  autoComplete
}: {
  value: string
  onChange: (v: string) => void
  variableContext: VariableTooltipContext
  className?: string
  inputClassName?: string
  placeholder?: string
  'aria-label'?: string
  autoComplete?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const mirrorRef = useRef<HTMLDivElement>(null)
  const pad = inputClassName ?? 'px-3 py-2'
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const rafRef = useRef<number | null>(null)

  const clearTooltip = useCallback(() => {
    setTooltip(null)
    if (inputRef.current) inputRef.current.style.cursor = ''
  }, [])

  const onInputMouseMove = useCallback(
    (e: React.MouseEvent<HTMLInputElement>) => {
      const input = inputRef.current
      if (!input) return

      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        const idx = charIndexFromClientX(input, e.clientX)
        if (idx < 0) {
          clearTooltip()
          return
        }
        const hit = findVariablePlaceholderAtIndex(value, idx)
        if (!hit) {
          clearTooltip()
          return
        }
        const { pathLine, resolved } = resolveVariableTooltipWithPath(
          hit.key,
          variableContext.envVars,
          variableContext.collectionVars
        )
        input.style.cursor = 'help'
        setTooltip({
          x: e.clientX + 12,
          y: e.clientY + 14,
          pathLine,
          resolved
        })
      })
    },
    [value, variableContext, clearTooltip]
  )

  const onInputMouseLeave = useCallback(() => {
    clearTooltip()
  }, [clearTooltip])

  return (
    <div
      className={`relative min-h-[2.25rem] rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 focus-within:ring-1 focus-within:ring-emerald-600/50 ${className}`}
      onMouseLeave={onInputMouseLeave}
    >
      <input
        ref={inputRef}
        type="text"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onMouseMove={onInputMouseMove}
        onScroll={(e) => {
          if (mirrorRef.current) mirrorRef.current.scrollLeft = e.currentTarget.scrollLeft
        }}
        placeholder={placeholder}
        aria-label={ariaLabel}
        autoComplete={autoComplete}
        className={`${inputOverlayClass} ${pad} whitespace-nowrap`}
      />
      <div
        ref={mirrorRef}
        aria-hidden
        className={`${mirrorBaseClass} overflow-x-auto overflow-y-hidden whitespace-nowrap ${pad} flex items-center`}
      >
        <MirrorParts value={value} />
      </div>

      {tooltip &&
        createPortal(
          <div
            role="tooltip"
            className="fixed z-[200] max-w-sm rounded-md border border-emerald-600 bg-slate-950 px-3 py-2 text-xs text-slate-100 shadow-xl ring-1 ring-slate-600 pointer-events-none"
            style={{ left: tooltip.x, top: tooltip.y }}
          >
            <p className="font-mono text-sky-400 mb-1.5 break-all">{tooltip.pathLine}</p>
            <p className="text-slate-200 break-all leading-relaxed">{tooltip.resolved}</p>
          </div>,
          document.body
        )}
    </div>
  )
}
