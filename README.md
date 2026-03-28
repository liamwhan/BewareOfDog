# Beware Of Dog

**REST API debugging that stays yours.** A desktop client for building requests, inspecting responses, and sharing workspaces—without a vendor account or “team sync” rent.

![Beware of Dog Logo](public/bod.png)

![BewareOfDog application screenshot](bod_screenshot.png)

## Why BewareOfDog?

**Local-first**, fast, and honest about where data lives. When you need a shared workspace, **you** pick the backend: nothing is stored on our servers. Credentials stay on your machine (OS keychain where supported); sync goes to **your** S3-compatible bucket or **your** Git remote—no BewareOfDog login, no surprise invoices.

## Features

- **Request builder** — Method, URL, route/query params, headers, JSON body with syntax coloring, per-request auth; bad URLs are caught before send.
- **Variables** — Environment and collection variables with `{{var}}`; hover to see resolved values.
- **Response view** — Status, timing, headers, body with JSON-aware coloring; one-click copy.
- **HTTP console** — Recent requests/responses while you iterate.
- **Collections** — CRUD; import **Postman v2.1**, **OpenAPI 3.x** (JSON), or native JSON; export as portable BewareOfDog JSON.
- **Environments** — Named variable sets (e.g. Dev / Staging / Prod).
- **Workspace sync (BYO)** — Local file, **S3-compatible** storage, or **Git** (header → *Workspace sync*).
- **Layout** — Window and panel sizes remembered between sessions.
- **Updates** — Packaged builds check **GitHub Releases** in the background and prompt when a new version is ready (**electron-updater**).
- **Ctrl+Enter** to send · **Dark / light** themes
- **Post-request scripts** — Sandboxed JS with a `bod` API (tokens, assertions, variable updates); Tab inserts spaces; autocomplete for `bod`.

## Workspace sync

One JSON document holds collections, environments, selected request, and last successful response metadata. You can back it with infrastructure you already use:

| Mode | Best for |
|------|----------|
| **Local file** | Default, solo, or air-gapped |
| **S3-compatible** | AWS S3, R2, MinIO, etc.—single object path, conditional writes to avoid blind overwrites |
| **Git** | Teams already on GitHub/GitLab—familiar history and review |

Conflicts are explicit (S3 ETags; Git pull/rebase before push). Secrets use Electron **safe storage** where the OS supports it. *Git mode needs [Git](https://git-scm.com/) on `PATH`; HTTPS + PAT is the usual setup.*

## Quick start

```bash
npm install
npm run dev
```

## Installers

Releases are on the repo **Releases** tab: Windows (NSIS `.exe`), macOS (`.dmg`), Linux (`.AppImage`; `chmod +x` if needed). macOS builds are not notarized—you may need **Open** from the context menu on first launch.

## Collection format (excerpt)

```json
{
  "name": "My API",
  "variables": [
    { "key": "baseUrl", "value": "https://api.example.com" }
  ],
  "requests": [
    {
      "id": "uuid",
      "name": "Get User",
      "method": "GET",
      "url": "{{baseUrl}}/users/:userId",
      "routeParams": [{ "key": "userId", "value": "123" }],
      "queryParams": [{ "key": "include", "value": "profile" }],
      "headers": [],
      "body": null,
      "postRequestScript": null
    }
  ]
}
```

## Import & export

- **OpenAPI 3.x (JSON)** — Import from the collections panel; operations become requests where mapping allows.
- **Postman Collection v2.1** — Export from Postman, import here; common auth, params, and body shapes transfer; a short summary appears if something needed manual follow-up.
- **On disk** — Save/export uses the same open JSON shape as above—good for Git and diff-friendly backups.

Postman `pm.*` pre-request/test scripts are not migrated; use BewareOfDog’s `bod` post-request scripts instead. Exotic auth, multipart uploads, or query-string API keys may need a quick tweak after import.

## Environment format

```json
{
  "name": "Development",
  "variables": [
    { "key": "baseUrl", "value": "http://localhost:3000" }
  ]
}
```

## Post-request scripts

Sandboxed JavaScript with a `bod` object (syntax coloring, Tab → spaces, autocomplete after `bod.`).

```javascript
// bod.request — { method, url, headers }
// bod.response — { status, statusText, headers, body, json(), text() }
// bod.environment / bod.collectionVariables — get(key), set(key, value)

const json = bod.response.json();
if (json.token) {
  bod.environment.set('token', json.token);
}
```

## S3 IAM (least privilege)

For one prefix, scope `s3:GetObject` / `s3:PutObject` to `arn:...:bucket/prefix/*` (and `s3:ListBucket` with a prefix condition if you need listing).

## Build

```bash
npm run build
```

**Installers locally:** `npm run dist` (build + icons → `release/`, NSIS / DMG / AppImage). `npm run dist:dir` for an unpacked app only.

**Auto-update:** Packaged apps use **electron-updater** against **GitHub Releases** (see workflow). Checks run in the background; **Check for updates** in the header is a manual check. *Not available in `npm run dev`.*

### Publishing a release

1. Bump `version` in `package.json` and commit.
2. Tag and push: `git tag -a v0.2.0 -m "v0.2.0"` then `git push origin v0.2.0`.

The tag must be `v` plus the exact version string (e.g. `v0.2.0` ↔ `0.2.0`). CI builds Windows, macOS, and Linux and attaches installers plus `*.yml` update metadata to that GitHub Release.

---

*BewareOfDog: debug APIs, share workspaces, keep the keys.*
