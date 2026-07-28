import { api } from './client'

export interface AiDraftParagraph {
  id: string
  heading: string
  content: string
  confidence: number
  editable: boolean
}

export interface AiDraftResult {
  paragraphs: AiDraftParagraph[]
  overallConfidence: number
  modelVersion: string
  generatedAt: Date
}

export interface AiDraftGenerateDto {
  patientId: string
  examId: string
  modality: string
  bodyPart: string
  clinicalHistory?: string
  keywords?: string[]
}

export interface AiDraftRewriteDto {
  content: string
  instruction: string
  modality?: string
}

export interface AiDraftRewriteResult {
  content: string
  confidence: number
}

export interface AiDraftContinueDto {
  existingParagraphs: Array<{ heading: string; content: string }>
  prompt: string
  modality?: string
}

export const aiDraftApi = {
  generate: (dto: AiDraftGenerateDto) =>
    api.post<AiDraftResult>('/ai-draft/generate', dto),

  rewrite: (dto: AiDraftRewriteDto) =>
    api.post<AiDraftRewriteResult>('/ai-draft/rewrite', dto),

  continue: (dto: AiDraftContinueDto) =>
    api.post<AiDraftParagraph>('/ai-draft/continue', dto),
}
