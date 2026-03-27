import type { Collection, Environment } from './types'

/** Persisted snapshot of a 2xx response for the request that was active when it was received. */
export interface LastSuccessfulResponseSnapshot {
  requestId: string
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  duration: number
}

/** Single persisted document: collections, environments, and UI selection state. */
export interface WorkspaceData {
  collections: Collection[]
  environments: Environment[]
  activeEnvironmentId: string | null
  selectedRequestId: string | null
  /** Last HTTP 2xx response (for `requestId`), capped in size when saving. */
  lastSuccessfulResponse: LastSuccessfulResponseSnapshot | null
}
