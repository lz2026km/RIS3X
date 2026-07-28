import { api } from './client'

// Benchmark (对标分析) API
// Backend: /benchmark/*

export interface BenchmarkRecord {
  id: string
  hospitalId: string
  hospitalName: string
  category: string
  metricName: string
  value: number
  unit: string
  period: string
  rank?: number
  percentile?: number
}

export interface BenchmarkComparison {
  metricName: string
  localValue: number
  benchmarkValue: number
  deviation: number
  unit: string
  grade: 'excellent' | 'good' | 'average' | 'below_average' | 'poor'
}

export interface BenchmarkAiDiagnosis {
  id: string
  hospitalId: string
  hospitalName: string
  modality: string
  aiModel: string
  sensitivity: number
  specificity: number
  accuracy: number
  auc: number
  f1Score: number
  totalCases: number
  period: string
}

export interface BenchmarkQueryParams {
  category?: string
  period?: string
  hospitalId?: string
  page?: number
  pageSize?: number
}

export interface BenchmarkReport {
  id: string
  title: string
  generatedAt: string
  period: string
  comparisons: BenchmarkComparison[]
  summary: string
}

export const benchmarkApi = {
  listRecords: (params?: BenchmarkQueryParams) =>
    api.get<BenchmarkRecord[]>(`/benchmark/records?${new URLSearchParams(params ?? {}).toString()}`),

  getRecord: (id: string) =>
    api.get<BenchmarkRecord>(`/benchmark/records/${id}`),

  getComparisons: (params?: { category?: string; period?: string }) =>
    api.get<BenchmarkComparison[]>(`/benchmark/comparisons?${new URLSearchParams(params ?? {}).toString()}`),

  getAiDiagnosisBenchmarks: (params?: { modality?: string; period?: string }) =>
    api.get<BenchmarkAiDiagnosis[]>(`/benchmark/ai-diagnosis?${new URLSearchParams(params ?? {}).toString()}`),

  generateReport: (period: string) =>
    api.post<BenchmarkReport>('/benchmark/reports', { period }),

  listReports: (params?: { page?: number; pageSize?: number }) =>
    api.get<BenchmarkReport[]>(`/benchmark/reports?${new URLSearchParams(params ?? {}).toString()}`),

  getReport: (id: string) =>
    api.get<BenchmarkReport>(`/benchmark/reports/${id}`),
}
