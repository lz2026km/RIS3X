import { api, invalidateApiCacheByPrefix } from './client'

// [v3.0.6.11-101 Wave 2C] 影像分割深化 (segmentation-v2)
// 5 算法: region_grow 区域生长 / threshold 阈值(otsu 自动|manual 双阈值) / edge_canny 边缘 /
//         kmeans 聚类(4类) / active_contour 活动轮廓

export type SegmentationV2Algorithm = 'region_grow' | 'threshold' | 'edge_canny' | 'kmeans' | 'active_contour'
export type ThresholdMode = 'otsu' | 'manual'
export type OrganClass = '结节' | '骨骼' | '肝脏' | '肺' | '血管' | '软组织' | '其他'

export interface SeedPoint {
  x: number
  y: number
  z: number
}

export interface AlgorithmParams {
  thresholdLo?: number
  thresholdHi?: number
  thresholdMode?: ThresholdMode
  seed?: SeedPoint | null
  sigma?: number
  edgeLow?: number
  edgeHigh?: number
  iterations?: number
  minVoxels?: number
}

export interface RleRun {
  start: number
  length: number
}

export interface SliceRle {
  z: number
  width: number
  height: number
  runs: RleRun[]
}

export interface SegmentBbox {
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
}

export interface SegmentV2Stats {
  voxelCount: number
  volumeCm3: number
  areaCm2: number
  meanIntensity: number
  minIntensity: number
  maxIntensity: number
  boundaryPointCount: number
  bbox: SegmentBbox
}

export interface LinkedMeasurement {
  measurementId: string
  lesionId: string | null
  diameterMm: number
  studyId: string
  date: string
  notes?: string
}

export interface SegmentationV2SegmentDto {
  id: string
  seriesUID: string
  algorithm: SegmentationV2Algorithm
  algorithmLabel: string
  thresholdMode?: ThresholdMode
  params: AlgorithmParams
  label: string
  color: string
  organClass: OrganClass
  source: 'real' | 'synthetic'
  usedFallback: boolean
  stats: SegmentV2Stats
  dims: { width: number; height: number; depth: number }
  pixelSpacing: [number, number]
  sliceThickness: number
  rle3d: RleRun[]
  slices: SliceRle[]
  linkedMeasurement: LinkedMeasurement | null
  createdAt: string
}

export interface SegmentSummaryDto {
  id: string
  seriesUID: string
  algorithm: SegmentationV2Algorithm
  algorithmLabel: string
  label: string
  color: string
  organClass: OrganClass
  source: 'real' | 'synthetic'
  usedFallback: boolean
  stats: SegmentV2Stats
  linkedMeasurement: LinkedMeasurement | null
  createdAt: string
}

export interface SegmentationV2HistoryItemDto {
  id: string
  seriesUID: string
  algorithm: SegmentationV2Algorithm
  label: string
  organClass: OrganClass
  status: 'active' | 'deleted'
  voxelCount: number
  volumeCm3: number
  createdAt: string
}

const PREFIX = '/segmentation-v2'

export const segmentationV2Api = {
  run: async (dto: { seriesUID: string; algorithm: SegmentationV2Algorithm; params?: AlgorithmParams }) => {
    const res = await api.post<SegmentationV2SegmentDto>(`${PREFIX}/run`, dto)
    await invalidateApiCacheByPrefix(PREFIX)
    return res
  },
  list: (seriesUID: string) =>
    api.get<SegmentSummaryDto[]>(`${PREFIX}/segments?seriesUID=${encodeURIComponent(seriesUID)}`),
  get: (id: string) => api.get<SegmentationV2SegmentDto>(`${PREFIX}/segments/${encodeURIComponent(id)}`),
  annotate: async (id: string, dto: { label?: string; color?: string; organClass?: OrganClass }) => {
    const res = await api.patch<SegmentationV2SegmentDto>(`${PREFIX}/segments/${encodeURIComponent(id)}`, dto)
    await invalidateApiCacheByPrefix(PREFIX)
    return res
  },
  remove: async (id: string) => {
    const res = await api.delete<{ id: string; deleted: boolean }>(`${PREFIX}/segments/${encodeURIComponent(id)}`)
    await invalidateApiCacheByPrefix(PREFIX)
    return res
  },
  history: (seriesUID: string) =>
    api.get<SegmentationV2HistoryItemDto[]>(`${PREFIX}/history?seriesUID=${encodeURIComponent(seriesUID)}`),
  linkMeasurement: async (id: string, dto: { patientId?: string; lesionId?: string; sizeMm?: number; date?: string; notes?: string }) => {
    const res = await api.post<SegmentationV2SegmentDto>(`${PREFIX}/segments/${encodeURIComponent(id)}/measurement`, dto)
    await invalidateApiCacheByPrefix(PREFIX)
    return res
  },
}

/** RLE 游程 → 布尔掩码 (flat) */
export function decodeRle(runs: RleRun[], length: number): Uint8Array {
  const out = new Uint8Array(length)
  for (const run of runs) {
    for (let i = 0; i < run.length; i++) out[run.start + i] = 1
  }
  return out
}

/** 从 3D 掩码提取指定平面切片 (最近邻重采样对齐 MPR 尺寸) */
export function extractPlaneMask(
  mask3d: Uint8Array,
  W: number,
  H: number,
  D: number,
  plane: 'axial' | 'sagittal' | 'coronal',
  index: number,
  sliceThickness: number,
  pixelSpacing: [number, number],
): { width: number; height: number; data: Uint8Array } | null {
  if (mask3d.length !== W * H * D) return null
  const zi = Math.max(0, Math.min(D - 1, Math.round(index)))
  if (plane === 'axial') {
    const data = new Uint8Array(W * H)
    const base = zi * W * H
    for (let i = 0; i < W * H; i++) data[i] = mask3d[base + i] ?? 0
    return { width: W, height: H, data }
  }
  if (plane === 'sagittal') {
    const xi = Math.max(0, Math.min(W - 1, Math.round(index)))
    const outH = Math.max(1, Math.round((D * Math.max(sliceThickness, 0.1)) / pixelSpacing[1]))
    const data = new Uint8Array(H * outH)
    for (let oy = 0; oy < outH; oy++) {
      const sz = Math.min(D - 1, Math.floor(((oy + 0.5) * D) / outH))
      for (let y = 0; y < H; y++) data[oy * H + y] = mask3d[sz * (W * H) + y * W + xi] ?? 0
    }
    return { width: H, height: outH, data }
  }
  const yi = Math.max(0, Math.min(H - 1, Math.round(index)))
  const outH = Math.max(1, Math.round((D * Math.max(sliceThickness, 0.1)) / pixelSpacing[0]))
  const data = new Uint8Array(W * outH)
  for (let oy = 0; oy < outH; oy++) {
    const sz = Math.min(D - 1, Math.floor(((oy + 0.5) * D) / outH))
    for (let x = 0; x < W; x++) data[oy * W + x] = mask3d[sz * (W * H) + yi * W + x] ?? 0
  }
  return { width: W, height: outH, data }
}

/** 等效球直径 (体积 cm³ → mm) */
export function equivalentDiameterMm(volumeCm3: number): number {
  if (volumeCm3 <= 0) return 0
  return +(2 * Math.cbrt((3 * volumeCm3 * 1000) / (4 * Math.PI))).toFixed(2)
}
