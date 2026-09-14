import { api } from './client'

// [v3.0.6.11-104 Wave 3C] 临床反馈闭环: 临床医生对报告提异议/补充/更正 → 放射科回应 → 关闭
// 与后端 clinical-feedback.controller 对齐 (孤儿模块, seed 回退)

export type FeedbackType = 'objection' | 'supplement' | 'correction'
export type FeedbackStatus = 'SUBMITTED' | 'RESPONDED' | 'RESOLVED' | 'REJECTED'

export interface FeedbackResponse {
  content: string
  responder: string
  department?: string
  respondedAt: string
}

export interface FeedbackResolution {
  content?: string
  resolver: string
  amendId?: string
  resolvedAt: string
}

export interface ClinicalFeedback {
  id: string
  reportId: string
  patientId: string | null
  patientName?: string
  examId?: string | null
  type: FeedbackType
  content: string
  submittedBy: string
  department: string
  status: FeedbackStatus
  createdAt: string
  updatedAt: string
  response?: FeedbackResponse
  resolution?: FeedbackResolution
}

export interface CreateFeedbackInput {
  reportId: string
  patientId?: string
  patientName?: string
  examId?: string
  type: FeedbackType
  content: string
  submittedBy: string
  department: string
}

export interface RespondFeedbackInput {
  content: string
  responder: string
  department?: string
}

export interface ResolveFeedbackInput {
  content?: string
  resolver: string
  amendId?: string
}

export interface RejectFeedbackInput {
  reason: string
  resolver: string
}

export interface FeedbackListFilter {
  status?: string
  reportId?: string
  department?: string
  type?: string
  page?: number
  pageSize?: number
}

export interface FeedbackListData {
  items: ClinicalFeedback[]
  total: number
  page: number
  pageSize: number
}

export interface FeedbackMeta {
  types: Array<{ key: FeedbackType; label: string }>
  statuses: Array<{ key: FeedbackStatus; label: string }>
  transitions: Record<FeedbackStatus, FeedbackStatus[]>
}

function buildQuery(filter?: FeedbackListFilter): string {
  if (!filter) return ''
  const params = new URLSearchParams()
  if (filter.status) params.set('status', filter.status)
  if (filter.reportId) params.set('reportId', filter.reportId)
  if (filter.department) params.set('department', filter.department)
  if (filter.type) params.set('type', filter.type)
  if (filter.page) params.set('page', String(filter.page))
  if (filter.pageSize) params.set('pageSize', String(filter.pageSize))
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export const clinicalFeedbackApi = {
  create: (data: CreateFeedbackInput) => api.post<ClinicalFeedback>('/clinical-feedback', data),

  list: (filter?: FeedbackListFilter) => api.get<FeedbackListData>(`/clinical-feedback${buildQuery(filter)}`),

  get: (id: string) => api.get<ClinicalFeedback>(`/clinical-feedback/${id}`),

  respond: (id: string, data: RespondFeedbackInput) =>
    api.post<ClinicalFeedback>(`/clinical-feedback/${id}/respond`, data),

  resolve: (id: string, data: ResolveFeedbackInput) =>
    api.post<ClinicalFeedback>(`/clinical-feedback/${id}/resolve`, data),

  reject: (id: string, data: RejectFeedbackInput) =>
    api.post<ClinicalFeedback>(`/clinical-feedback/${id}/reject`, data),

  meta: () => api.get<FeedbackMeta>('/clinical-feedback/meta'),
}
