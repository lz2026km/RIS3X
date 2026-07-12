import { api } from './client'

export interface TemplateDto {
  id: string
  name: string
  category: string
  bodyPart: string
  body: string
  parentId?: string
  radsCategory?: string
  tags?: string[]
  createdById: string
  createdAt?: string
  updatedAt?: string
}

export interface TemplateListParams {
  category?: string
  bodyPart?: string
  keyword?: string
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
}
