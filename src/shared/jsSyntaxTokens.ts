/**
 * Lightweight JS lexer for syntax coloring only — not a parser; not executed.
 *
 * Security: output is plain strings consumed as React text nodes (escaped by React).
 * Work is bounded: max input length, max token count, template nesting depth.
 */

export type JsTokenKind =
  | 'keyword'
  | 'identifier'
  | 'string'
  | 'number'
  | 'comment'
  | 'operator'
  | 'whitespace'
  | 'punctuation'
  | 'plain'

export interface JsToken {
  kind: JsTokenKind
  text: string
}

/** Beyond this, return a single plain token (no per-character pathological DOM). */
export const JS_SYNTAX_MAX_INPUT_CHARS = 400_000

/** After merging, if still above this, collapse to one plain span. */
const MAX_TOKEN_SPANS = 50_000

/** Stop tokenizing if this many fragments are produced (e.g. a+a+a+…); avoids huge arrays. */
const MAX_TOKEN_FRAGMENTS = 100_000

const KEYWORDS = new Set([
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'export',
  'extends',
  'finally',
  'for',
  'function',
  'if',
  'import',
  'in',
  'instanceof',
  'let',
  'new',
  'return',
  'super',
  'switch',
  'this',
  'throw',
  'try',
  'typeof',
  'var',
  'void',
  'while',
  'with',
  'yield',
  'await',
  'async',
  'static',
  'get',
  'set',
  'of',
  'from',
  'as',
  'enum',
  'implements',
  'interface',
  'package',
  'private',
  'protected',
  'public',
  'abstract',
  'boolean',
  'byte',
  'char',
  'double',
  'final',
  'float',
  'goto',
  'int',
  'long',
  'native',
  'short',
  'synchronized',
  'throws',
  'transient',
  'volatile',
  'null',
  'true',
  'false',
  'undefined'
])

function isIdentStart(c: string): boolean {
  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_' || c === '$'
}

function isIdentPart(c: string): boolean {
  return isIdentStart(c) || (c >= '0' && c <= '9')
}

