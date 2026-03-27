import { create } from 'zustand'
import type { Collection, Request } from '../../shared/types'
import {
  createEmptyCollection,
  createRequest,
  mergeCollectionIntoExisting,
  parseCollectionImport,
  serializeCollection
} from '../../shared/collection'
import type { CollectionImportResult } from '../../shared/collection'
import { useRequestStore } from './requestStore'

interface CollectionStore {
  collections: Collection[]
  selectedRequestId: string | null
  /** When set, the right panel shows settings for this collection index. */
  selectedCollectionSettingsIndex: number | null
  setCollections: (collections: Collection[]) => void
  addCollection: (name?: string) => void
  removeCollection: (index: number) => void
  updateCollection: (index: number, updates: Partial<Collection>) => void
  addRequest: (collectionIndex: number, request?: Partial<Request>) => void
  updateRequest: (collectionIndex: number, requestId: string, updates: Partial<Request>) => void
  removeRequest: (collectionIndex: number, requestId: string) => void
  selectRequest: (requestId: string | null) => void
  selectCollectionSettings: (collectionIndex: number | null) => void
  getSelectedRequest: () => Request | null
  getSelectedCollection: () => { collection: Collection; index: number } | null
  getCollectionVariable: (key: string) => string
  setCollectionVariable: (key: string, value: string) => void
  loadRequestIntoBuilder: (request: Request) => void
  importCollection: (json: string) => Pick<CollectionImportResult, 'warnings' | 'source'> & {
    collectionName: string
    updated: boolean
  }
  exportCollection: (index: number) => string
}

export const useCollectionStore = create<CollectionStore>((set, get) => ({
  collections: [],
  selectedRequestId: null,
  selectedCollectionSettingsIndex: null,

  setCollections: (collections) => set({ collections }),

  addCollection: (name = 'New Collection') => {
    const coll = createEmptyCollection(name)
    set((s) => ({ collections: [...s.collections, coll] }))
  },

  removeCollection: (index) => {
    set((s) => ({
      collections: s.collections.filter((_, i) => i !== index),
      selectedRequestId:
        s.collections[index]?.requests.some((r) => r.id === s.selectedRequestId)
          ? null
          : s.selectedRequestId,
      selectedCollectionSettingsIndex:
        s.selectedCollectionSettingsIndex === index
          ? null
          : s.selectedCollectionSettingsIndex !== null && s.selectedCollectionSettingsIndex > index
            ? s.selectedCollectionSettingsIndex - 1
            : s.selectedCollectionSettingsIndex
    }))
  },

  updateCollection: (index, updates) => {
    set((s) => {
      const next = [...s.collections]
      next[index] = { ...next[index], ...updates }
      return { collections: next }
    })
  },

  addRequest: (collectionIndex, requestOverrides) => {
    const req = createRequest(requestOverrides)
    set((s) => {
      const next = [...s.collections]
      next[collectionIndex] = {
        ...next[collectionIndex],
        requests: [...next[collectionIndex].requests, req]
      }
      return { collections: next, selectedRequestId: req.id }
    })
    useRequestStore.getState().loadRequest(req)
    return req
  },

  updateRequest: (collectionIndex, requestId, updates) => {
    set((s) => {
      const next = [...s.collections]
      const coll = next[collectionIndex]
      coll.requests = coll.requests.map((r) =>
        r.id === requestId ? { ...r, ...updates } : r
      )
      return { collections: next }
    })
  },

  removeRequest: (collectionIndex, requestId) => {
    set((s) => ({
      collections: s.collections.map((coll, i) =>
        i === collectionIndex
          ? { ...coll, requests: coll.requests.filter((r) => r.id !== requestId) }
          : coll
      ),
      selectedRequestId: s.selectedRequestId === requestId ? null : s.selectedRequestId
    }))
  },

  selectRequest: (requestId) =>
    set({ selectedRequestId: requestId, selectedCollectionSettingsIndex: null }),

  selectCollectionSettings: (collectionIndex) =>
    set({
      selectedCollectionSettingsIndex: collectionIndex,
      selectedRequestId: null
    }),

  getSelectedRequest: () => {
    const { collections, selectedRequestId } = get()
    for (const coll of collections) {
      const req = coll.requests.find((r) => r.id === selectedRequestId)
      if (req) return req
    }
    return null
  },

  getSelectedCollection: () => {
    const { collections, selectedRequestId } = get()
    for (let i = 0; i < collections.length; i++) {
      if (collections[i].requests.some((r) => r.id === selectedRequestId)) {
        return { collection: collections[i], index: i }
      }
    }
    return null
  },

  getCollectionVariable: (key) => {
    const sel = get().getSelectedCollection()
    const v = sel?.collection.variables.find((x) => x.key === key)
    return v?.value ?? ''
  },

  setCollectionVariable: (key, value) => {
    const sel = get().getSelectedCollection()
    if (!sel) return
    const vars = [...sel.collection.variables]
    const idx = vars.findIndex((v) => v.key === key)
    if (idx >= 0) vars[idx] = { key, value }
    else vars.push({ key, value })
    set((s) => {
      const next = [...s.collections]
      next[sel.index] = { ...next[sel.index], variables: vars }
      return { collections: next }
    })
  },

  loadRequestIntoBuilder: (request) => {
    useRequestStore.getState().loadRequest(request)
  },

  importCollection: (json) => {
    const { collection, warnings, source } = parseCollectionImport(json)
    const idx = get().collections.findIndex((c) => c.name === collection.name)
    if (idx >= 0) {
      const merged = mergeCollectionIntoExisting(get().collections[idx], collection)
      set((s) => {
        const next = [...s.collections]
        next[idx] = merged
        return { collections: next }
      })
      return { warnings, source, collectionName: collection.name, updated: true }
    }
    set((s) => ({ collections: [...s.collections, collection] }))
    return { warnings, source, collectionName: collection.name, updated: false }
  },

  exportCollection: (index) => {
    return serializeCollection(get().collections[index])
  }
}))
