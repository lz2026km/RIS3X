import { api } from './client'

// WADO-RS (Web Access to DICOM Objects - RESTful) API
// Backend: /api/v1/dicom/wado-rs/*

export interface WadoRsStudy {
  studyInstanceUid: string
  patientName: string
  patientId: string
  studyDate: string
  studyDescription: string
  modality: string
  seriesCount: number
  instanceCount: number
}

export interface WadoRsSeries {
  seriesInstanceUid: string
  seriesNumber: number
  modality: string
  seriesDescription: string
  instanceCount: number
  bodyPart: string
}

export interface WadoRsInstance {
  sopInstanceUid: string
  instanceNumber: number
  sopClassUid: string
  transferSyntaxUid: string
  wadoUri: string
}

export interface WadoRsQueryParams {
  patientId?: string
  patientName?: string
  studyDate?: string
  modality?: string
  studyDescription?: string
  page?: number
  pageSize?: number
}

export const wadoRsApi = {
  queryStudies: (params?: WadoRsQueryParams) =>
    api.get<WadoRsStudy[]>(`/dicom/wado-rs/studies?${new URLSearchParams(params ?? {}).toString()}`),

  getStudy: (studyUid: string) =>
    api.get<WadoRsStudy>(`/dicom/wado-rs/studies/${studyUid}`),

  getSeries: (studyUid: string) =>
    api.get<WadoRsSeries[]>(`/dicom/wado-rs/studies/${studyUid}/series`),

  getInstances: (studyUid: string, seriesUid: string) =>
    api.get<WadoRsInstance[]>(`/dicom/wado-rs/studies/${studyUid}/series/${seriesUid}/instances`),

  getInstance: (studyUid: string, seriesUid: string, instanceUid: string) =>
    api.get<WadoRsInstance>(`/dicom/wado-rs/studies/${studyUid}/series/${seriesUid}/instances/${instanceUid}`),

  getMetadata: (studyUid: string, seriesUid?: string, instanceUid?: string) => {
    let path = `/dicom/wado-rs/studies/${studyUid}`
    if (seriesUid) path += `/series/${seriesUid}`
    if (instanceUid) path += `/instances/${instanceUid}`
    path += '/metadata'
    return api.get<Record<string, unknown>>(path)
  },

  retrieveBulkData: (studyUid: string, bulkDataUri: string) =>
    api.get<unknown>(`/dicom/wado-rs/studies/${studyUid}/bulkdata?uri=${encodeURIComponent(bulkDataUri)}`),
}
