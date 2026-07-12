import { create } from 'zustand'
import { workflowApi } from '../services/api/workflowApi'
import type { WorkflowDefinitionDto, WorkflowStepDto, SLAPolicyDto, RoutingRuleDto } from '../services/api/workflowApi'

interface WorkflowState {
  definitions: WorkflowDefinitionDto[]
  steps: Record<string, WorkflowStepDto[]>
  slaPolicies: SLAPolicyDto[]
  routingRules: RoutingRuleDto[]
  loading: boolean
  error: string | null

  loadDefinitions: () => Promise<void>
  loadSteps: (definitionId: string) => Promise<void>
  loadSlaPolicies: () => Promise<void>
  loadRoutingRules: () => Promise<void>
  loadAll: () => Promise<void>
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  definitions: [],
  steps: {},
  slaPolicies: [],
  routingRules: [],
  loading: false,
  error: null,

  loadDefinitions: async () => {
    set({ loading: true, error: null })
    try {
      const res = await workflowApi.listDefinitions()
      if (res.success && Array.isArray(res.data)) {
        set({ definitions: res.data as WorkflowDefinitionDto[], loading: false })
      } else {
        set({ loading: false, error: res.error?.message ?? '加载失败' })
      }
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : '网络错误' })
    }
  },

  loadSteps: async (definitionId: string) => {
    set({ loading: true, error: null })
    try {
      const res = await workflowApi.listSteps(definitionId)
      if (res.success && Array.isArray(res.data)) {
        set((state) => ({
          steps: { ...state.steps, [definitionId]: res.data as WorkflowStepDto[] },
          loading: false,
        }))
      } else {
        set({ loading: false, error: res.error?.message ?? '加载失败' })
      }
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : '网络错误' })
    }
  },

  loadSlaPolicies: async () => {
    set({ loading: true, error: null })
    try {
      const res = await workflowApi.listSlaPolicies()
      if (res.success && Array.isArray(res.data)) {
        set({ slaPolicies: res.data as SLAPolicyDto[], loading: false })
      } else {
        set({ loading: false, error: res.error?.message ?? '加载失败' })
      }
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : '网络错误' })
    }
  },

  loadRoutingRules: async () => {
    set({ loading: true, error: null })
    try {
      const res = await workflowApi.listRoutingRules()
      if (res.success && Array.isArray(res.data)) {
        set({ routingRules: res.data as RoutingRuleDto[], loading: false })
      } else {
        set({ loading: false, error: res.error?.message ?? '加载失败' })
      }
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : '网络错误' })
    }
  },

  loadAll: async () => {
    set({ loading: true, error: null })
    try {
      const [defRes, slaRes, ruleRes] = await Promise.all([
        workflowApi.listDefinitions(),
        workflowApi.listSlaPolicies(),
        workflowApi.listRoutingRules(),
      ])
      set({
        definitions: (defRes.success && Array.isArray(defRes.data)) ? defRes.data as WorkflowDefinitionDto[] : [],
        slaPolicies: (slaRes.success && Array.isArray(slaRes.data)) ? slaRes.data as SLAPolicyDto[] : [],
        routingRules: (ruleRes.success && Array.isArray(ruleRes.data)) ? ruleRes.data as RoutingRuleDto[] : [],
        loading: false,
        error: null,
      })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : '网络错误' })
    }
  },
}))
