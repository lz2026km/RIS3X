import { api, invalidateApiCacheByPrefix } from './client'

// Tele-Sign (远程双签) API
// Backend: /tele-sign/* (backend/src/modules/tele-sign), mock: /api/v1/tele-sign/* (MSW teleSignHandlers)

export interface TeleSignSession {
  id: string
  reportId: string
  reportTitle: string
  patientName: string
  signerId: string
  signerName: string
  status: 'pending' | 'approved' | 'rejected'
  signatureData?: string
  comment?: string
  createdAt: string
  updatedAt?: string
}

export interface TeleSignQueryParams {
  status?: string
  signerId?: string
}

export interface CreateTeleSignSessionInput {
  reportId: string
  reportTitle: string
  patientName: string
  signerId: string
  signerName: string
}

export interface TeleSignDto {
  id: string
  signatureData: string
  comment?: string
}

export interface TeleSignRejectDto {
  id: string
  comment: string
}

export const teleSignApi = {
  listSessions: (params?: TeleSignQueryParams) =>
    api.get<TeleSignSession[]>(`/tele-sign/sessions?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  createSession: (data: CreateTeleSignSessionInput) =>
    api.post<TeleSignSession>('/tele-sign/session', data),

  approve: async (id: string, signatureData: string, comment?: string) => {
    const res = await api.post<TeleSignSession>('/tele-sign/approve', { id, signatureData, comment })
    await invalidateApiCacheByPrefix('/tele-sign/sessions')
    return res
  },

  reject: async (id: string, comment: string) => {
    const res = await api.post<TeleSignSession>('/tele-sign/reject', { id, comment })
    await invalidateApiCacheByPrefix('/tele-sign/sessions')
    return res
  },
}
