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

  getExams: (id: string) =>
    api.get<unknown[]>(`/patients/${id}/exams`),

  getReports: (id: string) =>
    api.get<unknown[]>(`/patients/${id}/reports`),

  getTimeline: (id: string) =>
    api.get<any[]>(`/patients/${id}/timeline`),

  getStats: (params?: { modality?: string }) =>
    api.get<any>(`/patients/stats?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  getByModality: (modality: string) =>
    api.get<PatientDto[]>(`/patients/by-modality/${modality}`),

  getByStatus: (status: string) =>
    api.get<PatientDto[]>(`/patients/by-status/${status}`),

  exportCsv: (params?: PatientQueryParams) =>
    api.get<{ url: string }>(`/patients/export.csv?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  bulkImport: (data: Partial<PatientDto>[]) =>
    api.post<{ imported: number }>('/patients/bulk-import', { patients: data }),
}
