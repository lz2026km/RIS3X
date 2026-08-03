import { api } from './client'

export interface SimilarCaseSearchDto {
  reportId?: string
  reportText?: string
  modality?: string
  bodyPart?: string
  limit?: number
}

export interface SimilarCaseResult {
  id: string
  reportId: string
  patientId: string
  gender: string
  age: number
  modality: string
  bodyPart: string
  studyDate: string
  findings: string
  impression: string
  conclusion: string
  keywords: string[]
  source: 'db' | 'demo'
  similarity: number
  textScore: number
  featureScore: number
  snomedScore: number
}

export interface SimilarCaseFeedbackDto {
  reportId: string
  targetReportId: string
  useful: boolean
  comment?: string
}

export const similarCaseApi = {
  search: (dto: SimilarCaseSearchDto) =>
    api.post<SimilarCaseResult[]>('/similar-case/search', dto),
  searchByReport: (reportId: string) =>
    api.get<SimilarCaseResult[]>(`/similar-case/${encodeURIComponent(reportId)}`),
  feedback: (dto: SimilarCaseFeedbackDto) =>
    api.post<{ success: boolean }>('/similar-case/feedback', dto),
}
