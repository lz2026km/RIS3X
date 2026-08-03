import { api, invalidateApiCache } from './client'

function toQuery(params: Record<string, string | number | undefined> | undefined): string {
  const query = new URLSearchParams()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null) query.set(key, String(value))
    }
  }
  const qs = query.toString()
  return qs ? `?${qs}` : ''
}

// Cardiac AI (心脏 AI 分析) API
// Backend: /ai-diagnosis/cardiac-ai/*

export interface CardiacMeasurement {
  id: string
  studyId: string
  parameter: string
  value: number
  unit: string
  normalRange: { min: number; max: number }
  abnormal: boolean
}

export interface CardiacAiResult {
  id: string
  studyId: string
  patientName: string
  modality: 'CT' | 'MR'
  measurements: CardiacMeasurement[]
  ejectionFraction?: number
  lvVolume?: number
  lvMass?: number
  cadRads?: '0' | '1' | '2' | '3' | '4' | '5'
  stenosis: CardiacStenosis[]
  overallAssessment: string
  recommendation: string
  modelVersion: string
  status: 'auto' | 'reviewed' | 'confirmed'
  createdAt: string
}

export interface CardiacStenosis {
  vessel: string
  segment: string
  stenosisPercent: number
  severity: 'normal' | 'mild' | 'moderate' | 'severe' | 'occluded'
  calcified: boolean
}

export interface CardiacAiReviewDto {
  status: 'confirmed' | 'rejected' | 'amended'
  amendedAssessment?: string
  comment?: string
}

export interface CardiacAiStats {
  totalStudies: number
  avgEjectionFraction: number
  cadRadsDistribution: { cadRads: string; count: number }[]
  stenosisDistribution: { severity: string; count: number }[]
}

export const cardiacAiApi = {
  listResults: (params?: { studyId?: string; status?: string; page?: number; pageSize?: number }) =>
    api.get<CardiacAiResult[]>(`/ai-diagnosis/cardiac-ai/results${toQuery(params)}`),

  getResult: (id: string) =>
    api.get<CardiacAiResult>(`/ai-diagnosis/cardiac-ai/results/${id}`),

  analyzeStudy: (studyId: string) =>
    api.post<CardiacAiResult>(`/ai-diagnosis/cardiac-ai/analyze/${studyId}`, {}),

  reviewResult: async (resultId: string, data: CardiacAiReviewDto) => {
    const res = await api.post<CardiacAiResult>(`/ai-diagnosis/cardiac-ai/results/${resultId}/review`, data)
    await invalidateApiCache('/ai-diagnosis/cardiac-ai/results')
    return res
  },

  getStats: () =>
    api.get<CardiacAiStats>('/ai-diagnosis/cardiac-ai/stats'),
}
