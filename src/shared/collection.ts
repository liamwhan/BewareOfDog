import type { Collection, Request } from './types'

export function createEmptyCollection(name: string): Collection {
  return {
    name,
    variables: [],
    requests: []
  }
}

export function createRequest(overrides: Partial<Request> = {}): Request {
  return {
    id: crypto.randomUUID(),
    name: 'New Request',
    method: 'GET',
    url: '',
    routeParams: [],
    queryParams: [],
    headers: [],
    body: null,
    postRequestScript: null,
    ...overrides
  }
}

export function parseCollectionJson(json: string): Collection {
  const data = JSON.parse(json)
  if (!data.name || !Array.isArray(data.requests)) {
    throw new Error('Invalid collection format')
  }
  return {
    name: data.name,
    variables: Array.isArray(data.variables) ? data.variables : [],
    requests: data.requests.map((r: Partial<Request>) => ({
      id: r.id ?? crypto.randomUUID(),
      name: r.name ?? 'Untitled',
      method: r.method ?? 'GET',
      url: r.url ?? '',
      routeParams: r.routeParams ?? [],
      queryParams: (r.queryParams ?? []).map((q: { key: string; value: string; enabled?: boolean }) => ({
        ...q,
        enabled: q.enabled !== false
      })),
      headers: r.headers ?? [],
      body: r.body ?? null,
      postRequestScript: r.postRequestScript ?? null
    }))
  }
}

export function serializeCollection(collection: Collection): string {
  return JSON.stringify(collection, null, 2)
}
