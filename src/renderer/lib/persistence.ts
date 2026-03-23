/**
 * Workspace load/save and `versionToken` flow are the extension points for a future hybrid
 * coordinator (local cache + explicit push/pull to S3/Git). See `src/main/workspace/router.ts`.
 */
import type { Collection } from '../../shared/types'
import type { Environment } from '../../shared/types'
import type { WorkspaceData } from '../../shared/workspace'
import type { WorkspaceSaveResult } from '../../shared/syncTypes'
import { parseCollectionJson } from '../../shared/collection'
import { parseEnvironmentJson } from '../../shared/environment'

export type { WorkspaceData }

export interface LoadWorkspaceOutcome {
  data: WorkspaceData | null
  versionToken: string | null
  error?: string
  conflict?: boolean
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

function parseWorkspaceFromJson(json: string): WorkspaceData | null {
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
}

export async function loadWorkspace(): Promise<LoadWorkspaceOutcome> {
  try {
    const result = await window.electron.workspaceLoad()
    if (result.error) {
      return {
        data: null,
        versionToken: result.versionToken,
        error: result.error,
        conflict: result.conflict
      }
    }
    if (!result.json) {
      return { data: null, versionToken: result.versionToken }
    }
    try {
      const data = parseWorkspaceFromJson(result.json)
      return { data, versionToken: result.versionToken }
    } catch (err) {
      return {
        data: null,
        versionToken: result.versionToken,
        error: err instanceof Error ? err.message : String(err)
      }
    }
  } catch (err) {
    console.error('[BewareOfDog] Failed to load workspace:', err)
    return {
      data: null,
      versionToken: null,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}

export async function saveWorkspace(
  data: WorkspaceData,
  options?: { ifVersionMatch?: string | null }
): Promise<WorkspaceSaveResult> {
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
    return await window.electron.workspaceSave({
      content: json,
      ifVersionMatch: options?.ifVersionMatch
    })
  } catch (err) {
    console.error('[BewareOfDog] Failed to save workspace:', err)
    return {
      ok: false,
      versionToken: null,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}
