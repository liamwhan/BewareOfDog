import type { Collection, Environment } from './types'

/** Single persisted document: collections, environments, and UI selection state. */
export interface WorkspaceData {
  collections: Collection[]
  environments: Environment[]
  activeEnvironmentId: string | null
  selectedRequestId: string | null
}
