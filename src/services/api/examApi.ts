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

  updateStatus: async (id: string, status: string) => {
    const res = await api.patch<ExamDto>(`/exams/${id}`, { state: status })
    await invalidateApiCache(`/exams/${id}`)
    return res
  },
}
