import type { Collection, Request, Variable } from './types'
import { defaultCollectionAuth, defaultRequestAuth } from './auth'

export type CollectionImportSource = 'bod' | 'postman-v2.1'

export interface CollectionImportResult {
  collection: Collection
  warnings: string[]
  source: CollectionImportSource
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
}

export function isPostmanCollectionV21(data: unknown): boolean {
  if (!isRecord(data)) return false
  const info = data.info
  if (!isRecord(info)) return false
  const schema = info.schema
  if (typeof schema !== 'string') return false
  const s = schema.toLowerCase()
  if (!s.includes('getpostman.com')) return false
  if (!s.includes('collection')) return false
  if (!s.includes('2.1') && !s.includes('v2.1')) return false
  return Array.isArray(data.item)
}

function varValueToString(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function mergeVariables(
  target: Map<string, string>,
  list: unknown,
  collisionCount: { n: number }
): void {
  if (!Array.isArray(list)) return
  for (const entry of list) {
    if (!isRecord(entry)) continue
    if (entry.disabled === true) continue
    const key = typeof entry.key === 'string' ? entry.key : typeof entry.id === 'string' ? entry.id : ''
    if (!key) continue
    const val = varValueToString(entry.value)
    if (target.has(key) && target.get(key) !== val) collisionCount.n += 1
    target.set(key, val)
  }
}

type PostmanAuth = Record<string, unknown> & { type: string }

function resolveAuth(explicit: unknown, inherited: PostmanAuth | null): PostmanAuth | null {
  if (explicit === undefined) return inherited
  if (explicit === null) return inherited
  if (isRecord(explicit) && typeof explicit.type === 'string') return explicit as PostmanAuth
  return inherited
}

function getAuthAttrs(auth: PostmanAuth, key: string): unknown[] {
  const v = auth[key]
  if (!Array.isArray(v)) return []
  return v as unknown[]
}

function attrMap(attrs: unknown[]): Record<string, string> {
  const m: Record<string, string> = {}
  for (const a of attrs) {
    if (!isRecord(a)) continue
    const k = typeof a.key === 'string' ? a.key : ''
    if (!k) continue
    m[k] = varValueToString(a.value)
  }
  return m
}

function authToHeaders(auth: PostmanAuth | null): Record<string, string> {
  if (!auth) return {}
  const t = auth.type
  if (t === 'noauth') return {}

  if (t === 'bearer') {
    const m = attrMap(getAuthAttrs(auth, 'bearer'))
    const token = m.token ?? m.Token ?? ''
    if (!token) return {}
    return { Authorization: `Bearer ${token}` }
  }

  if (t === 'basic') {
    const m = attrMap(getAuthAttrs(auth, 'basic'))
    const user = m.username ?? ''
    const pass = m.password ?? ''
    if (!user && !pass) return {}
    try {
      return { Authorization: `Basic ${btoa(`${user}:${pass}`)}` }
    } catch {
      return {}
    }
  }

  if (t === 'apikey') {
    const m = attrMap(getAuthAttrs(auth, 'apikey'))
    const keyName = m.key ?? 'X-API-Key'
    const val = m.value ?? ''
    const where = (m.in ?? 'header').toLowerCase()
    if (where === 'header' && val) {
      return { [keyName]: val }
    }
    return {}
  }

  return {}
}

function isUnsupportedAuth(auth: PostmanAuth | null): boolean {
  if (!auth) return false
  const t = auth.type
  return t !== 'noauth' && t !== 'bearer' && t !== 'basic' && t !== 'apikey'
}

function normalizeHeaderKey(key: string): string {
  return key.toLowerCase()
}

function mergeHeaderMaps(base: Record<string, string>, extra: Record<string, string>): Record<string, string> {
  const seen = new Set<string>()
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(base)) {
    const lk = normalizeHeaderKey(k)
    seen.add(lk)
    out[k] = v
  }
  for (const [k, v] of Object.entries(extra)) {
    const lk = normalizeHeaderKey(k)
    if (seen.has(lk)) continue
    out[k] = v
  }
  return out
}

