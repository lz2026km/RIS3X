import { api } from './client'

export interface CoSignItem {
  id: string
  reportId: string
  patientName: string
  modality: string
  bodyPart: string
  priority: string
  submittedAt: string
  authorId: string
  authorName: string
  status: string
  waitingHours: number
}

export interface CoSignStats {
  total: number
  pending: number
  approved: number
  rejected: number
  avgResponseMinutes: number
  onTimeRate: number
}

export const coSignApi = {
  getPending: () =>
    api.get<CoSignItem[]>('/cosign/pending'),

  approve: (id: string, data: { note?: string }) =>
    api.post<{ success: boolean }>(`/cosign/pending/${id}/approve`, data),

  reject: (id: string, data: { reason: string }) =>
    api.post<{ success: boolean }>(`/cosign/pending/${id}/reject`, data),

  getHistory: () =>
    api.get<CoSignItem[]>('/cosign/history'),

  getStats: () =>
    api.get<CoSignStats>('/cosign/stats'),

  getRules: () =>
    api.get<Array<{ id: string; name: string; condition: string; action: string; enabled: boolean }>>('/cosign/rules'),
}
