import { create } from 'zustand'
import type { Collection, Request } from '../../shared/types'
import { createEmptyCollection, createRequest, parseCollectionJson, serializeCollection } from '../../shared/collection'
import { useRequestStore } from './requestStore'

interface CollectionStore {
  collections: Collection[]
  selectedRequestId: string | null
  setCollections: (collections: Collection[]) => void
  addCollection: (name?: string) => void
  removeCollection: (index: number) => void
  updateCollection: (index: number, updates: Partial<Collection>) => void
  addRequest: (collectionIndex: number, request?: Partial<Request>) => void
  updateRequest: (collectionIndex: number, requestId: string, updates: Partial<Request>) => void
  removeRequest: (collectionIndex: number, requestId: string) => void
  selectRequest: (requestId: string | null) => void
  getSelectedRequest: () => Request | null
  loadRequestIntoBuilder: (request: Request) => void
  importCollection: (json: string) => void
  exportCollection: (index: number) => string
}

export const useCollectionStore = create<CollectionStore>((set, get) => ({
  collections: [],
  selectedRequestId: null,

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
          : s.selectedRequestId
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

  selectRequest: (requestId) => set({ selectedRequestId: requestId }),

  getSelectedRequest: () => {
    const { collections, selectedRequestId } = get()
    for (const coll of collections) {
      const req = coll.requests.find((r) => r.id === selectedRequestId)
      if (req) return req
    }
    return null
  },

  loadRequestIntoBuilder: (request) => {
    useRequestStore.getState().loadRequest(request)
  },

  importCollection: (json) => {
    const coll = parseCollectionJson(json)
    set((s) => ({ collections: [...s.collections, coll] }))
  },

  exportCollection: (index) => {
    return serializeCollection(get().collections[index])
  }
}))
