import { useEffect, useState } from 'react'
import { useRequestStore } from '../../stores/requestStore'
import { JsonHighlightPre } from '../JsonCodeTextarea'

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function formatHeaders(headers: Record<string, string>): string {
  return Object.entries(headers)
    .map(([k, v]) => `${k}: ${v}`)
    .join('\n')
}

export function ResponseView() {
  const { response } = useRequestStore()
  const [activeTab, setActiveTab] = useState<'body' | 'headers'>('body')
  const [bodyCopied, setBodyCopied] = useState(false)

  useEffect(() => {
    setBodyCopied(false)
  }, [response.body])

  const statusColor =
    response.status >= 200 && response.status < 300
      ? 'text-green-400'
      : response.status >= 400
        ? 'text-red-400'
        : 'text-emerald-400'

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-4 mb-4 pb-2 border-b border-slate-700">
        {response.loading ? (
          <span className="text-slate-400">Loading...</span>
        ) : (
          <>
            <span className={`font-semibold ${statusColor}`}>
              {response.status} {response.statusText}
            </span>
            <span className="text-slate-400 text-sm">{response.duration} ms</span>
            <span className="text-slate-400 text-sm">
              {response.body ? new Blob([response.body]).size : 0} bytes
            </span>
          </>
        )}
      </div>

      <div className="flex gap-2 border-b border-slate-700 mb-2">
        <button
          onClick={() => setActiveTab('body')}
          className={`px-3 py-2 text-sm ${
            activeTab === 'body'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Body
        </button>
        <button
          onClick={() => setActiveTab('headers')}
          className={`px-3 py-2 text-sm ${
            activeTab === 'headers'
              ? 'text-emerald-400 border-b-2 border-emerald-400'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Headers
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === 'body' && (
          <div className="p-4 bg-slate-900 rounded min-h-0 flex flex-col gap-2">
            {response.body ? (
              <>
                <div className="flex justify-end shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      const ok = await copyText(response.body)
                      if (ok) {
                        setBodyCopied(true)
                        window.setTimeout(() => setBodyCopied(false), 1500)
                      }
                    }}
                    className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline"
                  >
                    {bodyCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <JsonHighlightPre value={response.body} className="text-slate-100 min-h-0" />
              </>
            ) : (
              <pre className="text-sm font-mono text-slate-500 whitespace-pre-wrap">(empty)</pre>
            )}
          </div>
        )}
        {activeTab === 'headers' && (
          <pre className="p-4 text-sm font-mono text-slate-400 whitespace-pre-wrap break-words bg-slate-900 rounded">
            {formatHeaders(response.headers) || '(no headers)'}
          </pre>
        )}
      </div>
    </div>
  )
}
