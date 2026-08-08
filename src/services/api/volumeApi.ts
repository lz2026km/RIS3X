import { api } from './client'

// [G005 W1-C] 旧 volumeApi.list/get/render 3 方法已删除:
//   后端 volume.controller 无 /volume(列表) / /volume/:studyUid / /volume/render 端点,
//   正确端点见下方 series/reconstruct/status/mprSlice/mipProjection/vrImage/segmentations。
export interface VolumeVrDto { seriesUid: string; threshold?: number; opacity?: number; colorMap?: string; rotation?: { x: number; y: number; z: number } }
export interface VolumeMprDto { seriesUid: string; plane: 'axial' | 'coronal' | 'sagittal' | 'oblique'; sliceIndex: number; thickness?: number }
export interface VolumeSegmentationDto { id: string; seriesUid: string; label: string; color: string; volume: number; voxelCount: number; createdBy: string; createdAt: string }

// ────────────────────────────────────────────────────────────────────────────
// Phase 1.2+1.3: 真实 DICOM 体数据端点 (jobId 会话式)
// ────────────────────────────────────────────────────────────────────────────

export interface VolumeSeriesDto {
  seriesInstanceUid: string
  modality: string
  instanceCount: number
  rows: number
  columns: number
  slices: number
}

export interface VolumeReconstructDto {
  jobId: string
  volume: { x: number; y: number; z: number }
  source: 'real' | 'synthetic'
  instanceCount: number
}

export interface VolumeStatusDto {
  status: string
  progress: number
  source: string
  volume: { x: number; y: number; z: number } | null
  slices?: number
  modality?: string
}

export interface VolumePixelPayload {
  dataBase64: string
  bitsAllocated: number
  signed: boolean
  width: number
  height: number
}

export interface VolumeMprResultDto {
  plane: string
  sliceIndex: number
  totalSlices: number
  source: string
  dimensions: { width: number; height: number }
  windowWidth: number
  windowLevel: number
  pixelData: VolumePixelPayload
}

export interface VolumeMipResultDto {
  direction: string
  source: string
  dimensions: { width: number; height: number }
  windowWidth: number
  windowLevel: number
  pixelData: VolumePixelPayload
}

export interface VolumeVrResultDto {
  width: number
  height: number
  source: string
  windowWidth: number
  windowLevel: number
  pixelData: { dataBase64: string; channels: number }
}

export const volumeApi = {
  // [G005 W1-C] 已删除: list / get / render (后端无 /volume 列表、/volume/:studyUid、/volume/render 端点)
  // 旧 DTO 式 vr/mpr (seriesUid 入参) 后端 /volume/vr|mpr 需 jobId, 已改用下方 vrImage/mprSlice/mipProjection
  vr: (dto: VolumeVrDto) => api.post<{ pixelDataBase64: string }>('/volume/vr', dto),
  mpr: (dto: VolumeMprDto) => api.post<VolumeMprResultDto>('/volume/mpr', dto),
  listSegmentations: (seriesUid: string) => api.get<VolumeSegmentationDto[]>(`/volume/${seriesUid}/segmentations`),
  createSegmentation: (seriesUid: string, data: { label: string; color: string; voxelIndices: number[] }) => api.post<VolumeSegmentationDto>(`/volume/${seriesUid}/segmentations`, data),
  deleteSegmentation: (id: string) => api.delete(`/volume/segmentations/${id}`),

  // 真实体数据端点
  series: () => api.get<VolumeSeriesDto[]>('/volume/series'),
  reconstruct: (seriesUID: string) => api.post<VolumeReconstructDto>('/volume/reconstruct', { seriesUID }),
  status: (jobId: string) => api.get<VolumeStatusDto>(`/volume/status/${encodeURIComponent(jobId)}`),
  mprSlice: (jobId: string, plane: 'axial' | 'sagittal' | 'coronal', sliceIndex: number) =>
    api.post<VolumeMprResultDto>('/volume/mpr', { jobId, plane, sliceIndex }),
  mipProjection: (jobId: string, direction: 'axial' | 'sagittal' | 'coronal', thickness?: number) =>
    api.post<VolumeMipResultDto>('/volume/mip', { jobId, direction, ...(thickness !== undefined ? { thickness } : {}) }),
  vrImage: (jobId: string, opts?: { preset?: string; opacity?: number; rotation?: { x?: number; y?: number; z?: number } }) =>
    api.post<VolumeVrResultDto>('/volume/vr', { jobId, ...opts }),
}
