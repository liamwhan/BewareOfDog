/**
 * Workspace persistence router: delegates load/save to Local, S3, or Git backends.
 *
 * Hybrid coordinator (future): keep a LocalFileBackend as fast cache and add an
 * explicit sync step that compares `versionToken` (S3 ETag or Git HEAD) before
 * push/pull; a small main-process coordinator can chain Git + S3 without changing
 * the renderer contract if load/save continue to return `versionToken` and
 * `WorkspaceSaveResult.conflict`.
 */
import type { App } from 'electron'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import type { WorkspaceLoadResult, WorkspaceSaveResult } from '../../shared/syncTypes'
import { gitLoad, gitSave } from './backends/gitBackend'
import { localLoad, localSave } from './backends/localBackend'
import { s3Load, s3Save } from './backends/s3Backend'
import {
  getGitSecrets,
  getS3Secrets,
  readSettings
} from './settingsStore'

function gitWorkspacesRoot(app: App): string {
  return join(app.getPath('userData'), 'git-workspaces')
}

export async function routeWorkspaceLoad(app: App): Promise<WorkspaceLoadResult> {
  const settings = await readSettings()
  if (settings.activeBackend === 'local') {
    return localLoad(app)
  }
  if (settings.activeBackend === 's3') {
    const id = settings.activeS3ProfileId
    if (!id) return { json: null, versionToken: null, error: 'No S3 profile selected.' }
    const profile = settings.s3Profiles.find((p) => p.id === id)
    if (!profile) return { json: null, versionToken: null, error: 'S3 profile not found.' }
    const secrets = await getS3Secrets(id)
    if (!secrets) return { json: null, versionToken: null, error: 'S3 credentials missing for profile.' }
    return s3Load(profile, secrets)
  }
  if (settings.activeBackend === 'git') {
    const id = settings.activeGitProfileId
    if (!id) return { json: null, versionToken: null, error: 'No Git profile selected.' }
    const profile = settings.gitProfiles.find((p) => p.id === id)
    if (!profile) return { json: null, versionToken: null, error: 'Git profile not found.' }
    const secrets = await getGitSecrets(id)
    if (!secrets) return { json: null, versionToken: null, error: 'Git credentials missing for profile.' }
    await mkdir(gitWorkspacesRoot(app), { recursive: true })
    return gitLoad(gitWorkspacesRoot(app), profile, secrets)
  }
  return localLoad(app)
}

export async function routeWorkspaceSave(
  app: App,
  content: string,
  options?: { ifVersionMatch?: string | null }
): Promise<WorkspaceSaveResult> {
  const settings = await readSettings()
  if (settings.activeBackend === 'local') {
    return localSave(app, content)
  }
  if (settings.activeBackend === 's3') {
    const id = settings.activeS3ProfileId
    if (!id) return { ok: false, versionToken: null, error: 'No S3 profile selected.' }
    const profile = settings.s3Profiles.find((p) => p.id === id)
    if (!profile) return { ok: false, versionToken: null, error: 'S3 profile not found.' }
    const secrets = await getS3Secrets(id)
    if (!secrets) return { ok: false, versionToken: null, error: 'S3 credentials missing for profile.' }
    return s3Save(profile, secrets, content, options?.ifVersionMatch)
  }
  if (settings.activeBackend === 'git') {
    const id = settings.activeGitProfileId
    if (!id) return { ok: false, versionToken: null, error: 'No Git profile selected.' }
    const profile = settings.gitProfiles.find((p) => p.id === id)
    if (!profile) return { ok: false, versionToken: null, error: 'Git profile not found.' }
    const secrets = await getGitSecrets(id)
    if (!secrets) return { ok: false, versionToken: null, error: 'Git credentials missing for profile.' }
    await mkdir(gitWorkspacesRoot(app), { recursive: true })
    return gitSave(gitWorkspacesRoot(app), profile, secrets, content, options?.ifVersionMatch)
  }
  return localSave(app, content)
}
