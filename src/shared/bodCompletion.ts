/**
 * Completion for the post-request `bod` API only (scriptRunner PmApi shape).
 * Parsing is linear; no regex on unbounded user strings.
 */

/** Mirrors keys exposed on `bod` and one level of nesting where applicable. */
const BOD_ROOT_KEYS = ['request', 'response', 'environment', 'collectionVariables'] as const

const BOD_CHILDREN: Record<string, readonly string[]> = {
  request: ['method', 'url', 'headers'],
  response: ['status', 'statusText', 'headers', 'body', 'json', 'text'],
  environment: ['get', 'set'],
  collectionVariables: ['get', 'set']
}

export interface BodCompletionContext {
  /** Path segments after `bod`, e.g. ['request'] for `bod.request.` */
  path: string[]
  /** Identifier fragment being typed after the last dot (or first segment after `bod`). */
  partial: string
  /** Start index in `value` of `partial` (replace [replaceStart, caret) on accept). */
  replaceStart: number
  caret: number
}

function filterPrefix(items: readonly string[], partial: string): string[] {
  const p = partial.toLowerCase()
  return items.filter((s) => s.toLowerCase().startsWith(p))
}

/** Children for a path like ['request'] or [] for root after `bod.`. */
export function bodChildrenForPath(path: string[]): string[] | null {
  if (path.length === 0) return [...BOD_ROOT_KEYS]
  if (path.length === 1) {
    const k = path[0]
    if (!k) return null
    const next = BOD_CHILDREN[k]
    return next ? [...next] : null
  }
  return []
}

/**
 * If the caret is in a `bod....` chain, return context for filtering completions.
 * Otherwise null.
 */
export function getBodCompletionContext(value: string, caret: number): BodCompletionContext | null {
  if (caret < 0 || caret > value.length) return null

  let i = caret - 1
  let partial = ''
  while (i >= 0 && /[a-zA-Z0-9_$]/.test(value[i]!)) {
    partial = value[i]! + partial
    i--
  }

  const replaceStart = caret - partial.length

  if (i < 0) {
    if (partial === 'bod') return null
    return null
  }

  const path: string[] = []

  while (i >= 0) {
    if (value[i] !== '.') {
      if (/[a-zA-Z0-9_$]/.test(value[i]!)) return null
      return null
    }
    i--
    let seg = ''
    while (i >= 0 && /[a-zA-Z0-9_$]/.test(value[i]!)) {
      seg = value[i]! + seg
      i--
    }
    if (!seg) return null
    if (seg === 'bod') {
      if (i >= 0 && /[a-zA-Z0-9_$]/.test(value[i]!)) return null
      return { path, partial, replaceStart, caret }
    }
    path.unshift(seg)
  }

  return null
}

export function getBodSuggestions(ctx: BodCompletionContext): string[] {
  const children = bodChildrenForPath(ctx.path)
  if (children === null) return []
  return filterPrefix(children, ctx.partial).sort()
}

/** For docs / tests — describes the public `bod` surface. */
export function bodApiShapeReference(): { root: typeof BOD_ROOT_KEYS; children: typeof BOD_CHILDREN } {
  return { root: BOD_ROOT_KEYS, children: { ...BOD_CHILDREN } }
}

export type { PmApi } from './scriptRunner'
