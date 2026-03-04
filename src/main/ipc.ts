import { ipcMain } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

export interface HttpRequestPayload {
  method: string
  url: string
  headers?: Record<string, string>
  body?: string
}

export interface HttpResponse {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  duration: number
}

export function registerIpcHandlers() {
  ipcMain.handle('http:request', async (_event, payload: HttpRequestPayload): Promise<HttpResponse> => {
    const start = Date.now()
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)

      const response = await fetch(payload.url, {
        method: payload.method,
        headers: payload.headers ?? {},
        body: payload.body ?? undefined,
        signal: controller.signal
      })

      clearTimeout(timeout)
      const duration = Date.now() - start

      const contentType = response.headers.get('content-type') ?? ''
      let body: string
      if (contentType.includes('application/json')) {
        body = await response.json().then((j) => JSON.stringify(j, null, 2))
      } else {
        body = await response.text()
      }

      const headers: Record<string, string> = {}
      response.headers.forEach((v, k) => {
        headers[k] = v
      })

      return {
        status: response.status,
        statusText: response.statusText,
        headers,
        body,
        duration
      }
    } catch (err) {
      const duration = Date.now() - start
      const message = err instanceof Error ? err.message : String(err)
      return {
        status: 0,
        statusText: 'Error',
        headers: {},
        body: JSON.stringify({ error: message }, null, 2),
        duration
      }
    }
  })

  ipcMain.handle('file:read', async (_event, filePath: string): Promise<string> => {
    return readFile(filePath, 'utf-8')
  })

  ipcMain.handle('file:write', async (_event, filePath: string, content: string): Promise<void> => {
    return writeFile(filePath, content, 'utf-8')
  })

  ipcMain.handle('file:exists', async (_event, filePath: string): Promise<boolean> => {
    return existsSync(filePath)
  })

  ipcMain.handle('app:getPath', async (_event, name: string): Promise<string> => {
    return app.getPath(name as 'userData' | 'documents' | 'home')
  })
}
