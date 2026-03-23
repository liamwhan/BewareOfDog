import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type PutObjectCommandInput
} from '@aws-sdk/client-s3'
import type { S3ProfilePublic, S3ProfileSecrets } from '../../../shared/syncTypes'
import type { WorkspaceLoadResult, WorkspaceSaveResult } from '../../../shared/syncTypes'

function objectKey(prefix: string): string {
  const p = prefix.replace(/^\/+/, '').replace(/\/+$/, '')
  return p ? `${p}/workspace.json` : 'workspace.json'
}

function clientFor(profile: S3ProfilePublic, secrets: S3ProfileSecrets): S3Client {
  const endpoint = profile.endpoint?.trim() || undefined
  return new S3Client({
    region: profile.region,
    endpoint,
    credentials: {
      accessKeyId: secrets.accessKeyId,
      secretAccessKey: secrets.secretAccessKey,
      sessionToken: secrets.sessionToken
    },
    forcePathStyle: profile.forcePathStyle === true
  })
}

export async function s3Load(
  profile: S3ProfilePublic,
  secrets: S3ProfileSecrets
): Promise<WorkspaceLoadResult> {
  const client = clientFor(profile, secrets)
  const key = objectKey(profile.prefix)
  try {
    const out = await client.send(
      new GetObjectCommand({
        Bucket: profile.bucket,
        Key: key
      })
    )
    const body = await out.Body?.transformToString('utf-8')
    const etag = out.ETag?.replaceAll('"', '') ?? null
    return { json: body ?? null, versionToken: etag }
  } catch (err: unknown) {
    const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: string }).name) : ''
    if (name === 'NoSuchKey' || name === 'NotFound') {
      return { json: null, versionToken: null }
    }
    const message = err instanceof Error ? err.message : String(err)
    return { json: null, versionToken: null, error: message }
  }
}

export async function s3Save(
  profile: S3ProfilePublic,
  secrets: S3ProfileSecrets,
  content: string,
  ifVersionMatch?: string | null
): Promise<WorkspaceSaveResult> {
  const client = clientFor(profile, secrets)
  const key = objectKey(profile.prefix)
  const input: PutObjectCommandInput = {
    Bucket: profile.bucket,
    Key: key,
    Body: content,
    ContentType: 'application/json'
  }
  if (ifVersionMatch) {
    const raw = ifVersionMatch.replace(/"/g, '')
    input.IfMatch = raw
  }
  try {
    const out = await client.send(new PutObjectCommand(input))
    const etag = out.ETag?.replaceAll('"', '') ?? null
    return { ok: true, versionToken: etag }
  } catch (err: unknown) {
    const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: string }).name) : ''
    const status =
      err && typeof err === 'object' && '$metadata' in err
        ? (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode
        : undefined
    if (name === 'PreconditionFailed' || status === 412) {
      return { ok: false, versionToken: null, conflict: true }
    }
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, versionToken: null, error: message }
  }
}

/** Verify bucket/key is reachable (HeadObject). */
export async function s3TestConnection(
  profile: S3ProfilePublic,
  secrets: S3ProfileSecrets
): Promise<{ ok: boolean; message: string }> {
  const client = clientFor(profile, secrets)
  const key = objectKey(profile.prefix)
  try {
    await client.send(
      new HeadObjectCommand({
        Bucket: profile.bucket,
        Key: key
      })
    )
    return { ok: true, message: 'Object exists.' }
  } catch (err: unknown) {
    const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: string }).name) : ''
    if (name === 'NotFound' || name === 'NoSuchKey') {
      return { ok: true, message: 'Bucket reachable; object not created yet (first save will create it).' }
    }
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, message }
  }
}
