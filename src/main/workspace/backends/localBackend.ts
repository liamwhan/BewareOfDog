import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import type { App } from 'electron'
import type { WorkspaceLoadResult, WorkspaceSaveResult } from '../../../shared/syncTypes'

const WORKSPACE_FILENAME = 'workspace.json'

export function getLocalWorkspacePath(app: App): string {
  return join(app.getPath('userData'), WORKSPACE_FILENAME)
}

export async function localLoad(app: App): Promise<WorkspaceLoadResult> {
  try {
    const path = getLocalWorkspacePath(app)
    if (!existsSync(path)) return { json: null, versionToken: null }
    const json = await readFile(path, 'utf-8')
    return { json, versionToken: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { json: null, versionToken: null, error: message }
  }
}

export async function localSave(app: App, content: string): Promise<WorkspaceSaveResult> {
  try {
    const path = getLocalWorkspacePath(app)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, content, 'utf-8')
    return { ok: true, versionToken: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, versionToken: null, error: message }
  }
}
