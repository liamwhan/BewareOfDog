import type { Collection, Request, Variable } from './types'
import { defaultCollectionAuth, defaultRequestAuth, normalizeCollectionAuth, normalizeRequestAuth } from './auth'
import { importPostmanCollectionV21WithWarnings, isPostmanCollectionV21 } from './postmanImport'
import type { CollectionImportResult } from './postmanImport'
import { importOpenApi3WithWarnings, isOpenApi3 } from './openapiImport'

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

/** Stable key for merging re-imported requests (method + path after {{baseUrl}}). */
export function mergeKeyForRequest(r: Request): string {
  const m = r.method.toUpperCase().trim()
  let u = r.url.trim()
  u = u.replace(/^\{\{baseUrl\}\}/i, '')
  if (!u.startsWith('/')) u = `/${u}`
  return `${m}\t${u}`
}

/** Merge an import into an existing collection with the same name: update matching requests by key, add new ones, keep requests not present in the import. */
export function mergeCollectionIntoExisting(existing: Collection, incoming: Collection): Collection {
  const key = mergeKeyForRequest
  const incomingByKey = new Map<string, Request>()
  for (const ir of incoming.requests) {
    incomingByKey.set(key(ir), ir)
  }
  const uniqueIncoming = Array.from(incomingByKey.values())
  const incomingKeySet = new Set(incomingByKey.keys())

  const merged: Request[] = []
  for (const ir of uniqueIncoming) {
    const k = key(ir)
    const prev = existing.requests.find((r) => key(r) === k)
    if (prev) merged.push({ ...ir, id: prev.id })
    else merged.push(ir)
  }
  for (const r of existing.requests) {
    if (!incomingKeySet.has(key(r))) merged.push(r)
  }

  const variableMap = new Map<string, string>()
  for (const v of existing.variables) variableMap.set(v.key, v.value)
  for (const v of incoming.variables) {
    if (!variableMap.has(v.key)) variableMap.set(v.key, v.value)
  }
  const variables: Variable[] = Array.from(variableMap.entries()).map(([k, value]) => ({ key: k, value }))

  return {
    name: existing.name,
    auth: existing.auth,
    variables,
    requests: merged
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
  if (isOpenApi3(data)) {
    const { collection, warnings } = importOpenApi3WithWarnings(data)
    return { collection, warnings, source: 'openapi-3' }
  }
  try {
    return { collection: parseBodCollection(data), warnings: [], source: 'bod' }
  } catch {
    throw new Error(
      'Unsupported collection file. Import a BewareOfDog collection JSON, a Postman Collection v2.1 export, or OpenAPI 3.x JSON.'
    )
  }
}

export function serializeCollection(collection: Collection): string {
  return JSON.stringify(collection, null, 2)
}
