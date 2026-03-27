import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent
} from 'react'
import {
  getBodCompletionContext,
  getBodSuggestionItems,
  type BodSuggestionItem
} from '../../shared/bodCompletion'
import { getTextareaCaretOffset } from '../lib/textareaCaretOffset'
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

function SuggestionKindIcon({ kind }: { kind: BodSuggestionItem['kind'] }) {
  if (kind === 'method') {
    return (
      <svg
        className="h-3.5 w-3.5 shrink-0 text-sky-400"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        aria-hidden
      >
        <path d="M4 3.5c-1.2 2.2-1.2 7.3 0 9.5M12 3.5c1.2 2.2 1.2 7.3 0 9.5M6.5 8h3" />
      </svg>
    )
  }
  return (
    <svg className="h-3.5 w-3.5 shrink-0 text-amber-300/90" viewBox="0 0 16 16" aria-hidden>
      <rect x="4" y="5" width="8" height="6" rx="1" fill="currentColor" opacity="0.85" />
    </svg>
  )
}

/**
 * Monospace script field with lightweight JS highlighting. Spellcheck disabled for code.
 * `bod.` completions only; Tab inserts four spaces when no list is open, or accepts the
 * highlighted suggestion when the completion list is visible.
 */
export function JsCodeTextarea({
  value,
  onChange,
  placeholder,
  heightClass = 'h-40',
  className = ''
}: JsCodeTextareaProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const [caret, setCaret] = useState(0)
  const [pickIndex, setPickIndex] = useState(0)
  const [suppressSuggestions, setSuppressSuggestions] = useState(false)
  const [scrollTick, setScrollTick] = useState(0)
  const [popupStyle, setPopupStyle] = useState<{
    left: number
    top: number
    maxWidth: number
  } | null>(null)

  const popupPlacement = popupStyle ?? { left: 0, top: 0, maxWidth: 320 }

  const tokens = useMemo(() => tokenizeJs(value), [value])

  const bodCtx = useMemo(() => getBodCompletionContext(value, caret), [value, caret])
  const suggestions = useMemo(() => {
    if (suppressSuggestions) return []
    if (!bodCtx) return []
    return getBodSuggestionItems(bodCtx)
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

  useLayoutEffect(() => {
    if (suggestions.length === 0) {
      setPopupStyle(null)
      return
    }
    const ta = taRef.current
    const wrap = containerRef.current
    if (!ta || !wrap) return

    const coords = getTextareaCaretOffset(ta, caret)
    const gap = 4
    const pad = 8
    const containerW = wrap.clientWidth
    const listW = listRef.current?.offsetWidth ?? 0
    const preferredLeft = coords.left + gap
    let left = preferredLeft
    if (listW > 0 && preferredLeft + listW > containerW - pad) {
      const leftOfCaret = coords.left - gap - listW
      if (leftOfCaret >= pad) {
        left = leftOfCaret
      } else {
        left = Math.max(pad, containerW - listW - pad)
      }
    }
    const maxWidth = Math.max(160, containerW - left - pad)
    setPopupStyle({ left, top: coords.top, maxWidth })
  }, [suggestions.length, caret, value, pickIndex, scrollTick])

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Tab') {
        if (suggestions.length > 0) {
          e.preventDefault()
          e.stopPropagation()
          const pick = suggestions[pickIndex] ?? suggestions[0]
          if (pick) applyCompletion(pick.label)
          return
        }
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
        if (pick) applyCompletion(pick.label)
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

  const syncScrollAndPopup = useCallback(() => {
    syncScroll()
    setScrollTick((n) => n + 1)
  }, [syncScroll])

  const layerClass =
    'w-full box-border px-3 py-2 text-sm font-mono leading-normal whitespace-pre tab-size-[4] overflow-auto resize-none'

  return (
    <div ref={containerRef} className={`relative rounded border border-slate-600 bg-slate-800 ${className}`}>
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
        onScroll={syncScrollAndPopup}
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
          style={{
            left: popupPlacement.left,
            top: popupPlacement.top,
            maxWidth: popupPlacement.maxWidth
          }}
          className="absolute z-30 min-w-[10rem] max-h-36 overflow-y-auto rounded border border-slate-600 bg-slate-900 shadow-xl text-sm font-mono"
        >
          {suggestions.map((s, i) => (
            <button
              key={s.label}
              type="button"
              role="option"
              aria-selected={i === pickIndex}
              title={s.kind === 'method' ? 'Method' : 'Property'}
              className={`flex w-full items-center gap-2 text-left px-2 py-1 hover:bg-slate-700/80 ${
                i === pickIndex ? 'bg-slate-700 text-slate-100' : 'text-slate-200'
              }`}
              onMouseDown={(e) => {
                e.preventDefault()
                applyCompletion(s.label)
              }}
              onMouseEnter={() => setPickIndex(i)}
            >
              <SuggestionKindIcon kind={s.kind} />
              <span className="min-w-0 flex-1 truncate">{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
