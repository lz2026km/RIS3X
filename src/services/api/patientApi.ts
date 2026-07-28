import { api, invalidateApiCacheByPrefix } from './client'
import type { PatientQueryParams } from './types'
import type { PatientDto } from '../../types/dto'

export type { PatientDto }

export const patientApi = {
  list: (params?: PatientQueryParams) =>
    api.get<PatientDto[]>(`/patients?${new URLSearchParams(params as Record<string, string>).toString()}`),

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
