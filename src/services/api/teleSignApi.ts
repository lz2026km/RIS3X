import { api, invalidateApiCache } from './client'

// Tele Sign (远程签署) API
// Backend: /tele-sign/*

export interface TeleSignSession {
  id: string
  reportId: string
  reportTitle: string
  patientName: string
  patientId: string
  signerId: string
  signerName: string
  status: 'pending' | 'approved' | 'rejected'
  signatureData?: string
  comment?: string
  createdAt: string
  signedAt?: string
}

export interface TeleSignDto {
  signatureData: string
  comment?: string
}

export interface TeleSignRejectDto {
  reason: string
}

export interface TeleSignQueryParams {
  status?: string
  signerId?: string
  page?: number
  pageSize?: number
}

export interface TeleSignStats {
  totalSessions: number
  pendingCount: number
  approvedCount: number
  rejectedCount: number
  avgSignTimeMinutes: number
}

export const teleSignApi = {
  listSessions: (params?: TeleSignQueryParams) =>
    api.get<TeleSignSession[]>(`/tele-sign/sessions?${new URLSearchParams(params ?? {}).toString()}`),

  getSession: (id: string) =>
    api.get<TeleSignSession>(`/tele-sign/sessions/${id}`),

  approve: async (id: string, data: TeleSignDto) => {
    const res = await api.post<TeleSignSession>(`/tele-sign/sessions/${id}/approve`, data)
    await invalidateApiCache('/tele-sign/sessions')
    return res
  },

  reject: async (id: string, data: TeleSignRejectDto) => {
    const res = await api.post<TeleSignSession>(`/tele-sign/sessions/${id}/reject`, data)
    await invalidateApiCache('/tele-sign/sessions')
    return res
  },

  requestSign: async (reportId: string, signerId: string) => {
    const res = await api.post<TeleSignSession>('/tele-sign/request', { reportId, signerId })
    await invalidateApiCache('/tele-sign/sessions')
    return res
  },

  getStats: () =>
    api.get<TeleSignStats>('/tele-sign/stats'),
}
