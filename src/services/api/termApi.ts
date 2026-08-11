import { api } from './client'

// [v3.0.6.11-88] 后端 term-entry.controller 已实现 /terms 全 11 端点 (list/search/suggestions/synonyms/
// translations/extracted/category-tree + CRUD), 以下方法走真实 API; MSW (handlers.ts Terms 段) 仅 dev 模式兜底。

export interface TermDto {
  id: string
  term: string
  pinyin: string
  category: string
  synonyms?: string[]
  definition?: string
  typicalFindings?: string[]
  typicalDiagnosis?: string[]
  radsSystem?: string
  isFeatured?: boolean
}

export const termApi = {
  // [v3.0.6.11-88] 后端 term-entry.controller 已实现
  list: (params?: { category?: string; search?: string }) =>
    api.get<TermDto[]>(`/terms?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  // [v3.0.6.11-88] 后端 term-entry.controller 已实现
  getById: (id: string) =>
    api.get<TermDto>(`/terms/${id}`),

  // [v3.0.6.11-88] 后端 term-entry.controller 已实现
  create: (data: Partial<TermDto>) =>
    api.post<TermDto>('/terms', data),

  // [v3.0.6.11-88] 后端 term-entry.controller 已实现
  update: (id: string, data: Partial<TermDto>) =>
    api.put<TermDto>(`/terms/${id}`, data),

  // [v3.0.6.11-88] 后端 term-entry.controller 已实现
  delete: (id: string) =>
    api.delete<TermDto>(`/terms/${id}`),

  // [v3.0.6.11-88] 后端 term-entry.controller 已实现
  search: (q: string) =>
    api.get<TermDto[]>(`/terms/search?q=${encodeURIComponent(q)}`),

  // [v3.0.6.11-88] 后端 term-entry.controller 已实现
  getSuggestions: (params?: { modality?: string; search?: string }) =>
    api.get<TermSuggestionDto[]>(`/terms/suggestions?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  // [v3.0.6.11-88] 后端 term-entry.controller 已实现
  getSynonymRelations: () =>
    api.get<SynonymRelationDto[]>('/terms/synonyms'),

  // [v3.0.6.11-88] 后端 term-entry.controller 已实现
  getTranslations: (params?: { search?: string }) =>
    api.get<TranslationDto[]>(`/terms/translations?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  // [v3.0.6.11-88] 后端 term-entry.controller 已实现
  getExtractedTerms: () =>
    api.get<ExtractedTermDto[]>('/terms/extracted'),

  // [v3.0.6.11-88] 后端 term-entry.controller 已实现
  getCategoryTree: () =>
    api.get<CategoryTreeNodeDto[]>('/terms/category-tree'),
}

export interface TermSuggestionDto {
  term: string
  frequency: number
  modality: string
  category: string
  context: string
}

export interface SynonymRelationDto {
  id: string
  from: string
  to: string
  type: 'synonym' | 'broader' | 'narrower' | 'related'
  weight: number
}

export interface TranslationDto {
  termId: string
  zh: string
  en: string
  ja: string
  accuracy: number
}

export interface ExtractedTermDto {
  id: string
  term: string
  frequency: number
  source: string
  status: 'pending' | 'approved' | 'rejected'
  suggestedCategory: string
}

export interface CategoryTreeNodeDto {
  id: string
  name: string
  children: CategoryTreeNodeDto[]
  count: number
  color: string
}
