import { contextBridge, ipcRenderer } from 'electron'
import type {
  WorkspaceBackendKind,
  WorkspaceLoadResult,
  WorkspaceSaveResult,
  WorkspaceSyncSettingsDTO
} from '../shared/syncTypes'

export type UpdaterEventPayload =
  | { type: 'checking' }
  | { type: 'available'; version?: string }
  | { type: 'not-available' }
  | { type: 'download-progress'; percent: number; bytesPerSecond: number }
  | { type: 'downloaded'; version?: string }
  | { type: 'error'; message: string }

const api = {
  appGetVersion: (): Promise<string> => ipcRenderer.invoke('app:getVersion'),
  checkForUpdates: (): Promise<
    | { ok: true; isUpdateAvailable: boolean; availableVersion?: string }
    | { ok: false; reason: string }
  > => ipcRenderer.invoke('app:checkForUpdates'),
  installUpdate: (): Promise<{ ok: true } | { ok: false; reason: string }> =>
    ipcRenderer.invoke('app:installUpdate'),
  onUpdaterEvent: (listener: (payload: UpdaterEventPayload) => void): (() => void) => {
    const handler = (_event: unknown, payload: UpdaterEventPayload) => listener(payload)
    ipcRenderer.on('updater:event', handler)
    return () => ipcRenderer.removeListener('updater:event', handler)
  },
  httpRequest: (payload: { method: string; url: string; headers?: Record<string, string>; body?: string }) =>
    ipcRenderer.invoke('http:request', payload),
  fileRead: (path: string) => ipcRenderer.invoke('file:read', path),
  fileWrite: (path: string, content: string) => ipcRenderer.invoke('file:write', path, content),
  fileExists: (path: string) => ipcRenderer.invoke('file:exists', path),
  appGetPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
  workspaceLoad: (): Promise<WorkspaceLoadResult> => ipcRenderer.invoke('workspace:load'),
  workspaceSave: (payload: { content: string; ifVersionMatch?: string | null }): Promise<WorkspaceSaveResult> =>
    ipcRenderer.invoke('workspace:save', payload),

  syncGetSettings: (): Promise<WorkspaceSyncSettingsDTO> => ipcRenderer.invoke('sync:getSettings'),
  syncSetActiveBackend: (payload: {
    kind: WorkspaceBackendKind
    s3ProfileId?: string | null
    gitProfileId?: string | null
  }) => ipcRenderer.invoke('sync:setActiveBackend', payload),
  syncUpsertS3Profile: (payload: {
    id?: string
    name: string
    endpoint?: string
    region: string
    bucket: string
    prefix?: string
    forcePathStyle?: boolean
    secrets?: { accessKeyId: string; secretAccessKey: string; sessionToken?: string }
  }) => ipcRenderer.invoke('sync:upsertS3Profile', payload),
  syncUpsertGitProfile: (payload: {
    id?: string
    name: string
    remoteUrl: string
    branch: string
    relativePath?: string
    secrets?: { username: string; passwordOrToken: string }
  }) => ipcRenderer.invoke('sync:upsertGitProfile', payload),
  syncDeleteProfile: (payload: { kind: 's3' | 'git'; id: string }) =>
    ipcRenderer.invoke('sync:deleteProfile', payload),
  syncTestS3: (profileId: string): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke('sync:testS3', profileId),
  syncTestGit: (profileId: string): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke('sync:testGit', profileId)
}

export type ElectronApi = typeof api

contextBridge.exposeInMainWorld('electron', api)
