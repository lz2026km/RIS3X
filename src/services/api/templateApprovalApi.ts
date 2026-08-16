/**
 * [G005 v3.0.6.11-101 Wave 6C] 模板审批流 V2 API (F7)
 * 后端: backend/src/modules/template-approval (孤儿模块 + seed 回退)
 */
import { api } from './client'

export type TemplateStateV2 = 'draft' | 'pending' | 'approved' | 'rejected' | 'published'
export type ApprovalActionV2 = 'submit' | 'approve' | 'reject' | 'publish' | 'rework'

export interface TemplateVersionV2 {
  version: number
  name: string
  content: string
  category: string
  bodyPart: string
  changedBy: string
  note: string
  at: string
}

export interface TemplateApprovalRecordV2 {
  id: string
  templateId: string
  action: ApprovalActionV2
  actorName: string
  comment?: string
  at: string
}

export interface ApproverAssignmentV2 {
  dept: string
  role: string
  approverName: string
}

export interface ReportTemplateV2 {
  id: string
  name: string
  category: string
  modality?: string
  bodyPart: string
  content: string
  state: TemplateStateV2
  version: number
  versions: TemplateVersionV2[]
  approvals: TemplateApprovalRecordV2[]
  assignee?: ApproverAssignmentV2
  favoriteCount: number
  usageCount: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface TemplateApprovalStatsV2 {
  total: number
  byState: Record<TemplateStateV2, number>
  pendingCount: number
  publishedCount: number
  totalVersions: number
  avgApprovalHours: number
  totalFavorites: number
  totalUsage: number
}

export const templateApprovalApi = {
  listTemplates: (params?: { state?: TemplateStateV2; category?: string; keyword?: string }) =>
    api.get<ReportTemplateV2[]>('/template-approval/templates' + (params ? '?' + new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined && v !== null),
      ) as Record<string, string>,
    ).toString() : '')),

  createTemplate: (data: { name: string; category?: string; modality?: string; bodyPart?: string; content: string; createdBy?: string }) =>
    api.post<ReportTemplateV2>('/template-approval/templates', data),

  getTemplate: (id: string) =>
    api.get<ReportTemplateV2>(`/template-approval/templates/${id}`),

  updateContent: (id: string, data: { name?: string; content?: string; bodyPart?: string; changedBy?: string; note?: string }) =>
    api.patch<ReportTemplateV2>(`/template-approval/templates/${id}/content`, data),

  getVersions: (id: string) =>
    api.get<TemplateVersionV2[]>(`/template-approval/templates/${id}/versions`),

  getApprovals: (id: string) =>
    api.get<TemplateApprovalRecordV2[]>(`/template-approval/templates/${id}/approvals`),

  submit: (id: string, data: { submittedBy?: string; comment?: string }) =>
    api.post<ReportTemplateV2>(`/template-approval/templates/${id}/submit`, data),

  approve: (id: string, data: { approvedBy?: string; comment?: string }) =>
    api.post<ReportTemplateV2>(`/template-approval/templates/${id}/approve`, data),

  reject: (id: string, data: { rejectedBy?: string; reason: string }) =>
    api.post<ReportTemplateV2>(`/template-approval/templates/${id}/reject`, data),

  publish: (id: string, data: { publishedBy?: string; comment?: string }) =>
    api.post<ReportTemplateV2>(`/template-approval/templates/${id}/publish`, data),

  rework: (id: string, data: { by?: string; comment?: string }) =>
    api.post<ReportTemplateV2>(`/template-approval/templates/${id}/rework`, data),

  assignApprover: (id: string, data: { dept?: string; role?: string; approverName: string }) =>
    api.post<ReportTemplateV2>(`/template-approval/templates/${id}/assign`, data),

  toggleFavorite: (id: string, userId?: string) =>
    api.post<{ favorite: boolean; favorites: string[] }>(`/template-approval/templates/${id}/favorite${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`),

  listFavorites: (userId?: string) =>
    api.get<ReportTemplateV2[]>(`/template-approval/favorites${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`),

  recordUsage: (id: string, usedBy?: string) =>
    api.post<ReportTemplateV2>(`/template-approval/templates/${id}/use${usedBy ? `?usedBy=${encodeURIComponent(usedBy)}` : ''}`),

  stats: () =>
    api.get<TemplateApprovalStatsV2>('/template-approval/stats'),
}
