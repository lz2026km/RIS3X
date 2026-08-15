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

// ==================== v3.0.6.11-100 Wave 3A (G-19) LLM + RAG 深化 ====================

export type LlmProviderId = 'mock' | 'deepseek' | 'hunyuan'

export interface LlmProviderInfo {
  id: LlmProviderId
  name: string
  model: string
  kind: 'template' | 'llm'
  available: boolean
  apiKeyConfigured: boolean
  description: string
}

export interface AiDraftRagSource {
  reportId: string
  date: string
  snippet: string
}

export interface AiDraftMatchedTerm {
  term: string
  code: string
}

export interface AiDraftRagContext {
  reportId: string
  patientId: string
  modality: string
  bodyPart: string
  clinicalInfo: string
  matchedTerms: AiDraftMatchedTerm[]
  priorReports: AiDraftRagSource[]
}

export interface AiDraftGenerateAdvancedDto {
  reportId: string
  provider?: LlmProviderId
  includeRag?: boolean
}

export interface AiDraftAdvancedResult {
  id: string
  reportId: string
  draftText: string
  sections: AiReportDraftSection[]
  provider: LlmProviderId
  modelVersion: string
  confidenceScore: number
  sources: AiDraftRagSource[]
  ragUsed: boolean
  fallbackToMock: boolean
  status: 'PENDING' | 'ACCEPTED' | 'MODIFIED'
  createdAt: string
  updatedAt: string
}

export interface AiDraftStructuredResult {
  reportId: string
  provider: LlmProviderId
  modelVersion: string
  confidenceScore: number
  sections: AiReportDraftSection[]
  draftText: string
  status: 'PENDING' | 'ACCEPTED' | 'MODIFIED'
  createdAt: string
}

export const aiDraftApi = {
  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
  generate: (dto: AiDraftGenerateDto) =>
    api.post<AiDraftResult>('/ai-draft/generate', dto),

  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
  rewrite: (dto: AiDraftRewriteDto) =>
    api.post<AiDraftRewriteResult>('/ai-draft/rewrite', dto),

  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
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

  // ==================== v3.0.6.11-100 Wave 3A (G-19) LLM + RAG 深化 ====================
  listProviders: () =>
    api.get<LlmProviderInfo[]>('/ai-draft/providers'),

  getRagContext: (reportId: string) =>
    api.get<AiDraftRagContext>(`/ai-draft/rag-context?reportId=${encodeURIComponent(reportId)}`),

  generateAdvanced: (dto: AiDraftGenerateAdvancedDto) =>
    api.post<AiDraftAdvancedResult>('/ai-draft/generate-advanced', dto),

  generateStructured: (reportId: string) =>
    api.post<AiDraftStructuredResult>('/ai-draft/generate-structured', { reportId }),
}
