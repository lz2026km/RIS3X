import { api, invalidateApiCache, invalidateApiCacheByPrefix } from './client'
import type { ExamQueryParams } from './types'
import type { ExamDto, CreateExamDto, UpdateExamDto } from '../../types/dto'

export type { ExamDto, CreateExamDto, UpdateExamDto }

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

  checkIn: async (id: string) => {
    const res = await api.post<ExamDto>(`/worklist/${id}/checkin`)
    await invalidateApiCache(`/exams/${id}`)
    await invalidateApiCacheByPrefix('/exams')
    return res
  },

  start: async (id: string) => {
    const res = await api.post<ExamDto>(`/worklist/${id}/start`)
    await invalidateApiCache(`/exams/${id}`)
    await invalidateApiCacheByPrefix('/exams')
    return res
  },

  complete: async (id: string) => {
    const res = await api.post<ExamDto>(`/worklist/${id}/complete`)
    await invalidateApiCache(`/exams/${id}`)
    await invalidateApiCacheByPrefix('/exams')
    return res
  },

  cancel: async (id: string, reason?: string) => {
    const res = await api.post<ExamDto>(`/worklist/${id}/cancel`, { reason })
    await invalidateApiCache(`/exams/${id}`)
    await invalidateApiCacheByPrefix('/exams')
    return res
  },
}
