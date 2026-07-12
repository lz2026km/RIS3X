import { api, invalidateApiCache, invalidateApiCacheByPrefix } from './client'

// === Types (matching backend responses) ===

export interface QualityRuleDimension {
  key: string
  label: string
  max: number
  weight: number
}

export interface QualityGrade {
  grade: string
  min: number
  label: string
}

export interface QualityRulesResponse {
  version: string
  dimensions: QualityRuleDimension[]
  grades: QualityGrade[]
  keywords: string[]
  blacklist: string[]
}

export interface ScoreRule {
  key: string
  value: unknown
}

export interface DefectEntry {
  id: string
  action: string
  resource: string
  detail: unknown
  createdAt: string
}

export interface QualityStatsData {
  total: number
  avgScore: number
}

export interface EvaluateDto {
  reportId: string
  findings: string
  conclusion: string
  suggestion?: string
  radsCategory?: string
  hasCritical?: boolean
  verified?: boolean
  structuredCompletion?: number
}

export interface QualityEvaluation {
  id: string
  reportId: string
  totalScore: number
  grade: string
  dimensions: Array<{
    key: string
    label: string
    score: number
    max: number
    weight: number
    issues: string[]
  }>
  evaluatedAt: string
  suggestions: string[]
}

// === API Methods ===

export const reportQualityApi = {
  // ── Quality rules & evaluation (reports-quality.controller) ──

  getRules: () =>
    api.get<QualityRulesResponse>('/reports/quality/rules'),

  evaluate: (data: EvaluateDto) =>
    api.post<QualityEvaluation>('/reports/quality/evaluate', data),

  getHistory: (reportId: string) =>
    api.get<QualityEvaluation[]>(`/reports/quality/history/${reportId}`),

  getTrend: (reportId: string, days?: number) =>
    api.get<QualityEvaluation[]>(`/reports/quality/trend/${reportId}?days=${days ?? 30}`),

  reEvaluate: (reportId: string, data: EvaluateDto) =>
    api.post<QualityEvaluation>(`/reports/quality/re-evaluate/${reportId}`, data),

  // ── Score rules (reportquality.controller) ──

  getScoreRules: () =>
    api.get<{ data: ScoreRule[] }>('/reports/quality/score-rules'),

  createScoreRule: async (data: unknown) => {
    const res = await api.post<{ data: ScoreRule[] }>('/reports/quality/score-rules', data)
    await invalidateApiCache('/reports/quality/score-rules')
    return res
  },

  updateScoreRule: async (id: string, data: unknown) => {
    const res = await api.put<{ data: ScoreRule[] }>(`/reports/quality/score-rules/${id}`, data)
    await invalidateApiCache('/reports/quality/score-rules')
    return res
  },

  // ── Defect library ──

  getDefectLibrary: () =>
    api.get<{ data: DefectEntry[] }>('/reports/quality/defect-library'),

  createDefectEntry: async (data: unknown) => {
    const res = await api.post<{ data: DefectEntry[] }>('/reports/quality/defect-library', data)
    await invalidateApiCache('/reports/quality/defect-library')
    return res
  },

  updateDefectEntry: async (id: string, data: unknown) => {
    const res = await api.put<{ data: DefectEntry[] }>(`/reports/quality/defect-library/${id}`, data)
    await invalidateApiCache('/reports/quality/defect-library')
    return res
  },

  // ── AI report drafts ──

  getAiReportDrafts: () =>
    api.get<{ data: unknown[] }>('/reports/quality/ai-report-drafts'),

  createAiReportDraft: async (data: unknown) => {
    const res = await api.post<{ data: unknown[] }>('/reports/quality/ai-report-drafts', data)
    await invalidateApiCache('/reports/quality/ai-report-drafts')
    return res
  },

  // ── Stats ──

  getStats: () =>
    api.get<{ data: QualityStatsData }>('/reports/quality/stats'),
}
