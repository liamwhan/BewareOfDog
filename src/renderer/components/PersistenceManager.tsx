import { useEffect, useRef } from 'react'
import { loadWorkspace, saveWorkspace } from '../lib/persistence'
import { useCollectionStore } from '../stores/collectionStore'
import { useEnvironmentStore } from '../stores/environmentStore'

const SAVE_DEBOUNCE_MS = 500

export function PersistenceManager() {
  const initialized = useRef(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false

    async function init() {
      const data = await loadWorkspace()
      if (cancelled) return
      if (data) {
        useCollectionStore.getState().setCollections(data.collections)
        useCollectionStore.getState().selectRequest(data.selectedRequestId)
        useEnvironmentStore.getState().setEnvironments(data.environments)
        useEnvironmentStore.getState().setActiveEnvironment(data.activeEnvironmentId)
        if (data.selectedRequestId) {
          const req = data.collections
            .flatMap((c) => c.requests)
            .find((r) => r.id === data.selectedRequestId)
          if (req) useCollectionStore.getState().loadRequestIntoBuilder(req)
        }
      }
      initialized.current = true
    }

    init()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function scheduleSave() {
      if (!initialized.current) return
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
      saveTimeout.current = setTimeout(() => {
        saveTimeout.current = null
        const collState = useCollectionStore.getState()
        const envState = useEnvironmentStore.getState()
        saveWorkspace({
          collections: collState.collections,
          environments: envState.environments,
          activeEnvironmentId: envState.activeEnvironmentId,
          selectedRequestId: collState.selectedRequestId
        })
      }, SAVE_DEBOUNCE_MS)
    }

    const unsubColl = useCollectionStore.subscribe(scheduleSave)
    const unsubEnv = useEnvironmentStore.subscribe(scheduleSave)

    return () => {
      unsubColl()
      unsubEnv()
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
    }
  }, [])

  return null
}
