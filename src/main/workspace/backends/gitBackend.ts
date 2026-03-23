import { mkdir, readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join, dirname } from 'path'
import simpleGit from 'simple-git'
import type { GitProfilePublic, GitProfileSecrets } from '../../../shared/syncTypes'
import type { WorkspaceLoadResult, WorkspaceSaveResult } from '../../../shared/syncTypes'

function authedRemoteUrl(remoteUrl: string, username: string, passwordOrToken: string): string {
  const u = new URL(remoteUrl)
  const user = username.trim() || 'git'
  u.username = encodeURIComponent(user)
  u.password = encodeURIComponent(passwordOrToken)
  return u.toString()
}

function repoRoot(userDataGitDir: string, profileId: string): string {
  return join(userDataGitDir, profileId)
}

async function ensureGitIdentity(repoPath: string): Promise<void> {
  const git = simpleGit(repoPath)
  await git.addConfig('user.email', 'bewareofdog@local', false, 'local')
  await git.addConfig('user.name', 'BewareOfDog', false, 'local')
}

async function cloneOrOpen(
  repoPath: string,
  profile: GitProfilePublic,
  secrets: GitProfileSecrets
): Promise<{ git: ReturnType<typeof simpleGit>; error?: string }> {
  const authed = authedRemoteUrl(profile.remoteUrl, secrets.username, secrets.passwordOrToken)
  if (!existsSync(join(repoPath, '.git'))) {
    try {
      await simpleGit().clone(authed, repoPath, ['--depth', '50', '--branch', profile.branch, '--single-branch'])
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { git: simpleGit(repoPath), error: message }
    }
  }
  const git = simpleGit(repoPath)
  try {
    await git.remote(['set-url', 'origin', authed])
  } catch {
    /* ignore */
  }
  return { git }
}

async function pullRebase(git: ReturnType<typeof simpleGit>, branch: string): Promise<{ ok: boolean; conflict?: boolean; error?: string }> {
  try {
    await git.pull('origin', branch, ['--rebase'])
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/CONFLICT|conflict/i.test(msg) || /Merge conflict/i.test(msg)) {
      try {
        await git.rebase(['--abort'])
      } catch {
        /* ignore */
      }
      return { ok: false, conflict: true, error: msg }
    }
    return { ok: false, error: msg }
  }
}

export async function gitLoad(
  userDataGitDir: string,
  profile: GitProfilePublic,
  secrets: GitProfileSecrets
): Promise<WorkspaceLoadResult> {
  const root = repoRoot(userDataGitDir, profile.id)
  const { git, error: cloneErr } = await cloneOrOpen(root, profile, secrets)
  if (cloneErr && !existsSync(join(root, '.git'))) {
    return { json: null, versionToken: null, error: cloneErr }
  }
  await ensureGitIdentity(root)
  const pulled = await pullRebase(git, profile.branch)
  if (!pulled.ok) {
    if (pulled.conflict) {
      return { json: null, versionToken: null, error: pulled.error ?? 'Pull conflict; resolve in repo then retry.', conflict: true }
    }
    return { json: null, versionToken: null, error: pulled.error }
  }
  let head: string
  try {
    head = (await git.revparse(['HEAD'])).trim()
  } catch (e) {
    return { json: null, versionToken: null, error: e instanceof Error ? e.message : String(e) }
  }
  const filePath = join(root, profile.relativePath.replace(/\\/g, '/'))
  if (!existsSync(filePath)) {
    return { json: null, versionToken: head }
  }
  try {
    const json = await readFile(filePath, 'utf-8')
    return { json, versionToken: head }
  } catch (e) {
    return { json: null, versionToken: head, error: e instanceof Error ? e.message : String(e) }
  }
}

export async function gitSave(
  userDataGitDir: string,
  profile: GitProfilePublic,
  secrets: GitProfileSecrets,
  content: string,
  _ifVersionMatch?: string | null
): Promise<WorkspaceSaveResult> {
  const root = repoRoot(userDataGitDir, profile.id)
  const { git, error: cloneErr } = await cloneOrOpen(root, profile, secrets)
  if (cloneErr && !existsSync(join(root, '.git'))) {
    return { ok: false, versionToken: null, error: cloneErr }
  }
  await ensureGitIdentity(root)
  const pulled = await pullRebase(git, profile.branch)
  if (!pulled.ok) {
    if (pulled.conflict) {
      return { ok: false, versionToken: null, conflict: true, error: pulled.error }
    }
    return { ok: false, versionToken: null, error: pulled.error }
  }
  const rel = profile.relativePath.replace(/\\/g, '/')
  const filePath = join(root, rel)
  await mkdir(dirname(filePath), { recursive: true })
  await writeFile(filePath, content, 'utf-8')
  try {
    await git.add(rel)
    const staged = await git.diff(['--cached'])
    if (!staged.trim()) {
      const head = (await git.revparse(['HEAD'])).trim()
      return { ok: true, versionToken: head }
    }
    await git.commit(`Update workspace (${new Date().toISOString()})`)
    await git.push('origin', profile.branch)
    const head = (await git.revparse(['HEAD'])).trim()
    return { ok: true, versionToken: head }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    if (/conflict|rejected|non-fast-forward/i.test(message)) {
      return { ok: false, versionToken: null, conflict: true, error: message }
    }
    return { ok: false, versionToken: null, error: message }
  }
}

export async function gitTestConnection(
  userDataGitDir: string,
  profile: GitProfilePublic,
  secrets: GitProfileSecrets
): Promise<{ ok: boolean; message: string }> {
  const root = repoRoot(userDataGitDir, profile.id)
  const { git, error } = await cloneOrOpen(root, profile, secrets)
  if (error && !existsSync(join(root, '.git'))) {
    return { ok: false, message: error }
  }
  try {
    await git.fetch('origin', profile.branch)
    return { ok: true, message: 'Remote reachable.' }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) }
  }
}
