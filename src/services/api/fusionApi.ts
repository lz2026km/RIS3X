import { api } from './client'

export interface FusionStudyDto { id: string; studyUid: string; patientName: string; patientId: string; studyDate: string; fixedModality: string; movingModality: string; status: string; registrationId?: string }
export interface FusionRegisterDto { fixedSeriesUid: string; movingSeriesUid: string; transformType?: 'rigid' | 'affine' | 'deformable'; fixedModality?: string; movingModality?: string }
export interface FusionRegistrationResult { registrationId: string; status: string; metrics: { dice: number; hd95: number; rmse: number }; matrix: number[][]; processingTimeMs: number }
export interface FusionRenderDto { registrationId: string; plane?: 'axial' | 'coronal' | 'sagittal'; sliceIndex: number; alpha?: number; windowWidth?: number; windowLevel?: number }
export interface FusionRenderResult { frameId: string; pixelDataBase64: string; plane: string; sliceIndex: number; alpha: number }

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
}
