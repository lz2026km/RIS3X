import { api } from './client'

// [G005 Wave1B P1] 融合 API — register/render/series 真实; list/registration/:id/DELETE 已补
// (fusion.controller, 内存注册记录 + FusionJob 派生), MSW 标注已更新。
export interface FusionStudyDto { id: string; studyUid: string; patientName: string; patientId: string; studyDate: string; fixedModality: string; movingModality: string; status: string; registrationId?: string }
export interface FusionRegisterDto { fixedSeriesUid: string; movingSeriesUid: string; transformType?: 'rigid' | 'affine' | 'deformable'; fixedModality?: string; movingModality?: string }
export interface FusionRegistrationResult { registrationId: string; status: string; metrics: { dice: number; hd95: number; rmse: number }; matrix: number[][]; processingTimeMs: number }
export interface FusionRenderDto { registrationId: string; plane?: 'axial' | 'coronal' | 'sagittal'; sliceIndex: number; alpha?: number; windowWidth?: number; windowLevel?: number }
export interface FusionRenderResult { frameId: string; pixelDataBase64: string; plane: string; sliceIndex: number; alpha: number }
// [G005 Wave4A G-06] SUV 定量
export interface SuvLesion { id: string; x: number; y: number; diameterMm: number; suvMax: number; label: string; slice?: number }
export interface SuvNormalization { weightKg: number; injectedDoseMbg: number; injectionToScanMin: number; formula: string; unit: string }
export interface SuvResult {
  studyId: string
  hasPet: boolean
  source: 'exam' | 'seed' | 'none'
  suv: { max: number; mean: number; peak: number; normalization: SuvNormalization } | null
  lesions: SuvLesion[]
}

export const fusionApi = {
  list: (params?: { patientId?: string; status?: string }) => {
    const sp = new URLSearchParams()
    if (params) { Object.entries(params).forEach(([k, v]) => { if (v !== undefined) sp.set(k, String(v)) }) }
    return api.get<FusionStudyDto[]>(`/fusion?${sp.toString()}`)
  },
  register: (dto: FusionRegisterDto) => api.post<FusionRegistrationResult>('/fusion/register', dto),
  getRegistration: (id: string) => api.get<FusionRegistrationResult>(`/fusion/registration/${id}`),
  render: (dto: FusionRenderDto) => api.post<FusionRenderResult>('/fusion/render', dto),
  delete: (id: string) => api.delete(`/fusion/${id}`),
  getSuv: (studyId: string) => api.get<SuvResult>(`/fusion/suv/${encodeURIComponent(studyId)}`),
}
