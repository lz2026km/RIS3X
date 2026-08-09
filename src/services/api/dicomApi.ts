import { api, API_BASE } from './client'
import { getToken } from '../../utils/auth'

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
  // [W3-2] 文件元数据 (DimseUploadPage 真实上传)
  fileName?: string
  fileSize?: number
  mimeType?: string
  payloadBase64?: string
  destination?: string
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

// ══════════════════════════════════════════════════════════════════════════
// DICOM 4D
// ══════════════════════════════════════════════════════════════════════════

export interface Series4D {
  seriesUid: string
  studyUid: string
  patientName: string
  patientId: string
  modality: string
  seriesDescription: string
  frameCount: number
  frameRate: number
  gatingType: 'cardiac' | 'respiratory' | 'both'
  dimensions: { width: number; height: number }
}

export interface FrameData4D {
  frameIndex: number
  timestamp: string
  phase: number
  dataUrl: string
}

export interface PhaseInfo4D {
  seriesUid: string
  gatingType: 'cardiac' | 'respiratory' | 'both'
  cardiacPhase: number
  respiratoryPhase: number
  cardiacCycleMs: number
  respiratoryCycleMs: number
  frameCount: number
}

export const dicom4dApi = {
  list: () => api.post<Series4D[]>('/dicom/4d/list', {}),
  frames: (seriesUid: string) => api.post<FrameData4D[]>('/dicom/4d/frames', { seriesUid }),
  phase: (seriesUid: string) => api.get<PhaseInfo4D>(`/dicom/4d/phase/${encodeURIComponent(seriesUid)}`),
}

// ══════════════════════════════════════════════════════════════════════════
// Volume 3D Rendering
// ══════════════════════════════════════════════════════════════════════════

export interface VolumeReconstructResult {
  jobId: string
  volume: { x: number; y: number; z: number }
}

export interface VolumeStatusResult {
  status: string
  progress: number
  volume: { x: number; y: number; z: number } | null
}

export interface MprSliceResult {
  plane: string
  sliceIndex: number
  totalSlices: number
  dimensions: { width: number; height: number }
  dataUrl: string
}

export interface MipResult {
  direction: string
  dimensions: { width: number; height: number }
  dataUrl: string
}

export const volumeApi = {
  reconstruct: (seriesUID: string) =>
    api.post<VolumeReconstructResult>('/volume/reconstruct', { seriesUID }),

  status: (jobId: string) =>
    api.get<VolumeStatusResult>(`/volume/status/${encodeURIComponent(jobId)}`),

  mpr: (jobId: string, plane: 'axial' | 'sagittal' | 'coronal', sliceIndex: number) =>
    api.post<MprSliceResult>('/volume/mpr', { jobId, plane, sliceIndex }),

  mip: (jobId: string, direction: 'axial' | 'sagittal' | 'coronal') =>
    api.post<MipResult>('/volume/mip', { jobId, direction }),
}

// ══════════════════════════════════════════════════════════════════════════
// PET-CT / Multi-modal Fusion
// ══════════════════════════════════════════════════════════════════════════

export interface FusionSeriesItem {
  modality: string
  seriesDescription: string
  instanceCount: number
}

export interface FusionSeriesResult {
  patientId: string
  series: FusionSeriesItem[]
}

export interface FusionRegisterResult {
  registrationId: string
  fixedSeriesUid: string
  movingSeriesUid: string
  transformType: string
  status: string
  metrics: { dice: number; hd95: number; rmse: number }
  matrix: number[][]
}

export interface FusionRenderResult {
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

export const fusionApi = {
  getSeries: (patientId: string) =>
    api.get<FusionSeriesResult>(`/fusion/series/${encodeURIComponent(patientId)}`),

  register: (fixedSeriesUid: string, movingSeriesUid: string, transformType: 'rigid' | 'affine' | 'deformable' = 'rigid') =>
    api.post<FusionRegisterResult>('/fusion/register', { fixedSeriesUid, movingSeriesUid, transformType }),

  render: (params: {
    fixedSeriesUid: string
    movingSeriesUid: string
    plane?: 'axial' | 'coronal' | 'sagittal'
    sliceIndex: number
    alpha?: number
    windowWidth?: number
    windowLevel?: number
    fusionWindowWidth?: number
    fusionWindowLevel?: number
  }) => api.post<FusionRenderResult>('/fusion/render', params),
}

// ══════════════════════════════════════════════════════════════════════════
// DICOM Structured Report (SR)
// ══════════════════════════════════════════════════════════════════════════

export interface DicomSrTemplate {
  id: string
  label: string
  labelEn: string
  description: string
  tid: string
}

export interface DicomSrDocument {
  id: string
  reportId: string
  templateId: string
  tid: string
  content: string
  status: string
  generatedAt: string
  sopInstanceUID: string
}

export interface GenerateSrPayload {
  reportId: string
  templateId: 'tid1500' | 'tid2000'
  findings?: string
  impression?: string
}

export const dicomSrApi = {
  getTemplates: () =>
    api.post<DicomSrTemplate[]>('/dicom-sr/templates', {}),

  generate: (payload: GenerateSrPayload) =>
    api.post<DicomSrDocument>('/dicom-sr/generate', payload),

  findById: (id: string) =>
    api.get<DicomSrDocument>(`/dicom-sr/${encodeURIComponent(id)}`),
}

export interface CrossModalSearchResult {
  id: string
  patientName: string
  patientId: string
  modality: string
  studyDate: string
  description: string
  similarity: number
  thumbnail?: string
}

// [G005 Wave1B P1] 路径对齐: /dicom/cross-modal-search* → 真实后端 /cross-modal/* (cross-modal.controller)
// 原 GET /dicom/cross-modal-search 仅有 MSW 支撑; 后端真实端点为 POST /cross-modal/search、POST /cross-modal/similar。
export const crossModalSearchApi = {
  search: (params: { query: string; modality?: string; limit?: number }) =>
    api.post<CrossModalSearchResult[]>('/cross-modal/search', {
      query: params.query,
      ...(params.modality ? { modalities: [params.modality] } : {}),
      limit: params.limit,
    }),

  findSimilar: (id: string, limit?: number) =>
    api.post<CrossModalSearchResult[]>('/cross-modal/similar', { imageId: id, limit }),
}
