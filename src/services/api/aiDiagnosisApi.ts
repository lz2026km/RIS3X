import { api, invalidateApiCache } from './client'

// AI Diagnosis (AI 辅助诊断) API
// Backend: /ai-diagnosis/*

export interface AiDiagnosisResult {
  id: string
  studyId: string
  patientName: string
  modality: string
  bodyPart: string
  finding: string
  diagnosis: string
  confidence: number
  severity: 'normal' | 'mild' | 'moderate' | 'severe' | 'critical'
  recommendations: string[]
  status: 'auto' | 'confirmed' | 'rejected' | 'amended'
  doctorId?: string
  doctorName?: string
  modelVersion: string
  createdAt: string
}

export interface AiDiagnosisConfirmDto {
  status: 'confirmed' | 'rejected' | 'amended'
  amendedDiagnosis?: string
  comment?: string
}

export interface AiDiagnosisQueryParams {
  modality?: string
  bodyPart?: string
  status?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}

export interface AiDiagnosisStats {
  totalDiagnoses: number
  autoCount: number
  confirmedCount: number
  rejectedCount: number
  avgConfidence: number
  accuracyRate: number
  bodyPartDistribution: { bodyPart: string; count: number }[]
}

export const aiDiagnosisApi = {
  listResults: (params?: AiDiagnosisQueryParams) =>
    api.get<AiDiagnosisResult[]>(`/ai-diagnosis/results?${new URLSearchParams(params ?? {}).toString()}`),

  getResult: (id: string) =>
    api.get<AiDiagnosisResult>(`/ai-diagnosis/results/${id}`),

  confirmResult: async (id: string, data: AiDiagnosisConfirmDto) => {
    const res = await api.post<AiDiagnosisResult>(`/ai-diagnosis/results/${id}/confirm`, data)
    await invalidateApiCache('/ai-diagnosis/results')
    return res
  },

  batchConfirm: async (ids: string[], status: 'confirmed' | 'rejected') => {
    const res = await api.post<AiDiagnosisResult[]>('/ai-diagnosis/batch-confirm', { ids, status })
    await invalidateApiCache('/ai-diagnosis/results')
    return res
  },

  getStats: (params?: { startDate?: string; endDate?: string }) =>
    api.get<AiDiagnosisStats>(`/ai-diagnosis/stats?${new URLSearchParams(params ?? {}).toString()}`),

  retrainModel: (modelVersion: string) =>
    api.post<AiDiagnosisResult>(`/ai-diagnosis/retrain/${modelVersion}`, {}),
}
