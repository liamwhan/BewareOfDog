import { create } from 'zustand'
import type { Environment, Variable } from '../../shared/types'
import { createEnvironment, parseEnvironmentJson, serializeEnvironment } from '../../shared/environment'

interface EnvironmentStore {
  environments: Environment[]
  activeEnvironmentId: string | null
  setEnvironments: (envs: Environment[]) => void
  addEnvironment: (name?: string) => void
  removeEnvironment: (id: string) => void
  updateEnvironment: (id: string, updates: Partial<Environment>) => void
  setActiveEnvironment: (id: string | null) => void
  getActiveEnvironment: () => Environment | null
  getVariables: () => Variable[]
  getEnvironmentVariable: (key: string) => string
  setEnvironmentVariable: (key: string, value: string) => void
  importEnvironment: (json: string) => void
  exportEnvironment: (id: string) => string
}

export const useEnvironmentStore = create<EnvironmentStore>((set, get) => ({
  environments: [],
  activeEnvironmentId: null,

  setEnvironments: (environments) => set({ environments }),

  addEnvironment: (name = 'New Environment') => {
    const env = createEnvironment(name)
    set((s) => ({
      environments: [...s.environments, env],
      activeEnvironmentId: env.id
    }))
  },

  removeEnvironment: (id) => {
    set((s) => ({
      environments: s.environments.filter((e) => e.id !== id),
      activeEnvironmentId: s.activeEnvironmentId === id ? null : s.activeEnvironmentId
    }))
  },

  updateEnvironment: (id, updates) => {
    set((s) => ({
      environments: s.environments.map((e) =>
        e.id === id ? { ...e, ...updates } : e
      )
    }))
  },

  setActiveEnvironment: (activeEnvironmentId) => set({ activeEnvironmentId }),

  getActiveEnvironment: () => {
    const { environments, activeEnvironmentId } = get()
    return environments.find((e) => e.id === activeEnvironmentId) ?? null
  },

  getVariables: () => {
    const env = get().getActiveEnvironment()
    return env?.variables ?? []
  },

  getEnvironmentVariable: (key) => {
    const env = get().getActiveEnvironment()
    const v = env?.variables.find((x) => x.key === key)
    return v?.value ?? ''
  },

  setEnvironmentVariable: (key, value) => {
    const env = get().getActiveEnvironment()
    if (!env) return
    const vars = [...env.variables]
    const idx = vars.findIndex((v) => v.key === key)
    if (idx >= 0) vars[idx] = { key, value }
    else vars.push({ key, value })
    set((s) => ({
      environments: s.environments.map((e) =>
        e.id === env.id ? { ...e, variables: vars } : e
      )
    }))
  },

  importEnvironment: (json) => {
    const env = parseEnvironmentJson(json)
    set((s) => ({
      environments: [...s.environments, env],
      activeEnvironmentId: env.id
    }))
  },

  exportEnvironment: (id) => {
    const env = get().environments.find((e) => e.id === id)
    return env ? serializeEnvironment(env) : ''
  }
}))
