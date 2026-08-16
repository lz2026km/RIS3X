import { api } from './client'

// [v3.0.6.11-101 Wave 8A] 报告检索 V2 (report-search-v2) API
// 后端: backend/src/modules/report-search-v2/ (孤儿模块: 自然语言解析 + 跨机构检索 + 高亮/聚合, 确定性)

export interface SearchCondition {
  keyword?: string
  modality?: string
  dateFrom?: string
  dateTo?: string
  doctor?: string
  diagnosisKeyword?: string
  organization?: string
}

export interface HighlightRange {
  start: number
  end: number
}

export interface HighlightSnippet {
  field: string
  label: string
  text: string
  ranges: HighlightRange[]
}

export interface SearchHit {
  reportId: string
  patientId: string
  patientName: string
  examDate: string
  modality: string
  bodyPart: string
  doctorName: string
  organization: string
  conclusion: string
  isCritical: boolean
  relevance: number
  matchedKeywords: string[]
  snippets: HighlightSnippet[]
}

export interface ParsedCondition {
  key: string
  label: string
  value: string
}

export interface SearchAggregations {
  total: number
  byModality: Array<{ key: string; count: number }>
  byOrganization: Array<{ key: string; count: number }>
  byDoctor: Array<{ key: string; count: number }>
  byDiagnosis: Array<{ key: string; count: number }>
  dateRange: { from: string | null; to: string | null }
}

export interface SearchResult {
  items: SearchHit[]
  total: number
  aggregations: SearchAggregations
  source: string
}

export interface NaturalLanguageResult extends SearchResult {
  phrase: string
  conditions: SearchCondition
  parsed: ParsedCondition[]
}

export interface SearchMeta {
  modalities: string[]
  organizations: Array<{ name: string; count: number }>
  doctors: Array<{ name: string; count: number }>
  keywords: string[]
}

export interface SearchV2Stats {
  totalReports: number
  organizationCount: number
  byOrganization: Array<{ key: string; count: number }>
  byModality: Array<{ key: string; count: number }>
  criticalCount: number
  latestExamDate: string | null
  earliestExamDate: string | null
}

const PREFIX = '/report-search-v2'

export const reportSearchV2Api = {
  search: (conditions: SearchCondition) => api.post<SearchResult>(`${PREFIX}/search`, conditions),

  naturalLanguage: (phrase: string) => api.post<NaturalLanguageResult>(`${PREFIX}/natural-language`, { phrase }),

  getMeta: () => api.get<SearchMeta>(`${PREFIX}/meta`),

  getStats: () => api.get<SearchV2Stats>(`${PREFIX}/stats`),
}
