import type { Collection, Request, Variable } from './types'
import { defaultCollectionAuth, defaultRequestAuth } from './auth'

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === 'object' && !Array.isArray(x)
}

/** OpenAPI 3.x JSON (e.g. Swashbuckle). */
export function isOpenApi3(data: unknown): boolean {
  if (!isRecord(data)) return false
  const v = data.openapi
  if (typeof v !== 'string' || !v.startsWith('3.')) return false
  if (!isRecord(data.paths)) return false
  const info = data.info
  if (!isRecord(info) || typeof info.title !== 'string' || !info.title.trim()) return false
  return true
}

const HTTP_METHODS = new Set([
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'head',
  'options',
  'trace'
])

/** OpenAPI `{param}` → BOD `:param` for routeParams / extractRouteParams */
function openApiPathToBodPath(path: string): string {
  return path.replace(/\{([^}]+)\}/g, (_, name: string) => `:${name.trim()}`)
}

function routeParamNamesFromPath(path: string): string[] {
  const names: string[] = []
  const re = /\{([^}]+)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(path)) !== null) {
    names.push(m[1].trim())
  }
  return names
}

function pickRequestName(
  method: string,
  path: string,
  op: Record<string, unknown>
): string {
  if (typeof op.summary === 'string' && op.summary.trim()) return op.summary.trim()
  if (typeof op.operationId === 'string' && op.operationId.trim()) return op.operationId.trim()
  return `${method.toUpperCase()} ${path}`
}

/**
 * When baseUrl is "/" (default), use {{baseUrl}}api/foo so resolved URL is /api/foo.
 * When baseUrl is a full server URL, use {{baseUrl}}/api/foo.
 */
function buildRequestUrl(baseUrlVar: string, openApiPath: string): string {
  const path = openApiPath.startsWith('/') ? openApiPath : `/${openApiPath}`
  if (!baseUrlVar || baseUrlVar === '/') {
    return `{{baseUrl}}${path.slice(1)}`
  }
  return `{{baseUrl}}${path}`
}

function parametersToParts(parameters: unknown, refSkip: { n: number }): {
  query: Array<Variable & { enabled?: boolean }>
  header: Variable[]
  route: Variable[]
} {
  const query: Array<Variable & { enabled?: boolean }> = []
  const header: Variable[] = []
  const route: Variable[] = []
  if (!Array.isArray(parameters)) return { query, header, route }

  for (const p of parameters) {
    if (!isRecord(p)) continue
    if (p.$ref) {
      refSkip.n += 1
      continue
    }
    const where = typeof p.in === 'string' ? p.in : ''
    const name = typeof p.name === 'string' ? p.name : ''
    if (!name) continue
    const required = p.required === true
    const schema = isRecord(p.schema) ? p.schema : null
    let example: string | undefined
    if (p.example !== undefined) {
      example = typeof p.example === 'string' ? p.example : JSON.stringify(p.example)
    } else if (schema && schema.default !== undefined) {
      example =
        typeof schema.default === 'string' ? schema.default : JSON.stringify(schema.default)
    } else if (schema && Array.isArray(schema.enum) && schema.enum.length > 0) {
      example = String(schema.enum[0])
    }

    const val = example ?? (required ? '' : '')
    if (where === 'query') {
      query.push({ key: name, value: val, enabled: true })
    } else if (where === 'header') {
      header.push({ key: name, value: val })
    } else if (where === 'path') {
      route.push({ key: name, value: val })
    }
  }
  return { query, header, route }
}

function jsonFromSchema(schema: Record<string, unknown> | null): string | null {
  if (!schema) return null
  const t = typeof schema.type === 'string' ? schema.type : ''
  if (t === 'object') {
    return '{}'
  }
  if (t === 'array') {
    return '[]'
  }
  if (t === 'string') return '""'
  if (t === 'number' || t === 'integer') return '0'
  if (t === 'boolean') return 'false'
  return '{}'
}

