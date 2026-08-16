import { api } from './client'

// [v3.0.6.11-101 Wave 8A (F16)] 报告对比 V2 (report-compare-v2) API
// 后端: backend/src/modules/report-compare-v2/ (孤儿模块: 逐段 diff + 关键字段 + 相似度, 确定性)

export type CompareType = 'patient-history' | 'dual-read' | 'doctor-ai'
export type DiffType = 'same' | 'modified' | 'added' | 'removed'

export interface ReportSummary {
  id: string
  patientName: string
  examDate: string
  modality: string
  bodyPart: string
  doctorName: string
  source: 'doctor' | 'ai' | 'prior'
  organization: string
  isAiGenerated: boolean
}

export interface ComparePreset {
  id: string
  type: CompareType
  label: string
  description: string
  reportAId: string
  reportBId: string
}

export interface LineDiffOp {
  section: string
  sectionLabel: string
  type: DiffType
  line: string
  original?: string
  lineNoOld?: number
  lineNoNew?: number
}

export interface SectionDiffItem {
  section: string
  label: string
  type: DiffType
  original: string
  updated: string
  originalLineCount: number
  updatedLineCount: number
  ops: LineDiffOp[]
}

export interface KeyFieldComparison {
  field: string
  label: string
  original: string
  updated: string
  equal: boolean
  change: DiffType
}

export interface CompareStatistics {
  totalLines: number
  same: number
  modified: number
  added: number
  removed: number
  changeRate: number
  similarity: number
  keyFieldChanges: number
  sectionsCompared: number
}

export interface ReportCompareResult {
  id: string
  type: CompareType
  reportA: ReportSummary
  reportB: ReportSummary
  sectionDiffs: SectionDiffItem[]
  keyFields: KeyFieldComparison[]
  lineDiffs: LineDiffOp[]
  statistics: CompareStatistics
  deterministic: true
  generatedAt: string
}

export interface CompareV2Stats {
  totalReports: number
  presetCount: number
  byType: Record<CompareType, number>
  avgSimilarity: number
  organizationCount: number
}

export interface CompareInput {
  reportAId?: string
  reportBId?: string
  type?: CompareType
  textA?: string
  textB?: string
  sectionLabel?: string
}

export const TYPE_LABEL: Record<CompareType, string> = {
  'patient-history': '同患者不同时点',
  'dual-read': '双阅双报告',
  'doctor-ai': '医生与 AI 报告',
}

const PREFIX = '/report-compare-v2'

export const reportCompareV2Api = {
  listReports: () => api.get<ReportSummary[]>(`${PREFIX}/reports`),

  listPresets: () => api.get<ComparePreset[]>(`${PREFIX}/presets`),

  compare: (input: CompareInput) => api.post<ReportCompareResult>(`${PREFIX}/compare`, input),

  getStats: () => api.get<CompareV2Stats>(`${PREFIX}/stats`),
}
