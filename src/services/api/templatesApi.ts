import { api } from './client'

// [G005 Wave1B P1] 模板 API — snippets 端点后端已实现 (templates.controller,
// ReportTemplate 派生 + 内存 CRUD), MSW 标注已更新。
// [v3.0.6.11-98 Wave2A P1] 模板审批流 (status/approvedBy/approvedAt/rejectReason) + 个人模板库 (personal/userId)
export type TemplateApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected'

// [v3.0.6.11-100 Wave2C P2] 模板类型: FULL=全文模板 / SECTION=段落模板 / PHRASE=短语模板 (默认 SECTION)
export type TemplateType = 'FULL' | 'SECTION' | 'PHRASE'

export interface TemplateDto {
  id: string
  name: string
  category: string
  bodyPart: string
  body: string
  // [v3.0.6.11-99 Wave2B P1] 结构化段落块 (模板设计器可视化保存, 可选)
  structure?: TemplateStructure
  modality?: string
  // [v3.0.6.11-100 Wave2C P2] 模板类型 (模板库分类展示/段落树生成引擎区分)
  templateType?: TemplateType
  shared?: boolean
  parentId?: string
  radsCategory?: string
  tags?: string[]
  createdById: string
  status?: TemplateApprovalStatus
  approvedBy?: string
  approvedAt?: string
  rejectReason?: string
  createdAt?: string
  updatedAt?: string
}

export interface TemplateListParams {
  category?: string
  bodyPart?: string
  keyword?: string
  status?: TemplateApprovalStatus
  personal?: boolean
  userId?: string
  templateType?: TemplateType
}

// [v3.0.6.11-96 Wave3B P1] 模板分类 (GET/POST/PATCH/DELETE /templates/categories, 后端内存+seed)
export interface TemplateCategoryDto {
  id: string
  name: string
  description?: string
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

// [v3.0.6.11-99 Wave2B (模板设计器 P1)] 结构化段落块
// type: text=文本段落 / variable=变量占位 {{key}} / field=结构化字段占位 {{field:KEY}} / structured=RADS 等结构段
export type TemplateBlockType = 'text' | 'field' | 'variable' | 'structured'

export interface TemplateBlock {
  type: TemplateBlockType
  content: string
  fieldKey?: string
  variable?: string
}

export type TemplateStructure = TemplateBlock[]

export interface TemplateStructureDto {
  structure: TemplateStructure | null
  body: string
}

export const templatesApi = {
  list: (params?: TemplateListParams) =>
    api.get<TemplateDto[]>('/templates' + (params ? '?' + new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([_, v]) => v != null)) as Record<string, string>
    ).toString() : '')),

  getById: (id: string) =>
    api.get<TemplateDto>(`/templates/${id}`),

  create: (data: Omit<TemplateDto, 'id' | 'createdAt' | 'updatedAt'>) =>
    api.post<TemplateDto>('/templates', data),

  update: (id: string, data: Partial<Omit<TemplateDto, 'id' | 'createdById' | 'createdAt' | 'updatedAt'>>) =>
    api.patch<TemplateDto>(`/templates/${id}`, data),

  delete: (id: string) =>
    api.delete<void>(`/templates/${id}`),

  clone: (id: string) =>
    api.post<TemplateDto>(`/templates/${id}/clone`),

  // [v3.0.6.11-99 Wave2B P1] 模板结构化内容 (模板设计器段落块) — GET/PATCH /templates/:id/structure
  getStructure: (id: string) =>
    api.get<TemplateStructureDto>(`/templates/${id}/structure`),

  saveStructure: (id: string, structure: TemplateStructure, body?: string) =>
    api.patch<TemplateStructureDto>(`/templates/${id}/structure`, { structure, body }),

  // [v3.0.6.11-98 Wave2A P1] 模板审批流
  submit: (id: string) =>
    api.post<TemplateDto>(`/templates/${id}/submit`),

  approve: (id: string, approvedBy: string) =>
    api.post<TemplateDto>(`/templates/${id}/approve`, { approvedBy }),

  reject: (id: string, reason: string) =>
    api.post<TemplateDto>(`/templates/${id}/reject`, { reason }),

  // [W3-2] 智能片段 (ReportTemplateManagerPage)
  listSnippets: (params?: { category?: string }) =>
    api.get<any[]>('/templates/snippets' + (params?.category ? `?category=${encodeURIComponent(params.category)}` : '')),

  createSnippet: (data: { name: string; content: string; category: string; shortcuts?: string }) =>
    api.post<any>('/templates/snippets', data),

  deleteSnippet: (id: string) =>
    api.delete<void>(`/templates/snippets/${id}`),

  // [v3.0.6.11-96 Wave3B P1] 模板分类 CRUD (TemplateCategoryPage 树渲染/管理)
  listCategories: () =>
    api.get<TemplateCategoryDto[]>('/templates/categories'),

  // [v3.0.6.11-98 Wave2B P1] 模板收藏服务端化 (后端内存+seed, 按用户) — 失败回退 localStorage
  listFavorites: () =>
    api.get<{ ids: string[]; templates: TemplateDto[] }>('/templates/favorites'),

  toggleFavorite: (id: string) =>
    api.post<{ favorite: boolean; ids: string[] }>(`/templates/${id}/favorite`),

  createCategory: (data: { name: string; description?: string; sortOrder?: number }) =>
    api.post<TemplateCategoryDto>('/templates/categories', data),

  updateCategory: (id: string, data: Partial<{ name: string; description?: string; sortOrder?: number }>) =>
    api.patch<TemplateCategoryDto>(`/templates/categories/${id}`, data),

  deleteCategory: (id: string) =>
    api.delete<{ ok: boolean; id: string }>(`/templates/categories/${id}`),
}
