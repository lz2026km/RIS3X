import { api, invalidateApiCacheByPrefix } from './client'
import type { PatientQueryParams } from './types'
import type { PatientDto } from '../../types/dto'

export type { PatientDto }

// [G005 P1] 列表双形状: MSW 裸数组 / 后端 { items, total }
export type ListPayload<T> = T[] | { items: T[]; total: number }

// [W4-A] 批量导入导出
export interface ImportPatientRow {
  name: string
  gender?: string
  age?: number | string
  birthDate?: string
  idCard?: string
  phone?: string
  type?: string
  patientType?: string
}

export interface ImportResultDto {
  imported: number
  skipped: number
  errors: { index: number; message: string }[]
}

export interface ExportCsvDto {
  filename: string
  content: string
  count: number
}

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

  // [W2-4] 患者合并: 源患者关联 (exam/report/appointment/critical) 全部迁至目标患者后软删源患者
  merge: async (sourceId: string, targetId: string) => {
    const res = await api.post<{
      ok: boolean
      merged: {
        sourceId: string
        targetId: string
        movedExams: number
        movedReports: number
        movedAppointments: number
        movedCriticalValues: number
      }
    }>('/patients/merge', { sourceId, targetId })
    await invalidateApiCacheByPrefix('/patients')
    return res
  },

  // [W4-A] 批量导入 (JSON 数组或 { items }, 逐条创建 + 冲突跳过)
  importPatients: async (items: ImportPatientRow[]) => {
    const res = await api.post<ImportResultDto>('/patients/import', { items })
    await invalidateApiCacheByPrefix('/patients')
    return res
  },

  // [W4-A] CSV 导出 (全部或按 name/phone 筛选)
  exportPatients: (params?: { name?: string; phone?: string }) => {
    const q = params
      ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
      : ''
    return api.get<ExportCsvDto>(`/patients/export${q}`)
  },
}
