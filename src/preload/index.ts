import { contextBridge, ipcRenderer } from 'electron'

const api = {
  httpRequest: (payload: { method: string; url: string; headers?: Record<string, string>; body?: string }) =>
    ipcRenderer.invoke('http:request', payload),
  fileRead: (path: string) => ipcRenderer.invoke('file:read', path),
  fileWrite: (path: string, content: string) => ipcRenderer.invoke('file:write', path, content),
  fileExists: (path: string) => ipcRenderer.invoke('file:exists', path),
  appGetPath: (name: string) => ipcRenderer.invoke('app:getPath', name)
}

export type ElectronApi = typeof api

contextBridge.exposeInMainWorld('electron', api)
