import type { HttpAuthConfig, RequestAuth, Variable } from './types'
import { resolveVariables } from './variableResolver'

export function defaultCollectionAuth(): HttpAuthConfig {
  return {
    type: 'none',
    bearerToken: '',
    username: '',
    password: ''
  }
}

export function defaultRequestAuth(): RequestAuth {
  return {
    inheritFromCollection: true,
    ...defaultCollectionAuth()
  }
}

function normalizeAuthFields(auth: Partial<HttpAuthConfig> | undefined): HttpAuthConfig {
  const base = defaultCollectionAuth()
  if (!auth || typeof auth !== 'object') return base
  const t = auth.type
  if (t === 'bearer' || t === 'basic' || t === 'none') base.type = t
  if (typeof auth.bearerToken === 'string') base.bearerToken = auth.bearerToken
  if (typeof auth.username === 'string') base.username = auth.username
  if (typeof auth.password === 'string') base.password = auth.password
  return base
}

export function normalizeCollectionAuth(raw: unknown): HttpAuthConfig {
  if (!raw || typeof raw !== 'object') return defaultCollectionAuth()
  const r = raw as Record<string, unknown>
  return normalizeAuthFields({
    type: r.type as HttpAuthConfig['type'],
    bearerToken: typeof r.bearerToken === 'string' ? r.bearerToken : undefined,
    username: typeof r.username === 'string' ? r.username : undefined,
    password: typeof r.password === 'string' ? r.password : undefined
  })
}

export function normalizeRequestAuth(raw: unknown): RequestAuth {
  if (!raw || typeof raw !== 'object') return defaultRequestAuth()
  const r = raw as Record<string, unknown>
  const base = normalizeAuthFields(r)
  const inherit =
    typeof r.inheritFromCollection === 'boolean' ? r.inheritFromCollection : true
  return {
    inheritFromCollection: inherit,
    ...base
  }
}

/** UTF-8 safe Base64 (browser / Electron renderer). */
export function utf8ToBase64(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)))
  } catch {
    try {
      return btoa(str)
    } catch {
      return ''
    }
  }
}

/**
 * After variable resolution, build the Authorization header value (without the "Authorization" key).
 * Returns null if no auth should be sent.
 */
export function authorizationValueFromResolvedConfig(auth: HttpAuthConfig): string | null {
  if (auth.type === 'none') return null
  if (auth.type === 'bearer') {
    const token = (auth.bearerToken ?? '').trim()
    if (!token) return null
    return `Bearer ${token}`
  }
  if (auth.type === 'basic') {
    const pair = `${auth.username ?? ''}:${auth.password ?? ''}`
    const encoded = utf8ToBase64(pair)
    if (!encoded) return null
    return `Basic ${encoded}`
  }
  return null
}

/**
 * Resolve {{var}} in auth fields using env first, then collection (collection wins on duplicate keys).
 */
export function resolveAuthConfig(
  auth: HttpAuthConfig,
  envVars: Variable[],
  collectionVars: Variable[]
): HttpAuthConfig {
  const resolve = (s: string) => resolveVariables(s, envVars, collectionVars)
  return {
    type: auth.type,
    bearerToken: resolve(auth.bearerToken ?? ''),
    username: resolve(auth.username ?? ''),
    password: resolve(auth.password ?? '')
  }
}

export function effectiveRequestAuth(
  collectionAuth: HttpAuthConfig | undefined,
  requestAuth: RequestAuth | undefined
): HttpAuthConfig {
  const coll = collectionAuth ?? defaultCollectionAuth()
  const req = requestAuth ?? defaultRequestAuth()
  if (req.inheritFromCollection) return coll
  return {
    type: req.type,
    bearerToken: req.bearerToken,
    username: req.username,
    password: req.password
  }
}
