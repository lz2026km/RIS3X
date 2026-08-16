import { api, invalidateApiCache } from './client'

// [G005 Wave 6B v3.0.6.11-101] 报告质控 V2 (report-qc-v2) API
// 后端: backend/src/modules/report-qc-v2/ (孤儿模块: 多维评分 + 质控任务流 + 二次复核 + 统计)

export type QcDimensionKey = 'completeness' | 'normativity' | 'accuracy' | 'readability' | 'timeliness'
export type QcGrade = 'A' | 'B' | 'C' | 'D'
export type DefectSeverity = 'high' | 'medium' | 'low'
export type QcTaskStatus = 'pending' | 'in_progress' | 'reviewing' | 'closed'
export type ReviewOpinion = 'pass' | 'return'

export interface QcSubItemMeta {
  key: string
  name: string
  max: number
}

export interface QcDimensionMeta {
  key: QcDimensionKey
  label: string
  labelEn: string
  max: number
  color: string
  subItems: QcSubItemMeta[]
}

export interface QcDefect {
  code: string
  dimension: QcDimensionKey
  dimensionLabel: string
  name: string
  severity: DefectSeverity
  message: string
  evidence: string
}

export interface QcSubItemScore {
  key: string
  name: string
  score: number
  max: number
  deducted: boolean
}

export interface QcDimensionScore {
  key: QcDimensionKey
  label: string
  score: number
  max: number
  subItems: QcSubItemScore[]
  issues: string[]
}

export interface QcScoreResult {
  id: string
  reportId: string
  modality: string
  totalScore: number
  grade: QcGrade
  modelVersion: string
  evaluatedAt: string
  dimensions: QcDimensionScore[]
  defects: QcDefect[]
  suggestions: string[]
}

export interface ScoreReportInput {
  reportId: string
  findings?: string
  diagnosis?: string
  conclusion?: string
  impression?: string
  recommendations?: string
  modality?: string
  radsCategory?: string
  isCritical?: boolean
  structuredCompletion?: number
  reportTimeMinutes?: number
  techParams?: string
}

export interface QcReview {
  id: string
  round: 1 | 2
  reviewer: string
  opinion: ReviewOpinion
  comment: string
  at: string
}

export interface QcTaskHistoryEntry {
  at: string
  action: string
  actor: string
  note: string
}

export interface QcTask {
  id: string
  reportId: string
  patientName: string
  modality: string
  scoreId?: string
  totalScore?: number
  grade?: QcGrade
  status: QcTaskStatus
  assignee?: string
  assigneeName?: string
  createdAt: string
  updatedAt: string
  closedAt?: string
  reviews: QcReview[]
  history: QcTaskHistoryEntry[]
  defects: QcDefect[]
}

export interface QcRecord {
  id: string
  reportId: string
  patientName: string
  modality: string
  totalScore?: number
  grade?: QcGrade
  status: QcTaskStatus
  assigneeName?: string
  defectCount: number
  reviewedRounds: number
  createdAt: string
  closedAt?: string
}

export interface DefectBucket {
  key: string
  label: string
  count: number
  high: number
  medium: number
  low: number
}

export interface MonthlyTrendItem {
  month: string
  count: number
  avgScore: number
}

export interface QcStatsData {
  totalTasks: number
  avgScore: number
  passRate: number
  gradeDistribution: Array<{ grade: QcGrade; count: number }>
  taskByStatus: Record<QcTaskStatus, number>
  defectDistribution: DefectBucket[]
  severityDistribution: Array<{ severity: DefectSeverity; count: number }>
  monthlyTrend: MonthlyTrendItem[]
}

const TASK_PREFIX = '/report-qc-v2'

export const reportQcV2Api = {
  getDimensions: () => api.get<QcDimensionMeta[]>(`${TASK_PREFIX}/dimensions`),

  score: (input: ScoreReportInput) => api.post<QcScoreResult>(`${TASK_PREFIX}/score`, input),

  listScores: () => api.get<QcScoreResult[]>(`${TASK_PREFIX}/scores`),

  getScore: (id: string) => api.get<QcScoreResult>(`${TASK_PREFIX}/scores/${id}`),

  createTask: async (data: { reportId: string; patientName?: string; modality?: string; assignee?: string; assigneeName?: string; scoreInput?: ScoreReportInput }) => {
    const res = await api.post<QcTask>(`${TASK_PREFIX}/tasks`, data)
    await invalidateApiCache(`${TASK_PREFIX}/tasks`)
    return res
  },

  listTasks: (status?: string) => api.get<QcTask[]>(`${TASK_PREFIX}/tasks${status ? `?status=${status}` : ''}`),

  getTask: (id: string) => api.get<QcTask>(`${TASK_PREFIX}/tasks/${id}`),

  assignTask: async (id: string, data: { assignee: string; assigneeName?: string }) => {
    const res = await api.post<QcTask>(`${TASK_PREFIX}/tasks/${id}/assign`, data)
    await invalidateApiCache(`${TASK_PREFIX}/tasks`)
    return res
  },

  reviewTask: async (id: string, data: { reviewer: string; opinion: ReviewOpinion; comment?: string }) => {
    const res = await api.post<QcTask>(`${TASK_PREFIX}/tasks/${id}/review`, data)
    await invalidateApiCache(`${TASK_PREFIX}/tasks`)
    return res
  },

  secondReviewTask: async (id: string, data: { reviewer: string; opinion: ReviewOpinion; comment?: string }) => {
    const res = await api.post<QcTask>(`${TASK_PREFIX}/tasks/${id}/second-review`, data)
    await invalidateApiCache(`${TASK_PREFIX}/tasks`)
    return res
  },

  closeTask: async (id: string, data?: { comment?: string }) => {
    const res = await api.post<QcTask>(`${TASK_PREFIX}/tasks/${id}/close`, data ?? {})
    await invalidateApiCache(`${TASK_PREFIX}/tasks`)
    return res
  },

  listReviews: (id: string) => api.get<QcReview[]>(`${TASK_PREFIX}/tasks/${id}/reviews`),

  listRecords: () => api.get<QcRecord[]>(`${TASK_PREFIX}/records`),

  getStats: () => api.get<QcStatsData>(`${TASK_PREFIX}/stats`),
}
