import { api } from './client'

// 诊断符合率 (Diagnosis Accuracy) API
// [G005 Wave1B P1] 后端已实现 /diagnosis-accuracy 端点 (diagnosis-accuracy.module,
// Report 审核结果派生 + seed 回退), MSW 标注已更新;
// 响应带 source 信封: 'database' 真实聚合 / 'demo' 演示数据

export interface DiagnosisAccuracyDto {
  period: string
  totalReports: number
  pathConfirmed: number
  clinicalConfirmed: number
  imagingFollowupConfirmed: number
  totalConfirmed: number
  accuracyRate: number
  sensitivity: number
  specificity: number
  positivePredictiveValue: number
  negativePredictiveValue: number
  byModality: { modality: string; accuracy: number; count: number }[]
  byDisease: { disease: string; accuracy: number; count: number }[]
}

export interface DiagnosisAccuracyEnvelope {
  source: 'database' | 'demo'
  generatedAt: string
  data: DiagnosisAccuracyDto
}

export const diagnosisAccuracyApi = {
  getAccuracy: () => api.get<DiagnosisAccuracyEnvelope>('/diagnosis-accuracy'),
}
