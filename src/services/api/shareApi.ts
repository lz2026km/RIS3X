import { api, invalidateApiCacheByPrefix } from './client'

// DICOM 跨科室共享 API
// Backend: /dicom-share/*

export interface ShareRecord {
  id: string
  studyId: string
  patientName: string
  fromDept: string
  toDept: string
  status: 'sent' | 'received' | 'pending' | 'expired' | 'failed'
  protocol: 'dicom-tls' | 'wado'
  password: string
  expiresAt: string
  sizeMb: number
  url?: string
  createdAt: string
}

export interface CreateShareDto {
  studyId: string
  patientName?: string
  toDept: string
  protocol: 'dicom-tls' | 'wado'
  password?: string
  expiresAt?: string
  sizeMb?: number
}

export interface ShareStats {
  total: number
  todayCount: number
  pendingCount: number
  receivedCount: number
  totalSizeMb: number
}

export interface ShareLinkResult {
  id: string
  url: string
  password: string
}

export const shareApi = {
  list: () => api.get<ShareRecord[]>('/dicom-share/shares'),

  get: (id: string) => api.get<ShareRecord>(`/dicom-share/shares/${id}`),

  create: async (data: CreateShareDto) => {
    const res = await api.post<ShareRecord>('/dicom-share/shares', data)
    await invalidateApiCacheByPrefix('/dicom-share')
    return res
  },

  remove: async (id: string) => {
    const res = await api.delete<{ id: string; deleted: boolean }>(`/dicom-share/shares/${id}`)
    await invalidateApiCacheByPrefix('/dicom-share')
    return res
  },

  copyLink: (id: string) => api.post<ShareLinkResult>(`/dicom-share/shares/${id}/copy-link`, {}),

  getStats: () => api.get<ShareStats>('/dicom-share/stats'),
}

export default shareApi
