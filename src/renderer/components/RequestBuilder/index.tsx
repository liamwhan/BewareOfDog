import { useState, useEffect, useRef } from 'react'
import { useRequestStore } from '../../stores/requestStore'
import { useEnvironmentStore } from '../../stores/environmentStore'
import { useCollectionStore } from '../../stores/collectionStore'
import { resolveVariables } from '../../../shared/variableResolver'
import { runPostRequestScript } from '../../../shared/scriptRunner'
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
    setPostRequestScript,
    sendRequest
  } = useRequestStore()

  const envStore = useEnvironmentStore.getState()
  const collStore = useCollectionStore.getState()

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

  const [activeTab, setActiveTab] = useState<'params' | 'query' | 'headers' | 'body' | 'scripts'>('params')
  const [scriptError, setScriptError] = useState<string | null>(null)

  useEffect(() => {
    const sel = useCollectionStore.getState().getSelectedCollection()
    const req = useCollectionStore.getState().getSelectedRequest()
    if (!sel || !req) return
    const timeout = setTimeout(() => {
      useCollectionStore.getState().updateRequest(sel.index, req.id, {
        method: request.method,
        url: request.url,
        routeParams: request.routeParams,
        queryParams: request.queryParams,
        headers: request.headers,
        body: request.body,
        postRequestScript: request.postRequestScript
      })
    }, 300)
    return () => clearTimeout(timeout)
  }, [
    request.method,
    request.url,
    request.routeParams,
    request.queryParams,
    request.headers,
    request.body,
    request.postRequestScript
  ])

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

  const handleSend = async () => {
    const finalUrl = buildFinalUrl()
    const headers = buildHeaders()
    const body = resolveBody()
    const script = useRequestStore.getState().request.postRequestScript
    setScriptError(null)
    await sendRequest(finalUrl, headers, body)
    if (script?.trim()) {
      try {
        runPostRequestScript({
          script,
          request: {
            method: request.method,
            url: finalUrl,
            headers
          },
          response: {
            status: useRequestStore.getState().response.status,
            statusText: useRequestStore.getState().response.statusText,
            headers: useRequestStore.getState().response.headers,
            body: useRequestStore.getState().response.body
          },
          envGet: (k) => envStore.getEnvironmentVariable(k),
          envSet: (k, v) => envStore.setEnvironmentVariable(k, v),
          collGet: (k) => collStore.getCollectionVariable(k),
          collSet: (k, v) => collStore.setCollectionVariable(k, v)
        })
      } catch (err) {
        setScriptError(err instanceof Error ? err.message : String(err))
      }
    }
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
          className="px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm font-semibold text-emerald-400"
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
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-semibold rounded text-sm"
        >
          Send
        </button>
      </div>

      <div className="flex gap-2 border-b border-slate-700 mb-2">
        {(['params', 'query', 'headers', 'body', 'scripts'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2 text-sm capitalize ${
              activeTab === tab
                ? 'text-emerald-400 border-b-2 border-emerald-400'
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
        {activeTab === 'scripts' && (
          <div className="space-y-2">
            <p className="text-slate-400 text-sm mb-2">
              JavaScript that runs after the response. Use <code className="bg-slate-800 px-1 rounded">bod</code> to access request, response, and variables.
            </p>
            <textarea
              value={request.postRequestScript ?? ''}
              onChange={(e) => {
                const v = e.target.value || null
                setPostRequestScript(v)
                const sel = useCollectionStore.getState().getSelectedCollection()
                const req = useCollectionStore.getState().getSelectedRequest()
                if (sel && req) {
                  useCollectionStore.getState().updateRequest(sel.index, req.id, { postRequestScript: v })
                }
              }}
              placeholder={`// Example: extract token and save to env
const json = bod.response.json();
if (json.token) {
  bod.environment.set('token', json.token);
}`}
              className="w-full h-40 px-3 py-2 bg-slate-800 border border-slate-600 rounded text-sm text-slate-100 font-mono placeholder-slate-500 resize-none"
            />
            {scriptError && (
              <p className="text-red-400 text-sm">Script error: {scriptError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
