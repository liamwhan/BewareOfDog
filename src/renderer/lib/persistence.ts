/**
 * Workspace load/save and `versionToken` flow are the extension points for a future hybrid
 * coordinator (local cache + explicit push/pull to S3/Git). See `src/main/workspace/router.ts`.
 */
import type { Collection } from '../../shared/types'
import type { Environment } from '../../shared/types'
import type { LastSuccessfulResponseSnapshot, WorkspaceData } from '../../shared/workspace'
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

const MAX_LAST_RESPONSE_BODY_CHARS = 500_000

function parseLastSuccessfulResponse(raw: unknown): LastSuccessfulResponseSnapshot | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  const requestId = typeof o.requestId === 'string' ? o.requestId : null
  const status = typeof o.status === 'number' ? o.status : null
  const statusText = typeof o.statusText === 'string' ? o.statusText : ''
  const body = typeof o.body === 'string' ? o.body : null
  const duration = typeof o.duration === 'number' ? o.duration : 0
  if (!requestId || status == null || body == null) return null
  if (status < 200 || status >= 300) return null
  const headers: Record<string, string> = {}
  if (o.headers && typeof o.headers === 'object' && !Array.isArray(o.headers)) {
    for (const [k, v] of Object.entries(o.headers as Record<string, unknown>)) {
      if (typeof v === 'string') headers[k] = v
    }
  }
  return {
    requestId,
    status,
    statusText,
    headers,
    body: body.length > MAX_LAST_RESPONSE_BODY_CHARS ? body.slice(0, MAX_LAST_RESPONSE_BODY_CHARS) : body,
    duration
  }
}

export function truncateResponseBodyForWorkspace(body: string): string {
  if (body.length <= MAX_LAST_RESPONSE_BODY_CHARS) return body
  return `${body.slice(0, MAX_LAST_RESPONSE_BODY_CHARS)}\n\n… (truncated for workspace save)`
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
    selectedRequestId: data.selectedRequestId ?? null,
    lastSuccessfulResponse: parseLastSuccessfulResponse(data.lastSuccessfulResponse)
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

/** Set by PersistenceManager so sendRequest can record the last 2xx for workspace save. */
let lastSuccessfulResponseSink: ((snap: LastSuccessfulResponseSnapshot) => void) | null = null

export function registerLastSuccessfulResponseSink(
  fn: ((snap: LastSuccessfulResponseSnapshot) => void) | null
): void {
  lastSuccessfulResponseSink = fn
}

export function emitLastSuccessfulResponse(snap: LastSuccessfulResponseSnapshot): void {
  lastSuccessfulResponseSink?.(snap)
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
        selectedRequestId: data.selectedRequestId,
        lastSuccessfulResponse: data.lastSuccessfulResponse
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
