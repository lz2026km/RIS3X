import { api, invalidateApiCache } from './client'

// Remote Reading (远程阅片) API
// Backend: /remote-reading/*

export interface RemoteReadingSession {
  id: string
  studyId: string
  patientName: string
  patientId: string
  modality: string
  referringDoctor: string
  readingDoctor: string
  readingDoctorDept: string
  status: 'pending' | 'in_progress' | 'completed' | 'returned'
  priority: 'routine' | 'urgent' | 'stat'
  requestedAt: string
  startedAt?: string
  completedAt?: string
  report?: string
  comment?: string
}

export interface CreateRemoteReadingDto {
  studyId: string
  readingDoctorId: string
  priority: 'routine' | 'urgent' | 'stat'
  comment?: string
}

export interface RemoteReadingQueryParams {
  status?: string
  priority?: string
  readingDoctorId?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}

export interface RemoteReadingStats {
  totalSessions: number
  pendingCount: number
  completedCount: number
  avgCompletionHours: number
  priorityDistribution: { priority: string; count: number }[]
  doctorWorkload: { doctorName: string; count: number }[]
}

export const remoteReadingApi = {
  listSessions: (params?: RemoteReadingQueryParams) =>
    api.get<RemoteReadingSession[]>(`/remote-reading/sessions?${new URLSearchParams(params ?? {}).toString()}`),

  getSession: (id: string) =>
    api.get<RemoteReadingSession>(`/remote-reading/sessions/${id}`),

  createSession: async (data: CreateRemoteReadingDto) => {
    const res = await api.post<RemoteReadingSession>('/remote-reading/sessions', data)
    await invalidateApiCache('/remote-reading/sessions')
    return res
  },

  startReading: async (id: string) => {
    const res = await api.post<RemoteReadingSession>(`/remote-reading/sessions/${id}/start`, {})
    await invalidateApiCache('/remote-reading/sessions')
    return res
  },

  completeReading: async (id: string, report: string) => {
    const res = await api.post<RemoteReadingSession>(`/remote-reading/sessions/${id}/complete`, { report })
    await invalidateApiCache('/remote-reading/sessions')
    return res
  },

  returnReading: async (id: string, reason: string) => {
    const res = await api.post<RemoteReadingSession>(`/remote-reading/sessions/${id}/return`, { reason })
    await invalidateApiCache('/remote-reading/sessions')
    return res
  },

  getStats: () =>
    api.get<RemoteReadingStats>('/remote-reading/stats'),
}
