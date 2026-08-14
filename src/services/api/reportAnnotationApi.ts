/**
 * G005 RIS v3.0.6.11-99 (Wave 2A 报告批注) - reportAnnotationApi
 * 报告详情/书写页协作批注: 列表 / 创建 / 编辑 / 删除 / 回复 / 解决 / 重开 / 统计
 */
import { api } from './client'
import type { ApiResponse } from './types'

export type ReportAnnotationStatus = 'open' | 'resolved'

export interface ReportAnnotationReply {
  id: string
  annotationId: string
  authorId: string
  authorName: string
  content: string
  createdAt: string
}

export interface ReportAnnotation {
  id: string
  reportId: string
  authorId: string
  authorName: string
  content: string
  quote: string | null
  status: ReportAnnotationStatus
  createdAt: string
  updatedAt: string
  editedAt: string | null
  resolvedAt: string | null
  resolvedBy: string | null
  resolution: string | null
  replies: ReportAnnotationReply[]
}

export interface ReportAnnotationStats {
  reportId: string
  total: number
  open: number
  resolved: number
  byAuthor: Array<{ authorId: string; authorName: string; count: number; open: number }>
}

export interface CreateReportAnnotationDto {
  reportId: string
  content: string
  quote?: string
  authorName?: string
}

const unwrap = <T>(res: ApiResponse<T>): T => {
  if (res?.success && res.data !== undefined && res.data !== null) return res.data
  throw new Error(res?.error?.message ?? '接口返回异常')
}

export const reportAnnotationApi = {
  list: (reportId: string) =>
    api.get<ReportAnnotation[]>(`/report-annotations?reportId=${encodeURIComponent(reportId)}&_t=${Date.now()}`)
      .then((res) => unwrap(res)),

  stats: (reportId: string) =>
    api.get<ReportAnnotationStats>(`/report-annotations/stats?reportId=${encodeURIComponent(reportId)}&_t=${Date.now()}`)
      .then((res) => unwrap(res)),

  create: (dto: CreateReportAnnotationDto) =>
    api.post<ReportAnnotation>('/report-annotations', dto)
      .then((res) => unwrap(res)),

  update: (id: string, content: string) =>
    api.patch<ReportAnnotation>(`/report-annotations/${id}`, { content })
      .then((res) => unwrap(res)),

  remove: (id: string) =>
    api.delete(`/report-annotations/${id}`).then(() => undefined),

  reply: (id: string, content: string, authorName?: string) =>
    api.post<ReportAnnotation>(`/report-annotations/${id}/reply`, { content, authorName })
      .then((res) => unwrap(res)),

  resolve: (id: string, resolution?: string) =>
    api.post<ReportAnnotation>(`/report-annotations/${id}/resolve`, { resolution })
      .then((res) => unwrap(res)),

  reopen: (id: string) =>
    api.post<ReportAnnotation>(`/report-annotations/${id}/reopen`)
      .then((res) => unwrap(res)),
}
