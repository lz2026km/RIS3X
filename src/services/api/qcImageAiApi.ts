import { api, invalidateApiCache } from './client'

// QC Image AI (AI 影像质控) API
// Backend: /qc/image-ai/*

export interface QcImageAiResult {
  id: string
  studyId: string
  patientName: string
  modality: string
  device: string
  examDate: string
  score: number
  maxScore: number
  issues: QcImageAiIssue[]
  aiModel: string
  status: 'pending' | 'reviewed' | 'accepted' | 'rejected'
  reviewerId?: string
  reviewerName?: string
  createdAt: string
}

export interface QcImageAiIssue {
  id: string
  category: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  location?: string
  suggestion?: string
}

export interface QcImageAiReviewDto {
  status: 'accepted' | 'rejected'
  comment?: string
}

export interface QcImageAiBatchDto {
  studyIds: string[]
}

export interface QcImageAiStats {
  totalReviewed: number
  avgScore: number
  issueDistribution: { category: string; count: number; percentage: number }[]
  qualityTrend: { date: string; avgScore: number }[]
}

export const qcImageAiApi = {
  listResults: (params?: { status?: string; modality?: string; page?: number; pageSize?: number }) =>
    api.get<QcImageAiResult[]>(`/qc/image-ai/results?${new URLSearchParams(params ?? {}).toString()}`),

  getResult: (id: string) =>
    api.get<QcImageAiResult>(`/qc/image-ai/results/${id}`),

  reviewResult: async (id: string, data: QcImageAiReviewDto) => {
    const res = await api.post<QcImageAiResult>(`/qc/image-ai/results/${id}/review`, data)
    await invalidateApiCache('/qc/image-ai/results')
    return res
  },

  batchReview: async (data: QcImageAiBatchDto & { status: 'accepted' | 'rejected' }) => {
    const res = await api.post<QcImageAiResult[]>('/qc/image-ai/batch-review', data)
    await invalidateApiCache('/qc/image-ai/results')
    return res
  },

  analyzeStudy: (studyId: string) =>
    api.post<QcImageAiResult>(`/qc/image-ai/analyze/${studyId}`, {}),

  getStats: (params?: { startDate?: string; endDate?: string }) =>
    api.get<QcImageAiStats>(`/qc/image-ai/stats?${new URLSearchParams(params ?? {}).toString()}`),
}
