import { api } from './client'

export interface RoutingRule {
  id: string
  name: string
  modality: string
  bodyPart: string
  patientStatus: string
  priority: number
  maxLoad: number
  active: boolean
}

export interface RoutingAssignment {
  id: string
  studyId: string
  patientName: string
  modality: string
  assignedTo: string
  ruleName: string
  assignedAt: string
  status: string
}

export const smartRoutingApi = {
  getRules: () =>
    api.get<RoutingRule[]>('/smart-routing/rules'),

  createRule: (data: Omit<RoutingRule, 'id'>) =>
    api.post<RoutingRule>('/smart-routing/rules', data),

  updateRule: (id: string, data: Partial<RoutingRule>) =>
    api.put<RoutingRule>(`/smart-routing/rules/${id}`, data),

  deleteRule: (id: string) =>
    api.delete(`/smart-routing/rules/${id}`),

  toggleRule: (id: string, active: boolean) =>
    api.patch<RoutingRule>(`/smart-routing/rules/${id}/toggle`, { active }),

  routeStudy: (studyId: string) =>
    api.post<RoutingAssignment>('/smart-routing/route', { studyId }),

  getAssignments: (_params?: { modality?: string; status?: string }) =>
    api.get<RoutingAssignment[]>('/smart-routing/assignments'),

  getStats: () =>
    api.get<{ totalAssignments: number; byModality: Record<string, number>; byDoctor: Record<string, number>; avgResponseTime: number; acceptanceRate: number }>('/smart-routing/stats'),
}
