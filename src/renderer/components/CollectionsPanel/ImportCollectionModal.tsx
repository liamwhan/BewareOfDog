import { useEffect, useRef, useState } from 'react'

interface ImportCollectionModalProps {
  open: boolean
  onClose: () => void
  /** Parses and imports JSON; must close the modal by calling onClose on success. */
  onImportJson: (text: string) => void
}

export function ImportCollectionModal({ open, onClose, onImportJson }: ImportCollectionModalProps) {
  const [paste, setPaste] = useState('')
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    setPaste('')
    setInlineError(null)
    setDragOver(false)
    const t = requestAnimationFrame(() => textareaRef.current?.focus())
    return () => cancelAnimationFrame(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const tryImport = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) {
      setInlineError('Paste JSON or choose a file.')
      return
    }
    setInlineError(null)
    onImportJson(trimmed)
  }

  const handleSelectFile = () => {
    fileInputRef.current?.click()
  }

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const text = await file.text()
      tryImport(text)
    } catch {
      setInlineError('Could not read that file.')
    }
  }

  const onFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    void handleFile(file)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) void handleFile(file)
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOver(true)
  }

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg shadow-xl max-w-lg w-full border border-slate-200 dark:border-slate-600"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-600 px-4 py-3">
          <h2 id="import-modal-title" className="text-base font-semibold pr-4">
            Import collection
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2 py-1 rounded text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-4 text-sm">
          <div>
            <label htmlFor="import-paste-json" className="block text-slate-600 dark:text-slate-400 mb-1.5">
              Paste JSON
            </label>
            <textarea
              id="import-paste-json"
              ref={textareaRef}
              value={paste}
              onChange={(e) => {
                setPaste(e.target.value)
                setInlineError(null)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  tryImport(paste)
                }
              }}
              placeholder="BewareOfDog collection, Postman v2.1, or OpenAPI 3.x JSON…"
              rows={5}
              spellCheck={false}
              className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-xs leading-relaxed placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 focus:border-emerald-600"
            />
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-500">
              JSON only — OpenAPI, Postman collection, or native BewareOfDog export. Ctrl+Enter to import.
            </p>
          </div>

          {inlineError && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {inlineError}
            </p>
          )}

          <div className="flex flex-wrap gap-2 justify-end">
            <button
              type="button"
              onClick={() => tryImport(paste)}
              className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium"
            >
              Import from text
            </button>
          </div>

          <div
            className={`relative rounded-lg border-2 border-dashed transition-colors ${
              dragOver
                ? 'border-emerald-500 bg-emerald-500/10'
                : 'border-slate-300 dark:border-slate-600 bg-slate-50/80 dark:bg-slate-900/40'
            }`}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
          >
            <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
              <span className="text-slate-500 dark:text-slate-400 text-2xl mb-2" aria-hidden>
                ↓
              </span>
              <p className="text-slate-700 dark:text-slate-300 font-medium">Drop a JSON file to import</p>
              <p className="mt-2 text-slate-600 dark:text-slate-400 text-xs">
                Or{' '}
                <button
                  type="button"
                  onClick={handleSelectFile}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline font-medium"
                >
                  select a file
                </button>
              </p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={onFileInputChange}
          />
        </div>
      </div>
    </div>
  )
}
