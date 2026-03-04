import { create } from 'zustand'
import type { Variable } from '../../shared/types'

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
}

export interface ResponseState {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  duration: number
  loading: boolean
}

interface RequestStore {
  request: RequestState
  response: ResponseState
  setMethod: (method: string) => void
  setUrl: (url: string) => void
  setRouteParams: (params: Variable[]) => void
  setQueryParams: (params: QueryParam[]) => void
  setHeaders: (headers: Variable[]) => void
  setBody: (body: string | null) => void
  setPostRequestScript: (script: string | null) => void
  setResponse: (response: Partial<ResponseState>) => void
  loadRequest: (request: {
    method: string
    url: string
    routeParams: { key: string; value: string }[]
    queryParams: Array<{ key: string; value: string; enabled?: boolean }>
    headers: { key: string; value: string }[]
    body: string | null
    postRequestScript?: string | null
  }) => void
  sendRequest: (resolvedUrl: string, resolvedHeaders: Record<string, string>, resolvedBody?: string) => Promise<void>
}

const DEFAULT_REQUEST: RequestState = {
  method: 'GET',
  url: '',
  routeParams: [],
  queryParams: [],
  headers: [],
  body: null,
  postRequestScript: null
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

  setMethod: (method) => set((s) => ({ request: { ...s.request, method } })),
  setUrl: (url) => set((s) => ({ request: { ...s.request, url } })),
  setRouteParams: (routeParams) => set((s) => ({ request: { ...s.request, routeParams } })),
  setQueryParams: (queryParams) => set((s) => ({ request: { ...s.request, queryParams } })),
  setHeaders: (headers) => set((s) => ({ request: { ...s.request, headers } })),
  setBody: (body) => set((s) => ({ request: { ...s.request, body } })),
  setPostRequestScript: (postRequestScript) =>
    set((s) => ({ request: { ...s.request, postRequestScript } })),

  setResponse: (response) =>
    set((s) => ({
      response: { ...s.response, ...response }
    })),

  loadRequest: (request: {
    method: string
    url: string
    routeParams: { key: string; value: string }[]
    queryParams: Array<{ key: string; value: string; enabled?: boolean }>
    headers: { key: string; value: string }[]
    body: string | null
  }) => {
    set((s) => ({
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
        postRequestScript: request.postRequestScript ?? null
      }
    }))
  },

  sendRequest: async (resolvedUrl, resolvedHeaders, resolvedBody) => {
    set({ response: { ...DEFAULT_RESPONSE, loading: true } })
    try {
      const res = await window.electron.httpRequest({
        method: get().request.method,
        url: resolvedUrl,
        headers: resolvedHeaders,
        body: resolvedBody
      })
      set({
        response: {
          ...res,
          loading: false
        }
      })
    } catch (err) {
      set({
        response: {
          status: 0,
          statusText: 'Error',
          headers: {},
          body: JSON.stringify({ error: String(err) }, null, 2),
          duration: 0,
          loading: false
        }
      })
    }
  }
}))
