/**
 * Runs a post-request script in a sandboxed context.
 * The script receives a `bod` object as its only argument - no access to global scope,
 * require, eval, or other dangerous APIs.
 */

export interface PmRequest {
  method: string
  url: string
  headers: Record<string, string>
}

export interface PmResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  json: () => unknown
  text: () => string
}

export interface PmEnvironment {
  get: (key: string) => string
  set: (key: string, value: string) => void
}

export interface PmCollectionVariables {
  get: (key: string) => string
  set: (key: string, value: string) => void
}

export interface PmApi {
  request: PmRequest
  response: PmResponse
  environment: PmEnvironment
  collectionVariables: PmCollectionVariables
}

export interface RunScriptOptions {
  script: string
  request: { method: string; url: string; headers: Record<string, string> }
  response: { status: number; statusText: string; headers: Record<string, string>; body: string }
  envGet: (key: string) => string
  envSet: (key: string, value: string) => void
  collGet: (key: string) => string
  collSet: (key: string, value: string) => void
}

export function runPostRequestScript(options: RunScriptOptions): void {
  const { script, request, response, envGet, envSet, collGet, collSet } = options

  let parsedBody: unknown = null
  let parseError: Error | null = null

  const bod: PmApi = {
    request: {
      method: request.method,
      url: request.url,
      headers: request.headers
    },
    response: {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
      body: response.body,
      json: () => {
        if (parsedBody !== null) return parsedBody
        if (parseError) throw parseError
        try {
          parsedBody = JSON.parse(response.body)
          return parsedBody
        } catch (e) {
          parseError = e instanceof Error ? e : new Error(String(e))
          throw parseError
        }
      },
      text: () => response.body
    },
    environment: {
      get: envGet,
      set: envSet
    },
    collectionVariables: {
      get: collGet,
      set: collSet
    }
  }

  try {
    const fn = new Function('bod', script)
    fn(bod)
  } catch (err) {
    console.error('[BewareOfDog] Post-request script error:', err)
    throw err
  }
}