function mergeAdjacentSameKind(tokens: JsToken[]): JsToken[] {
  if (tokens.length === 0) return tokens
  const out: JsToken[] = []
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

function collapseIfTooManySpans(tokens: JsToken[]): JsToken[] {
  if (tokens.length <= MAX_TOKEN_SPANS) return tokens
  const combined = tokens.map((t) => t.text).join('')
  return [{ kind: 'plain', text: combined }]
}

export function tokenizeJs(source: string): JsToken[] {
  if (source.length > JS_SYNTAX_MAX_INPUT_CHARS) {
    return [{ kind: 'plain', text: source }]
  }

  const n = source.length
  const tokens: JsToken[] = []
  let i = 0
  let bail = false

  const push = (kind: JsTokenKind, text: string) => {
    if (text.length === 0) return
    tokens.push({ kind, text })
    if (tokens.length > MAX_TOKEN_FRAGMENTS) bail = true
  }

  while (i < n && !bail) {
    const c = source[i]!

    // Whitespace
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

    // Line comment
    if (c === '/' && source[i + 1] === '/') {
      let j = i + 2
      while (j < n && source[j] !== '\n' && source[j] !== '\r') j++
      push('comment', source.slice(i, j))
      i = j
      continue
    }

    // Block comment
    if (c === '/' && source[i + 1] === '*') {
      let j = i + 2
      let closed = false
      while (j + 1 < n) {
        if (source[j] === '*' && source[j + 1] === '/') {
          j += 2
          closed = true
          break
        }
        j++
      }
      if (!closed) j = n
      push('comment', source.slice(i, j))
      i = j
      continue
    }

    // Strings
    if (c === '"' || c === "'") {
      const quote = c
      let j = i + 1
      while (j < n) {
        const d = source[j]!
        if (d === '\\') {
          j += 2
          continue
        }
        if (d === quote) {
          j++
          break
        }
        j++
      }
      push('string', source.slice(i, j))
      i = j
      continue
    }

    // Template literal (skip `${ ... }` with string/comment-aware brace matching)
    if (c === '`') {
      let j = i + 1
      while (j < n) {
        const d = source[j]!
        if (d === '\\') {
          j += 2
          continue
        }
        if (d === '`') {
          j++
          break
        }
        if (d === '$' && source[j + 1] === '{') {
          j += 2
          let b = 1
          while (j < n && b > 0) {
            const ch = source[j]!
            if (ch === '\\') {
              j += 2
              continue
            }
            if (ch === '"' || ch === "'" || ch === '`') {
              const q = ch
              j++
              while (j < n) {
                const e = source[j]!
                if (e === '\\') {
                  j += 2
                  continue
                }
                if (e === q) {
                  j++
                  break
                }
                j++
              }
              continue
            }
            if (ch === '/' && source[j + 1] === '/') {
              while (j < n && source[j] !== '\n' && source[j] !== '\r') j++
              continue
            }
            if (ch === '/' && source[j + 1] === '*') {
              let k = j + 2
              let closed = false
              while (k + 1 < n) {
                if (source[k] === '*' && source[k + 1] === '/') {
                  k += 2
                  closed = true
                  break
                }
                k++
              }
              j = closed ? k : n
              continue
            }
            if (ch === '{') b++
            else if (ch === '}') b--
            j++
          }
          continue
        }
        j++
      }
      push('string', source.slice(i, j))
      i = j
      continue
    }

    // Numbers
    if ((c >= '0' && c <= '9') || (c === '.' && i + 1 < n && source[i + 1]! >= '0' && source[i + 1]! <= '9')) {
      let j = i
      if (source[j] === '0' && (source[j + 1] === 'x' || source[j + 1] === 'X')) {
        j += 2
        while (j < n && /[0-9a-fA-F]/.test(source[j]!)) j++
        push('number', source.slice(i, j))
        i = j
        continue
      }
      if (source[j] === '0' && (source[j + 1] === 'b' || source[j + 1] === 'B')) {
        j += 2
        while (j < n && (source[j] === '0' || source[j] === '1')) j++
        push('number', source.slice(i, j))
        i = j
        continue
      }
      if (source[j] === '0' && (source[j + 1] === 'o' || source[j + 1] === 'O')) {
        j += 2
        while (j < n && source[j]! >= '0' && source[j]! <= '7') j++
        push('number', source.slice(i, j))
        i = j
        continue
      }
      j = i
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
      if (j < n && source[j] === 'n') j++
      push('number', source.slice(i, j))
      i = j
      continue
    }

    // Identifier / keyword
    if (isIdentStart(c)) {
      let j = i + 1
      while (j < n && isIdentPart(source[j]!)) j++
      const word = source.slice(i, j)
      push(KEYWORDS.has(word) ? 'keyword' : 'identifier', word)
      i = j
      continue
    }

    // Multi-char operators (longest match)
    const two = source.slice(i, i + 2)
    const three = source.slice(i, i + 3)
    if (
      three === '===' ||
      three === '!==' ||
      three === '>>>' ||
      three === '...' ||
      three === '**=' ||
      three === '??=' ||
      three === '&&=' ||
      three === '||='
    ) {
      push('operator', three)
      i += 3
      continue
    }
    if (
      two === '=>' ||
      two === '&&' ||
      two === '||' ||
      two === '??' ||
      two === '==' ||
      two === '!=' ||
      two === '<=' ||
      two === '>=' ||
      two === '+=' ||
      two === '-=' ||
      two === '*=' ||
      two === '/=' ||
      two === '%=' ||
      two === '&=' ||
      two === '|=' ||
      two === '^=' ||
      two === '<<' ||
      two === '>>' ||
      two === '**' ||
      two === '++' ||
      two === '--'
    ) {
      push('operator', two)
      i += 2
      continue
    }

    if ('[](){}.?:;,~^&|+-*%/=!<>'.includes(c)) {
      push('punctuation', c)
      i++
      continue
    }

    // Any other single character (unusual unicode, etc.)
    push('operator', c)
    i++
  }

  if (bail) {
    return [{ kind: 'plain', text: source }]
  }

  return collapseIfTooManySpans(mergeAdjacentSameKind(tokens))
}
