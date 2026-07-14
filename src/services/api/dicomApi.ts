import { api, API_BASE } from './client'
import { getToken } from '../../utils/auth'
import type { ApiResponse } from './types'

// ══════════════════════════════════════════════════════════════════════════
// DICOMweb (QIDO-RS / WADO-RS / STOW-RS)
// ══════════════════════════════════════════════════════════════════════════

export interface DicomWebStudy {
  studyInstanceUID: string
  studyID: string
  studyDate: string
  studyTime?: string
  studyDescription: string
  patientID: string
  patientName: string
  patientSex?: 'M' | 'F' | 'O'
  patientBirthDate?: string
  accessionNumber: string
  modalitiesInStudy: string[]
  numberOfStudyRelatedSeries: number
  numberOfStudyRelatedInstances: number
  referringPhysicianName?: string
}

export interface DicomWebSeries {
  seriesInstanceUID: string
  seriesNumber: number
  modality: string
  seriesDescription: string
  bodyPartExamined?: string
  sliceThickness?: number
  numberOfSeriesRelatedInstances: number
  studyInstanceUID: string
}

export interface DicomWebInstance {
  sopInstanceUID: string
  sopClassUID: string
  instanceNumber: number
  seriesInstanceUID: string
  studyInstanceUID: string
  numberOfFrames?: number
}

export interface DicomWebCapabilities {
  qidors: boolean
  wadors: boolean
  stowrs: boolean
  upsrs?: boolean
  version: string
}

export interface StoreInstancePayload {
  studyInstanceUid: string
  seriesInstanceUid: string
  sopInstanceUid: string
  modality: string
  sopClassUid: string
  patientId?: string
  sizeBytes: number
  storagePath: string
}

export interface DicomWebStudySearchParams {
  PatientID?: string
  Modality?: string
  StudyInstanceUID?: string
  limit?: number
  offset?: number
}

export const dicomWebApi = {
  capabilities: () => api.get<DicomWebCapabilities>('/dicom-web/capabilities'),

  searchStudies: (params?: DicomWebStudySearchParams) => {
    const qs = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)) })
    }
    return api.get<DicomWebStudy[]>(`/dicom-web/studies?${qs.toString()}`)
  },

  searchSeries: (studyInstanceUid: string) =>
    api.get<DicomWebSeries[]>(`/dicom-web/studies/${encodeURIComponent(studyInstanceUid)}/series`),

  searchInstances: (studyInstanceUid: string, seriesInstanceUid?: string) => {
    const qs = seriesInstanceUid ? `?series=${encodeURIComponent(seriesInstanceUid)}` : ''
    return api.get<DicomWebInstance[]>(`/dicom-web/studies/${encodeURIComponent(studyInstanceUid)}/instances${qs}`)
  },

  retrieveInstanceUrl: (study: string, series: string, sop: string) =>
    `/dicom-web/studies/${study}/series/${series}/instances/${sop}`,

  retrieveMetadata: (study: string, series: string, sop: string) =>
    api.get<Record<string, unknown>>(`/dicom-web/studies/${study}/series/${series}/instances/${sop}/metadata`),

  storeInstance: (studyInstanceUid: string, body: StoreInstancePayload) =>
    api.post<{ id: string }>(`/dicom-web/studies/${encodeURIComponent(studyInstanceUid)}`, body),

  // ══════════════════════════════════════════════════════════════════════════
  // WADO-RS 完整实现
  // ══════════════════════════════════════════════════════════════════════════

  wadoRsRetrieveStudy: (studyUID: string) =>
    api.get<ArrayBuffer>(`/dicom-web/studies/${encodeURIComponent(studyUID)}`),

  wadoRsRetrieveSeries: (studyUID: string, seriesUID: string) =>
    api.get<ArrayBuffer>(`/dicom-web/studies/${encodeURIComponent(studyUID)}/series/${encodeURIComponent(seriesUID)}`),

  wadoRsRetrieveInstance: (studyUID: string, seriesUID: string, instanceUID: string) =>
    api.get<ArrayBuffer>(`/dicom-web/studies/${encodeURIComponent(studyUID)}/series/${encodeURIComponent(seriesUID)}/instances/${encodeURIComponent(instanceUID)}`),

  wadoRsMetadata: (studyUID: string) =>
    api.get<Record<string, unknown>[]>(`/dicom-web/studies/${encodeURIComponent(studyUID)}/metadata`),

  // ══════════════════════════════════════════════════════════════════════════
  // STOW-RS (multipart/related)
  // ══════════════════════════════════════════════════════════════════════════
  stowRsStore: async (studyUID: string, dicomData: Blob | File): Promise<{ id: string }> => {
    const token = getToken()
    const headers: Record<string, string> = {
      Accept: 'application/dicom+json',
    }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const url = `${API_BASE}/dicom-web/studies/${encodeURIComponent(studyUID)}`
    const res = await fetch(url, { method: 'POST', headers, body: dicomData })
    if (!res.ok) throw new Error(`STOW-RS failed: ${res.status}`)
    return res.json()
  },
}

// ══════════════════════════════════════════════════════════════════════════
// DICOM DIMSE
// ══════════════════════════════════════════════════════════════════════════

export interface CEchoRequest {
  calledAeTitle?: string
  callingAeTitle?: string
  affectedSopClassUid?: string
}

export interface CStoreRequest {
  sopClassUid: string
  sopInstanceUid: string
  studyInstanceUid: string
  seriesInstanceUid: string
  modality: string
  patientId?: string
  patientName?: string
  studyDate?: string
  studyDescription?: string
  seriesNumber?: number
  instanceNumber?: number
  transferSyntax?: string
  pixelData?: string
  calledAeTitle?: string
  callingAeTitle?: string
}

export interface CFindMwlRequest {
  patientName?: string
  patientId?: string
  accessionNumber?: string
  modality?: string
  scheduledDate?: string
  scheduledDateFrom?: string
  scheduledDateTo?: string
  studyInstanceUid?: string
  queryRetrieveLevel?: 'PATIENT' | 'STUDY' | 'SERIES' | 'IMAGE'
}

export interface CMoveRequest {
  studyInstanceUid?: string
  seriesInstanceUid?: string
  sopInstanceUid?: string
  destinationAe: string
  destinationHost?: string
  destinationPort?: number
  queryRetrieveLevel?: 'STUDY' | 'SERIES' | 'IMAGE'
}

export interface UploadS3Request {
  sopInstanceUid: string
  bucketName?: string
  endpoint?: string
  accessKey?: string
  secretKey?: string
  region?: string
}

export interface DimseResponse {
  status: 'SUCCESS' | 'WARNING' | 'FAILURE'
  message?: string
  data?: unknown
}

export const dicomDimseApi = {
  cEcho: (body: CEchoRequest) =>
    api.post<DimseResponse>('/dicom-dimse/echo', body),

  cStore: (body: CStoreRequest) =>
    api.post<DimseResponse>('/dicom-dimse/store', body),

  cFind: (body: CFindMwlRequest) =>
    api.post<DimseResponse>('/dicom-dimse/find', body),

  cMove: (body: CMoveRequest) =>
    api.post<DimseResponse>('/dicom-dimse/move', body),

  uploadToS3: (body: UploadS3Request) =>
    api.post<DimseResponse>('/dicom-dimse/upload', body),
}
