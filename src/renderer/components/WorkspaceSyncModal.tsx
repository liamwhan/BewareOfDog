import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  S3ProfilePublic,
  WorkspaceBackendKind,
  WorkspaceSyncSettingsDTO
} from '../../shared/syncTypes'

interface WorkspaceSyncModalProps {
  open: boolean
  onClose: () => void
}

function requestWorkspacePull() {
  window.dispatchEvent(new CustomEvent('bewareofdog:workspace-pull'))
}

/** Explicit empty form; distinct from `null` (follow active S3 profile when backend is S3). */
const S3_FORM_NEW = '__s3_form_new__' as const
type S3FormFocusId = string | typeof S3_FORM_NEW | null

export function WorkspaceSyncModal({ open, onClose }: WorkspaceSyncModalProps) {
  const [settings, setSettings] = useState<WorkspaceSyncSettingsDTO | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  /** When set to an id or `S3_FORM_NEW`, drives the S3 form; when null, follows active S3 profile (if any). */
  const [s3FormFocusId, setS3FormFocusId] = useState<S3FormFocusId>(null)

  const refresh = useCallback(async () => {
    const s = await window.electron.syncGetSettings()
    setSettings(s)
  }, [])

  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh])

  useEffect(() => {
    if (!open) setS3FormFocusId(null)
  }, [open])

  const s3ProfileForForm = useMemo((): S3ProfilePublic | null => {
    if (s3FormFocusId === S3_FORM_NEW) return null
    if (!settings?.s3Profiles.length) return null
    const id =
      s3FormFocusId ??
      (settings.activeBackend === 's3' ? settings.activeS3ProfileId : null)
    if (!id) return null
    return settings.s3Profiles.find((p) => p.id === id) ?? null
  }, [settings, s3FormFocusId])

  if (!open) return null

  async function applyBackend(kind: WorkspaceBackendKind) {
    if (!settings) return
    const s3Id = settings.activeS3ProfileId ?? settings.s3Profiles[0]?.id ?? null
    const gitId = settings.activeGitProfileId ?? settings.gitProfiles[0]?.id ?? null
    if (kind === 's3' && !s3Id) {
      setMessage('Add an S3 profile below first.')
      return
    }
    if (kind === 'git' && !gitId) {
      setMessage('Add a Git profile below first.')
      return
    }
    setBusy(true)
    setMessage(null)
    try {
      await window.electron.syncSetActiveBackend({
        kind,
        ...(kind === 's3' ? { s3ProfileId: s3Id } : {}),
        ...(kind === 'git' ? { gitProfileId: gitId } : {})
      })
      await refresh()
      requestWorkspacePull()
      setMessage('Active backend updated. Workspace reloaded from remote (or local file).')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function setS3Active(id: string | null) {
    if (!settings) return
    setS3FormFocusId(null)
    setBusy(true)
    setMessage(null)
    try {
      await window.electron.syncSetActiveBackend({ kind: 's3', s3ProfileId: id })
      await refresh()
      requestWorkspacePull()
      setMessage('S3 profile active. Workspace reloaded.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function setGitActive(id: string | null) {
    if (!settings) return
    setBusy(true)
    setMessage(null)
    try {
      await window.electron.syncSetActiveBackend({ kind: 'git', gitProfileId: id })
      await refresh()
      requestWorkspacePull()
      setMessage('Git profile active. Workspace reloaded.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-modal-title"
    >
      <div className="bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-slate-600">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-600 px-4 py-3">
          <h2 id="sync-modal-title" className="text-lg font-semibold">
            Workspace sync (BYO)
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 px-2"
          >
            Close
          </button>
        </div>

        <div className="p-4 space-y-6 text-sm">
          <p className="text-slate-600 dark:text-slate-400">
            No BewareOfDog account. Storage is local, or your own S3-compatible bucket, or a Git remote. Secrets are
            encrypted with the OS where supported.
          </p>

          {message && (
            <p className="rounded bg-slate-100 dark:bg-slate-900/80 px-3 py-2 text-slate-800 dark:text-slate-200">
              {message}
            </p>
          )}

          <section>
            <h3 className="font-medium mb-2">Active backend</h3>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !settings}
                className={`px-3 py-1.5 rounded border ${
                  settings?.activeBackend === 'local'
                    ? 'bg-slate-200 dark:bg-slate-700 border-slate-400'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
                onClick={() => void applyBackend('local')}
              >
                Local file
              </button>
              <button
                type="button"
                disabled={busy || !settings}
                className={`px-3 py-1.5 rounded border ${
                  settings?.activeBackend === 's3'
                    ? 'bg-slate-200 dark:bg-slate-700 border-slate-400'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
                onClick={() => void applyBackend('s3')}
              >
                S3-compatible
              </button>
              <button
                type="button"
                disabled={busy || !settings}
                className={`px-3 py-1.5 rounded border ${
                  settings?.activeBackend === 'git'
                    ? 'bg-slate-200 dark:bg-slate-700 border-slate-400'
                    : 'border-slate-300 dark:border-slate-600'
                }`}
                onClick={() => void applyBackend('git')}
              >
                Git remote
              </button>
            </div>
            <button
              type="button"
              disabled={busy}
              className="mt-2 text-xs text-sky-600 dark:text-sky-400 underline"
              onClick={() => {
                requestWorkspacePull()
                setMessage('Pull requested.')
              }}
            >
              Pull from remote now (uses active backend)
            </button>
          </section>

          {settings && (
            <section>
              <h3 className="font-medium mb-2">S3-compatible profiles</h3>
              <p className="text-xs text-slate-500 mb-2">
                Object key: <code className="bg-slate-100 dark:bg-slate-900 px-1 rounded">{`{prefix}/workspace.json`}</code>
              </p>
              {settings.activeBackend === 's3' && (
                <select
                  className="w-full border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 bg-white dark:bg-slate-900 mb-2"
                  value={settings.activeS3ProfileId ?? ''}
                  onChange={(e) => void setS3Active(e.target.value || null)}
                >
                  <option value="">Select active S3 profile…</option>
                  {settings.s3Profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              {settings.s3Profiles.length > 0 && (
                <p className="text-xs text-slate-500 mb-2">
                  {settings.activeBackend === 's3'
                    ? 'The form below fills from the active profile. Use Edit on a row to load another profile without switching the active one.'
                    : 'Load a profile into the form with Edit (below) to review or change settings.'}
                </p>
              )}
              <S3ProfileForm
                busy={busy}
                setBusy={setBusy}
                setMessage={setMessage}
                onSaved={refresh}
                profileToLoad={s3ProfileForForm}
                onRequestNewProfile={() => setS3FormFocusId(S3_FORM_NEW)}
              />
              <ul className="mt-2 space-y-1">
                {settings.s3Profiles.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 flex-wrap">
                    <span>{p.name}</span>
                    <button
                      type="button"
                      className="text-xs text-sky-600 dark:text-sky-400"
                      disabled={busy}
                      onClick={() => setS3FormFocusId(p.id)}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-xs text-sky-600 dark:text-sky-400"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true)
                        const r = await window.electron.syncTestS3(p.id)
                        setMessage(r.ok ? r.message : `Test failed: ${r.message}`)
                        setBusy(false)
                      }}
                    >
                      Test
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-600 dark:text-red-400"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true)
                        await window.electron.syncDeleteProfile({ kind: 's3', id: p.id })
                        await refresh()
                        setBusy(false)
                      }}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {settings && (
            <section>
              <h3 className="font-medium mb-2">Git remote profiles</h3>
              <p className="text-xs text-slate-500 mb-2">Requires Git on PATH. HTTPS + personal access token recommended.</p>
              {settings.activeBackend === 'git' && (
                <select
                  className="w-full border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 bg-white dark:bg-slate-900 mb-2"
                  value={settings.activeGitProfileId ?? ''}
                  onChange={(e) => void setGitActive(e.target.value || null)}
                >
                  <option value="">Select active Git profile…</option>
                  {settings.gitProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
              <GitProfileForm busy={busy} setBusy={setBusy} setMessage={setMessage} onSaved={refresh} />
              <ul className="mt-2 space-y-1">
                {settings.gitProfiles.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 flex-wrap">
                    <span>{p.name}</span>
                    <button
                      type="button"
                      className="text-xs text-sky-600 dark:text-sky-400"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true)
                        const r = await window.electron.syncTestGit(p.id)
                        setMessage(r.ok ? r.message : `Test failed: ${r.message}`)
                        setBusy(false)
                      }}
                    >
                      Test
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-600 dark:text-red-400"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true)
                        await window.electron.syncDeleteProfile({ kind: 'git', id: p.id })
                        await refresh()
                        setBusy(false)
                      }}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

function emptyS3Form() {
  return {
    name: '',
    endpoint: '',
    region: 'us-east-1',
    bucket: '',
    prefix: '',
    forcePathStyle: false,
    accessKeyId: '',
    secretAccessKey: ''
  }
}

function S3ProfileForm({
  busy,
  setBusy,
  setMessage,
  onSaved,
  profileToLoad,
  onRequestNewProfile
}: {
  busy: boolean
  setBusy: (v: boolean) => void
  setMessage: (s: string | null) => void
  onSaved: () => Promise<void>
  profileToLoad: S3ProfilePublic | null
  onRequestNewProfile: () => void
}) {
  const [name, setName] = useState('')
  const [endpoint, setEndpoint] = useState('')
  const [region, setRegion] = useState('us-east-1')
  const [bucket, setBucket] = useState('')
  const [prefix, setPrefix] = useState('')
  const [forcePathStyle, setForcePathStyle] = useState(false)
  const [accessKeyId, setAccessKeyId] = useState('')
  const [secretAccessKey, setSecretAccessKey] = useState('')

  useEffect(() => {
    if (!profileToLoad) {
      const z = emptyS3Form()
      setName(z.name)
      setEndpoint(z.endpoint)
      setRegion(z.region)
      setBucket(z.bucket)
      setPrefix(z.prefix)
      setForcePathStyle(z.forcePathStyle)
      setAccessKeyId(z.accessKeyId)
      setSecretAccessKey(z.secretAccessKey)
      return
    }
    setName(profileToLoad.name)
    setEndpoint(profileToLoad.endpoint)
    setRegion(profileToLoad.region)
    setBucket(profileToLoad.bucket)
    setPrefix(profileToLoad.prefix)
    setForcePathStyle(profileToLoad.forcePathStyle)
    setAccessKeyId('')
    setSecretAccessKey('')
  }, [profileToLoad?.id])

  const editingId = profileToLoad?.id ?? null
  const isEditing = editingId !== null

  return (
    <form
      className="grid gap-2 border border-slate-200 dark:border-slate-600 rounded p-3"
      onSubmit={async (e) => {
        e.preventDefault()
        const ak = accessKeyId.trim().replace(/^\uFEFF/, '')
        const sk = secretAccessKey.trim().replace(/^\uFEFF/, '')
        const hasBothKeys = ak.length > 0 && sk.length > 0
        const hasNoKeys = ak.length === 0 && sk.length === 0
        const hasPartial = !hasBothKeys && !hasNoKeys

        if (!name.trim() || !region.trim() || !bucket.trim()) {
          setMessage('Fill name, region, and bucket.')
          return
        }
        if (hasPartial) {
          setMessage('Provide both access key and secret, or leave both blank to keep stored credentials.')
          return
        }
        if (!isEditing && !hasBothKeys) {
          setMessage('Fill name, region, bucket, and keys for a new profile.')
          return
        }
        setBusy(true)
        setMessage(null)
        try {
          await window.electron.syncUpsertS3Profile({
            ...(isEditing ? { id: editingId } : {}),
            name: name.trim(),
            endpoint: endpoint.trim(),
            region: region.trim(),
            bucket: bucket.trim(),
            prefix: prefix.trim(),
            forcePathStyle,
            ...(hasBothKeys
              ? {
                  secrets: {
                    accessKeyId: ak,
                    secretAccessKey: sk
                  }
                }
              : {})
          })
          await onSaved()
          setMessage(isEditing ? 'S3 profile updated.' : 'S3 profile saved.')
          setAccessKeyId('')
          setSecretAccessKey('')
          if (!isEditing) {
            onRequestNewProfile()
            const z = emptyS3Form()
            setName(z.name)
            setEndpoint(z.endpoint)
            setRegion(z.region)
            setBucket(z.bucket)
            setPrefix(z.prefix)
            setForcePathStyle(z.forcePathStyle)
          }
        } catch (err) {
          setMessage(err instanceof Error ? err.message : String(err))
        } finally {
          setBusy(false)
        }
      }}
    >
      <input
        placeholder="Profile name"
        className="border rounded px-2 py-1 dark:bg-slate-900 dark:border-slate-600"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        placeholder="Endpoint (optional, for MinIO/R2)"
        className="border rounded px-2 py-1 dark:bg-slate-900 dark:border-slate-600"
        value={endpoint}
        onChange={(e) => setEndpoint(e.target.value)}
      />
      <input
        placeholder="Region"
        className="border rounded px-2 py-1 dark:bg-slate-900 dark:border-slate-600"
        value={region}
        onChange={(e) => setRegion(e.target.value)}
      />
      <input
        placeholder="Bucket"
        className="border rounded px-2 py-1 dark:bg-slate-900 dark:border-slate-600"
        value={bucket}
        onChange={(e) => setBucket(e.target.value)}
      />
      <input
        placeholder="Key prefix (optional)"
        className="border rounded px-2 py-1 dark:bg-slate-900 dark:border-slate-600"
        value={prefix}
        onChange={(e) => setPrefix(e.target.value)}
      />
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={forcePathStyle} onChange={(e) => setForcePathStyle(e.target.checked)} />
        Force path-style (MinIO)
      </label>
      <input
        placeholder="Access key ID"
        className="border rounded px-2 py-1 dark:bg-slate-900 dark:border-slate-600"
        value={accessKeyId}
        onChange={(e) => setAccessKeyId(e.target.value)}
        autoComplete="off"
      />
      <input
        placeholder="Secret access key"
        type="password"
        className="border rounded px-2 py-1 dark:bg-slate-900 dark:border-slate-600"
        value={secretAccessKey}
        onChange={(e) => setSecretAccessKey(e.target.value)}
        autoComplete="off"
      />
      {isEditing && (
        <p className="text-xs text-slate-500">
          Access key and secret are not shown after save. Leave both blank to keep the stored credentials, or enter new
          ones to replace them.
        </p>
      )}
      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="submit"
          disabled={busy}
          className="px-3 py-1.5 rounded bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 disabled:opacity-50"
        >
          {isEditing ? 'Update S3 profile' : 'Save S3 profile'}
        </button>
        {isEditing && (
          <button
            type="button"
            disabled={busy}
            className="px-3 py-1.5 rounded border border-slate-300 dark:border-slate-600 text-sm"
            onClick={() => {
              onRequestNewProfile()
              const z = emptyS3Form()
              setName(z.name)
              setEndpoint(z.endpoint)
              setRegion(z.region)
              setBucket(z.bucket)
              setPrefix(z.prefix)
              setForcePathStyle(z.forcePathStyle)
              setAccessKeyId(z.accessKeyId)
              setSecretAccessKey(z.secretAccessKey)
              setMessage(null)
            }}
          >
            New profile instead
          </button>
        )}
      </div>
    </form>
  )
}

function GitProfileForm({
  busy,
  setBusy,
  setMessage,
  onSaved
}: {
  busy: boolean
  setBusy: (v: boolean) => void
  setMessage: (s: string | null) => void
  onSaved: () => Promise<void>
}) {
  const [name, setName] = useState('')
  const [remoteUrl, setRemoteUrl] = useState('')
  const [branch, setBranch] = useState('main')
  const [relativePath, setRelativePath] = useState('bewareofdog/workspace.json')
  const [username, setUsername] = useState('')
  const [passwordOrToken, setPasswordOrToken] = useState('')

  return (
    <form
      className="grid gap-2 border border-slate-200 dark:border-slate-600 rounded p-3"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!name.trim() || !remoteUrl.trim() || !branch.trim() || !passwordOrToken.trim()) {
          setMessage('Fill name, remote URL, branch, and token.')
          return
        }
        setBusy(true)
        setMessage(null)
        try {
          await window.electron.syncUpsertGitProfile({
            name: name.trim(),
            remoteUrl: remoteUrl.trim(),
            branch: branch.trim(),
            relativePath: relativePath.trim() || 'bewareofdog/workspace.json',
            secrets: {
              username: username.trim() || 'git',
              passwordOrToken
            }
          })
          setName('')
          setPasswordOrToken('')
          await onSaved()
          setMessage('Git profile saved.')
        } catch (err) {
          setMessage(err instanceof Error ? err.message : String(err))
        } finally {
          setBusy(false)
        }
      }}
    >
      <input
        placeholder="Profile name"
        className="border rounded px-2 py-1 dark:bg-slate-900 dark:border-slate-600"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <input
        placeholder="HTTPS remote URL"
        className="border rounded px-2 py-1 dark:bg-slate-900 dark:border-slate-600"
        value={remoteUrl}
        onChange={(e) => setRemoteUrl(e.target.value)}
      />
      <input
        placeholder="Branch"
        className="border rounded px-2 py-1 dark:bg-slate-900 dark:border-slate-600"
        value={branch}
        onChange={(e) => setBranch(e.target.value)}
      />
      <input
        placeholder="Path in repo (default bewareofdog/workspace.json)"
        className="border rounded px-2 py-1 dark:bg-slate-900 dark:border-slate-600"
        value={relativePath}
        onChange={(e) => setRelativePath(e.target.value)}
      />
      <input
        placeholder="Username (optional; use x-access-token for some hosts)"
        className="border rounded px-2 py-1 dark:bg-slate-900 dark:border-slate-600"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      <input
        placeholder="PAT / password"
        type="password"
        className="border rounded px-2 py-1 dark:bg-slate-900 dark:border-slate-600"
        value={passwordOrToken}
        onChange={(e) => setPasswordOrToken(e.target.value)}
        autoComplete="off"
      />
      <button
        type="submit"
        disabled={busy}
        className="px-3 py-1.5 rounded bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 disabled:opacity-50"
      >
        Save Git profile
      </button>
    </form>
  )
}
