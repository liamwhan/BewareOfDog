import { randomUUID } from 'node:crypto'
import { app } from 'electron'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { dirname, join } from 'path'
import type {
  GitProfilePublic,
  S3ProfilePublic,
  WorkspaceBackendKind,
  WorkspaceSyncSettingsDTO
} from '../../shared/syncTypes'
import { loadSecrets, saveSecrets, type SecretsPayload } from './secretsStore'

const SETTINGS_VERSION = 1 as const
const SETTINGS_NAME = 'workspace-sync-settings.json'
const SECRETS_NAME = 'workspace-sync-secrets.enc'

function defaultSettings(): WorkspaceSyncSettingsDTO {
  return {
    version: SETTINGS_VERSION,
    activeBackend: 'local',
    activeS3ProfileId: null,
    activeGitProfileId: null,
    s3Profiles: [],
    gitProfiles: []
  }
}

export function getSettingsPath(): string {
  return join(app.getPath('userData'), SETTINGS_NAME)
}

export function getSecretsPath(): string {
  return join(app.getPath('userData'), SECRETS_NAME)
}

export async function readSettings(): Promise<WorkspaceSyncSettingsDTO> {
  const path = getSettingsPath()
  if (!existsSync(path)) return defaultSettings()
  try {
    const raw = await readFile(path, 'utf-8')
    const data = JSON.parse(raw) as Partial<WorkspaceSyncSettingsDTO>
    if (data.version !== SETTINGS_VERSION) return defaultSettings()
    return {
      version: SETTINGS_VERSION,
      activeBackend: data.activeBackend ?? 'local',
      activeS3ProfileId: data.activeS3ProfileId ?? null,
      activeGitProfileId: data.activeGitProfileId ?? null,
      s3Profiles: Array.isArray(data.s3Profiles) ? data.s3Profiles : [],
      gitProfiles: Array.isArray(data.gitProfiles) ? data.gitProfiles : []
    }
  } catch {
    return defaultSettings()
  }
}

export async function writeSettings(settings: WorkspaceSyncSettingsDTO): Promise<void> {
  const path = getSettingsPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(settings, null, 2), 'utf-8')
}

export async function readSecretsPayload(): Promise<SecretsPayload> {
  return loadSecrets(getSecretsPath())
}

export async function writeSecretsPayload(payload: SecretsPayload): Promise<void> {
  const path = getSecretsPath()
  await mkdir(dirname(path), { recursive: true })
  await saveSecrets(path, payload)
}

export async function setActiveBackend(params: {
  kind: WorkspaceBackendKind
  s3ProfileId?: string | null
  gitProfileId?: string | null
}): Promise<WorkspaceSyncSettingsDTO> {
  const s = await readSettings()
  const next: WorkspaceSyncSettingsDTO = {
    ...s,
    activeBackend: params.kind
  }
  if (params.kind === 's3' && params.s3ProfileId !== undefined) {
    next.activeS3ProfileId = params.s3ProfileId
  }
  if (params.kind === 'git' && params.gitProfileId !== undefined) {
    next.activeGitProfileId = params.gitProfileId
  }
  await writeSettings(next)
  return next
}

function newId(): string {
  return randomUUID()
}

export async function upsertS3Profile(
  publicPart: Omit<S3ProfilePublic, 'id'> & { id?: string },
  secrets?: S3ProfileSecrets
): Promise<{ settings: WorkspaceSyncSettingsDTO; id: string }> {
  const s = await readSettings()
  const sec = await readSecretsPayload()
  const id = publicPart.id ?? newId()
  const row: S3ProfilePublic = {
    id,
    name: publicPart.name,
    endpoint: publicPart.endpoint ?? '',
    region: publicPart.region,
    bucket: publicPart.bucket,
    prefix: publicPart.prefix ?? '',
    forcePathStyle: publicPart.forcePathStyle ?? false
  }
  const others = s.s3Profiles.filter((p) => p.id !== id)
  const settings: WorkspaceSyncSettingsDTO = { ...s, s3Profiles: [...others, row] }
  await writeSettings(settings)
  if (secrets) {
    sec.s3[id] = secrets
    await writeSecretsPayload(sec)
  }
  return { settings, id }
}

export async function upsertGitProfile(
  publicPart: Omit<GitProfilePublic, 'id'> & { id?: string },
  secrets?: GitProfileSecrets
): Promise<{ settings: WorkspaceSyncSettingsDTO; id: string }> {
  const s = await readSettings()
  const sec = await readSecretsPayload()
  const id = publicPart.id ?? newId()
  const row: GitProfilePublic = {
    id,
    name: publicPart.name,
    remoteUrl: publicPart.remoteUrl,
    branch: publicPart.branch,
    relativePath: publicPart.relativePath || 'bewareofdog/workspace.json'
  }
  const others = s.gitProfiles.filter((p) => p.id !== id)
  const settings: WorkspaceSyncSettingsDTO = { ...s, gitProfiles: [...others, row] }
  await writeSettings(settings)
  if (secrets) {
    sec.git[id] = secrets
    await writeSecretsPayload(sec)
  }
  return { settings, id }
}

export async function deleteProfile(kind: 's3' | 'git', id: string): Promise<WorkspaceSyncSettingsDTO> {
  const s = await readSettings()
  const sec = await readSecretsPayload()
  if (kind === 's3') {
    delete sec.s3[id]
    await writeSecretsPayload(sec)
    const settings: WorkspaceSyncSettingsDTO = {
      ...s,
      s3Profiles: s.s3Profiles.filter((p) => p.id !== id),
      activeS3ProfileId: s.activeS3ProfileId === id ? null : s.activeS3ProfileId
    }
    await writeSettings(settings)
    return settings
  }
  delete sec.git[id]
  await writeSecretsPayload(sec)
  const settings: WorkspaceSyncSettingsDTO = {
    ...s,
    gitProfiles: s.gitProfiles.filter((p) => p.id !== id),
    activeGitProfileId: s.activeGitProfileId === id ? null : s.activeGitProfileId
  }
  await writeSettings(settings)
  return settings
}

export async function getS3Secrets(profileId: string): Promise<S3ProfileSecrets | null> {
  const sec = await readSecretsPayload()
  return sec.s3[profileId] ?? null
}

export async function getGitSecrets(profileId: string): Promise<GitProfileSecrets | null> {
  const sec = await readSecretsPayload()
  return sec.git[profileId] ?? null
}
