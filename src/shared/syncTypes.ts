export type WorkspaceBackendKind = 'local' | 's3' | 'git'

export interface WorkspaceLoadResult {
  json: string | null
  versionToken: string | null
  error?: string
  /** Remote merge/pull could not be applied cleanly (e.g. Git). */
  conflict?: boolean
}

export interface WorkspaceSaveResult {
  ok: boolean
  versionToken: string | null
  conflict?: boolean
  error?: string
}

export interface S3ProfilePublic {
  id: string
  name: string
  /** Empty = default AWS endpoint for region */
  endpoint: string
  region: string
  bucket: string
  /** Object key prefix (no leading slash), e.g. `team/bod` */
  prefix: string
  forcePathStyle: boolean
}

export interface GitProfilePublic {
  id: string
  name: string
  /** HTTPS remote without credentials, e.g. https://github.com/org/repo.git */
  remoteUrl: string
  branch: string
  /** Path inside repo; default bewareofdog/workspace.json */
  relativePath: string
}

export interface WorkspaceSyncSettingsDTO {
  version: 1
  activeBackend: WorkspaceBackendKind
  activeS3ProfileId: string | null
  activeGitProfileId: string | null
  s3Profiles: S3ProfilePublic[]
  gitProfiles: GitProfilePublic[]
}

export interface S3ProfileSecrets {
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
}

export interface GitProfileSecrets {
  username: string
  passwordOrToken: string
}
