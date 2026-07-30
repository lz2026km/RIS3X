import { api } from './client'

export interface ComplianceDocDto { id: string; title: string; category: string; status: 'CURRENT' | 'DRAFT' | 'ARCHIVED'; version: string; updatedAt: string; content?: string; author?: string; approvedBy?: string; effectiveDate?: string }
export interface ComplianceDocListParams { page?: number; pageSize?: number; category?: string; status?: string; search?: string }

export const complianceDocsApi = {
  list: (params?: ComplianceDocListParams) => {
    const sp = new URLSearchParams()
    if (params) { Object.entries(params).forEach(([k, v]) => { if (v !== undefined) sp.set(k, String(v)) }) }
    return api.get<ComplianceDocDto[]>(`/compliance-docs?${sp.toString()}`)
  },
  getById: (id: string) => api.get<ComplianceDocDto>(`/compliance-docs/${id}`),
  create: (data: Partial<ComplianceDocDto>) => api.post<ComplianceDocDto>('/compliance-docs', data),
  update: (id: string, data: Partial<ComplianceDocDto>) => api.put<ComplianceDocDto>(`/compliance-docs/${id}`, data),
  delete: (id: string) => api.delete(`/compliance-docs/${id}`),
  publish: (id: string) => api.post(`/compliance-docs/${id}/publish`, {}),
  archive: (id: string) => api.post(`/compliance-docs/${id}/archive`, {}),
}
