import { api } from './client'

// ══════════════════════════════════════════════════════════════════════════
// DBT 乳腺断层合成 (Digital Breast Tomosynthesis)
// 对标 Hologic/GE/Infinitt 乳腺断层阅片
// ══════════════════════════════════════════════════════════════════════════

export interface DbtSeriesSummaryDto {
  seriesInstanceUid: string
  seriesNumber: number
  laterality: 'L' | 'R'
  viewPosition: string
  sliceCount: number
  rows: number
  columns: number
  sliceThickness: number
  pixelSpacing: string
  windowCenter: number
  windowWidth: number
  source: 'sample' | 'db' | 'synthetic'
}

export interface DbtStudyDto {
  id: string
  studyInstanceUid: string
  patientName: string
  patientId: string
  patientSex: string
  patientBirthDate: string
  studyDate: string
  studyTime: string
  studyDescription: string
  accessionNumber: string
  isCurrent: boolean
  priorStudyId?: string
  series: DbtSeriesSummaryDto[]
}

export interface DbtSlicePixelDto {
  dataBase64: string
  bitsAllocated: number
  signed: boolean
  width: number
  height: number
}

export interface DbtSliceDto {
  instanceNumber: number
  sopInstanceUid: string
  sliceLocation: number
  tomoAngle: number
  sliceThickness: number
  rows: number
  columns: number
  pixelData: DbtSlicePixelDto | null
}

export interface DbtSlicesResultDto {
  study: DbtStudyDto
  slices: DbtSliceDto[]
}

export interface DbtReconstructDto {
  seriesInstanceUid: string
  projection?: 'mip' | 'mean'
  thickness?: number
}

export interface DbtReconstructResultDto {
  studyId: string
  seriesInstanceUid: string
  projection: 'mip' | 'mean'
  thickness: number
  source: 'real' | 'synthetic'
  width: number
  height: number
  windowWidth: number
  windowLevel: number
  pixelData: DbtSlicePixelDto
}

export interface DbtCompareDto {
  currentStudyId: string
  priorStudyId: string
}

export interface DbtCompareResultDto {
  current: DbtStudyDto
  prior: DbtStudyDto
  lateralityMap: Array<{ laterality: 'L' | 'R'; currentSeries?: string; priorSeries?: string }>
}

// [G-21 Wave3C] DBT 微钙化检测 → BI-RADS 自动评分
export type BiradsCategory = '0' | '1' | '2' | '3' | '4A' | '4B' | '4C' | '5'

export interface DbtBiradsCalcificationDto {
  count: number
  distribution: 'clustered' | 'linear' | 'segmental' | 'regional' | 'diffuse'
  morphology?:
    | 'round' | 'punctate' | 'popcorn' | 'egg_shell' | 'coarse' | 'large_rod' | 'vascular'
    | 'amorphous' | 'coarse_heterogeneous' | 'fine_pleomorphic' | 'fine_linear'
}

export interface DbtBiradsMassDto {
  size: number
  shape: 'round' | 'oval' | 'irregular'
  margin: 'circumscribed' | 'microlobulated' | 'indistinct' | 'spiculated'
}

export interface DbtBiradsScoreDto {
  calcifications?: DbtBiradsCalcificationDto[]
  mass?: DbtBiradsMassDto
}

export interface DbtBiradsScoreResultDto {
  studyId: string
  category: BiradsCategory
  categoryLabel: string
  malignancyRisk: string
  recommendation: string
  basis: string[]
  features: {
    calcifications: Array<{ count: number; distribution: string; morphology?: string }>
    mass?: { size: number; shape: string; margin: string }
  }
  scoredAt: string
}

export interface DbtBiradsScoreQueryDto {
  scored: boolean
  score?: DbtBiradsScoreResultDto
}

export const dbtApi = {
  studies: () => api.get<DbtStudyDto[]>('/dbt/studies'),
  slices: (studyId: string, series?: string) => {
    const qs = series ? `?series=${encodeURIComponent(series)}` : ''
    return api.get<DbtSlicesResultDto>(`/dbt/studies/${encodeURIComponent(studyId)}/slices${qs}`)
  },
  reconstruct: (studyId: string, dto: DbtReconstructDto) =>
    api.post<DbtReconstructResultDto>(`/dbt/studies/${encodeURIComponent(studyId)}/reconstruct`, dto),
  compare: (dto: DbtCompareDto) => api.post<DbtCompareResultDto>('/dbt/compare', dto),
  // [G-21 Wave3C] BI-RADS 自动评分 (微钙化+肿块特征 → 分类 0-5) + 已有评分查询
  scoreBirads: (studyId: string, dto: DbtBiradsScoreDto) =>
    api.post<DbtBiradsScoreResultDto>(`/dbt/${encodeURIComponent(studyId)}/birads-score`, dto),
  getBiradsScore: (studyId: string) =>
    api.get<DbtBiradsScoreQueryDto>(`/dbt/${encodeURIComponent(studyId)}/birads-score`),
}
