import { useCallback, useEffect, useState } from 'react'

type Props = {
  /** Called with horizontal pointer movement (positive = mouse moved right). */
  onResize: (deltaPx: number) => void
  /** Accessible label for the drag control */
  label?: string
}

/**
 * Narrow hit target between two columns; drag to resize the adjacent panel(s).
 */
export function VerticalResizeHandle({ onResize, label = 'Resize panel' }: Props) {
  const [dragging, setDragging] = useState(false)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
  }, [])

  useEffect(() => {
    if (!dragging) return

    const move = (e: PointerEvent) => {
      onResize(e.movementX)
    }
    const up = () => setDragging(false)

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [dragging, onResize])

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      onPointerDown={onPointerDown}
      className={`group relative w-3 shrink-0 z-10 flex justify-center cursor-col-resize select-none -mx-1 ${
        dragging ? 'bg-emerald-500/20' : 'hover:bg-slate-300/30 dark:hover:bg-slate-600/30'
      }`}
    >
      <span className="w-px h-full bg-slate-300 dark:bg-slate-600 group-hover:bg-emerald-500/80 pointer-events-none" />
    </div>
  )
}
