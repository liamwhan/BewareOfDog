import { app, BrowserWindow, screen } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'

export interface WindowStateFile {
  width: number
  height: number
  x: number
  y: number
  isMaximized: boolean
}

const DEFAULT_WIDTH = 1280
const DEFAULT_HEIGHT = 800

function statePath(): string {
  return join(app.getPath('userData'), 'window-state.json')
}

function clampToDisplay(bounds: { x: number; y: number; width: number; height: number }) {
  const displays = screen.getAllDisplays()
  if (displays.length === 0) return bounds
  const cx = bounds.x + bounds.width / 2
  const cy = bounds.y + bounds.height / 2
  const onAny = displays.some((d) => {
    const { x, y, width, height } = d.bounds
    return cx >= x && cx <= x + width && cy >= y && cy <= y + height
  })
  if (onAny) return bounds
  const primary = screen.getPrimaryDisplay().workArea
  return {
    ...bounds,
    x: Math.round(primary.x + (primary.width - bounds.width) / 2),
    y: Math.round(primary.y + (primary.height - bounds.height) / 2)
  }
}

export function loadWindowState(): WindowStateFile {
  try {
    const p = statePath()
    if (!existsSync(p)) {
      return {
        width: DEFAULT_WIDTH,
        height: DEFAULT_HEIGHT,
        x: Number.NaN,
        y: Number.NaN,
        isMaximized: false
      }
    }
    const raw = JSON.parse(readFileSync(p, 'utf-8')) as Partial<WindowStateFile>
    const width =
      typeof raw.width === 'number' && raw.width >= 400 ? raw.width : DEFAULT_WIDTH
    const height =
      typeof raw.height === 'number' && raw.height >= 300 ? raw.height : DEFAULT_HEIGHT
    let x = typeof raw.x === 'number' ? raw.x : Number.NaN
    let y = typeof raw.y === 'number' ? raw.y : Number.NaN
    const isMaximized = Boolean(raw.isMaximized)
    if (Number.isFinite(x) && Number.isFinite(y)) {
      const c = clampToDisplay({ x, y, width, height })
      x = c.x
      y = c.y
    }
    return { width, height, x, y, isMaximized }
  } catch {
    return {
      width: DEFAULT_WIDTH,
      height: DEFAULT_HEIGHT,
      x: Number.NaN,
      y: Number.NaN,
      isMaximized: false
    }
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

export function attachWindowStatePersistence(win: BrowserWindow): void {
  const save = () => {
    try {
      if (win.isDestroyed()) return
      const isMaximized = win.isMaximized()
      const bounds = isMaximized ? win.getNormalBounds() : win.getBounds()
      const payload: WindowStateFile = {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        isMaximized
      }
      writeFileSync(statePath(), JSON.stringify(payload), 'utf-8')
    } catch (e) {
      console.error('[BewareOfDog] window state save failed', e)
    }
  }

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(save, 200)
  }

  win.on('resize', scheduleSave)
  win.on('move', scheduleSave)
  win.on('maximize', save)
  win.on('unmaximize', save)
  win.on('close', () => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    save()
  })
}
