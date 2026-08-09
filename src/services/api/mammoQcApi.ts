import { api } from './client'

// 乳腺影像质量管理 (Mammography QC) API
// [G005 Wave1B P1] 后端已实现 /mammo-qc 端点 (mammo-qc.module, Exam MG/TOM 派生 + seed 回退),
// MSW 标注已更新; 响应带 source 信封: 'database' 真实聚合 / 'demo' 演示数据

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

// [G005 Wave1A W9] 质控测试项 (后端 GET /mammo-qc/tests)
export interface MammoQcTest {
  id: string
  name: string
  category: string
  frequency: string
  target: string
  lastResult: number
  status: '通过' | '待复评' | '未通过'
  nextDue: string
}

// [G005 Wave1A W9] 质控标准 (后端 GET /mammo-qc/standards)
export interface MammoQcStandard {
  id: string
  name: string
  requirement: string
  source: string
  scope: string
}

// [G005 Wave1A W9] 质控统计 (后端 GET /mammo-qc/stats)
export interface MammoQcStats {
  totalRecords: number
  passRate: number
  reviewRate: number
  failRate: number
  avgScore: number
  byModality: Record<string, number>
  byTechnologist: { technologist: string; count: number; avgScore: number }[]
}

export const mammoQcApi = {
  getOverview: () => api.get<MammoQcEnvelope<MammoQcOverview>>('/mammo-qc/overview'),

  listRecords: (params?: { search?: string; pageSize?: number }) =>
    api.get<MammoQcEnvelope<MammoQcRecord[]>>(`/mammo-qc/records?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  // [G005 Wave1A W9] 质控测试计划 (后端 GET /mammo-qc/tests)
  getTests: () => api.get<MammoQcTest[]>('/mammo-qc/tests'),

  // [G005 Wave1A W9] 质控标准 (后端 GET /mammo-qc/standards)
  getStandards: () => api.get<MammoQcStandard[]>('/mammo-qc/standards'),

  // [G005 Wave1A W9] 质控统计 (后端 GET /mammo-qc/stats)
  getStats: () => api.get<MammoQcEnvelope<MammoQcStats>>('/mammo-qc/stats'),
}
