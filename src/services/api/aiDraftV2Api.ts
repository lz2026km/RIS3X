/**
 * G005 RIS v3.0.6.11-101 Wave 7A (F1) — AI 报告助理 V2 API 客户端
 * 端点: /ai-draft-v2/extract-fields | /generate | /suggest | /drafts
 * 协议: 后端直接返回业务对象 (非 {success,data} 包裹), api 客户端自动归一化。
 */
import { api } from './client'

export type FieldCategory = 'bodyPart' | 'finding' | 'measurement' | 'comparison' | 'conclusion'

export interface ExtractedField {
  id: string
  category: FieldCategory
  label: string
  value: string
  confidence: number
  source: 'dictionary' | 'rule'
  ruleId: string
  evidence: string
  start: number
  end: number
}

export interface ExtractFieldsResult {
  reportId?: string
  fields: ExtractedField[]
  categoriesFound: FieldCategory[]
  overallConfidence: number
  modelVersion: string
  generatedAt: string
  simulated?: boolean
}

export type TraceSourceKind = 'template' | 'rule' | 'field' | 'clinicalHistory' | 'seed'

export interface TraceSource {
  kind: TraceSourceKind
  refId: string
  description: string
  confidence: number
}

export type SegmentType = 'technique' | 'findings' | 'conclusion' | 'recommendation' | 'clinicalHistory'

export interface DraftSegment {
  id: string
  paragraphType: SegmentType
  heading: string
  content: string
  confidence: number
  sources: TraceSource[]
}

export interface GenerateDraftV2Result {
  id: string
  reportId?: string
  segments: DraftSegment[]
  overallConfidence: number
  modelVersion: string
  generatedAt: string
  simulated?: boolean
}

export interface DraftSuggestion {
  id: string
  paragraphIndex: number
  paragraphHeading: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  suggestedText?: string
  ruleId: string
  confidence: number
}

export interface SuggestResult {
  suggestions: DraftSuggestion[]
  overallScore: number
  modelVersion: string
  generatedAt: string
}

export const FIELD_CATEGORY_LABEL: Record<FieldCategory, string> = {
  bodyPart: '部位',
  finding: '征象',
  measurement: '测量值',
  comparison: '对比',
  conclusion: '结论',
}

export const aiDraftV2Api = {
  extractFields: (dto: { findings: string; modality?: string; bodyPart?: string; reportId?: string }) =>
    api.post<ExtractFieldsResult>('/ai-draft-v2/extract-fields', dto),

  generate: (dto: {
    patientId: string
    examId: string
    modality: string
    bodyPart: string
    findings?: string
    clinicalHistory?: string
    keywords?: string[]
  }) => api.post<GenerateDraftV2Result>('/ai-draft-v2/generate', dto),

  suggest: (dto: { paragraphs: Array<{ heading: string; content: string }>; modality?: string; bodyPart?: string }) =>
    api.post<SuggestResult>('/ai-draft-v2/suggest', dto),

  listDrafts: () => api.get<GenerateDraftV2Result[]>('/ai-draft-v2/drafts'),
}
