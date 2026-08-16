import { api, invalidateApiCache } from './client'

// AI 增强 (ai-v2) API
// Backend: /ai-v2/* (全局前缀 /api → /api/ai-v2/*)
// 资源: organ-detection (多器官自动检出) / draft-score (草稿评分) / smart-hanging (智能挂片)

export interface PixelStatsInput {
  mean?: number
  stddev?: number
  min?: number
  max?: number
  slices?: number
  width?: number
  height?: number
}

export interface OrganBBox {
  x: number
  y: number
  width: number
  height: number
}

export interface OrganMask {
  type: 'ellipse'
  cx: number
  cy: number
  rx: number
  ry: number
}

export interface OrganDetectionItem {
  code: string
  label: string
  confidence: number
  bbox: OrganBBox
  mask: OrganMask
  volumeMl: number
  slices: number
  status: 'detected' | 'low-confidence'
  featureNote: string
}

export interface OrganDetectionResult {
  id: string
  studyId: string
  modality: string
  bodyPart: string
  pixelStats: Required<PixelStatsInput>
  organs: OrganDetectionItem[]
  organsDetected: number
  avgConfidence: number
  primaryOrgan: string | null
  modelVersion: string
  createdAt: string
}

export interface ReportParagraphResult {
  id: string
  studyId: string
  paragraph: string
  organCount: number
  generatedAt: string
}

export interface DraftDimension {
  key: string
  label: string
  weight: number
  score: number
}

export interface DraftSuggestion {
  code: string
  level: 'error' | 'warning' | 'info'
  message: string
}

export interface DraftScoreResult {
  id: string
  modality: string | null
  score: number
  grade: '优' | '良' | '中' | '差'
  dimensions: DraftDimension[]
  suggestions: DraftSuggestion[]
  stats: {
    charCount: number
    sectionCount: number
    numericCount: number
    unitCoverage: number
    informalTerms: string[]
    missingSections: string[]
    missingStandardTerms: string[]
    unnumberedValues: number
  }
  scoredAt: string
}

export interface HangingSeriesInput {
  description?: string
  seriesNumber?: number
  images?: number
}

export interface HangingCell {
  index: number
  label: string
  seriesKey: string
  windowWidth?: number
  windowCenter?: number
}

export interface HangingRecommendation {
  layoutId: string
  name: string
  rows: number
  cols: number
  cells: HangingCell[]
  score: number
  source: 'rule' | 'history'
  reasons: string[]
  matchedSeries: string[]
  alternatives: { layoutId: string; name: string; score: number }[]
  recommendedAt: string
}

export interface HangingApplication {
  id: string
  examId: string
  layoutId: string
  layoutName: string
  rows: number
  cols: number
  appliedBy: string
  appliedAt: string
}

export const aiV2Api = {
  // ── 多器官自动检出 ──
  analyzeOrgans: (body: { studyId: string; modality: string; bodyPart?: string; pixelStats?: PixelStatsInput }) =>
    api.post<OrganDetectionResult>('/ai-v2/organ-detection/analyze', body),

  listOrganResults: () => api.get<OrganDetectionResult[]>('/ai-v2/organ-detection/results'),

  getOrganResult: (id: string) => api.get<OrganDetectionResult>(`/ai-v2/organ-detection/results/${id}`),

  generateParagraph: async (id: string) => {
    const res = await api.post<ReportParagraphResult>(`/ai-v2/organ-detection/${id}/report-paragraph`, {})
    return res
  },

  // ── 报告草稿评分 ──
  scoreDraft: (body: { draftText: string; modality?: string; expectedSections?: string[] }) =>
    api.post<DraftScoreResult>('/ai-v2/draft-score', body),

  listDraftScores: () => api.get<DraftScoreResult[]>('/ai-v2/draft-score/results'),

  getDraftScore: (id: string) => api.get<DraftScoreResult>(`/ai-v2/draft-score/results/${id}`),

  // ── 智能挂片 ──
  recommendHanging: (body: { examId?: string; modality: string; bodyPart?: string; series?: HangingSeriesInput[]; doctorId?: string }) =>
    api.post<HangingRecommendation>('/ai-v2/smart-hanging/recommend', body),

  applyHanging: async (body: { examId: string; layoutId: string; appliedBy: string }) => {
    const res = await api.post<HangingApplication>('/ai-v2/smart-hanging/apply', body)
    await invalidateApiCache('/ai-v2/smart-hanging/applications')
    return res
  },

  listHangingApplications: () => api.get<HangingApplication[]>('/ai-v2/smart-hanging/applications'),

  listHangingRules: () => api.get<unknown[]>('/ai-v2/smart-hanging/rules'),

  // ── 总览 ──
  overview: () => api.get<Record<string, unknown>>('/ai-v2/overview'),
}
