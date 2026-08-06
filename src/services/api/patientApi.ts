import { api, invalidateApiCacheByPrefix } from './client'
import type { PatientQueryParams } from './types'
import type { PatientDto } from '../../types/dto'

export type { PatientDto }

// [G005 P1] 列表双形状: MSW 裸数组 / 后端 { items, total }
export type ListPayload<T> = T[] | { items: T[]; total: number }

export const patientApi = {
  list: (params?: PatientQueryParams) =>
    api.get<ListPayload<PatientDto>>(`/patients?${new URLSearchParams(params as Record<string, string>).toString()}`),

  getById: (id: string) =>
    api.get<PatientDto>(`/patients/${id}`),

  create: async (data: Partial<PatientDto>) => {
    const res = await api.post<PatientDto>('/patients', data)
    await invalidateApiCacheByPrefix('/patients')
    return res
  },

  update: async (id: string, data: Partial<PatientDto>) => {
    const res = await api.patch<PatientDto>(`/patients/${id}`, data)
    await invalidateApiCacheByPrefix('/patients')
    return res
  },

  delete: async (id: string) => {
    const res = await api.delete<null>(`/patients/${id}`)
    await invalidateApiCacheByPrefix('/patients')
    return res
  },

  getReports: (id: string) =>
    api.get<unknown[]>(`/patients/${id}/reports`),

  getExams: (id: string) =>
    api.get<unknown[]>(`/patients/${id}/exams`),

  getTimeline: (id: string) =>
    api.get<any[]>(`/patients/${id}/timeline`),
}
