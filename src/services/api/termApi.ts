import { api } from './client'

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
  list: (params?: { category?: string; search?: string }) =>
    api.get<TermDto[]>(`/terms?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  getById: (id: string) =>
    api.get<TermDto>(`/terms/${id}`),

  create: (data: Partial<TermDto>) =>
    api.post<TermDto>('/terms', data),

  update: (id: string, data: Partial<TermDto>) =>
    api.put<TermDto>(`/terms/${id}`, data),

  delete: (id: string) =>
    api.delete<TermDto>(`/terms/${id}`),

  search: (q: string) =>
    api.get<TermDto[]>(`/terms/search?q=${encodeURIComponent(q)}`),

  getSuggestions: (params?: { modality?: string; search?: string }) =>
    api.get<TermSuggestionDto[]>(`/terms/suggestions?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  getSynonymRelations: () =>
    api.get<SynonymRelationDto[]>('/terms/synonyms'),

  getTranslations: (params?: { search?: string }) =>
    api.get<TranslationDto[]>(`/terms/translations?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  getExtractedTerms: () =>
    api.get<ExtractedTermDto[]>('/terms/extracted'),

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
