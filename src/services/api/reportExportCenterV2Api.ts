/**
 * [G005 v3.0.6.11-101 Wave 7B F15] 报告导出中心 V2 API
 * 后端: backend/src/modules/report-export-center-v2 (孤儿模块 + seed 回退)
 */
import { api } from './client'

export type ExportFormatV2 = 'PDF' | 'DOCX' | 'HTML' | 'CSV' | 'DICOM_SR'
export type ExportTaskStateV2 = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELED'

export interface ReportRecordV2 {
  id: string
  title: string
  patientName: string
  patientId: string
  examType: string
  examDate: string
  department: string
  reportDoctor: string
  content: string
}

export interface ExportTaskV2 {
  id: string
  format: ExportFormatV2
  reportIds: string[]
  state: ExportTaskStateV2
  progress: number
  fileName?: string
  content?: string
  fileSize?: number
  mimeType?: string
  error?: string
  requestedBy: string
  requestedByRole: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface ExportTaskSummaryV2 {
  id: string
  format: ExportFormatV2
  reportIds: string[]
  reportCount: number
  state: ExportTaskStateV2
  progress: number
  fileName?: string
  fileSize?: number
  requestedBy: string
  requestedByRole: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  error?: string
}

export interface ExportDownloadV2 {
  taskId: string
  format: ExportFormatV2
  fileName: string
  mimeType: string
  content: string
  fileSize: number
  exportedAt: string
}

export interface ExportCenterStatsV2 {
  total: number
  completed: number
  active: number
  canceled: number
  byFormat: Record<string, number>
  totalExportedBytes: number
  totalReportsExported: number
}

export const FORMAT_OPTIONS_V2: { value: ExportFormatV2; label: string; desc: string }[] = [
  { value: 'PDF', label: 'PDF', desc: '概念导出 (占位文本)' },
  { value: 'DOCX', label: 'DOCX', desc: '概念导出 (Word 占位)' },
  { value: 'HTML', label: 'HTML', desc: '完整排版文档' },
  { value: 'CSV', label: 'CSV', desc: '表格数据' },
  { value: 'DICOM_SR', label: 'DICOM SR', desc: '结构化报告 (概念)' },
]

export const reportExportCenterV2Api = {
  listReports: (params?: { examType?: string; keyword?: string }) =>
    api.get<ReportRecordV2[]>('/report-export-center-v2/reports' + (params ? '?' + new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined && v !== null),
      ) as Record<string, string>,
    ).toString() : '')),

  createTask: (data: { format: ExportFormatV2; reportIds: string[]; requestedBy?: string; requestedByRole?: string }) =>
    api.post<ExportTaskV2>('/report-export-center-v2/tasks', data),

  listTasks: (params?: { state?: ExportTaskStateV2; page?: number; pageSize?: number }) =>
    api.get<{ items: ExportTaskSummaryV2[]; total: number; page: number; pageSize: number }>('/report-export-center-v2/tasks' + (params ? '?' + new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined && v !== null),
      ) as Record<string, string>,
    ).toString() : '')),

  getTask: (id: string) =>
    api.get<ExportTaskV2>(`/report-export-center-v2/tasks/${id}`),

  processTask: (id: string) =>
    api.post<ExportTaskV2>(`/report-export-center-v2/tasks/${id}/process`),

  cancelTask: (id: string) =>
    api.post<ExportTaskV2>(`/report-export-center-v2/tasks/${id}/cancel`),

  download: (id: string) =>
    api.post<ExportDownloadV2>(`/report-export-center-v2/tasks/${id}/download`),

  batchExport: (data: { format: ExportFormatV2; reportIds: string[]; requestedBy?: string; requestedByRole?: string }) =>
    api.post<ExportTaskV2>('/report-export-center-v2/batch', data),

  history: () =>
    api.get<ExportTaskSummaryV2[]>('/report-export-center-v2/history'),

  stats: () =>
    api.get<ExportCenterStatsV2>('/report-export-center-v2/stats'),
}
