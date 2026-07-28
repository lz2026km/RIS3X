import { api, invalidateApiCache } from './client'
import type { WorkflowGraph, RoutingRule, SLAPolicyConfig } from '../../types/workflow'

export interface WorkflowDefinitionDto {
  id: string
  name: string
  version: number
  description?: string
  graph?: WorkflowGraph
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface WorkflowStepDto {
  id: string
  definitionId: string
  name: string
  type: string
  assignee?: string
  slaMinutes?: number
  config?: Record<string, unknown>
  order: number
  status: 'active' | 'inactive'
}

export interface SLAPolicyDto {
  id: string
  name: string
  modality: string
  priority: string
  targetMinutes: number
  warningMinutes: number
  escalationMinutes: number
  active: boolean
  createdAt?: string
  updatedAt?: string
}

export interface RoutingRuleDto {
  id: string
  name: string
  description?: string
  priority: number
  active: boolean
  conditions: Record<string, unknown>
  event: Record<string, unknown>
  target?: Record<string, unknown>
  explanation?: string
  createdAt?: string
  updatedAt?: string
}

export const workflowApi = {
  listDefinitions: () =>
    api.get<WorkflowDefinitionDto[]>('/workflow/definitions'),

  createDefinition: async (data: Partial<WorkflowDefinitionDto>) => {
    const res = await api.post<WorkflowDefinitionDto>('/workflow/definitions', data)
    await invalidateApiCache('/workflow/definitions')
    return res
  },

  getDefinition: (id: string) =>
    api.get<WorkflowDefinitionDto>(`/workflow/definitions/${id}`),

  updateDefinition: async (id: string, data: Partial<WorkflowDefinitionDto>) => {
    const res = await api.put<WorkflowDefinitionDto>(`/workflow/definitions/${id}`, data)
    await invalidateApiCache(`/workflow/definitions/${id}`)
    await invalidateApiCache('/workflow/definitions')
    return res
  },

  deleteDefinition: async (id: string) => {
    const res = await api.delete(`/workflow/definitions/${id}`)
    await invalidateApiCache('/workflow/definitions')
    return res
  },

  activateDefinition: async (id: string, body?: Record<string, unknown>) => {
    const res = await api.post<WorkflowDefinitionDto>(
      `/workflow/definitions/${id}/activate`,
      body ?? {},
    )
    await invalidateApiCache(`/workflow/definitions/${id}`)
    await invalidateApiCache('/workflow/definitions')
    return res
  },

  listSteps: (definitionId: string) =>
    api.get<WorkflowStepDto[]>(`/workflow/definitions/${definitionId}/steps`),

  addStep: async (definitionId: string, data: Partial<WorkflowStepDto>) => {
    const res = await api.post<WorkflowStepDto>(
      `/workflow/definitions/${definitionId}/steps`,
      data,
    )
    await invalidateApiCache(`/workflow/definitions/${definitionId}/steps`)
    return res
  },

  listSlaPolicies: () =>
    api.get<SLAPolicyDto[]>('/workflow/sla-policies'),

  createSlaPolicy: async (data: Partial<SLAPolicyDto>) => {
    const res = await api.post<SLAPolicyDto>('/workflow/sla-policies', data)
    await invalidateApiCache('/workflow/sla-policies')
    return res
  },

  updateSlaPolicy: async (id: string, data: Partial<SLAPolicyDto>) => {
    const res = await api.put<SLAPolicyDto>(`/workflow/sla-policies/${id}`, data)
    await invalidateApiCache(`/workflow/sla-policies/${id}`)
    await invalidateApiCache('/workflow/sla-policies')
    return res
  },

  listRoutingRules: () =>
    api.get<RoutingRuleDto[]>('/workflow/routing-rules'),

  createRoutingRule: async (data: Partial<RoutingRuleDto>) => {
    const res = await api.post<RoutingRuleDto>('/workflow/routing-rules', data)
    await invalidateApiCache('/workflow/routing-rules')
    return res
  },

  updateRoutingRule: async (id: string, data: Partial<RoutingRuleDto>) => {
    const res = await api.put<RoutingRuleDto>(`/workflow/routing-rules/${id}`, data)
    await invalidateApiCache(`/workflow/routing-rules/${id}`)
    await invalidateApiCache('/workflow/routing-rules')
    return res
  },

  deleteRoutingRule: async (id: string) => {
    const res = await api.delete(`/workflow/routing-rules/${id}`)
    await invalidateApiCache('/workflow/routing-rules')
    return res
  },
}
