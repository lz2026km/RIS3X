import { api, invalidateApiCache, invalidateApiCacheByPrefix } from './client'
import type { ExamQueryParams } from './types'
import type { ExamDto, CreateExamDto, UpdateExamDto } from '../../types/dto'

export type { ExamDto, CreateExamDto, UpdateExamDto }

// [G005 P1] 列表双形状: MSW 裸数组 / 后端 { items, total }
export type ListPayload<T> = T[] | { items: T[]; total: number }

// [W4-A] 批量导入导出
export interface ImportExamRow {
  patientId: string
  accessionNumber: string
  modality: string
  bodyPart: string
  scheduledAt?: string
  deviceId?: string
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

// [G005 Wave4B] G-18 检查合并/拆分
export interface MergeExamsPayload {
  targetId: string
  sourceIds: string[]
}

export interface MergeExamsResult {
  targetId: string
  patientId: string
  mergedSourceCount: number
  removedSourceIds: string[]
  retainedSourceIds: string[]
  movedReports: number
  mergedAt: string
}

export interface SplitExamPayload {
  reportIds: string[]
}

export interface SplitExamResult {
  sourceExamId: string
  patientId: string
  created: { id: string; accessionNumber: string; reportCount: number }[]
  splitAt: string
}

export const examApi = {
  list: (params?: ExamQueryParams) =>
    api.get<ListPayload<ExamDto>>(`/exams?${new URLSearchParams(params as Record<string, string>).toString()}`),

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

  // [W4-A] 批量导入 (JSON 数组或 { items }, 无患者则报错列出)
  importExams: async (items: ImportExamRow[]) => {
    const res = await api.post<ImportResultDto>('/exams/import', { items })
    await invalidateApiCacheByPrefix('/exams')
    return res
  },

  // [W4-A] CSV 导出 (按 patientId/modality/state/日期筛选)
  exportExams: (params?: { patientId?: string; modality?: string; state?: string; dateFrom?: string; dateTo?: string }) => {
    const q = params
      ? `?${new URLSearchParams(params as Record<string, string>).toString()}`
      : ''
    return api.get<ExportCsvDto>(`/exams/export${q}`)
  },

  // [G005 Wave4B] G-18 检查合并: 同患者多检查 → 目标检查 (报告/影像引用迁移)
  mergeExams: async (payload: MergeExamsPayload) => {
    const res = await api.post<MergeExamsResult>('/exams/merge', payload)
    await invalidateApiCacheByPrefix('/exams')
    return res
  },

  // [G005 Wave4B] G-18 检查拆分: 按报告归属拆分
  splitExam: async (id: string, payload: SplitExamPayload) => {
    const res = await api.post<SplitExamResult>(`/exams/${encodeURIComponent(id)}/split`, payload)
    await invalidateApiCacheByPrefix('/exams')
    return res
  },
}
