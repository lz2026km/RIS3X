import { api } from './client'

export interface SmartMwlItem {
  id: string
  patientName: string
  patientId: string
  modality: string
  bodyPart: string
  examItem: string
  priority: string
  patientType: string
  status: string
  createdTime: string
  scheduledTime?: string
  referringDoctor?: string
  deviceId?: string
  roomId?: string
  age?: number
  gender?: string
  clinicalInfo?: string
}

export interface SmartScoreFactors {
  urgencyScore: number
  waitTimeScore: number
  ageScore: number
  patientTypeScore: number
  bodyPartScore: number
  clinicalInfoScore: number
  totalScore: number
  level: 'critical' | 'urgent' | 'semi-urgent' | 'routine'
  reasons: string[]
}

export interface SmartWeightConfig {
  urgencyWeight: number
  waitTimeWeight: number
  ageWeight: number
  patientTypeWeight: number
  bodyPartWeight: number
  clinicalInfoWeight: number
}

export const smartMwlApi = {
  getWorklist: (params?: { modality?: string; status?: string; priority?: string }) =>
    api.get<SmartMwlItem[]>('/smart-mwl/worklist'),

  score: (item: SmartMwlItem) =>
    api.post<SmartScoreFactors>('/smart-mwl/score', item),

  reorder: (items: SmartMwlItem[]) =>
    api.post<Array<SmartMwlItem & { score: number; level: string; rank: number }>>('/smart-mwl/reorder', { items }),

  getWeights: () =>
    api.get<SmartWeightConfig>('/smart-mwl/weights'),

  setWeights: (weights: Partial<SmartWeightConfig>) =>
    api.put<SmartWeightConfig>('/smart-mwl/weights', weights),

  getStats: () =>
    api.get<{ total: number; byLevel: Record<string, number>; avgWaitTime: number }>('/smart-mwl/stats'),
}
