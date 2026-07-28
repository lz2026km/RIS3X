import { api } from './client'

export interface FusionV2RegisterDto {
  fixedSeriesUid: string
  movingSeriesUid: string
  transformType?: 'rigid' | 'affine' | 'deformable' | 'nonlinear'
}

export interface FusionV2RegisterResult {
  registrationId: string
  fixedSeriesUid: string
  movingSeriesUid: string
  transformType: string
  status: string
  metrics: { dice: number; hd95: number; rmse: number }
  matrix: number[][]
  processingTimeMs: number
}

export interface FusionV2RenderDto {
  fixedSeriesUid: string
  movingSeriesUid: string
  plane?: 'axial' | 'coronal' | 'sagittal'
  sliceIndex: number
  alpha?: number
  windowWidth?: number
  windowLevel?: number
  fusionWindowWidth?: number
  fusionWindowLevel?: number
}

export interface FusionV2RenderResult {
  frameId: string
  width: number
  height: number
  alpha: number
  plane: string
  sliceIndex: number
  pixelDataBase64: string
  windowWidth: number
  windowLevel: number
  fusionWindowWidth: number
  fusionWindowLevel: number
}

export interface FusionV2SeriesItem {
  modality: string
  seriesDescription: string
  instanceCount: number
}

export interface FusionV2SeriesResult {
  patientId: string
  series: FusionV2SeriesItem[]
}

export const fusionV2Api = {
  register: (dto: FusionV2RegisterDto) =>
    api.post<FusionV2RegisterResult>('/fusion-v2/register', dto),

  render: (dto: FusionV2RenderDto) =>
    api.post<FusionV2RenderResult>('/fusion-v2/render', dto),

  getSeries: (patientId: string) =>
    api.get<FusionV2SeriesResult>(`/fusion-v2/series/${encodeURIComponent(patientId)}`),
}
