import { useState, useEffect, useRef } from 'react'
import { useRequestStore } from '../../stores/requestStore'
import { useEnvironmentStore } from '../../stores/environmentStore'
import { useCollectionStore } from '../../stores/collectionStore'
import { resolveVariables } from '../../../shared/variableResolver'
import { RouteParamsEditor } from './RouteParamsEditor'
import { QueryParamsEditor } from './QueryParamsEditor'
import { KeyValueEditor } from './KeyValueEditor'
import type { Variable } from '../../../shared/types'

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']

export function RequestBuilder() {
  const {
    request,
    setMethod,
    setUrl,
    setRouteParams,
    setQueryParams,
    setHeaders,
    setBody,
    sendRequest
  } = useRequestStore()

  const envVars = useEnvironmentStore((s) => {
    const env = s.environments.find((e) => e.id === s.activeEnvironmentId)
    return env?.variables ?? []
  })
  const collections = useCollectionStore((s) => s.collections)
  const selectedRequestId = useCollectionStore((s) => s.selectedRequestId)

  const collectionVars: Variable[] = (() => {
    for (const coll of collections) {
      if (coll.requests.some((r) => r.id === selectedRequestId)) {
        return coll.variables ?? []
      }
    }
    return []
  })()

  const [activeTab, setActiveTab] = useState<'params' | 'query' | 'headers' | 'body'>('params')

  const resolvedUrl = resolveVariables(request.url, envVars, collectionVars)

  const buildFinalUrl = (): string => {
    let url = resolvedUrl
    for (const p of request.routeParams) {
      url = url.replace(new RegExp(`:${p.key}`, 'g'), encodeURIComponent(p.value))
    }
    const enabledQuery = request.queryParams.filter((q) => q.enabled !== false && q.key)
    if (enabledQuery.length > 0) {
      const search = new URLSearchParams()
      for (const q of enabledQuery) {
        search.append(q.key, q.value)
      }
      const sep = url.includes('?') ? '&' : '?'
      url += sep + search.toString()
    }
    return url
  }

  const buildHeaders = (): Record<string, string> => {
    const headers: Record<string, string> = {}
    for (const h of request.headers) {
      if (h.key) {
        headers[h.key] = resolveVariables(h.value, envVars, collectionVars)
      }
    }
    return headers
  }

  const resolveBody = (): string | undefined => {
    if (!request.body || request.method === 'GET') return undefined
    return resolveVariables(request.body, envVars, collectionVars)
  }

  const handleSend = () => {
    const finalUrl = buildFinalUrl()
    const headers = buildHeaders()
    const body = resolveBody()
    sendRequest(finalUrl, headers, body)
  }

  const handleSendRef = useRef(handleSend)
  handleSendRef.current = handleSend
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault()
        handleSendRef.current()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const queryParamsWithEnabled = request.queryParams.map((q) => ({
    ...q,
    enabled: q.enabled !== false
  }))

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 items-center mb-4">
        <select
          value={request.method}
          onChange={(e) => setMethod(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm font-semibold text-amber-400"
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={request.url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://api.example.com/endpoint"
          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-slate-100 placeholder-slate-500 font-mono"
        />
        <button
          onClick={handleSend}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-slate-900 font-semibold rounded text-sm"
        >
          Send
        </button>
      </div>

      <div className="flex gap-2 border-b border-slate-700 mb-2">
        {(['params', 'query', 'headers', 'body'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-sm capitalize ${
              activeTab === tab
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === 'params' && (
          <RouteParamsEditor
            url={request.url}
            params={request.routeParams}
            onChange={setRouteParams}
          />
        )}
        {activeTab === 'query' && (
          <QueryParamsEditor
            params={queryParamsWithEnabled}
            onChange={setQueryParams}
          />
        )}
        {activeTab === 'headers' && (
          <KeyValueEditor
            items={request.headers}
            onChange={setHeaders}
            keyPlaceholder="Header name"
            valuePlaceholder="Value"
          />
        )}
        {activeTab === 'body' && (
          <div className="space-y-2">
            <textarea
              value={request.body ?? ''}
              onChange={(e) => setBody(e.target.value || null)}
              placeholder='{"key": "value"}'
              className="w-full h-40 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-slate-100 font-mono placeholder-slate-500 resize-none"
            />
          </div>
        )}
      </div>
    </div>
  )
}
