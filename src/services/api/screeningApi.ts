import { api } from './client'

export interface ScreeningStatsDto {
  ldctCount: number
  breastCount: number
  highRiskCount: number
  earlyCancerCount: number
  birads4Plus: number
  monthlyNew: number
}

export interface ScreeningQueueItemDto {
  id: string
  examId: string
  patientId: string
  patientName: string
  age: number
  gender: string
  phone?: string
  screenType: string
  screenDate: string
  status: string
  result?: string
  rads?: string
  institution?: string
  markDoctor?: string
  markedAt?: string
}

export interface ScreeningTrendDto {
  month: string
  screenings: number
  detections: number
  rate: number
}

export const screeningApi = {
  getStats: () =>
    api.get<ScreeningStatsDto>('/screening/stats'),

  listQueue: (params?: { status?: string; screenType?: string; keyword?: string }) => {
    const sp = new URLSearchParams()
    if (params?.status) sp.set('status', params.status)
    if (params?.screenType) sp.set('screenType', params.screenType)
    if (params?.keyword) sp.set('keyword', params.keyword)
    return api.get<ScreeningQueueItemDto[]>(`/screening/queue?${sp.toString()}`)
  },

  markScreening: (id: string, data: { screenType: string; doctor?: string }) =>
    api.post<ScreeningQueueItemDto>(`/screening/queue/${id}/mark`, data),

  updateStatus: (id: string, data: { status: string; result?: string }) =>
    api.post<ScreeningQueueItemDto>(`/screening/queue/${id}/status`, data),

  getTrend: () =>
    api.get<ScreeningTrendDto[]>('/screening/trend'),

  create: (data: Partial<ScreeningQueueItemDto>) =>
    api.post<ScreeningQueueItemDto>('/screening/queue', data),
}
