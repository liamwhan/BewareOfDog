import type { Variable } from './types'

/**
 * Resolve {{variable}} placeholders in a string.
 * Resolution order: collectionVars (highest) -> envVars -> fallback to literal
 */
export function resolveVariables(
  str: string,
  envVars: Variable[] = [],
  collectionVars: Variable[] = []
): string {
  const vars = new Map<string, string>()

  for (const v of envVars) {
    vars.set(v.key, v.value)
  }
  for (const v of collectionVars) {
    vars.set(v.key, v.value)
  }

  return str.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
    return vars.get(key) ?? `{{${key}}}`
  })
}

/**
 * Extract :param placeholders from a URL template
 */
export function extractRouteParams(url: string): string[] {
  const matches = url.matchAll(/:(\w+)/g)
  const params: string[] = []
  const seen = new Set<string>()
  for (const m of matches) {
    if (!seen.has(m[1])) {
      seen.add(m[1])
      params.push(m[1])
    }
  }
  return params
}