function bodyFromOperation(op: Record<string, unknown>): { body: string | null; headers: Variable[] } {
  const rb = op.requestBody
  if (!isRecord(rb)) return { body: null, headers: [] }

  const content = rb.content
  if (!isRecord(content)) return { body: null, headers: [] }

  let jsonMedia: Record<string, unknown> | null = null
  for (const [ct, media] of Object.entries(content)) {
    if (ct.includes('json') && isRecord(media)) {
      jsonMedia = media
      break
    }
  }
  if (!jsonMedia) {
    return { body: null, headers: [] }
  }

  const headers: Variable[] = [{ key: 'Content-Type', value: 'application/json' }]

  if (jsonMedia.example !== undefined) {
    const ex = jsonMedia.example
    const body = typeof ex === 'string' ? ex : JSON.stringify(ex, null, 2)
    return { body, headers }
  }

  const examples = jsonMedia.examples
  if (isRecord(examples)) {
    const first = Object.values(examples)[0]
    if (isRecord(first) && first.value !== undefined) {
      const v = first.value
      const body = typeof v === 'string' ? v : JSON.stringify(v, null, 2)
      return { body, headers }
    }
  }

  const schema = isRecord(jsonMedia.schema) ? jsonMedia.schema : null
  const body = jsonFromSchema(schema)
  return { body, headers }
}

export function importOpenApi3WithWarnings(data: unknown): { collection: Collection; warnings: string[] } {
  if (!isRecord(data) || !isOpenApi3(data)) {
    throw new Error('Invalid OpenAPI 3 document')
  }

  const info = data.info as Record<string, unknown>
  const title = typeof info.title === 'string' ? info.title.trim() : 'Imported API'
  const paths = data.paths as Record<string, unknown>
  const warnings: string[] = []
  const refParamSkip = { n: 0 }

  const baseUrlValue = '/'

  const variables: Variable[] = [{ key: 'baseUrl', value: baseUrlValue }]

  const requests: Request[] = []

  for (const [pathKey, pathItem] of Object.entries(paths)) {
    if (!isRecord(pathItem)) continue

    const pathLevelParams = pathItem.parameters

    for (const method of HTTP_METHODS) {
      const op = pathItem[method]
      if (!isRecord(op)) continue

      const methodUpper = method.toUpperCase()
      const mergedParams = [...(Array.isArray(pathLevelParams) ? pathLevelParams : [])]
      if (Array.isArray(op.parameters)) mergedParams.push(...op.parameters)

      const parts = parametersToParts(mergedParams, refParamSkip)

      const bodPath = openApiPathToBodPath(pathKey)
      const url = buildRequestUrl(baseUrlValue, bodPath)

      const name = pickRequestName(methodUpper, pathKey, op)
      const routeNames = routeParamNamesFromPath(pathKey)
      const routeParams: Variable[] = routeNames.map((k) => {
        const fromOp = parts.route.find((r) => r.key === k)
        return { key: k, value: fromOp?.value ?? '' }
      })

      let headers = [...parts.header]
      let body: string | null = null

      if (method !== 'get' && method !== 'head') {
        const b = bodyFromOperation(op)
        if (b.body !== null) {
          body = b.body
          for (const h of b.headers) {
            if (!headers.some((x) => x.key.toLowerCase() === h.key.toLowerCase())) headers.push(h)
          }
        }
      }

      requests.push({
        id: crypto.randomUUID(),
        name,
        method: methodUpper,
        url,
        routeParams,
        queryParams: parts.query,
        headers,
        body,
        postRequestScript: null,
        auth: defaultRequestAuth()
      })
    }
  }

  if (requests.length === 0) {
    warnings.push('No operations were found under paths — empty collection.')
  }
  if (refParamSkip.n > 0) {
    warnings.push(
      `${refParamSkip.n} parameter(s) use $ref and were skipped — expand references in the JSON before import for full fidelity.`
    )
  }

  const s0 = Array.isArray(data.servers) && data.servers[0] && isRecord(data.servers[0]) ? data.servers[0] : null
  if (s0 && typeof s0.url === 'string') {
    const u = s0.url.trim()
    if (u && u !== '/') {
      warnings.push(
        `servers[0].url is "${u}" — set the baseUrl collection variable if requests should target that origin.`
      )
    }
  }

  const collection: Collection = {
    name: title,
    variables,
    auth: defaultCollectionAuth(),
    requests
  }

  return { collection, warnings }
}
