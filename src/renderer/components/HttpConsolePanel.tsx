import { useState } from 'react'
import type { HttpConsoleLogEntry } from '../stores/requestStore'
import { useRequestStore } from '../stores/requestStore'

function formatHeaderBlock(h: Record<string, string>): string {
  return Object.entries(h)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
}

function ConsoleLogBlock({ log }: { log: HttpConsoleLogEntry }) {
  const time = new Date(log.at).toLocaleTimeString(undefined, {
    hour12: false
  })
  const ms = new Date(log.at).getMilliseconds().toString().padStart(3, '0')

  const statusLine =
    log.error != null
      ? `Error — ${log.error}`
      : log.responseStatus != null
        ? `${log.responseStatus} ${log.responseStatusText ?? ''} · ${log.durationMs ?? 0} ms`
        : '—'

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-md p-3 bg-white/90 dark:bg-slate-900/70 text-slate-800 dark:text-slate-300">
      <div className="text-emerald-700 dark:text-emerald-500/90 font-medium mb-2 flex flex-wrap gap-x-2 gap-y-1">
        <span className="text-slate-600 dark:text-slate-500">{time}.{ms}</span>
        <span className="text-sky-700 dark:text-sky-400">{log.method}</span>
        <span className="text-slate-600 dark:text-slate-400 break-all">{statusLine}</span>
      </div>
      <div className="space-y-2 text-[11px] leading-relaxed">
        <div>
          <div className="text-slate-600 dark:text-slate-500 uppercase tracking-wide mb-0.5">Full URL</div>
          <pre className="whitespace-pre-wrap break-all text-slate-800 dark:text-slate-200">{log.url}</pre>
        </div>
        <div>
          <div className="text-slate-600 dark:text-slate-500 uppercase tracking-wide mb-0.5">Request headers</div>
          <pre className="whitespace-pre-wrap break-all text-slate-600 dark:text-slate-400">
            {formatHeaderBlock(log.requestHeaders) || '(none)'}
          </pre>
        </div>
        {log.requestBody != null && log.requestBody !== '' && (
          <div>
            <div className="text-slate-600 dark:text-slate-500 uppercase tracking-wide mb-0.5">Request body</div>
            <pre className="whitespace-pre-wrap break-all text-slate-600 dark:text-slate-400 max-h-40 overflow-auto">
              {log.requestBody}
            </pre>
          </div>
        )}
        {!log.error && log.responseStatus != null && (
          <>
            <div>
              <div className="text-slate-600 dark:text-slate-500 uppercase tracking-wide mb-0.5">Response headers</div>
              <pre className="whitespace-pre-wrap break-all text-slate-600 dark:text-slate-400">
                {log.responseHeaders && Object.keys(log.responseHeaders).length > 0
                  ? formatHeaderBlock(log.responseHeaders)
                  : '(none)'}
              </pre>
            </div>
            <div>
              <div className="text-slate-600 dark:text-slate-500 uppercase tracking-wide mb-0.5">Response body</div>
              <pre className="whitespace-pre-wrap break-all text-slate-600 dark:text-slate-400 max-h-48 overflow-auto">
                {log.responseBody ?? '(empty)'}
              </pre>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function HttpConsolePanel() {
  const logs = useRequestStore((s) => s.httpConsoleLogs)
  const clearHttpConsole = useRequestStore((s) => s.clearHttpConsole)
  const [open, setOpen] = useState(false)

  return (
    <div className="shrink-0 border-t border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-950 text-slate-800 dark:text-slate-200">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-2.5 flex items-center gap-3 text-left text-sm hover:bg-slate-200/90 dark:hover:bg-slate-900/90 border-b border-slate-300 dark:border-slate-800/80"
      >
        <span className="font-semibold text-emerald-700 dark:text-emerald-500">Console</span>
        <span className="text-slate-600 dark:text-slate-500 text-xs">
          HTTP request / response log
        </span>
        <span className="flex-1" />
        {logs.length > 0 && (
          <span className="text-xs text-slate-600 dark:text-slate-500 tabular-nums">{logs.length}</span>
        )}
        <span className="text-slate-600 dark:text-slate-500 w-4 text-center">{open ? '▼' : '▲'}</span>
      </button>
      {open && (
        <div className="max-h-[min(50vh,28rem)] overflow-auto px-4 py-3 space-y-4">
          <div className="flex justify-end sticky top-0 bg-slate-100/95 dark:bg-slate-950/95 pb-2 z-10">
            <button
              type="button"
              onClick={() => clearHttpConsole()}
              className="text-xs text-emerald-700 dark:text-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400"
            >
              Clear
            </button>
          </div>
          {logs.length === 0 ? (
            <p className="text-slate-600 dark:text-slate-500 text-sm font-mono">
              Send a request to log method, full URL, headers, body, timing, and response here.
            </p>
          ) : (
            logs.map((log: HttpConsoleLogEntry) => <ConsoleLogBlock key={log.id} log={log} />)
          )}
        </div>
      )}
    </div>
  )
}
