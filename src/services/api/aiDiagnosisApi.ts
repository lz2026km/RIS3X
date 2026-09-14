import { api, invalidateApiCache } from './client'

// AI Diagnosis (AI 辅助诊断) API
// Backend: /ai-diagnosis/*
// [W1-B] 对齐后端 ai-diagnosis.controller:
//   - 结果列表/详情/复核 → /ai-diagnosis/{lung-cad|breast-cad|fracture-cad|cardiac-ai}[/results[/:id]] / .../results/:id/review
//   - 批量确认        → POST /ai-diagnosis/batch-confirm (后端 W1-B 新增)
//   - 模型重训        → POST /ai-diagnosis/retrain/:modelVersion (后端 W1-B 新增,模拟)
//   - 统计/准确率/趋势 → GET /stats、POST /accuracy、GET /trend

export type AiDiagnosisModelKey = 'lung-cad' | 'breast-cad' | 'fracture-cad' | 'cardiac-ai'

// 通用结果接口: 各模型共有字段子集; 模型特有字段以索引签名保留
export interface AiDiagnosisResult {
  id: string
  studyId: string
  patientName: string
  modality: string
  status: 'auto' | 'reviewed' | 'confirmed'
  modelVersion: string
  createdAt: string
  [key: string]: unknown
}

export interface AiDiagnosisConfirmDto {
  status: 'confirmed' | 'rejected' | 'amended'
  amendedDiagnosis?: string
  comment?: string
  // 模型特有复核字段 (对应后端各 ReviewSchema)
  noduleId?: string
  lesionId?: string
  findingId?: string
  amendedBiRads?: string
  amendedAssessment?: string
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
  [key: string]: unknown
}

export interface AiDiagnosisAccuracyResult {
  sensitivity: number
  specificity: number
  ppv: number
  npv: number
  accuracy: number
  totalCases: number
  aiPositive: number
  aiNegative: number
  physicianPositive: number
  physicianNegative: number
}

export interface AiDiagnosisTrendPoint {
  date: string
  sensitivity: number
  specificity: number
  accuracy: number
  totalCases: number
}

export interface AiDiagnosisRetrainResult {
  modelVersion: string
  status: string
  startedAt: string
  message: string
}

// ===== [v3.0.6.11-104 Wave 2D] AI 病例库 (GET /ai-diagnosis/cases[/:model/:id]) =====

export interface AiCaseCategoryStat {
  key: string
  count: number
}

export interface AiCaseModelSummary {
  total: number
  byCategory: AiCaseCategoryStat[]
}

export interface AiCaseLibraryDto {
  lungCad: AiCaseModelSummary
  breastCad: AiCaseModelSummary
  fractureCad: AiCaseModelSummary
  cardiacAi: AiCaseModelSummary
  generatedAt: string
}

export interface AiCaseDetail {
  id: string
  studyId?: string
  patientName?: string
  status?: string
  createdAt?: string
  [key: string]: unknown
}

function toQuery<T extends object>(params: T | undefined): string {
  const query = new URLSearchParams()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value != null) query.set(key, String(value))
    }
  }
  const qs = query.toString()
  return qs ? `?${qs}` : ''
}

// 按模型映射后端复核 DTO (后端各 ReviewSchema 字段不同)
function reviewBodyFor(model: AiDiagnosisModelKey, data: AiDiagnosisConfirmDto): Record<string, unknown> {
  switch (model) {
    case 'lung-cad':
      return { noduleId: data.noduleId, status: data.status, amendedDiagnosis: data.amendedDiagnosis, comment: data.comment }
    case 'breast-cad':
      return { lesionId: data.lesionId, status: data.status, amendedBiRads: data.amendedBiRads, comment: data.comment }
    case 'fracture-cad':
      return { findingId: data.findingId, status: data.status, amendedDiagnosis: data.amendedDiagnosis, comment: data.comment }
    case 'cardiac-ai':
      return { status: data.status, amendedAssessment: data.amendedAssessment, comment: data.comment }
  }
}

function resolveDateRange(params?: { startDate?: string; endDate?: string }) {
  const endDate = params?.endDate ?? new Date().toISOString()
  const startDate = params?.startDate ?? new Date(Date.now() - 30 * 86400000).toISOString()
  return { startDate, endDate }
}

export const aiDiagnosisApi = {
  // GET /ai-diagnosis/{model}/results
  listResults: <T = AiDiagnosisResult>(model: AiDiagnosisModelKey, params?: AiDiagnosisQueryParams) =>
    api.get<T[]>(`/ai-diagnosis/${model}/results${toQuery(params)}`),

  // GET /ai-diagnosis/{model}/results/:id
  getResult: <T = AiDiagnosisResult>(model: AiDiagnosisModelKey, id: string) =>
    api.get<T>(`/ai-diagnosis/${model}/results/${id}`),

  // POST /ai-diagnosis/{model}/results/:id/review
  confirmResult: async <T = AiDiagnosisResult>(model: AiDiagnosisModelKey, id: string, data: AiDiagnosisConfirmDto) => {
    const res = await api.post<T>(`/ai-diagnosis/${model}/results/${id}/review`, reviewBodyFor(model, data))
    await invalidateApiCache(`/ai-diagnosis/${model}/results`)
    return res
  },

  // POST /ai-diagnosis/batch-confirm (后端 W1-B 新增)
  batchConfirm: async (ids: string[], status: 'confirmed' | 'rejected', model?: AiDiagnosisModelKey) => {
    const res = await api.post<AiDiagnosisResult[]>('/ai-diagnosis/batch-confirm', {
      ids,
      status,
      ...(model ? { model } : {}),
    })
    await invalidateApiCache('/ai-diagnosis')
    return res
  },

  // GET /ai-diagnosis/stats
  getStats: (params?: { startDate?: string; endDate?: string }) =>
    api.get<AiDiagnosisStats>(`/ai-diagnosis/stats${toQuery(params)}`),

  // POST /ai-diagnosis/retrain/:modelVersion (后端 W1-B 新增,模拟训练)
  retrainModel: (modelVersion: string) =>
    api.post<AiDiagnosisRetrainResult>(`/ai-diagnosis/retrain/${encodeURIComponent(modelVersion)}`, {}),

  // POST /ai-diagnosis/accuracy
  getAccuracy: (params?: { startDate?: string; endDate?: string; siteId?: string; modality?: string }) =>
    api.post<AiDiagnosisAccuracyResult>('/ai-diagnosis/accuracy', { ...resolveDateRange(params), siteId: params?.siteId, modality: params?.modality }),

  // GET /ai-diagnosis/trend
  getTrend: (params?: { startDate?: string; endDate?: string; siteId?: string; modality?: string }) =>
    api.get<AiDiagnosisTrendPoint[]>(`/ai-diagnosis/trend${toQuery(resolveDateRange(params))}`),

  // [v3.0.6.11-104 Wave 2D] AI 病例库
  // GET /ai-diagnosis/cases
  listCases: () =>
    api.get<AiCaseLibraryDto>('/ai-diagnosis/cases'),

  // GET /ai-diagnosis/cases/:model/:id
  getCase: (model: AiDiagnosisModelKey, id: string) =>
    api.get<AiCaseDetail>(`/ai-diagnosis/cases/${encodeURIComponent(model)}/${encodeURIComponent(id)}`),
}
