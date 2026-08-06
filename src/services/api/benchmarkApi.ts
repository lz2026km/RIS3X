import { api } from "./client";

// Benchmark (对标分析) API
// [G005-P0] 前缀修复: 前端 /benchmark/* → 后端 /api/benchmark/* (modules/benchmark.controller)
//   后端实际端点: list / compare / cross-site / stats
//   MSW: /api/v1/benchmark/* (mock 基地址 /api/v1 + 前端路径)

export interface BenchmarkRecord {
  id: string;
  hospitalId: string;
  hospitalName: string;
  category: string;
  metricName: string;
  value: number;
  unit: string;
  period: string;
  rank?: number;
  percentile?: number;
}

export interface BenchmarkComparison {
  metricName: string;
  localValue: number;
  benchmarkValue: number;
  deviation: number;
  unit: string;
  grade: "excellent" | "good" | "average" | "below_average" | "poor";
}

export interface BenchmarkAiDiagnosis {
  id: string;
  hospitalId: string;
  hospitalName: string;
  modality: string;
  aiModel: string;
  sensitivity: number;
  specificity: number;
  accuracy: number;
  auc: number;
  f1Score: number;
  totalCases: number;
  period: string;
}

export interface BenchmarkQueryParams {
  category?: string;
  period?: string;
  hospitalId?: string;
  page?: number;
  pageSize?: number;
}

export interface BenchmarkReport {
  id: string;
  title: string;
  generatedAt: string;
  period: string;
  comparisons: BenchmarkComparison[];
  summary: string;
}

export interface BenchmarkTimeRange {
  start: string;
  end: string;
}

export interface BenchmarkCompareDto {
  metricCode: string;
  timeRange: BenchmarkTimeRange;
  compareMode: "yoy" | "qoq";
  dimension?: "dept" | "site" | "time";
  dimensionValues?: string[];
}

export interface BenchmarkCrossSiteDto {
  metricCodes: string[];
  siteIds: string[];
  timeRange: BenchmarkTimeRange;
}

export const benchmarkApi = {
  listMetrics: () => api.get<unknown[]>("/benchmark/list"),

  compare: (dto: BenchmarkCompareDto) =>
    api.post<unknown>("/benchmark/compare", dto),

  crossSite: (dto: BenchmarkCrossSiteDto) =>
    api.post<unknown>("/benchmark/cross-site", dto),

  stats: () => api.get<unknown>("/benchmark/stats"),
};
