import { api } from './client'

export interface SimilarCaseSearchDto {
  reportId?: string
  reportText?: string
  modality?: string
  bodyPart?: string
  limit?: number
}

export interface SimilarCaseResult {
  id: string
  reportId: string
  patientId: string
  gender: string
  age: number
  modality: string
  bodyPart: string
  studyDate: string
  findings: string
  impression: string
  conclusion: string
  keywords: string[]
  source: 'db' | 'demo'
  similarity: number
  textScore: number
  featureScore: number
  snomedScore: number
}

export interface SimilarCaseFeedbackDto {
  reportId: string
  targetReportId: string
  useful: boolean
  comment?: string
}

// ══════════════════════════════════════════════════════════════════════════
// v3.0.6.11-62 影像级相似检索 (对标 Siemens 影像检索 / Infinitt 影像维度)
// ══════════════════════════════════════════════════════════════════════════

export interface ImageSearchDto {
  seriesUID?: string
  studyUid?: string
  limit?: number
}

export interface ImageFeatureSummary {
  mean: number
  std: number
  skew: number
  kurtosis: number
  min: number
  max: number
  percentiles: number[] // [p5, p25, p50, p75, p95]
  textureEnergy: number
  highDensityRatio: number
  lowDensityRatio: number
  histogram: number[] // 32 bins
}

export interface ImageSearchResult {
  seriesUid: string
  studyUid: string
  modality: string
  bodyPart: string
  instanceCount: number
  similarity: number
  featureScore: number
  matchScore: number
  featureSummary: ImageFeatureSummary
  source: 'real' | 'demo'
}

export interface ImageSeriesItem {
  seriesUid: string
  studyUid: string
  modality: string
  bodyPart: string
  instanceCount: number
  description: string
  source: 'real' | 'demo'
}

export interface HybridSearchDto {
  reportId?: string
  reportText?: string
  seriesUID?: string
  studyUid?: string
  limit?: number
}

export interface HybridSearchResult {
  id: string
  reportId: string
  seriesUid?: string
  studyUid: string
  modality: string
  bodyPart: string
  similarity: number
  textScore: number | null
  imageScore: number | null
  featureSummary: ImageFeatureSummary | null
  source: 'db' | 'demo' | 'real'
  impression?: string
  findings?: string
  keywords?: string[]
}

export const similarCaseApi = {
  search: (dto: SimilarCaseSearchDto) =>
    api.post<SimilarCaseResult[]>('/similar-case/search', dto),
  searchByReport: (reportId: string) =>
    api.get<SimilarCaseResult[]>(`/similar-case/${encodeURIComponent(reportId)}`),
  feedback: (dto: SimilarCaseFeedbackDto) =>
    api.post<{ success: boolean }>('/similar-case/feedback', dto),
  // v3.0.6.11-62 影像级相似检索
  listImageSeries: () =>
    api.get<ImageSeriesItem[]>('/similar-case/series'),
  imageSearch: (dto: ImageSearchDto) =>
    api.post<ImageSearchResult[]>('/similar-case/image-search', dto),
  hybridSearch: (dto: HybridSearchDto) =>
    api.post<HybridSearchResult[]>('/similar-case/hybrid-search', dto),
}
