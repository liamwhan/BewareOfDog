import { create } from 'zustand'
import type { Request, RequestAuth, Variable } from '../../shared/types'
import { defaultRequestAuth } from '../../shared/auth'
import { emitLastSuccessfulResponse, truncateResponseBodyForWorkspace } from '../lib/persistence'

export interface QueryParam extends Variable {
  enabled: boolean
}

export interface RequestState {
  method: string
  url: string
  routeParams: Variable[]
  queryParams: QueryParam[]
  headers: Variable[]
  body: string | null
  postRequestScript: string | null
  auth: RequestAuth
}

export interface ResponseState {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  duration: number
  loading: boolean
}

const CONSOLE_MAX_ENTRIES = 50
const CONSOLE_BODY_MAX = 14_000

export interface HttpConsoleLogEntry {
  id: string
  at: number
  method: string
  url: string
  requestHeaders: Record<string, string>
  requestBody?: string
  responseStatus?: number
  responseStatusText?: string
  responseHeaders?: Record<string, string>
  responseBody?: string
  durationMs?: number
  error?: string
}

function truncateForConsole(s: string | undefined): string | undefined {
  if (s == null || s.length <= CONSOLE_BODY_MAX) return s
  return `${s.slice(0, CONSOLE_BODY_MAX)}\n\n… (truncated for console)`
}

interface RequestStore {
  request: RequestState
  response: ResponseState
  /** Request id for the currently edited request (matches collection selection). */
  activeRequestId: string | null
  /** Last completed response per request id (in-memory; switching requests restores from here). */
  responseByRequestId: Record<string, ResponseState>
  setMethod: (method: string) => void
  setUrl: (url: string) => void
  setRouteParams: (params: Variable[]) => void
  setQueryParams: (params: QueryParam[]) => void
  setHeaders: (headers: Variable[]) => void
  setBody: (body: string | null) => void
  setPostRequestScript: (script: string | null) => void
  setAuth: (auth: RequestAuth) => void
  setResponse: (response: Partial<ResponseState>) => void
  loadRequest: (request: Request) => void
  /** Clear response cache and builder state before applying a loaded workspace document. */
  prepareWorkspaceHydration: () => void
  /** Seed a cached response (e.g. persisted last 2xx) before loadRequest. */
  seedResponseForRequest: (requestId: string, response: Omit<ResponseState, 'loading'>) => void
  sendRequest: (resolvedUrl: string, resolvedHeaders: Record<string, string>, resolvedBody?: string) => Promise<void>
  clearHttpConsole: () => void
}

const DEFAULT_REQUEST: RequestState = {
  method: 'GET',
  url: '',
  routeParams: [],
  queryParams: [],
  headers: [],
  body: null,
  postRequestScript: null,
  auth: defaultRequestAuth()
}

const DEFAULT_RESPONSE: ResponseState = {
  status: 0,
  statusText: '',
  headers: {},
  body: '',
  duration: 0,
  loading: false
}

