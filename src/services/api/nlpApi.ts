import { api } from './client'

export interface SpellCheckResult {
  original: string
  suggestions: { offset: number; length: number; word: string; candidates: string[] }[]
}

export interface TerminologyResult {
  original: string
  normalized: { offset: number; length: number; term: string; preferred: string }[]
}

export const nlpApi = {
  spellcheck: (text: string) =>
    api.post<SpellCheckResult>('/nlp/spellcheck', { text }),

  terminology: (text: string) =>
    api.post<TerminologyResult>('/nlp/terminology', { text }),
}
