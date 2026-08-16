import { api } from './client'

export interface SnomedCode {
  conceptId: string
  fsn: string
  pt: string
  semanticTag: string
  matchType: 'exact' | 'partial' | 'suggested'
  confidence: number
}

// ── [v3.0.6.11-103 Wave 17] 自动编码 ─────────────────────────────────────────

export interface Icd10Code {
  code: string
  title: string
  matchType: 'exact' | 'partial'
  confidence: number
}

export type AutoCodeSection = 'findings' | 'impression' | 'conclusion' | 'unknown'

export interface AutoEncodedTerm {
  keyword: string
  matched: boolean
  sourcePhrase: string
  start: number
  end: number
  section: AutoCodeSection
  snomed: SnomedCode[]
  icd10: Icd10Code[]
  confidence: number
}

export interface AutoEncodeResult {
  text: string
  terms: AutoEncodedTerm[]
  total: number
  confirmed: number
}

export const snomedApi = {
  encode: (text: string, modality?: string) =>
    api.post<{ text: string; codes: SnomedCode[] }>('/snomed/encode', { text, modality }),

  autoEncode: (text: string) =>
    api.post<AutoEncodeResult>('/snomed/auto-encode', { text }),

  search: (q: string) =>
    api.get<SnomedCode[]>(`/snomed/search?q=${encodeURIComponent(q)}`),
}
