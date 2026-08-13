import { api, invalidateApiCache, invalidateApiCacheByPrefix } from './client'
import type { ReportQueryParams } from './types'
import type { ReportDto } from '../../types/dto'
import { getCurrentUser } from '../../utils/auth'

export type { ReportDto }

type ReportState =
  | 'PENDING_ASSIGNMENT' | 'ASSIGNED' | 'WRITING' | 'SUBMITTED'
  | 'INITIAL_REVIEW' | 'FINAL_REVIEW' | 'CO_SIGN_REVIEW' | 'REVIEWED'
  | 'SIGNING' | 'SIGNED' | 'PUBLISHED' | 'AMENDING' | 'AMENDED'
  | 'WITHDRAWN' | 'REJECTED' | 'ESCALATED' | 'ARCHIVED'
  | 'RECTIFYING' | 'SUPPLEMENTING' | 'SUPPLEMENTED' | 'REDISTRIBUTING'

async function transition(id: string, to: ReportState, reason?: string) {
  const user = getCurrentUser()
  const actorId = user?.id ?? 'unknown'
  const body: Record<string, unknown> = { to, actorId }
  if (reason) body.reason = reason
  const res = await api.post<ReportDto>(`/reports/${id}/transition`, body)
  await invalidateApiCache(`/reports/${id}`)
  await invalidateApiCacheByPrefix('/reports')
  return res
}

// [G005 P1] 列表双形状: MSW 裸数组 / 后端 { items, total }
export type ListPayload<T> = T[] | { items: T[]; total: number }

