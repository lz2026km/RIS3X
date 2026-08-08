import { api } from './client'

// 乳腺影像质量管理 (Mammography QC) API
// 后端暂未实现 /mammo-qc 端点 → MSW mammoQcHandlers 支撑,
// 响应带 source 信封: 'database' 真实聚合 / 'demo' 演示数据(MSW)

export interface MammoQcRecord {
  id: string
  date: string
  patient: string
  modality: string
  score: number
  status: '合格' | '待复评' | '不合格'
  technologist: string
  issue: string
}

export interface MammoQcOverview {
  overallScore: number
  acrComplianceRate: number
  recallRate: number
  avgDoseMgy: number
  imageFailRate: number
  technologistConsistency: number
  acrChecks: { name: string; score: number; items: string[] }[]
}

export interface MammoQcEnvelope<T> {
  source: 'database' | 'demo'
  generatedAt: string
  data: T
}

export const mammoQcApi = {
  getOverview: () => api.get<MammoQcEnvelope<MammoQcOverview>>('/mammo-qc/overview'),

  listRecords: (params?: { search?: string; pageSize?: number }) =>
    api.get<MammoQcEnvelope<MammoQcRecord[]>>(`/mammo-qc/records?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),
}