function parsePostmanHeaders(headerField: unknown): { headers: Variable[]; map: Record<string, string> } {
  const map: Record<string, string> = {}
  const headers: Variable[] = []
  if (typeof headerField === 'string') {
    return { headers, map }
  }
  if (!Array.isArray(headerField)) return { headers, map }
  for (const h of headerField) {
    if (!isRecord(h)) continue
    if (h.disabled === true) continue
    const key = typeof h.key === 'string' ? h.key : ''
    const value = typeof h.value === 'string' ? h.value : h.value != null ? String(h.value) : ''
    if (!key) continue
    headers.push({ key, value })
    map[normalizeHeaderKey(key)] = value
  }
  return { headers, map }
}

function pathSegmentToString(seg: unknown): string {
  if (typeof seg === 'string') return seg
  if (isRecord(seg) && typeof seg.value === 'string') return seg.value
  return ''
}

function buildUrlFromObject(u: Record<string, unknown>): {
  url: string
  routeParams: Variable[]
  queryParams: Array<Variable & { enabled?: boolean }>
} {
  const routeParams: Variable[] = []
  const queryParams: Array<Variable & { enabled?: boolean }> = []

  if (typeof u.raw === 'string' && u.raw.trim()) {
    const raw = u.raw
    if (Array.isArray(u.variable)) {
      for (const v of u.variable) {
        if (!isRecord(v)) continue
        const key = typeof v.key === 'string' ? v.key : typeof v.id === 'string' ? v.id : ''
        if (!key) continue
        routeParams.push({ key, value: varValueToString(v.value) })
      }
    }
    if (Array.isArray(u.query)) {
      for (const q of u.query) {
        if (!isRecord(q)) continue
        const key = typeof q.key === 'string' ? q.key : ''
        const value = q.value != null && typeof q.value !== 'object' ? String(q.value) : ''
        const enabled = q.disabled !== true
        if (key || value) queryParams.push({ key, value, enabled })
      }
    }
    return { url: raw, routeParams, queryParams }
  }

  const protocol = typeof u.protocol === 'string' ? u.protocol.replace(/:$/, '') : 'http'
  let host = ''
  if (typeof u.host === 'string') host = u.host
  else if (Array.isArray(u.host)) host = u.host.map((x) => (typeof x === 'string' ? x : '')).join('')

  const port = typeof u.port === 'string' && u.port ? `:${u.port}` : ''

  let pathStr = ''
  if (typeof u.path === 'string') pathStr = u.path.startsWith('/') ? u.path : `/${u.path}`
  else if (Array.isArray(u.path)) {
    const parts: string[] = []
    for (const seg of u.path) {
      if (typeof seg === 'string') {
        parts.push(seg)
      } else if (isRecord(seg)) {
        parts.push(pathSegmentToString(seg))
      }
    }
    pathStr = parts.length ? `/${parts.join('/')}` : ''
  }

  if (Array.isArray(u.variable)) {
    for (const v of u.variable) {
      if (!isRecord(v)) continue
      const key = typeof v.key === 'string' ? v.key : typeof v.id === 'string' ? v.id : ''
      if (!key) continue
      routeParams.push({ key, value: varValueToString(v.value) })
    }
  }

  if (Array.isArray(u.query)) {
    for (const q of u.query) {
      if (!isRecord(q)) continue
      const key = typeof q.key === 'string' ? q.key : ''
      const value = q.value != null && typeof q.value !== 'object' ? String(q.value) : ''
      const enabled = q.disabled !== true
      if (key || value) queryParams.push({ key, value, enabled })
    }
  }

  const hash = typeof u.hash === 'string' && u.hash ? (u.hash.startsWith('#') ? u.hash : `#${u.hash}`) : ''
  const authority = host ? `${host}${port}` : ''
  const url =
    authority || pathStr
      ? `${protocol}://${authority}${pathStr}${hash}`
      : pathStr || `${protocol}://${authority}${hash}`

  return { url, routeParams, queryParams }
}

function parseUrlField(
  urlField: unknown
): { url: string; routeParams: Variable[]; queryParams: Array<Variable & { enabled?: boolean }> } {
  if (typeof urlField === 'string') {
    return { url: urlField, routeParams: [], queryParams: [] }
  }
  if (isRecord(urlField)) {
    return buildUrlFromObject(urlField)
  }
  return { url: '', routeParams: [], queryParams: [] }
}

