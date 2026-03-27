/**
 * Lightweight JSON lexer for syntax coloring only.
 * Distinguishes object key strings from value strings using a small bracket stack.
 * Same safety model as jsSyntaxTokens: React text nodes, bounded work.
 */

export type JsonTokenKind =
  | 'key'
  | 'keyword'
  | 'string'
  | 'number'
  | 'punctuation'
  | 'whitespace'
  | 'plain'

export interface JsonToken {
  kind: JsonTokenKind
  text: string
}

export const JSON_SYNTAX_MAX_INPUT_CHARS = 400_000

const MAX_TOKEN_SPANS = 50_000
const MAX_TOKEN_FRAGMENTS = 100_000

const KEYWORDS = new Set(['true', 'false', 'null'])

function mergeAdjacentSameKind(tokens: JsonToken[]): JsonToken[] {
  if (tokens.length === 0) return tokens
  const out: JsonToken[] = []
  for (const t of tokens) {
    const last = out[out.length - 1]
    if (last && last.kind === t.kind) {
      last.text += t.text
    } else {
      out.push({ kind: t.kind, text: t.text })
    }
  }
  return out
}

function collapseIfTooManySpans(tokens: JsonToken[]): JsonToken[] {
  if (tokens.length <= MAX_TOKEN_SPANS) return tokens
  return [{ kind: 'plain', text: tokens.map((t) => t.text).join('') }]
}

type StackTop = 'obj' | 'arr'

export function tokenizeJson(source: string): JsonToken[] {
  if (source.length > JSON_SYNTAX_MAX_INPUT_CHARS) {
    return [{ kind: 'plain', text: source }]
  }

  const n = source.length
  const tokens: JsonToken[] = []
  let i = 0
  let bail = false

  const stack: StackTop[] = []
  /** Next string in object position is a key name (after `{` or `,`). */
  let expectKey = false

  const push = (kind: JsonTokenKind, text: string) => {
    if (text.length === 0) return
    tokens.push({ kind, text })
    if (tokens.length > MAX_TOKEN_FRAGMENTS) bail = true
  }

  while (i < n && !bail) {
    const c = source[i]!

    if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f' || c === '\v') {
      let j = i + 1
      while (j < n) {
        const d = source[j]!
        if (d !== ' ' && d !== '\t' && d !== '\n' && d !== '\r' && d !== '\f' && d !== '\v') break
        j++
      }
      push('whitespace', source.slice(i, j))
      i = j
      continue
    }

    if (c === '"') {
      let j = i + 1
      while (j < n) {
        const d = source[j]!
        if (d === '\\') {
          j += 2
          continue
        }
        if (d === '"') {
          j++
          break
        }
        j++
      }
      const raw = source.slice(i, j)
      const inObjKey =
        expectKey && stack.length > 0 && stack[stack.length - 1] === 'obj'
      push(inObjKey ? 'key' : 'string', raw)
      if (inObjKey) expectKey = false
      i = j
      continue
    }

    if (c === '{') {
      push('punctuation', '{')
      stack.push('obj')
      expectKey = true
      i++
      continue
    }

    if (c === '[') {
      push('punctuation', '[')
      stack.push('arr')
      expectKey = false
      i++
      continue
    }

    if (c === '}') {
      push('punctuation', '}')
      if (stack.length > 0 && stack[stack.length - 1] === 'obj') stack.pop()
      i++
      continue
    }

    if (c === ']') {
      push('punctuation', ']')
      if (stack.length > 0 && stack[stack.length - 1] === 'arr') stack.pop()
      i++
      continue
    }

    if (c === ',') {
      push('punctuation', ',')
      if (stack.length > 0 && stack[stack.length - 1] === 'obj') expectKey = true
      i++
      continue
    }

    if (c === ':') {
      push('punctuation', ':')
      i++
      continue
    }

    if ((c >= '0' && c <= '9') || c === '-') {
      let j = i + (c === '-' ? 1 : 0)
      while (j < n && source[j]! >= '0' && source[j]! <= '9') j++
      if (j < n && source[j] === '.') {
        j++
        while (j < n && source[j]! >= '0' && source[j]! <= '9') j++
      }
      if (j < n && (source[j] === 'e' || source[j] === 'E')) {
        j++
        if (j < n && (source[j] === '+' || source[j] === '-')) j++
        while (j < n && source[j]! >= '0' && source[j]! <= '9') j++
      }
      push('number', source.slice(i, j))
      i = j
      continue
    }

    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_') {
      let j = i + 1
      while (j < n && /[a-zA-Z0-9_$]/.test(source[j]!)) j++
      const word = source.slice(i, j)
      push(KEYWORDS.has(word) ? 'keyword' : 'plain', word)
      i = j
      continue
    }

    push('plain', c)
    i++
  }

  if (bail) {
    return [{ kind: 'plain', text: source }]
  }

  return collapseIfTooManySpans(mergeAdjacentSameKind(tokens))
}
