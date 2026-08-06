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

export const useWorkflowStore = create<WorkflowState>((set, _get) => ({
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
      const list = Array.isArray(res.data) ? res.data : (res.data?.items ?? [])
      if (res.success) {
        set({ definitions: list as WorkflowDefinitionDto[], loading: false, error: null })
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
      const list = Array.isArray(res.data) ? res.data : (res.data?.items ?? [])
      if (res.success) {
        set((state) => ({
          steps: { ...state.steps, [definitionId]: list as WorkflowStepDto[] },
          loading: false,
          error: null,
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
      const list = Array.isArray(res.data) ? res.data : (res.data?.items ?? [])
      if (res.success) {
        set({ slaPolicies: list as SLAPolicyDto[], loading: false, error: null })
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
      const list = Array.isArray(res.data) ? res.data : (res.data?.items ?? [])
      if (res.success) {
        set({ routingRules: list as RoutingRuleDto[], loading: false, error: null })
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
      const failure = [defRes, slaRes, ruleRes].find((response) => !response.success)
      if (failure) {
        set({ loading: false, error: failure.error?.message ?? '加载工作流配置失败' })
        return
      }
      set({
        definitions: Array.isArray(defRes.data) ? defRes.data as WorkflowDefinitionDto[] : (defRes.data?.items ?? []) as WorkflowDefinitionDto[],
        slaPolicies: Array.isArray(slaRes.data) ? slaRes.data as SLAPolicyDto[] : (slaRes.data?.items ?? []) as SLAPolicyDto[],
        routingRules: Array.isArray(ruleRes.data) ? ruleRes.data as RoutingRuleDto[] : (ruleRes.data?.items ?? []) as RoutingRuleDto[],
        loading: false,
        error: null,
      })
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : '网络错误' })
    }
  },
}))
