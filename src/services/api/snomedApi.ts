import { api } from './client'

export interface SnomedCode {
  conceptId: string
  fsn: string
  pt: string
  semanticTag: string
  matchType: 'exact' | 'partial' | 'suggested'
  confidence: number
}

export const snomedApi = {
  encode: (text: string, modality?: string) =>
    api.post<{ text: string; codes: SnomedCode[] }>('/snomed/encode', { text, modality }),

  search: (q: string) =>
    api.get<SnomedCode[]>('/snomed/search', { params: { q } }),
}
