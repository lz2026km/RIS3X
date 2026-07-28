import { api, invalidateApiCache } from './client'

// STOW-RS (Store Over the Web - RESTful) API
// Backend: /api/v1/dicom/stow-rs/*

export interface StowRsStoreResult {
  studyInstanceUid: string
  seriesInstanceUid: string
  sopInstanceUid: string
  status: 'success' | 'warning' | 'failure'
  warning?: string
  failureReason?: string
}

export interface StowRsStoreResponse {
  contentType: string
  studyInstanceUid: string
  seriesInstanceUid: string
  receivedInstanceCount: number
  results: StowRsStoreResult[]
}

export interface StowRsQueryParams {
  studyInstanceUid?: string
  patientId?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}

export interface StowRsStoredInstance {
  id: string
  studyInstanceUid: string
  seriesInstanceUid: string
  sopInstanceUid: string
  patientName: string
  patientId: string
  modality: string
  studyDate: string
  receivedAt: string
  storedBy: string
}

export const stowRsApi = {
  storeInstances: (data: { formData: FormData }) =>
    api.post<StowRsStoreResponse>('/dicom/stow-rs', data.formData),

  storeToStudy: (studyUid: string, data: { formData: FormData }) =>
    api.post<StowRsStoreResponse>(`/dicom/stow-rs/studies/${studyUid}`, data.formData),

  listStored: (params?: StowRsQueryParams) =>
    api.get<StowRsStoredInstance[]>(`/dicom/stow-rs/stored?${new URLSearchParams(params ?? {}).toString()}`),

  deleteInstance: (studyUid: string, seriesUid: string, instanceUid: string) =>
    api.delete(`/dicom/stow-rs/studies/${studyUid}/series/${seriesUid}/instances/${instanceUid}`),

  getStorageStats: () =>
    api.get<{ totalStudies: number; totalSeries: number; totalInstances: number; totalSizeBytes: number }>('/dicom/stow-rs/stats'),
}
