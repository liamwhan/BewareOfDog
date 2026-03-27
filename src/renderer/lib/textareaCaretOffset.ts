/**
 * Caret pixel offset inside a textarea (relative to the textarea's border box,
 * matching where the caret is drawn). Uses a mirror element + scroll sync.
 */
export function getTextareaCaretOffset(textarea: HTMLTextAreaElement, position: number): { top: number; left: number } {
  const mirror = document.createElement('div')
  const computed = window.getComputedStyle(textarea)

  const copyProps = [
    'boxSizing',
    'width',
    'height',
    'borderTopWidth',
    'borderRightWidth',
    'borderBottomWidth',
    'borderLeftWidth',
    'borderTopStyle',
    'borderRightStyle',
    'borderBottomStyle',
    'borderLeftStyle',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'fontStyle',
    'fontVariant',
    'fontWeight',
    'fontStretch',
    'fontSize',
    'lineHeight',
    'fontFamily',
    'textAlign',
    'textTransform',
    'textIndent',
    'letterSpacing',
    'wordSpacing',
    'tabSize',
    'whiteSpace',
    'wordBreak',
    'wordWrap'
  ] as const

  for (const p of copyProps) {
    mirror.style.setProperty(p, computed.getPropertyValue(p))
  }

  mirror.style.position = 'fixed'
  mirror.style.visibility = 'hidden'
  mirror.style.whiteSpace = 'pre-wrap'
  mirror.style.wordWrap = 'break-word'
  mirror.style.overflow = 'auto'

  const taRect = textarea.getBoundingClientRect()
  mirror.style.top = `${taRect.top}px`
  mirror.style.left = `${taRect.left}px`
  mirror.style.width = `${textarea.clientWidth}px`
  mirror.style.height = `${textarea.clientHeight}px`
  mirror.scrollTop = textarea.scrollTop
  mirror.scrollLeft = textarea.scrollLeft

  const textBefore = textarea.value.slice(0, position)
  mirror.appendChild(document.createTextNode(textBefore))

  const marker = document.createElement('span')
  marker.textContent = textarea.value.slice(position) || '.'
  mirror.appendChild(marker)

  document.body.appendChild(mirror)

  const markerRect = marker.getBoundingClientRect()
  const left = markerRect.left - taRect.left
  const top = markerRect.top - taRect.top

  document.body.removeChild(mirror)

  return { top, left }
}