interface BodyResult {
  body: string | null
  extraHeaders: Record<string, string>
}

function parseBody(
  body: unknown,
  counters: { multipart: number; fileMode: number; graphqlIncomplete: number }
): BodyResult {
  const extraHeaders: Record<string, string> = {}
  if (body === null || body === undefined) return { body: null, extraHeaders }
  if (!isRecord(body)) return { body: null, extraHeaders }
  if (body.disabled === true) return { body: null, extraHeaders }

  const mode = typeof body.mode === 'string' ? body.mode : 'raw'

  if (mode === 'raw') {
    const raw = typeof body.raw === 'string' ? body.raw : body.raw != null ? String(body.raw) : ''
    return { body: raw || null, extraHeaders }
  }

  if (mode === 'urlencoded') {
    const list = Array.isArray(body.urlencoded) ? body.urlencoded : []
    const parts: string[] = []
    for (const p of list) {
      if (!isRecord(p) || p.disabled === true) continue
      const k = typeof p.key === 'string' ? p.key : ''
      const v = p.value != null ? String(p.value) : ''
      if (k) parts.push(`${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    }
    extraHeaders['Content-Type'] = 'application/x-www-form-urlencoded'
    return { body: parts.length ? parts.join('&') : null, extraHeaders }
  }

  if (mode === 'formdata') {
    const list = Array.isArray(body.formdata) ? body.formdata : []
    let hasFile = false
    const textParts: string[] = []
    for (const p of list) {
      if (!isRecord(p) || p.disabled === true) continue
      const key = typeof p.key === 'string' ? p.key : ''
      const typ = typeof p.type === 'string' ? p.type : 'text'
      if (typ === 'file') {
        hasFile = true
        continue
      }
      const val = typeof p.value === 'string' ? p.value : ''
      if (key) textParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
    }
    if (hasFile) counters.multipart += 1
    if (textParts.length) {
      extraHeaders['Content-Type'] = 'application/x-www-form-urlencoded'
      return { body: textParts.join('&'), extraHeaders }
    }
    if (hasFile) return { body: null, extraHeaders }
    return { body: null, extraHeaders }
  }

  if (mode === 'file') {
    counters.fileMode += 1
    return { body: null, extraHeaders }
  }

  if (mode === 'graphql') {
    const g = body.graphql
    if (isRecord(g) && typeof g.query === 'string') {
      const payload: Record<string, unknown> = { query: g.query }
      if (g.variables !== undefined) payload.variables = g.variables
      return { body: JSON.stringify(payload), extraHeaders: { 'Content-Type': 'application/json' } }
    }
    counters.graphqlIncomplete += 1
    return { body: null, extraHeaders }
  }

  return { body: null, extraHeaders }
}

function countEvents(events: unknown): { prerequest: number; test: number } {
  let prerequest = 0
  let test = 0
  if (!Array.isArray(events)) return { prerequest, test }
  for (const ev of events) {
    if (!isRecord(ev)) continue
    if (ev.disabled === true) continue
    const listen = typeof ev.listen === 'string' ? ev.listen : ''
    const script = ev.script
    const hasScript =
      isRecord(script) &&
      ((Array.isArray(script.exec) && script.exec.length > 0) ||
        (typeof script.exec === 'string' && script.exec.trim()) ||
        isRecord(script.src))
    if (!hasScript) continue
    if (listen === 'prerequest') prerequest += 1
    if (listen === 'test') test += 1
  }
  return { prerequest, test }
}

function requestHasExtras(reqObj: Record<string, unknown>): boolean {
  if (isRecord(reqObj.protocolProfileBehavior) && Object.keys(reqObj.protocolProfileBehavior).length > 0) return true
  if (isRecord(reqObj.proxy)) return true
  if (isRecord(reqObj.certificate)) return true
  return false
}

function postmanItemToRequest(
  itemName: string,
  requestField: unknown,
  inheritedAuth: PostmanAuth | null,
  counters: {
    savedResponses: number
    scriptsPrerequest: number
    scriptsTest: number
    protocolExtras: number
    unsupportedAuth: number
    multipart: number
    fileMode: number
    graphqlIncomplete: number
    headerString: number
    apikeyQuery: number
  }
): Request | null {
  let method = 'GET'
  let urlField: unknown = ''
  let headerField: unknown = []
  let bodyField: unknown = null
  let reqAuth: unknown = undefined
  let reqObj: Record<string, unknown> | null = null

  if (typeof requestField === 'string') {
    urlField = requestField
  } else if (isRecord(requestField)) {
    reqObj = requestField
    method = typeof requestField.method === 'string' ? requestField.method.toUpperCase() : 'GET'
    urlField = requestField.url
    headerField = requestField.header
    bodyField = requestField.body
    reqAuth = requestField.auth
  } else {
    return null
  }

  const effectiveAuth = resolveAuth(reqAuth, inheritedAuth)
  if (isUnsupportedAuth(effectiveAuth)) counters.unsupportedAuth += 1
  if (effectiveAuth?.type === 'apikey') {
    const m = attrMap(getAuthAttrs(effectiveAuth, 'apikey'))
    if ((m.in ?? 'header').toLowerCase() === 'query') counters.apikeyQuery += 1
  }

  const { url, routeParams, queryParams } = parseUrlField(urlField)
  const { headers: hdrList, map: headerMap } = parsePostmanHeaders(headerField)
  if (typeof headerField === 'string' && headerField.trim()) counters.headerString += 1

  const authHeaders = authToHeaders(effectiveAuth)
  const mergedMap = mergeHeaderMaps(headerMap, authHeaders)
  const headers: Variable[] = hdrList.slice()
  for (const [k, v] of Object.entries(authHeaders)) {
    if (normalizeHeaderKey(k) in headerMap) continue
    headers.push({ key: k, value: v })
  }

  const bodyRes = parseBody(bodyField, counters)
  for (const [k, v] of Object.entries(bodyRes.extraHeaders)) {
    if (!mergedMap[normalizeHeaderKey(k)]) {
      headers.push({ key: k, value: v })
    }
  }

  if (reqObj && requestHasExtras(reqObj)) counters.protocolExtras += 1

  return {
    id: crypto.randomUUID(),
    name: itemName,
    method,
    url,
    routeParams,
    queryParams,
    headers,
    body: bodyRes.body,
    postRequestScript: null,
    auth: defaultRequestAuth()
  }
}

function walkPostmanItems(
  items: unknown[],
  folderPath: string[],
  inheritedAuth: PostmanAuth | null,
  varMap: Map<string, string>,
  varCollision: { n: number },
  requests: Request[],
  counters: {
    savedResponses: number
    scriptsPrerequest: number
    scriptsTest: number
    protocolExtras: number
    unsupportedAuth: number
    multipart: number
    fileMode: number
    graphqlIncomplete: number
    headerString: number
    apikeyQuery: number
  }
): void {
  for (const raw of items) {
    if (!isRecord(raw)) continue

    const folderAuth = resolveAuth(raw.auth, inheritedAuth)

    if (Array.isArray(raw.variable)) {
      mergeVariables(varMap, raw.variable, varCollision)
    }

    const ev = countEvents(raw.event)
    counters.scriptsPrerequest += ev.prerequest
    counters.scriptsTest += ev.test

    if (Array.isArray(raw.response)) {
      counters.savedResponses += raw.response.length
    }

    if ('request' in raw && raw.request !== undefined) {
      const name =
        typeof raw.name === 'string' && raw.name.trim()
          ? raw.name.trim()
          : typeof raw.name === 'string'
            ? raw.name
            : 'Untitled'
      const displayName = [...folderPath, name].filter(Boolean).join(' / ')
      const req = postmanItemToRequest(displayName, raw.request, folderAuth, counters)
      if (req) requests.push(req)
      continue
    }

    const folderName =
      typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : 'Folder'
    const nextPath = [...folderPath, folderName]
    const children = raw.item
    if (Array.isArray(children)) {
      walkPostmanItems(children, nextPath, folderAuth, varMap, varCollision, requests, counters)
    }
  }
}

function finalizeWarnings(
  counters: {
    savedResponses: number
    scriptsPrerequest: number
    scriptsTest: number
    protocolExtras: number
    unsupportedAuth: number
    multipart: number
    fileMode: number
    graphqlIncomplete: number
    headerString: number
    apikeyQuery: number
    varCollisions: number
  },
  collectionEvents: { prerequest: number; test: number }
): string[] {
  const w: string[] = []
  if (collectionEvents.prerequest + collectionEvents.test > 0) {
    const n = collectionEvents.prerequest + collectionEvents.test
    w.push(
      `Collection-level scripts (${n}) were not imported — BewareOfDog uses a different post-request API than Postman (pm.*).`
    )
  }
  if (counters.scriptsPrerequest + counters.scriptsTest > 0) {
    const n = counters.scriptsPrerequest + counters.scriptsTest
    w.push(
      `${n} folder/request pre-request or test script(s) were not imported — Postman scripts are not compatible with the bod API.`
    )
  }
  if (counters.savedResponses > 0) {
    w.push(
      `Dropped ${counters.savedResponses} saved example response(s) — BewareOfDog does not store example responses.`
    )
  }
  if (counters.protocolExtras > 0) {
    w.push(
      `${counters.protocolExtras} request(s) had protocol profile, proxy, or certificate settings that were not imported.`
    )
  }
  if (counters.unsupportedAuth > 0) {
    w.push(
      `${counters.unsupportedAuth} request(s) use auth types BewareOfDog does not map (e.g. OAuth2, AWS Signature, Digest); set headers or variables manually.`
    )
  }
  if (counters.multipart > 0) {
    w.push(
      `${counters.multipart} request(s) had multipart/form-data with file field(s); file parts were not imported. Text-only parts may have been converted to a urlencoded body where possible.`
    )
  }
  if (counters.fileMode > 0) {
    w.push(`${counters.fileMode} request(s) used body mode "file" — body was not imported.`)
  }
  if (counters.graphqlIncomplete > 0) {
    w.push(
      `${counters.graphqlIncomplete} GraphQL request(s) had no query field — body was left empty.`
    )
  }
  if (counters.headerString > 0) {
    w.push(
      `${counters.headerString} request(s) had headers stored as a raw string — those headers were skipped (unsupported).`
    )
  }
  if (counters.apikeyQuery > 0) {
    w.push(
      `${counters.apikeyQuery} request(s) use API key auth in the query string — not applied automatically; add the query param to the URL or variables yourself.`
    )
  }
  if (counters.varCollisions > 0) {
    w.push(
      `${counters.varCollisions} collection variable key(s) were overridden when merging folder variables (last value wins).`
    )
  }
  return w
}

export function importPostmanCollectionV21WithWarnings(data: unknown): { collection: Collection; warnings: string[] } {
  if (!isRecord(data)) throw new Error('Invalid Postman collection')
  const info = data.info
  if (!isRecord(info) || typeof info.name !== 'string') {
    throw new Error('Invalid Postman collection: missing info.name')
  }
  const items = data.item
  if (!Array.isArray(items)) throw new Error('Invalid Postman collection: missing item array')

  const varMap = new Map<string, string>()
  const varCollision = { n: 0 }
  mergeVariables(varMap, data.variable, varCollision)

  const rootAuth = resolveAuth(data.auth, null)
  const colEv = countEvents(data.event)

  const counters = {
    savedResponses: 0,
    scriptsPrerequest: 0,
    scriptsTest: 0,
    protocolExtras: 0,
    unsupportedAuth: 0,
    multipart: 0,
    fileMode: 0,
    graphqlIncomplete: 0,
    headerString: 0,
    apikeyQuery: 0
  }

  const requests: Request[] = []
  walkPostmanItems(items, [], rootAuth, varMap, varCollision, requests, counters)

  const variables: Variable[] = Array.from(varMap.entries()).map(([key, value]) => ({ key, value }))

  const collection: Collection = {
    name: info.name,
    variables,
    auth: defaultCollectionAuth(),
    requests
  }

  const warnings = finalizeWarnings({ ...counters, varCollisions: varCollision.n }, colEv)
  return { collection, warnings }
}

export function importPostmanCollectionV21(data: unknown): Collection {
  return importPostmanCollectionV21WithWarnings(data).collection
}
