import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  type KeyboardEvent
} from 'react'
import { tokenizeJson, type JsonToken, type JsonTokenKind } from '../../shared/jsonSyntaxTokens'

const TAB_SPACES = '    '

export const JSON_KIND_CLASS: Record<JsonTokenKind, string> = {
  key: 'text-sky-700 dark:text-sky-400',
  keyword: 'text-violet-700 dark:text-violet-400',
  string: 'text-emerald-800 dark:text-emerald-400',
  number: 'text-amber-800 dark:text-amber-400',
  punctuation: 'text-slate-600 dark:text-slate-300',
  whitespace: 'text-slate-800 dark:text-slate-100',
  plain: 'text-slate-800 dark:text-slate-200'
}

function JsonTokenSpans({ tokens }: { tokens: JsonToken[] }) {
  return (
    <>
      {tokens.map((t, i) => (
        <span key={i} className={JSON_KIND_CLASS[t.kind]}>
          {t.text}
        </span>
      ))}
    </>
  )
}

/** Read-only JSON with the same highlighting as the request body editor. */
export function JsonHighlightPre({ value, className = '' }: { value: string; className?: string }) {
  const tokens = useMemo(() => tokenizeJson(value), [value])
  return (
    <pre
      className={`text-sm font-mono whitespace-pre-wrap break-words text-left ${className}`}
    >
      <JsonTokenSpans tokens={tokens} />
    </pre>
  )
}

export interface JsonCodeTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  heightClass?: string
  className?: string
}

/**
 * Monospace JSON body field with lightweight highlighting. Spellcheck disabled for code.
 * Tab inserts four spaces (does not move focus).
 */
export function JsonCodeTextarea({
  value,
  onChange,
  placeholder,
  heightClass = 'h-40',
  className = ''
}: JsonCodeTextareaProps) {
  const preRef = useRef<HTMLPreElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const tokens = useMemo(() => tokenizeJson(value), [value])

  const syncScroll = useCallback(() => {
    const pre = preRef.current
    const ta = taRef.current
    if (!pre || !ta) return
    pre.scrollTop = ta.scrollTop
    pre.scrollLeft = ta.scrollLeft
  }, [])

  useLayoutEffect(() => {
    syncScroll()
  }, [value, syncScroll])

  const insertAtSelection = useCallback(
    (insert: string) => {
      const ta = taRef.current
      if (!ta) return
      const start = ta.selectionStart
      const end = ta.selectionEnd
      const next = value.slice(0, start) + insert + value.slice(end)
      onChange(next)
      const pos = start + insert.length
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = pos
      })
    },
    [value, onChange]
  )

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault()
        e.stopPropagation()
        insertAtSelection(TAB_SPACES)
      }
    },
    [insertAtSelection]
  )

  const layerClass =
    'w-full box-border px-3 py-2 text-sm font-mono leading-normal whitespace-pre tab-size-[4] overflow-auto resize-none'

  return (
    <div className={`relative rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 ${className}`}>
      <pre
        ref={preRef}
        aria-hidden
        className={`pointer-events-none absolute inset-0 m-0 ${layerClass} ${heightClass} text-left`}
      >
        <JsonTokenSpans tokens={tokens} />
      </pre>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onScroll={syncScroll}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        autoComplete="off"
        placeholder={placeholder}
        className={`relative block ${layerClass} ${heightClass} border-0 bg-transparent text-transparent caret-slate-900 dark:caret-slate-100 outline-none ring-0 focus:ring-0 placeholder:text-slate-500 dark:placeholder:text-slate-500`}
      />
    </div>
  )
}
