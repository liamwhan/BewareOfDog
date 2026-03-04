import type { Environment, Variable } from './types'

export function createEnvironment(name: string, variables: Variable[] = []): Environment {
  return {
    id: crypto.randomUUID(),
    name,
    variables
  }
}

export function parseEnvironmentJson(json: string): Environment {
  const data = JSON.parse(json)
  if (!data.name) {
    throw new Error('Invalid environment format')
  }
  return {
    id: data.id ?? crypto.randomUUID(),
    name: data.name,
    variables: Array.isArray(data.variables) ? data.variables : []
  }
}

export function serializeEnvironment(env: Environment): string {
  return JSON.stringify(env, null, 2)
}
