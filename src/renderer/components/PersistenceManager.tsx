import { useEffect, useRef, useState, useCallback } from 'react'
import type { LastSuccessfulResponseSnapshot, WorkspaceData } from '../../shared/workspace'
import { loadWorkspace, registerLastSuccessfulResponseSink, saveWorkspace } from '../lib/persistence'
import { useCollectionStore } from '../stores/collectionStore'
import { useEnvironmentStore } from '../stores/environmentStore'
import { useRequestStore } from '../stores/requestStore'

const SAVE_DEBOUNCE_MS = 500

function applyWorkspaceToStores(
  data: WorkspaceData,
  lastSuccessfulRef: { current: LastSuccessfulResponseSnapshot | null }
) {
  useRequestStore.getState().prepareWorkspaceHydration()

  useCollectionStore.getState().setCollections(data.collections)
  useCollectionStore.getState().selectRequest(data.selectedRequestId)
  useEnvironmentStore.getState().setEnvironments(data.environments)
  useEnvironmentStore.getState().setActiveEnvironment(data.activeEnvironmentId)

  lastSuccessfulRef.current = data.lastSuccessfulResponse ?? null

  const snap = data.lastSuccessfulResponse
  if (snap) {
    useRequestStore.getState().seedResponseForRequest(snap.requestId, {
      status: snap.status,
      statusText: snap.statusText,
      headers: snap.headers,
      body: snap.body,
      duration: snap.duration
    })
  }

  if (data.selectedRequestId) {
    const req = data.collections.flatMap((c) => c.requests).find((r) => r.id === data.selectedRequestId)
    if (req) useCollectionStore.getState().loadRequestIntoBuilder(req)
  }
}

export function PersistenceManager() {
  const initialized = useRef(false)
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const versionTokenRef = useRef<string | null>(null)
  const lastSuccessfulResponseRef = useRef<LastSuccessfulResponseSnapshot | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saveConflict, setSaveConflict] = useState(false)
  const [lastSaveError, setLastSaveError] = useState<string | null>(null)

  const pullRemote = useCallback(async () => {
    setLoadError(null)
    setSaveConflict(false)
    const outcome = await loadWorkspace()
    if (outcome.error) {
      setLoadError(outcome.error)
      return
    }
    versionTokenRef.current = outcome.versionToken
    if (outcome.data) {
      applyWorkspaceToStores(outcome.data, lastSuccessfulResponseRef)
    }
  }, [])

  useEffect(() => {
    function onPullRequest() {
      void pullRemote()
    }
    window.addEventListener('bewareofdog:workspace-pull', onPullRequest)
    return () => window.removeEventListener('bewareofdog:workspace-pull', onPullRequest)
  }, [pullRemote])

  useEffect(() => {
    registerLastSuccessfulResponseSink((snap) => {
      lastSuccessfulResponseRef.current = snap
    })
    return () => registerLastSuccessfulResponseSink(null)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function init() {
      const outcome = await loadWorkspace()
      if (cancelled) return
      if (outcome.error) {
        setLoadError(outcome.error)
      }
      versionTokenRef.current = outcome.versionToken
      if (outcome.data) {
        applyWorkspaceToStores(outcome.data, lastSuccessfulResponseRef)
      }
      initialized.current = true
    }

    void init()
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
        void (async () => {
          const res = await saveWorkspace(
            {
              collections: collState.collections,
              environments: envState.environments,
              activeEnvironmentId: envState.activeEnvironmentId,
              selectedRequestId: collState.selectedRequestId,
              lastSuccessfulResponse: lastSuccessfulResponseRef.current
            },
            { ifVersionMatch: versionTokenRef.current }
          )
          if (res.ok) {
            setSaveConflict(false)
            setLastSaveError(null)
            if (res.versionToken != null) {
              versionTokenRef.current = res.versionToken
            }
          } else {
            if (res.conflict) {
              setSaveConflict(true)
            }
            if (res.error) {
              setLastSaveError(res.error)
            }
          }
        })()
      }, SAVE_DEBOUNCE_MS)
    }

    const unsubColl = useCollectionStore.subscribe(scheduleSave)
    const unsubEnv = useEnvironmentStore.subscribe(scheduleSave)

    const unsubReq = useRequestStore.subscribe((state, prev) => {
      if (state.response === prev.response && state.responseByRequestId === prev.responseByRequestId) return
      scheduleSave()
    })

    return () => {
      unsubColl()
      unsubEnv()
      unsubReq()
      if (saveTimeout.current) clearTimeout(saveTimeout.current)
    }
  }, [])

  if (!loadError && !saveConflict && !lastSaveError) return null

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50 max-w-lg w-[90vw] text-sm rounded-lg border shadow-lg px-4 py-2 bg-emerald-50 dark:bg-emerald-950/90 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-100">
      {loadError && <p className="mb-1">Workspace load: {loadError}</p>}
      {saveConflict && (
        <p className="mb-1">
          Remote workspace changed and your save was skipped to avoid overwriting. Use Workspace sync → Pull from remote
          (or the header action) to refresh, then edit again.
        </p>
      )}
      {lastSaveError && !saveConflict && <p>Save error: {lastSaveError}</p>}
      <div className="flex gap-2 mt-2 justify-end">
        <button
          type="button"
          className="px-2 py-1 rounded bg-emerald-200 dark:bg-emerald-800 hover:opacity-90"
          onClick={() => {
            setLoadError(null)
            setLastSaveError(null)
            void pullRemote()
          }}
        >
          Pull / retry
        </button>
        <button
          type="button"
          className="px-2 py-1 rounded border border-emerald-300 dark:border-emerald-700"
          onClick={() => {
            setLoadError(null)
            setSaveConflict(false)
            setLastSaveError(null)
          }}
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
