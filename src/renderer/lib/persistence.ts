import type { Collection } from '../../shared/types'
import type { Environment } from '../../shared/types'
import { parseCollectionJson } from '../../shared/collection'
import { parseEnvironmentJson } from '../../shared/environment'

export interface WorkspaceData {
  collections: Collection[]
  environments: Environment[]
  activeEnvironmentId: string | null
  selectedRequestId: string | null
}

function safeParseCollection(c: unknown): Collection | null {
  try {
    return parseCollectionJson(JSON.stringify(c))
  } catch {
    return null
  }
}

function safeParseEnvironment(e: unknown): Environment | null {
  try {
    return parseEnvironmentJson(JSON.stringify(e))
  } catch {
    return null
  }
}

export async function loadWorkspace(): Promise<WorkspaceData | null> {
  try {
    const json = await window.electron.workspaceLoad()
    if (!json) return null
    const data = JSON.parse(json)
    const collections = Array.isArray(data.collections)
      ? data.collections.map(safeParseCollection).filter((c): c is Collection => c !== null)
      : []
    const environments = Array.isArray(data.environments)
      ? data.environments.map(safeParseEnvironment).filter((e): e is Environment => e !== null)
      : []
    return {
      collections,
      environments,
      activeEnvironmentId: data.activeEnvironmentId ?? null,
      selectedRequestId: data.selectedRequestId ?? null
    }
  } catch (err) {
    console.error('[BewareOfDog] Failed to load workspace:', err)
    return null
  }
}

export async function saveWorkspace(data: WorkspaceData): Promise<void> {
  try {
    const json = JSON.stringify(
      {
        collections: data.collections,
        environments: data.environments,
        activeEnvironmentId: data.activeEnvironmentId,
        selectedRequestId: data.selectedRequestId
      },
      null,
      2
    )
    await window.electron.workspaceSave(json)
  } catch (err) {
    console.error('[BewareOfDog] Failed to save workspace:', err)
  }
}
