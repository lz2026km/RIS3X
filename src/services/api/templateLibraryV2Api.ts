/**
 * [G005 v3.0.6.11-101 Wave 7B F13] 模板库 V2 API
 * 后端: backend/src/modules/template-library-v2 (孤儿模块 + seed 回退)
 */
import { api } from './client'

export type TemplatePurposeV2 = 'STRUCTURED_REPORT' | 'FOLLOWUP' | 'URGENT' | 'CONTRAST' | 'PROCEDURE' | 'TECHNIQUE'
export type TemplateNodeTypeV2 = 'modality' | 'dept' | 'purpose'

export interface TemplateCategoryNodeV2 {
  key: string
  name: string
  nodeType: TemplateNodeTypeV2
  children?: TemplateCategoryNodeV2[]
}

export interface ReportTemplateLibraryItemV2 {
  id: string
  name: string
  modality: string
  dept: string
  purpose: TemplatePurposeV2
  bodyPart: string
  tags: string[]
  content: string
  isSystem: boolean
  sourceTemplateId?: string
  favoriteCount: number
  usageCount: number
  displayCount: number
  lastUsedAt?: string
  createdAt: string
  updatedAt: string
}

export interface TemplateUsageStatsV2 {
  templateId: string
  usageCount: number
  displayCount: number
  adoptionRate: number
  favoriteCount: number
  lastUsedAt?: string
  recentUsedDays: number
}

export interface TemplateRecommendationV2 {
  templateId: string
  score: number
  reason: string
  template: ReportTemplateLibraryItemV2
}

export interface TemplateSearchResultV2 {
  items: ReportTemplateLibraryItemV2[]
  total: number
}

export interface TemplateLibraryStatsV2 {
  total: number
  systemCount: number
  userCount: number
  totalUsage: number
  totalFavorites: number
  avgAdoptionRate: number
  byModality: Record<string, number>
  byDept: Record<string, number>
  byPurpose: Record<string, number>
}

export interface TemplateExportPayloadV2 {
  schemaVersion: number
  exportedAt: string
  templates: ReportTemplateLibraryItemV2[]
}

export const PURPOSE_LABEL_V2: Record<TemplatePurposeV2, string> = {
  STRUCTURED_REPORT: '常规报告',
  FOLLOWUP: '随访',
  URGENT: '危急',
  CONTRAST: '增强',
  PROCEDURE: '操作',
  TECHNIQUE: '技术',
}

export const templateLibraryV2Api = {
  getCategories: () =>
    api.get<TemplateCategoryNodeV2[]>('/template-library-v2/categories'),

  listTemplates: (params?: { modality?: string; dept?: string; purpose?: string; keyword?: string }) =>
    api.get<ReportTemplateLibraryItemV2[]>('/template-library-v2/templates' + (params ? '?' + new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined && v !== null),
      ) as Record<string, string>,
    ).toString() : '')),

  search: (params?: {
    keyword?: string
    tags?: string[]
    modality?: string
    dept?: string
    purpose?: string
    bodyPart?: string
    page?: number
    pageSize?: number
  }) => {
    const query: Record<string, string> = {}
    if (params) {
      if (params.keyword) query.keyword = params.keyword
      if (params.tags?.length) query.tags = params.tags.join(',')
      if (params.modality) query.modality = params.modality
      if (params.dept) query.dept = params.dept
      if (params.purpose) query.purpose = params.purpose
      if (params.bodyPart) query.bodyPart = params.bodyPart
      if (params.page) query.page = String(params.page)
      if (params.pageSize) query.pageSize = String(params.pageSize)
    }
    const qs = Object.keys(query).length ? '?' + new URLSearchParams(query).toString() : ''
    return api.get<TemplateSearchResultV2>(`/template-library-v2/search${qs}`)
  },

  recommend: (params?: { modality?: string; dept?: string; purpose?: string; tags?: string[]; bodyPart?: string; limit?: number }) => {
    const query: Record<string, string> = {}
    if (params) {
      if (params.modality) query.modality = params.modality
      if (params.dept) query.dept = params.dept
      if (params.purpose) query.purpose = params.purpose
      if (params.tags?.length) query.tags = params.tags.join(',')
      if (params.bodyPart) query.bodyPart = params.bodyPart
      if (params.limit) query.limit = String(params.limit)
    }
    const qs = Object.keys(query).length ? '?' + new URLSearchParams(query).toString() : ''
    return api.get<TemplateRecommendationV2[]>(`/template-library-v2/recommend${qs}`)
  },

  getTemplate: (id: string) =>
    api.get<ReportTemplateLibraryItemV2>(`/template-library-v2/templates/${id}`),

  templateStats: (id: string) =>
    api.get<TemplateUsageStatsV2>(`/template-library-v2/templates/${id}/stats`),

  recordUsage: (id: string, usedBy?: string) =>
    api.post<ReportTemplateLibraryItemV2>(`/template-library-v2/templates/${id}/use`, { usedBy }),

  toggleFavorite: (id: string, userId?: string) =>
    api.post<{ favorite: boolean; favoriteIds: string[] }>(`/template-library-v2/templates/${id}/favorite`, { userId }),

  listFavorites: (userId?: string) =>
    api.get<ReportTemplateLibraryItemV2[]>(`/template-library-v2/favorites${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`),

  usageHistory: (userId?: string) =>
    api.get<ReportTemplateLibraryItemV2[]>(`/template-library-v2/usage-history${userId ? `?userId=${encodeURIComponent(userId)}` : ''}`),

  copyTemplate: (id: string, copiedBy?: string) =>
    api.post<ReportTemplateLibraryItemV2>(`/template-library-v2/templates/${id}/copy`, { copiedBy }),

  createTemplate: (data: { name: string; modality?: string; dept?: string; purpose?: string; bodyPart?: string; tags?: string[]; content: string; createdBy?: string }) =>
    api.post<ReportTemplateLibraryItemV2>('/template-library-v2/templates', data),

  exportTemplates: (ids?: string[]) =>
    api.post<TemplateExportPayloadV2>('/template-library-v2/export', { ids }),

  exportTemplate: (id: string) =>
    api.get<TemplateExportPayloadV2>(`/template-library-v2/templates/${id}/export`),

  importTemplates: (json: string, importedBy?: string) =>
    api.post<{ imported: number; ids: string[] }>(`/template-library-v2/import${importedBy ? `?importedBy=${encodeURIComponent(importedBy)}` : ''}`, { json }),

  stats: () =>
    api.get<TemplateLibraryStatsV2>('/template-library-v2/stats'),
}
