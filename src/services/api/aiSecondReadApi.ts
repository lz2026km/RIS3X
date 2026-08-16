import { api, invalidateApiCache } from './client'

// [v3.0.6.11-101 Wave 7C F14] AI 二次检出 V2 (ai-second-read) API
// 后端: backend/src/modules/ai-second-read/ (孤儿模块: 定稿前 AI 复查 + 忽略/采纳/加入报告)

export type SecondReadCategory = 'missed_finding' | 'description_gap' | 'conclusion_inconsistency'
export type SecondReadSeverity = 'high' | 'medium' | 'low'
export type SecondReadRiskStatus = 'open' | 'ignored' | 'adopted' | 'appended'
export type SecondReadRiskLevel = 'low' | 'medium' | 'high'

export interface SecondReadRiskItem {
  id: string
  category: SecondReadCategory
  categoryLabel: string
  severity: SecondReadSeverity
  title: string
  description: string
  suggestion: string
  evidence: string
  status: SecondReadRiskStatus
  handledBy?: string
  handledAt?: string
}

export interface SecondReadFeatureStats {
  textLength: number
  sectionCount: number
  sentenceCount: number
  findingTermCount: number
  technicalTermCount: number
  fuzzyTermCount: number
  criticalTermCount: number
}

export interface SecondReadResult {
  id: string
  reportId: string
  patientName: string
  modality: string
  riskScore: number
  riskLevel: SecondReadRiskLevel
  riskItems: SecondReadRiskItem[]
  featureStats: SecondReadFeatureStats
  modelVersion: string
  status: 'completed'
  reviewedBy?: string
  reviewedAt?: string
  appendedText?: string
  appendedAt?: string
  createdAt: string
}

export interface SecondReadInput {
  reportId: string
  patientName?: string
  modality?: string
  findings?: string
  diagnosis?: string
  conclusion?: string
  recommendations?: string
}

export interface SecondReadStatsData {
  total: number
  avgRiskScore: number
  highRiskCount: number
  mediumRiskCount: number
  lowRiskCount: number
  openRiskItems: number
  handledRiskItems: number
  byCategory: Array<{ category: SecondReadCategory; label: string; count: number; open: number }>
  bySeverity: Array<{ severity: SecondReadSeverity; count: number }>
  appendedCount: number
}

const PREFIX = '/ai-second-read'

export const aiSecondReadApi = {
  analyze: async (input: SecondReadInput) => {
    const res = await api.post<SecondReadResult>(`${PREFIX}/analyze`, input)
    await invalidateApiCache(`${PREFIX}/results`)
    return res
  },

  listResults: () => api.get<SecondReadResult[]>(`${PREFIX}/results`),

  getResult: (id: string) => api.get<SecondReadResult>(`${PREFIX}/results/${id}`),

  ignoreRiskItem: async (id: string, itemId: string, reviewer: string) => {
    const res = await api.post<SecondReadResult>(`${PREFIX}/results/${id}/risk-items/${itemId}/ignore`, { reviewer })
    await invalidateApiCache(`${PREFIX}/results`)
    return res
  },

  adoptRiskItem: async (id: string, itemId: string, reviewer: string) => {
    const res = await api.post<SecondReadResult>(`${PREFIX}/results/${id}/risk-items/${itemId}/adopt`, { reviewer })
    await invalidateApiCache(`${PREFIX}/results`)
    return res
  },

  appendToReport: async (id: string, body: { reviewer: string; appendedText: string }) => {
    const res = await api.post<SecondReadResult>(`${PREFIX}/results/${id}/append`, body)
    await invalidateApiCache(`${PREFIX}/results`)
    return res
  },

  getStats: () => api.get<SecondReadStatsData>(`${PREFIX}/stats`),
}
