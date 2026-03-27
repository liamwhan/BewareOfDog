/**
 * Ensure `fetch` receives an absolute http(s) URL and surface clear errors for common mistakes
 * (relative paths, unresolved {{vars}}, protocol-relative URLs without scheme context in Node).
 */
export function normalizeHttpRequestUrl(raw: string): { ok: true; url: string } | { ok: false; message: string } {
  const t = raw.trim()
  if (!t) {
    return { ok: false, message: 'URL is empty after resolving variables.' }
  }
  if (/\{\{[^}]+\}\}/.test(t)) {
    return {
      ok: false,
      message:
        'URL still contains unresolved {{placeholders}}. Check environment and collection variables, then send again.'
    }
  }

  try {
    if (/^https?:\/\//i.test(t)) {
      new URL(t)
      return { ok: true, url: t }
    }

    // Protocol-relative (//host/path) — Node fetch has no document base; assume https
    if (t.startsWith('//')) {
      const absolute = `https:${t}`
      new URL(absolute)
      return { ok: true, url: absolute }
    }

    return {
      ok: false,
      message:
        'URL is not absolute. Use a full URL including scheme and host (e.g. https://api.example.com/...). ' +
          'If you use a baseUrl variable, set it to https://your-host/…, not only / or a path.'
    }
  } catch {
    return { ok: false, message: `Invalid URL after resolving variables: ${t.slice(0, 256)}` }
  }
}
