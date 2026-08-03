import { api } from './client'

export interface VolumeStudyDto { id: string; studyUid: string; patientName: string; patientId: string; studyDate: string; modality: string; seriesCount: number; status: string }
export interface VolumeRenderDto { seriesUid: string; windowWidth?: number; windowLevel?: number; voiType?: 'linear' | 'sigmoid'; colorMap?: string; opacity?: number; plane?: 'axial' | 'coronal' | 'sagittal'; sliceIndex?: number }
export interface VolumeRenderResult { frameId: string; width: number; height: number; pixelDataBase64: string; plane: string; sliceIndex: number; windowWidth: number; windowLevel: number }
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
  list: (params?: { patientId?: string; modality?: string }) => {
    const sp = new URLSearchParams()
    if (params) { Object.entries(params).forEach(([k, v]) => { if (v !== undefined) sp.set(k, String(v)) }) }
    return api.get<VolumeStudyDto[]>(`/volume?${sp.toString()}`)
  },
  get: (studyUid: string) => api.get<VolumeStudyDto>(`/volume/${studyUid}`),
  render: (dto: VolumeRenderDto) => api.post<VolumeRenderResult>('/volume/render', dto),
  vr: (dto: VolumeVrDto) => api.post<{ pixelDataBase64: string }>('/volume/vr', dto),
  mpr: (dto: VolumeMprDto) => api.post<VolumeRenderResult>('/volume/mpr', dto),
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
