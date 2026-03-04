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
}

export interface Collection {
  name: string
  variables: Variable[]
  requests: Request[]
}

export interface Environment {
  id: string
  name: string
  variables: Variable[]
}
