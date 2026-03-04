import { useState, useRef, useEffect } from 'react'
import { useCollectionStore } from '../../stores/collectionStore'
import type { Collection, Request } from '../../../shared/types'

export function CollectionsPanel() {
  const {
    collections,
    selectedRequestId,
    addCollection,
    removeCollection,
    updateCollection,
    addRequest,
    removeRequest,
    updateRequest,
    selectRequest,
    loadRequestIntoBuilder,
    importCollection,
    exportCollection
  } = useCollectionStore()

  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]))
  const [editing, setEditing] = useState<{
    type: 'collection' | 'request'
    collectionIndex: number
    requestId?: string
    value: string
  } | null>(null)
  const editInputRef = useRef<HTMLInputElement>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    type: 'collection' | 'request'
    collectionIndex: number
    request?: Request
  } | null>(null)

  useEffect(() => {
    if (editing) editInputRef.current?.focus()
  }, [editing])

  const handleRenameCollection = (i: number) => {
    setContextMenu(null)
    setEditing({
      type: 'collection',
      collectionIndex: i,
      value: collections[i].name
    })
  }

  const handleRenameRequest = (i: number, req: Request) => {
    setContextMenu(null)
    setEditing({
      type: 'request',
      collectionIndex: i,
      requestId: req.id,
      value: req.name
    })
  }

  const commitRename = () => {
    if (!editing) return
    const trimmed = editing.value.trim()
    if (trimmed) {
      if (editing.type === 'collection') {
        updateCollection(editing.collectionIndex, { name: trimmed })
      } else if (editing.requestId) {
        updateRequest(editing.collectionIndex, editing.requestId, { name: trimmed })
      }
    }
    setEditing(null)
  }

  const toggleExpand = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const handleSelectRequest = (req: Request) => {
    selectRequest(req.id)
    loadRequestIntoBuilder(req)
  }

  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        importCollection(text)
      } catch (err) {
        console.error(err)
      }
    }
    input.click()
  }

  const handleExport = (index: number) => {
    const json = exportCollection(index)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${collections[index].name}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex gap-2 mb-2">
        <button
          onClick={() => addCollection()}
          className="px-2 py-1 text-sm text-amber-400 hover:bg-slate-700 rounded"
        >
          New Collection
        </button>
        <button
          onClick={handleImport}
          className="px-2 py-1 text-sm text-amber-400 hover:bg-slate-700 rounded"
        >
          Import
        </button>
      </div>

      <div className="flex-1 overflow-auto space-y-1">
        {collections.map((coll, i) => (
          <div key={i} className="rounded overflow-hidden">
            <div
              className="flex items-center gap-1 py-1.5 px-2 hover:bg-slate-800 cursor-pointer group"
              onClick={() => toggleExpand(i)}
              onContextMenu={(e) => {
                e.preventDefault()
                setContextMenu({
                  x: e.clientX,
                  y: e.clientY,
                  type: 'collection',
                  collectionIndex: i
                })
              }}
            >
              <span className="text-slate-400 w-4">
                {expanded.has(i) ? '▼' : '▶'}
              </span>
              {editing?.type === 'collection' && editing.collectionIndex === i ? (
                <input
                  ref={editInputRef}
                  value={editing.value}
                  onChange={(e) => setEditing((p) => p && { ...p, value: e.target.value })}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    if (e.key === 'Escape') setEditing(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 px-1 py-0.5 text-sm bg-slate-700 border border-slate-500 rounded min-w-0"
                />
              ) : (
                <span
                  className="flex-1 text-sm truncate"
                  onDoubleClick={(e) => {
                    e.stopPropagation()
                    handleRenameCollection(i)
                  }}
                >
                  {coll.name}
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  addRequest(i)
                }}
                className="opacity-0 group-hover:opacity-100 px-1 text-amber-400 text-xs"
              >
                +
              </button>
            </div>
            {expanded.has(i) && (
              <div className="pl-4">
                {coll.requests.map((req) => (
                  <div
                    key={req.id}
                    onClick={() => handleSelectRequest(req)}
                    onContextMenu={(e) => {
                      e.preventDefault()
                      setContextMenu({
                        x: e.clientX,
                        y: e.clientY,
                        type: 'request',
                        collectionIndex: i,
                        request: req
                      })
                    }}
                    className={`py-1.5 px-2 text-sm cursor-pointer truncate flex items-center gap-2 ${
                      selectedRequestId === req.id
                        ? 'bg-slate-700 text-amber-400'
                        : 'hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <span className="font-mono text-xs text-slate-500 shrink-0">
                      {req.method}
                    </span>
                    {editing?.type === 'request' && editing.requestId === req.id ? (
                      <input
                        ref={editInputRef}
                        value={editing.value}
                        onChange={(e) => setEditing((p) => p && { ...p, value: e.target.value })}
                        onBlur={commitRename}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') commitRename()
                          if (e.key === 'Escape') setEditing(null)
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 min-w-0 px-1 py-0.5 text-sm bg-slate-700 border border-slate-500 rounded"
                      />
                    ) : (
                      <span
                        className="flex-1 truncate"
                        onDoubleClick={(e) => {
                          e.stopPropagation()
                          handleRenameRequest(i, req)
                        }}
                      >
                        {req.name}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {contextMenu && (
        <div
          className="fixed bg-slate-800 border border-slate-600 rounded shadow-lg py-1 z-50 min-w-32"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.type === 'collection' && (
            <>
              <button
                onClick={() => handleRenameCollection(contextMenu.collectionIndex)}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-700"
              >
                Rename
              </button>
              <button
                onClick={() => {
                  handleExport(contextMenu.collectionIndex)
                  setContextMenu(null)
                }}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-700"
              >
                Export
              </button>
              <button
                onClick={() => {
                  removeCollection(contextMenu.collectionIndex)
                  setContextMenu(null)
                }}
                className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-slate-700"
              >
                Delete
              </button>
            </>
          )}
          {contextMenu.type === 'request' && contextMenu.request && (
            <>
              <button
                onClick={() => handleRenameRequest(contextMenu.collectionIndex, contextMenu.request!)}
                className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-700"
              >
                Rename
              </button>
              <button
                onClick={() => {
                  removeRequest(contextMenu.collectionIndex, contextMenu.request!.id)
                  setContextMenu(null)
                }}
                className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-slate-700"
              >
                Delete Request
              </button>
            </>
          )}
        </div>
      )}

      {contextMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
