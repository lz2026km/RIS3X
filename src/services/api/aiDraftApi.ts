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

// ==================== v3.0.6.11-61 环境式 AI 报告草稿 ====================

export type ReportDraftStyle = 'concise' | 'standard' | 'detailed'

export interface AiReportDraftSection {
  heading: string
  content: string
}

export interface AiReportDraftGenerateDto {
  reportId: string
  patientId?: string
  examId?: string
  modality: string
  bodyPart: string
  clinicalInfo?: string
  /** 发现关键词, 如 '右肺上叶结节影' */
  findings?: string
  keywords?: string[]
  style?: ReportDraftStyle
}

export interface AiReportDraft {
  id: string
  reportId: string
  draftText: string
  sections: AiReportDraftSection[]
  style: string
  status: 'PENDING' | 'ACCEPTED' | 'MODIFIED'
  confidence: number
  modelVersion: string
  createdAt: string
  updatedAt: string
}

export const aiDraftApi = {
  generate: (dto: AiDraftGenerateDto) =>
    api.post<AiDraftResult>('/ai-draft/generate', dto),

  rewrite: (dto: AiDraftRewriteDto) =>
    api.post<AiDraftRewriteResult>('/ai-draft/rewrite', dto),

  continue: (dto: AiDraftContinueDto) =>
    api.post<AiDraftParagraph>('/ai-draft/continue', dto),

  // 环境式报告草稿 (生成式草稿 + 医生确认)
  generateReportDraft: (dto: AiReportDraftGenerateDto) =>
    api.post<AiReportDraft>('/ai/report-draft', dto),

  acceptDraft: (id: string) =>
    api.post<AiReportDraft>(`/ai/report-draft/${id}/accept`),

  modifyDraft: (id: string, draftText: string) =>
    api.post<AiReportDraft>(`/ai/report-draft/${id}/modify`, { draftText }),

  getReportDraft: (reportId: string) =>
    api.get<AiReportDraft>(`/ai/report-draft/${reportId}`),
}
