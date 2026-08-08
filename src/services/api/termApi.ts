import { api } from './client'

// [G005 W1-C] MOCK_ONLY: 后端无 /terms controller,
// 全部 11 方法由 MSW (src/services/mockBackend/handlers.ts Terms 段) 支撑演示数据, 后端待实现。

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
  // MOCK_ONLY (后端无 controller, MSW 支撑)
  list: (params?: { category?: string; search?: string }) =>
    api.get<TermDto[]>(`/terms?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  getById: (id: string) =>
    api.get<TermDto>(`/terms/${id}`),

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  create: (data: Partial<TermDto>) =>
    api.post<TermDto>('/terms', data),

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  update: (id: string, data: Partial<TermDto>) =>
    api.put<TermDto>(`/terms/${id}`, data),

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  delete: (id: string) =>
    api.delete<TermDto>(`/terms/${id}`),

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  search: (q: string) =>
    api.get<TermDto[]>(`/terms/search?q=${encodeURIComponent(q)}`),

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  getSuggestions: (params?: { modality?: string; search?: string }) =>
    api.get<TermSuggestionDto[]>(`/terms/suggestions?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  getSynonymRelations: () =>
    api.get<SynonymRelationDto[]>('/terms/synonyms'),

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  getTranslations: (params?: { search?: string }) =>
    api.get<TranslationDto[]>(`/terms/translations?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  getExtractedTerms: () =>
    api.get<ExtractedTermDto[]>('/terms/extracted'),

  // MOCK_ONLY (后端无 controller, MSW 支撑)
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