export const useRequestStore = create<RequestStore>((set, get) => ({
  request: DEFAULT_REQUEST,
  response: DEFAULT_RESPONSE,
  activeRequestId: null,
  responseByRequestId: {},
  httpConsoleLogs: [],

  setMethod: (method) => set((s) => ({ request: { ...s.request, method } })),
  setUrl: (url) => set((s) => ({ request: { ...s.request, url } })),
  setRouteParams: (routeParams) => set((s) => ({ request: { ...s.request, routeParams } })),
  setQueryParams: (queryParams) => set((s) => ({ request: { ...s.request, queryParams } })),
  setHeaders: (headers) => set((s) => ({ request: { ...s.request, headers } })),
  setBody: (body) => set((s) => ({ request: { ...s.request, body } })),
  setPostRequestScript: (postRequestScript) =>
    set((s) => ({ request: { ...s.request, postRequestScript } })),

  setAuth: (auth) => set((s) => ({ request: { ...s.request, auth } })),

  setResponse: (response) =>
    set((s) => ({
      response: { ...s.response, ...response }
    })),

  prepareWorkspaceHydration: () =>
    set({
      responseByRequestId: {},
      activeRequestId: null,
      request: DEFAULT_REQUEST,
      response: DEFAULT_RESPONSE
    }),

  seedResponseForRequest: (requestId, response) =>
    set((s) => ({
      responseByRequestId: {
        ...s.responseByRequestId,
        [requestId]: { ...response, loading: false }
      }
    })),

  loadRequest: (request) => {
    set((s) => {
      const prevId = s.activeRequestId
      const nextCache = { ...s.responseByRequestId }
      if (prevId && !s.response.loading) {
        nextCache[prevId] = { ...s.response }
      }
      const id = request.id
      const cached = nextCache[id]
      const nextResponse = cached ? { ...cached } : { ...DEFAULT_RESPONSE }
      return {
        activeRequestId: id,
        responseByRequestId: nextCache,
        request: {
          ...s.request,
          method: request.method,
          url: request.url,
          routeParams: request.routeParams ?? [],
          queryParams: (request.queryParams ?? []).map((q) => ({
            ...q,
            enabled: q.enabled !== false
          })),
          headers: request.headers ?? [],
          body: request.body,
          postRequestScript: request.postRequestScript ?? null,
          auth: request.auth ?? defaultRequestAuth()
        },
        response: nextResponse
      }
    })
  },

  sendRequest: async (resolvedUrl, resolvedHeaders, resolvedBody) => {
    const requestIdAtSend = get().activeRequestId
    set({ response: { ...DEFAULT_RESPONSE, loading: true } })
    const method = get().request.method
    const baseLog: HttpConsoleLogEntry = {
      id: crypto.randomUUID(),
      at: Date.now(),
      method,
      url: resolvedUrl,
      requestHeaders: resolvedHeaders,
      requestBody: resolvedBody
    }
    try {
      const res = await window.electron.httpRequest({
        method,
        url: resolvedUrl,
        headers: resolvedHeaders,
        body: resolvedBody
      })
      const entry: HttpConsoleLogEntry = {
        ...baseLog,
        responseStatus: res.status,
        responseStatusText: res.statusText,
        responseHeaders: res.headers,
        responseBody: truncateForConsole(res.body),
        durationMs: res.duration
      }
      const newRes: ResponseState = {
        ...res,
        loading: false
      }
      set((s) => {
        const rid = requestIdAtSend
        const nextLogs = [entry, ...s.httpConsoleLogs].slice(0, CONSOLE_MAX_ENTRIES)
        if (!rid) {
          return { response: newRes, httpConsoleLogs: nextLogs }
        }
        const nextCache = { ...s.responseByRequestId, [rid]: newRes }
        if (s.activeRequestId !== rid) {
          return { responseByRequestId: nextCache, httpConsoleLogs: nextLogs }
        }
        return {
          response: newRes,
          responseByRequestId: nextCache,
          httpConsoleLogs: nextLogs
        }
      })
      if (
        requestIdAtSend &&
        res.status >= 200 &&
        res.status < 300
      ) {
        emitLastSuccessfulResponse({
          requestId: requestIdAtSend,
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
          body: truncateResponseBodyForWorkspace(res.body),
          duration: res.duration
        })
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      const entry: HttpConsoleLogEntry = {
        ...baseLog,
        error: errMsg
      }
      const newRes: ResponseState = {
        status: 0,
        statusText: 'Error',
        headers: {},
        body: JSON.stringify({ error: errMsg }, null, 2),
        duration: 0,
        loading: false
      }
      set((s) => {
        const rid = requestIdAtSend
        const nextLogs = [entry, ...s.httpConsoleLogs].slice(0, CONSOLE_MAX_ENTRIES)
        if (!rid) {
          return { response: newRes, httpConsoleLogs: nextLogs }
        }
        const nextCache = { ...s.responseByRequestId, [rid]: newRes }
        if (s.activeRequestId !== rid) {
          return { responseByRequestId: nextCache, httpConsoleLogs: nextLogs }
        }
        return {
          response: newRes,
          responseByRequestId: nextCache,
          httpConsoleLogs: nextLogs
        }
      })
    }
  },

  clearHttpConsole: () => set({ httpConsoleLogs: [] })
}))
