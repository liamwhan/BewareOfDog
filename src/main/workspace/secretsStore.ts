import { safeStorage } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import type { GitProfileSecrets, S3ProfileSecrets } from '../../shared/syncTypes'

export interface SecretsPayload {
  s3: Record<string, S3ProfileSecrets>
  git: Record<string, GitProfileSecrets>
}

const emptySecrets = (): SecretsPayload => ({ s3: {}, git: {} })

export async function loadSecrets(secretsPath: string): Promise<SecretsPayload> {
  if (!existsSync(secretsPath)) return emptySecrets()
  try {
    const buf = await readFile(secretsPath)
    if (!safeStorage.isEncryptionAvailable()) {
      return JSON.parse(buf.toString('utf-8')) as SecretsPayload
    }
    const decrypted = safeStorage.decryptString(buf)
    return JSON.parse(decrypted) as SecretsPayload
  } catch {
    return emptySecrets()
  }
}

export async function saveSecrets(secretsPath: string, payload: SecretsPayload): Promise<void> {
  if (safeStorage.isEncryptionAvailable()) {
    const enc = safeStorage.encryptString(JSON.stringify(payload))
    await writeFile(secretsPath, enc)
  } else {
    await writeFile(secretsPath, JSON.stringify(payload), 'utf-8')
  }
}