export const reportApi = {
  list: (params?: ReportQueryParams) =>
    api.get<ListPayload<ReportDto>>(`/reports?${new URLSearchParams(params as Record<string, string>).toString()}`),

  getById: (id: string) =>
    api.get<ReportDto>(`/reports/${id}`),

  // [v3.0.6.11-70] P0: 允许 conclusion/radiologistId 等后端字段 (backend CreateReportSchema/UpdateReportSchema)
  create: async (data: Partial<ReportDto> & { conclusion?: string; radiologistId?: string; state?: string }) => {
    const res = await api.post<ReportDto>('/reports', data)
    await invalidateApiCache('/reports')
    await invalidateApiCacheByPrefix('/reports')
    return res
  },

  update: async (id: string, data: Partial<ReportDto> & { conclusion?: string; radiologistId?: string; state?: string }) => {
    const res = await api.patch<ReportDto>(`/reports/${id}`, data)
    await invalidateApiCache(`/reports/${id}`)
    return res
  },

  submit: async (id: string) => transition(id, 'SUBMITTED'),

  // [v3.0.6.11-73] P0 21 态对齐: 提交审核 (WRITING/SUBMITTED → INITIAL_REVIEW)
  submitForReview: (id: string) => transition(id, 'INITIAL_REVIEW'),

  // [v3.0.6.11-92 Wave1B P0] 审核分级 transition (修复跳中间态断链):
  //   初核通过 → FINAL_REVIEW, 终核通过 → CO_SIGN_REVIEW(需双签)/REVIEWED;
  //   无 type 时 (ReviewCheckPage/ReportReviewPage 通用调用) 按报告当前状态推导下一步
  review: async (id: string, data?: { type?: 'initial' | 'final'; doctorId?: string; doctorName?: string; suggestion?: string; score?: number; needsCosign?: boolean }) => {
    if (data?.type === 'initial') return transition(id, 'FINAL_REVIEW')
    if (data?.type === 'final') return transition(id, data.needsCosign ? 'CO_SIGN_REVIEW' : 'REVIEWED')
    try {
      const cur = await api.get<ReportDto>(`/reports/${id}`)
      const state = cur.data?.state as ReportState | undefined
      if (state === 'INITIAL_REVIEW') return transition(id, 'FINAL_REVIEW')
      if (state === 'FINAL_REVIEW') return transition(id, 'CO_SIGN_REVIEW')
      if (state === 'CO_SIGN_REVIEW') return transition(id, 'REVIEWED')
      return transition(id, 'REVIEWED')
    } catch {
      return transition(id, 'REVIEWED')
    }
  },

  // [v3.0.6.11-92 Wave1B P0] 双签通过 → REVIEWED (分步链 CO_SIGN_REVIEW → REVIEWED)
  completeCosignReview: (id: string) => transition(id, 'REVIEWED'),

  // [v3.0.6.11-92 Wave1B P0] 报告特殊态入口: 补充/整改/跨院区重分配/升级
  supplement: (id: string, note?: string) => transition(id, 'SUPPLEMENTING', note),
  rectify: (id: string, reason?: string) => transition(id, 'RECTIFYING', reason),
  redistribute: (id: string, reason?: string) => transition(id, 'REDISTRIBUTING', reason),
  escalate: (id: string, reason?: string) => transition(id, 'ESCALATED', reason),

  sign: async (id: string) => transition(id, 'SIGNED'),

  reject: async (id: string, reason: string) => transition(id, 'REJECTED', reason),

  publish: async (id: string, _qualityScore?: number) => transition(id, 'PUBLISHED'),

  revise: async (id: string) => transition(id, 'AMENDING'),

  // [G005 W2-C] 行删除: 后端 DELETE /reports/:id 需 body { reason } (状态置 WITHDRAWN)
  remove: async (id: string, reason: string = '手动删除') => {
    const res = await api.delete<ReportDto>(`/reports/${id}`, { reason })
    await invalidateApiCache(`/reports/${id}`)
    await invalidateApiCacheByPrefix('/reports')
    return res
  },

  // [v3.0.6.8-45] PR1: 双签 + 版本对比 + 审计轨迹
  cosign: async (id: string, _cosignerId: string) => {
    const res = await transition(id, 'CO_SIGN_REVIEW')
    return res
  },

  diff: (id: string) =>
    api.get<{ oldVersion: Partial<ReportDto>; newVersion: Partial<ReportDto>; changes: string[] }>(`/reports/${id}/diff`),

  auditTrail: (id: string) =>
    api.get<{
      events: Array<{ id: string; timestamp: string; actor: string; action: string; fromState: string; toState: string; reason?: string }>;
    }>(`/reports/${id}/audit-trail`),

  // [v3.0.6.11-70] P0 报告导出真实化: POST /reports/:id/export (后端入队, 返回下载地址)
  exportReport: (id: string, format: string = 'pdf') =>
    api.post<{ queued: boolean; downloadUrl?: string; format?: string }>(`/reports/${id}/export`, { format }),

  // [W2-3] 导出真实化: 轮询导出任务状态
  // [v3.0.6.11-88 P0] 对齐后端派生形状 { status, exportedAt?, fileUrl? } (MSW 兼容 downloadUrl 旧字段)
  exportStatus: (id: string) =>
    api.get<{ status: string; format?: string; downloadUrl?: string; fileUrl?: string; exportedAt?: string; queuedAt?: string }>(`/reports/${id}/export-status`),

  // [v3.0.6.11-88 P0] 导出文件下载: 走 api.getBlob (带 Authorization 头, 后端 GET /reports/export-files/:fileName)
  downloadExportFile: (fileName: string) =>
    api.getBlob<Blob>(`/reports/export-files/${encodeURIComponent(fileName)}`),

  // [W4-B] 批量报告导出: 创建任务 + 轮询状态
  batchExport: (ids: string[], format: string = 'pdf') =>
    api.post<{ taskId: string; status: string; total: number; format: string }>('/reports/batch-export', { ids, format }),

  batchExportStatus: (taskId: string) =>
    // [W4-B] 轮询端点: 追加时间戳绕过 client 内存缓存, 保证每次轮询拿到最新状态
    api.get<{
      taskId: string
      status: 'pending' | 'running' | 'completed' | 'failed'
      progress: number
      total: number
      done: number
      failedCount: number
      format: string
      error?: string
      downloads: Array<{ reportId: string; fileName: string; filePath: string; sizeBytes: number; format: string; downloadUrl: string }>
      createdAt: string
      updatedAt: string
    }>(`/reports/batch-export/${taskId}?t=${Date.now()}`),
}
