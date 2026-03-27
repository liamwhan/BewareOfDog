const STORAGE_KEY = 'bewareofdog.layout.v1'

export interface LayoutState {
  leftWidth: number
  rightWidth: number
}

export function loadLayout(): Partial<LayoutState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    const o = parsed as Record<string, unknown>
    const leftWidth = typeof o.leftWidth === 'number' ? o.leftWidth : undefined
    const rightWidth = typeof o.rightWidth === 'number' ? o.rightWidth : undefined
    return { leftWidth, rightWidth }
  } catch {
    return {}
  }
}

export function saveLayout(state: LayoutState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* quota / private mode */
  }
}
