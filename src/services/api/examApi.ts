import { api, invalidateApiCache, invalidateApiCacheByPrefix } from './client'
import type { ExamQueryParams } from './types'

export interface ExamDto {
  id: string
  examId: string
  patientId: string
  patientName: string
  gender: string
  age: number
  modality: string
  bodyPart: string
  status: string
  priority: string
  scheduledAt: string
  patientType: string
  deviceId?: string
  roomId?: string
  doctorId?: string
  contrastUsed?: boolean
  radiationDose?: number
  dlp?: number
  technicianId?: string
  imageCount?: number
}

export interface CreateExamDto {
  patientId: string
  accessionNumber: string
  modality: string
  bodyPart: string
  scheduledAt?: string
  deviceId?: string
}

export interface UpdateExamDto {
  state?: string
  startedAt?: string
  completedAt?: string
  deviceId?: string
}

export const examApi = {
  list: (params?: ExamQueryParams) =>
    api.get<ExamDto[]>(`/exams?${new URLSearchParams(params as Record<string, string>).toString()}`),

  getById: (id: string) =>
    api.get<ExamDto>(`/exams/${id}`),

  create: async (data: CreateExamDto) => {
    const res = await api.post<ExamDto>('/exams', data)
    await invalidateApiCache('/exams')
    await invalidateApiCacheByPrefix('/exams')
    return res
  },

  update: async (id: string, data: UpdateExamDto) => {
    const res = await api.patch<ExamDto>(`/exams/${id}`, data)
    await invalidateApiCache(`/exams/${id}`)
    await invalidateApiCacheByPrefix('/exams')
    return res
  },

  delete: async (id: string) => {
    const res = await api.delete<null>(`/exams/${id}`)
    await invalidateApiCacheByPrefix('/exams')
    return res
  },

  updateStatus: async (id: string, status: string) => {
    const res = await api.patch<ExamDto>(`/exams/${id}`, { state: status })
    await invalidateApiCache(`/exams/${id}`)
    return res
  },
}
