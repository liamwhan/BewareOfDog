/// <reference types="vite/client" />

interface Window {
  electron: {
    httpRequest: (payload: {
      method: string
      url: string
      headers?: Record<string, string>
      body?: string
    }) => Promise<{
      status: number
      statusText: string
      headers: Record<string, string>
      body: string
      duration: number
    }>
    fileRead: (path: string) => Promise<string>
    fileWrite: (path: string, content: string) => Promise<void>
    fileExists: (path: string) => Promise<boolean>
    appGetPath: (name: string) => Promise<string>
    workspaceLoad: () => Promise<string | null>
    workspaceSave: (content: string) => Promise<void>
  }
}
