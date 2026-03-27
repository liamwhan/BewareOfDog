import type { Variable } from './types'

/** Guard against pathological or circular {{a}}→{{b}}→{{a}} definitions. */
const MAX_VARIABLE_RESOLUTION_PASSES = 32

/**
 * Resolve {{variable}} placeholders in a string.
 * Merge order: environment variables first, then collection variables (collection wins on duplicate keys).
 * Runs multiple passes so nested placeholders resolve (e.g. collection baseUrl = "{{ATLAS_HOST}}" and env ATLAS_HOST = "https://…").
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

  const substitute = (s: string) =>
    s.replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      return vars.get(key) ?? `{{${key}}}`
    })

  let out = str
  for (let i = 0; i < MAX_VARIABLE_RESOLUTION_PASSES; i++) {
    const next = substitute(out)
    if (next === out) break
    out = next
  }
  return out
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

export type TemplatePart =
  | { type: 'text'; content: string }
  | { type: 'var'; content: string; key: string }

/** Split a string into literal segments and `{{name}}` placeholders for UI rendering. */
export function splitTemplateParts(text: string): TemplatePart[] {
  const re = /\{\{(\w+)\}\}/g
  const parts: TemplatePart[] = []
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push({ type: 'text', content: text.slice(last, m.index) })
    }
    parts.push({ type: 'var', content: m[0], key: m[1] })
    last = m.index + m[0].length
  }
  if (last < text.length) {
    parts.push({ type: 'text', content: text.slice(last) })
  }
  return parts
}

/** If the caret falls inside a `{{name}}` segment, return that key. */
export function findVariablePlaceholderAtIndex(text: string, charIndex: number): { key: string } | null {
  if (!text || charIndex < 0 || charIndex >= text.length) return null
  let offset = 0
  for (const p of splitTemplateParts(text)) {
    const len = p.content.length
    const start = offset
    const end = offset + len
    if (p.type === 'var' && charIndex >= start && charIndex < end) {
      return { key: p.key }
    }
    offset = end
  }
  return null
}

function variableMap(envVars: Variable[], collectionVars: Variable[]): Map<string, string> {
  const vars = new Map<string, string>()
  for (const v of envVars) vars.set(v.key, v.value)
  for (const v of collectionVars) vars.set(v.key, v.value)
  return vars
}

/**
 * Fully resolved value for a single variable name (e.g. hover tooltip on {{baseUrl}}).
 */
export function resolveVariableTooltipFull(
  key: string,
  envVars: Variable[],
  collectionVars: Variable[]
): string {
  const vars = variableMap(envVars, collectionVars)
  const raw = vars.get(key)
  if (raw === undefined) return `{{${key}}} is not defined`
  return resolveVariables(raw, envVars, collectionVars)
}

/**
 * Path line like `{{baseUrl}} => {{ATLAS_API}}` by following the first `{{name}}` in each stored value,
 * plus the fully resolved string (second line of tooltip).
 */
export function resolveVariableTooltipWithPath(
  startKey: string,
  envVars: Variable[],
  collectionVars: Variable[]
): { pathLine: string; resolved: string } {
  const vars = variableMap(envVars, collectionVars)
  const resolved = resolveVariableTooltipFull(startKey, envVars, collectionVars)

  const keyChain: string[] = [startKey]
  const visited = new Set<string>([startKey])
  let current = vars.get(startKey)

  if (current === undefined) {
    return { pathLine: `{{${startKey}}}`, resolved }
  }

  for (let i = 0; i < MAX_VARIABLE_RESOLUTION_PASSES; i++) {
    const m = current.match(/\{\{(\w+)\}\}/)
    if (!m) break
    const nextKey = m[1]
    if (visited.has(nextKey)) break
    visited.add(nextKey)
    keyChain.push(nextKey)
    const nextVal = vars.get(nextKey)
    if (nextVal === undefined) break
    current = nextVal
  }

  const pathLine = keyChain.map((k) => `{{${k}}}`).join(' => ')
  return { pathLine, resolved }
}
