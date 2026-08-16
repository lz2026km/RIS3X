import { api, invalidateApiCache } from './client'

// [v3.0.6.11-101 Wave 7C F9] 报告互评 (report-peer-review) API
// 后端: backend/src/modules/report-peer-review/ (孤儿模块: 按科室确定性分配 + 三维度 5 分制 + 统计)

export type ScoreDimension = 'accuracy' | 'completeness' | 'normativity'
export type PeerReviewStatus = 'pending' | 'reviewed' | 'overdue'

export interface PeerScores {
  accuracy: number
  completeness: number
  normativity: number
}

export interface PeerReviewTask {
  id: string
  reportId: string
  patientName: string
  modality: string
  department: string
  reviewerId: string
  reviewerName: string
  assignedAt: string
  dueAt: string
  status: PeerReviewStatus
  scores?: PeerScores
  comment?: string
  reviewedAt?: string
  autoAssigned: boolean
}

export interface PeerReviewStats {
  total: number
  reviewedCount: number
  pendingCount: number
  overdueCount: number
  completionRate: number
  avgScores: PeerScores & { overall: number }
  scoreDistribution: Array<{ score: number; count: number }>
  byDepartment: Array<{ department: string; total: number; reviewed: number; avgOverall: number }>
}

export interface AssignPeerReviewInput {
  reportId: string
  patientName?: string
  modality?: string
  department: string
  reviewerId?: string
  dueDays?: number
}

export interface PeerDimensionMeta {
  key: ScoreDimension
  label: string
  min: number
  max: number
}

const PREFIX = '/report-peer-review'

export const reportPeerReviewApi = {
  assign: async (input: AssignPeerReviewInput) => {
    const res = await api.post<PeerReviewTask>(`${PREFIX}/assign`, input)
    await invalidateApiCache(`${PREFIX}/tasks`)
    return res
  },

  listTasks: (status?: string) => api.get<PeerReviewTask[]>(`${PREFIX}/tasks${status ? `?status=${status}` : ''}`),

  getTask: (id: string) => api.get<PeerReviewTask>(`${PREFIX}/tasks/${id}`),

  score: async (id: string, body: { scores: PeerScores; comment?: string; reviewerId?: string }) => {
    const res = await api.post<PeerReviewTask>(`${PREFIX}/tasks/${id}/score`, body)
    await invalidateApiCache(`${PREFIX}/tasks`)
    return res
  },

  getStats: () => api.get<PeerReviewStats>(`${PREFIX}/stats`),

  getDimensions: () => api.get<PeerDimensionMeta[]>(`${PREFIX}/dimensions`),
}
