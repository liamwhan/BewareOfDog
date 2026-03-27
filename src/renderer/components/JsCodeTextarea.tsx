import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from 'react'
import { getBodCompletionContext, getBodSuggestions } from '../../shared/bodCompletion'
import { tokenizeJs, type JsTokenKind } from '../../shared/jsSyntaxTokens'

const TAB_SPACES = '    '

const KIND_CLASS: Record<JsTokenKind, string> = {
  keyword: 'text-violet-400',
  identifier: 'text-slate-200',
  string: 'text-emerald-400',
  number: 'text-amber-400',
  comment: 'text-slate-500 italic',
  operator: 'text-sky-400',
  whitespace: 'text-slate-100',
  punctuation: 'text-slate-300',
  plain: 'text-slate-100'
}

export interface JsCodeTextareaProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  /** Tailwind height class, e.g. h-40 */
  heightClass?: string
  className?: string
}

/**
 * Monospace script field with lightweight JS highlighting. Spellcheck disabled for code.
 * `bod.` completions only; Tab inserts four spaces (does not move focus).
 */
export function JsCodeTextarea({
  value,
  onChange,
  placeholder,
  heightClass = 'h-40',
  className = ''
}: JsCodeTextareaProps) {
  const preRef = useRef<HTMLPreElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const [caret, setCaret] = useState(0)
  const [pickIndex, setPickIndex] = useState(0)
  const [suppressSuggestions, setSuppressSuggestions] = useState(false)

  const tokens = useMemo(() => tokenizeJs(value), [value])

  const bodCtx = useMemo(() => getBodCompletionContext(value, caret), [value, caret])
  const suggestions = useMemo(() => {
    if (suppressSuggestions) return []
    if (!bodCtx) return []
    return getBodSuggestions(bodCtx)
  }, [bodCtx, suppressSuggestions])

  useEffect(() => {
    setPickIndex(0)
  }, [suggestions])

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

  const updateCaretFromDom = useCallback(() => {
    const ta = taRef.current
    if (!ta) return
    setCaret(ta.selectionStart)
    setSuppressSuggestions(false)
  }, [])

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
        setCaret(pos)
      })
    },
    [value, onChange]
  )

  const applyCompletion = useCallback(
    (label: string) => {
      const ta = taRef.current
      if (!ta || !bodCtx) return
      const next = value.slice(0, bodCtx.replaceStart) + label + value.slice(bodCtx.caret)
      onChange(next)
      const pos = bodCtx.replaceStart + label.length
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = pos
        setCaret(pos)
      })
    },
    [value, onChange, bodCtx]
  )

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        e.preventDefault()
        e.stopPropagation()
        insertAtSelection(TAB_SPACES)
        return
      }

      if (e.key === 'Escape' && suggestions.length > 0) {
        e.preventDefault()
        setSuppressSuggestions(true)
        return
      }

      if (suggestions.length === 0) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setPickIndex((i) => Math.min(suggestions.length - 1, i + 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setPickIndex((i) => Math.max(0, i - 1))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const pick = suggestions[pickIndex] ?? suggestions[0]
        if (pick) applyCompletion(pick)
      }
    },
    [insertAtSelection, suggestions, pickIndex, applyCompletion]
  )

  useEffect(() => {
    const el = listRef.current
    if (!el || suggestions.length === 0) return
    const row = el.children[pickIndex] as HTMLElement | undefined
    row?.scrollIntoView({ block: 'nearest' })
  }, [pickIndex, suggestions.length])

  const layerClass =
    'w-full box-border px-3 py-2 text-sm font-mono leading-normal whitespace-pre tab-size-[4] overflow-auto resize-none'

  return (
    <div className={`relative rounded border border-slate-600 bg-slate-800 ${className}`}>
      <pre
        ref={preRef}
        aria-hidden
        className={`pointer-events-none absolute inset-0 m-0 ${layerClass} ${heightClass} text-left`}
      >
        {tokens.map((t, i) => (
          <span key={i} className={KIND_CLASS[t.kind]}>
            {t.text}
          </span>
        ))}
      </pre>
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setCaret(e.target.selectionStart)
          setSuppressSuggestions(false)
        }}
        onSelect={updateCaretFromDom}
        onClick={updateCaretFromDom}
        onKeyUp={updateCaretFromDom}
        onKeyDown={onKeyDown}
        onScroll={syncScroll}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        autoComplete="off"
        placeholder={placeholder}
        className={`relative block ${layerClass} ${heightClass} border-0 bg-transparent text-transparent caret-slate-100 outline-none ring-0 focus:ring-0 placeholder:text-slate-500`}
      />
      {suggestions.length > 0 && (
        <div
          ref={listRef}
          role="listbox"
          aria-label="bod API suggestions"
          className="absolute z-20 left-0 right-0 mt-0.5 max-h-36 overflow-y-auto rounded border border-slate-600 bg-slate-900 shadow-lg text-sm font-mono"
        >
          {suggestions.map((s, i) => (
            <button
              key={s}
              type="button"
              role="option"
              aria-selected={i === pickIndex}
              className={`w-full text-left px-2 py-1 hover:bg-slate-700/80 ${
                i === pickIndex ? 'bg-slate-700 text-slate-100' : 'text-slate-200'
              }`}
              onMouseDown={(e) => {
                e.preventDefault()
                applyCompletion(s)
              }}
              onMouseEnter={() => setPickIndex(i)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
