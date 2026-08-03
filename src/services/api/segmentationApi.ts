import { api } from './client'

export type SegmentationTarget = 'nodule' | 'bone' | 'liver' | 'lung'

export interface SeedPoint {
  x: number
  y: number
  z: number
}

export interface SegmentationRequestDto {
  seriesUID: string
  target: SegmentationTarget
  thresholdMin?: number
  thresholdMax?: number
  seed?: SeedPoint
  minVoxels?: number
  maxVoxels?: number
}

export interface Bbox3d {
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
}

export interface SegmentationStatsDto {
  segId: string
  seriesUID: string
  target: SegmentationTarget
  source: 'real' | 'synthetic'
  jobId: string | null
  volumeCm3: number
  meanHu: number
  maxHu: number
  minHu: number
  voxelCount: number
  bbox: Bbox3d
  surfaceAreaCm2: number
  density: number
  createdAt: string
}

export interface MaskSliceDto {
  plane: 'axial' | 'sagittal' | 'coronal'
  index: number
  width: number
  height: number
  dataBase64: string
}

export interface SegmentationResultDto extends SegmentationStatsDto {
  maskSlices: MaskSliceDto[]
  centerSlices: MaskSliceDto[]
}

export interface HistogramBin {
  rangeMin: number
  rangeMax: number
  count: number
}

export interface QuantifyResultDto {
  segId: string
  seriesUID: string
  target: SegmentationTarget
  binCount: number
  bins: HistogramBin[]
}

export interface SegmentationFeatureDto {
  category: string
  name: string
  value: number
  unit: string
}

export interface SegmentationHistoryItemDto {
  id: string
  seriesUID: string
  target: string
  source: string
  approved: boolean
  createdAt: string
  volumeCm3: number
  meanHu: number
  maxHu: number
  minHu: number
  voxelCount: number
  surfaceAreaCm2: number
  features: SegmentationFeatureDto[]
}

// ────────────────────────────────────────────────────────────────────────────
// Phase 1.7: 3D 分割与定量 (结节/骨/肝/肺 + HU 直方图 + 医生确认)
// ────────────────────────────────────────────────────────────────────────────

export const segmentationApi = {
  segment: (dto: SegmentationRequestDto) => api.post<SegmentationResultDto>('/volume/segment', dto),
  quantify: (segId: string) => api.post<QuantifyResultDto>(`/volume/segment/${encodeURIComponent(segId)}/quantify`),
  history: (seriesUID: string) => api.get<SegmentationHistoryItemDto[]>(`/volume/segmentations/${encodeURIComponent(seriesUID)}`),
  approve: (id: string) => api.post<{ id: string; approved: boolean }>(`/volume/segmentations/${encodeURIComponent(id)}/approve`),
}
