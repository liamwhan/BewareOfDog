export type HttpAuthType = 'none' | 'bearer' | 'basic'

export interface HttpAuthConfig {
  type: HttpAuthType
  bearerToken: string
  username: string
  password: string
}

export interface RequestAuth extends HttpAuthConfig {
  inheritFromCollection: boolean
}

export interface Variable {
  key: string
  value: string
}

export interface Request {
  id: string
  name: string
  method: string
  url: string
  routeParams: Variable[]
  queryParams: Array<Variable & { enabled?: boolean }>
  headers: Variable[]
  body: string | null
  postRequestScript: string | null
  /** Per-request auth; when inheritFromCollection is true, collection auth applies. */
  auth: RequestAuth
}

export interface Collection {
  name: string
  variables: Variable[]
  /** Default HTTP auth for all requests unless a request overrides. */
  auth: HttpAuthConfig
  requests: Request[]
}

export interface Environment {
  id: string
  name: string
  variables: Variable[]
}
