import { api } from './client'

export interface SmartRouteRule {
  id: string
  name: string
  modality: string
  bodyPart: string
  patientStatus: string
  maxLoad: number
  priority: number
  enabled: boolean
}

export interface SmartRouteAssignment {
  id: string
  studyId: string
  patientName: string
  modality: string
  assignedTo: string
  ruleName: string
  assignedAt: string
}

export interface SmartRouteStats {
  total: number
  byModality: Record<string, number>
  byDoctor: Record<string, number>
}

export interface SmartRouteAssignDto {
  studyId: string
  patientName: string
  modality: string
  bodyPart: string
  patientStatus: string
}

export const smartRouteApi = {
  assign: (dto: SmartRouteAssignDto) =>
    api.post<SmartRouteAssignment>('/smart-route/assign', dto),

  getRules: () =>
    api.get<SmartRouteRule[]>('/smart-route/rules'),

  updateRules: (rules: SmartRouteRule[]) =>
    api.put<SmartRouteRule[]>('/smart-route/rules', { rules }),

  getHistory: () =>
    api.get<SmartRouteAssignment[]>('/smart-route/history'),

  getStats: () =>
    api.get<SmartRouteStats>('/smart-route/stats'),
}
