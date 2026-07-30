import { api } from './client'

export interface VolumeStudyDto { id: string; studyUid: string; patientName: string; patientId: string; studyDate: string; modality: string; seriesCount: number; status: string }
export interface VolumeRenderDto { seriesUid: string; windowWidth?: number; windowLevel?: number; voiType?: 'linear' | 'sigmoid'; colorMap?: string; opacity?: number; plane?: 'axial' | 'coronal' | 'sagittal'; sliceIndex?: number }
export interface VolumeRenderResult { frameId: string; width: number; height: number; pixelDataBase64: string; plane: string; sliceIndex: number; windowWidth: number; windowLevel: number }
export interface VolumeVrDto { seriesUid: string; threshold?: number; opacity?: number; colorMap?: string; rotation?: { x: number; y: number; z: number } }
export interface VolumeMprDto { seriesUid: string; plane: 'axial' | 'coronal' | 'sagittal' | 'oblique'; sliceIndex: number; thickness?: number }
export interface VolumeSegmentationDto { id: string; seriesUid: string; label: string; color: string; volume: number; voxelCount: number; createdBy: string; createdAt: string }

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
}
