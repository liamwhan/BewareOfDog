import { ipcMain, app } from 'electron'
import { mkdir } from 'fs/promises'
import { join } from 'path'
import type { WorkspaceBackendKind } from '../../shared/syncTypes'
import { gitTestConnection } from './backends/gitBackend'
import { s3TestConnection } from './backends/s3Backend'
import {
  deleteProfile,
  getGitSecrets,
  getS3Secrets,
  readSettings,
  setActiveBackend,
  upsertGitProfile,
  upsertS3Profile
} from './settingsStore'

function gitRoot(): string {
  return join(app.getPath('userData'), 'git-workspaces')
}

export function registerWorkspaceSyncIpc(): void {
  ipcMain.handle('sync:getSettings', async () => readSettings())

  ipcMain.handle(
    'sync:setActiveBackend',
    async (
      _e,
      payload: { kind: WorkspaceBackendKind; s3ProfileId?: string | null; gitProfileId?: string | null }
    ) => setActiveBackend(payload)
  )

  ipcMain.handle(
    'sync:upsertS3Profile',
    async (
      _e,
      payload: {
        id?: string
        name: string
        endpoint?: string
        region: string
        bucket: string
        prefix?: string
        forcePathStyle?: boolean
        secrets?: { accessKeyId: string; secretAccessKey: string; sessionToken?: string }
      }
    ) => {
      const { secrets, ...rest } = payload
      return upsertS3Profile(rest, secrets)
    }
  )

  ipcMain.handle(
    'sync:upsertGitProfile',
    async (
      _e,
      payload: {
        id?: string
        name: string
        remoteUrl: string
        branch: string
        relativePath?: string
        secrets?: { username: string; passwordOrToken: string }
      }
    ) => {
      const { secrets, ...rest } = payload
      return upsertGitProfile(rest, secrets)
    }
  )

  ipcMain.handle('sync:deleteProfile', async (_e, payload: { kind: 's3' | 'git'; id: string }) =>
    deleteProfile(payload.kind, payload.id)
  )

  ipcMain.handle('sync:testS3', async (_e, profileId: string) => {
    const settings = await readSettings()
    const profile = settings.s3Profiles.find((p) => p.id === profileId)
    if (!profile) return { ok: false, message: 'Profile not found.' }
    const secrets = await getS3Secrets(profileId)
    if (!secrets) return { ok: false, message: 'No credentials stored for this profile.' }
    return s3TestConnection(profile, secrets)
  })

  ipcMain.handle('sync:testGit', async (_e, profileId: string) => {
    const settings = await readSettings()
    const profile = settings.gitProfiles.find((p) => p.id === profileId)
    if (!profile) return { ok: false, message: 'Profile not found.' }
    const secrets = await getGitSecrets(profileId)
    if (!secrets) return { ok: false, message: 'No credentials stored for this profile.' }
    await mkdir(gitRoot(), { recursive: true })
    return gitTestConnection(gitRoot(), profile, secrets)
  })
}
