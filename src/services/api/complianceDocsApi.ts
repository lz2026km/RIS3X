import { api } from './client'

export interface ComplianceDocDto {
  id: string
  title: string
  category: string
  type: string
  version: string
  content?: string
  status: 'CURRENT' | 'DRAFT' | 'ARCHIVED'
  author?: string | null
  approvedBy?: string | null
  effectiveDate?: string | null
  publishedAt?: string | null
  archivedAt?: string | null
  createdAt?: string
  updatedAt: string
}

export interface ComplianceDocListParams {
  category?: string
  status?: string
  search?: string
}

// [G005 W2] 合规文档报告 (后端 GET /compliance-docs/report)
export interface ComplianceDocReport {
  generatedAt: string
  systemName: string
  complianceStandard: string
  summary: Record<string, unknown>
  checklist?: Array<{ item: string; status: string; detail: string }>
}

export interface CreateComplianceDocInput {
  title: string
  category: string
  type?: string
  version?: string
  content?: string
  status?: 'CURRENT' | 'DRAFT' | 'ARCHIVED'
  author?: string
  approvedBy?: string
  effectiveDate?: string
}

export const complianceDocsApi = {
  list: (params?: ComplianceDocListParams) => {
    const sp = new URLSearchParams()
    if (params) { Object.entries(params).forEach(([k, v]) => { if (v !== undefined) sp.set(k, String(v)) }) }
    return api.get<ComplianceDocDto[]>(`/compliance-docs?${sp.toString()}`)
  },
  getById: (id: string) => api.get<ComplianceDocDto>(`/compliance-docs/${id}`),
  // [G005 W2] 生成合规文档报告 (后端 GET /compliance-docs/report)
  getReport: () => api.get<ComplianceDocReport>('/compliance-docs/report'),
  create: (data: CreateComplianceDocInput) => api.post<ComplianceDocDto>('/compliance-docs', data),
  update: (id: string, data: Partial<CreateComplianceDocInput>) => api.put<ComplianceDocDto>(`/compliance-docs/${id}`, data),
  delete: (id: string) => api.delete(`/compliance-docs/${id}`),
  publish: (id: string) => api.post<ComplianceDocDto>(`/compliance-docs/${id}/publish`, {}),
  archive: (id: string) => api.post<ComplianceDocDto>(`/compliance-docs/${id}/archive`, {}),
}
