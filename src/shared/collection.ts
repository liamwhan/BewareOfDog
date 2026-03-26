import type { Collection, Request } from './types'
import { defaultCollectionAuth, defaultRequestAuth, normalizeCollectionAuth, normalizeRequestAuth } from './auth'
import { importPostmanCollectionV21WithWarnings, isPostmanCollectionV21 } from './postmanImport'
import type { CollectionImportResult } from './postmanImport'

export type { CollectionImportResult } from './postmanImport'

export function createEmptyCollection(name: string): Collection {
  return {
    name,
    variables: [],
    auth: defaultCollectionAuth(),
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
    auth: defaultRequestAuth(),
    ...overrides
  }
}

function parseBodCollection(data: unknown): Collection {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Invalid collection format')
  }
  const d = data as {
    name?: unknown
    variables?: unknown
    auth?: unknown
    requests?: unknown
  }
  if (typeof d.name !== 'string' || !Array.isArray(d.requests)) {
    throw new Error('Invalid collection format')
  }
  return {
    name: d.name,
    variables: Array.isArray(d.variables) ? d.variables : [],
    auth: normalizeCollectionAuth(d.auth),
    requests: d.requests.map((r: Partial<Request>) => ({
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
      postRequestScript: r.postRequestScript ?? null,
      auth: normalizeRequestAuth((r as Partial<Request>).auth)
    }))
  }
}

export function parseCollectionJson(json: string): Collection {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('Invalid collection format')
  }
  return parseBodCollection(data)
}

export function parseCollectionImport(json: string): CollectionImportResult {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('Invalid JSON')
  }
  if (isPostmanCollectionV21(data)) {
    const { collection, warnings } = importPostmanCollectionV21WithWarnings(data)
    return { collection, warnings, source: 'postman-v2.1' }
  }
  try {
    return { collection: parseBodCollection(data), warnings: [], source: 'bod' }
  } catch {
    throw new Error(
      'Unsupported collection file. Import a BewareOfDog collection JSON or a Postman Collection v2.1 export.'
    )
  }
}

export function serializeCollection(collection: Collection): string {
  return JSON.stringify(collection, null, 2)
}
