import { api, API_BASE } from './client'
import { getToken } from '../../utils/auth'
import type { SuvResult } from './fusionApi'

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

// ══════════════════════════════════════════════════════════════════════════
// [G005 v3.0.6.11-91 Wave 4A (PACS P0-2)] 影像预取 (工作列表 prefetch)
// ══════════════════════════════════════════════════════════════════════════

export type PrefetchStudyStatus = 'queued' | 'cached'

export interface PrefetchResult {
  queued: number
  cached: number
}

export interface PrefetchStatus {
  total: number
  cached: number
  pending: number
  studies: Array<{ studyUid: string; status: PrefetchStudyStatus }>
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
  // [G005 v3.0.6.11-91 Wave 4A (PACS P0-2)] 影像预取 (后端模拟预取队列)
  // ══════════════════════════════════════════════════════════════════════════
  prefetch: (studyUids: string[]) =>
    api.post<PrefetchResult>('/dicom-web/prefetch', { studyUids }),

  prefetchStatus: () =>
    api.get<PrefetchStatus>('/dicom-web/prefetch/status'),

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
  stowRsStore: async (studyUID: string, dicomData: Blob | File, onProgress?: (percent: number) => void): Promise<{ id: string }> => {
    const token = getToken()
    const headers: Record<string, string> = {
      Accept: 'application/dicom+json',
    }
    if (token) headers['Authorization'] = `Bearer ${token}`
    const url = `${API_BASE}/dicom-web/studies/${encodeURIComponent(studyUID)}`
    if (onProgress && typeof XMLHttpRequest !== 'undefined') {
      return await new Promise<{ id: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('POST', url)
        Object.entries(headers).forEach(([k, v]) => xhr.setRequestHeader(k, v))
        xhr.upload.onprogress = (e: ProgressEvent) => {
          if (e.lengthComputable) onProgress(Math.min(100, Math.round((e.loaded / e.total) * 100)))
        }
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try { resolve(JSON.parse(xhr.responseText)) } catch { resolve({ id: studyUID }) }
          } else {
            reject(new Error(`STOW-RS failed: ${xhr.status}`))
          }
        }
        xhr.onerror = () => reject(new Error('STOW-RS network error'))
        xhr.send(dicomData)
      })
    }
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

// ══════════════════════════════════════════════════════════════════════════
// [G005 v3.0.6.11-86 Wave 4B (G-03)] DIMSE TLS 配置
// ══════════════════════════════════════════════════════════════════════════

export interface DicomTlsConfig {
  enabled: boolean
  certificate?: string
  caCert?: string
  port?: number
  verifyPeer?: boolean
}

export interface NodeTlsStatus {
  id: string
  tlsEnabled: boolean
  supported: boolean
}

// ══════════════════════════════════════════════════════════════════════════
// [G005 v3.0.6.11-86 Wave 4B (G-05)] MPPS 进度
// ══════════════════════════════════════════════════════════════════════════

export interface MppsPerformedStep {
  code?: string
  description?: string
  startTime?: string
  endTime?: string
}

export interface MppsRecord {
  studyUid: string
  status: 'IN_PROGRESS' | 'COMPLETED' | 'DISCONTINUED'
  patientName?: string
  patientId?: string
  modality?: string
  startedAt?: string
  completedAt?: string
  performedSteps: MppsPerformedStep[]
  updatedAt: string
  source: 'mpps' | 'exam'
}

// ══════════════════════════════════════════════════════════════════════════
// [G005 v3.0.6.11-90 Wave 4A (PACS P0-1)] DICOM C-STORE 传输队列
// ══════════════════════════════════════════════════════════════════════════

export interface TransferRecord {
  id: string
  studyUid: string
  targetAe: string
  status: 'queued' | 'sending' | 'paused' | 'failed' | 'completed' | 'canceled'
  progress: number
  totalInstances: number
  completedInstances: number
  priority: 'HIGH' | 'NORMAL' | 'LOW'
  createdAt: string
  updatedAt: string
  error?: string
  source: 'queue' | 'seed'
  // [v3.0.6.11-96 Wave 2B (D)] C-STORE ↔ worklist 联动: 关联检查
  examId?: string
  accessionNumber?: string
}

export interface TransferStats {
  total: number
  queued: number
  sending: number
  paused: number
  failed: number
  completed: number
  canceled: number
  activeCount: number
  successRate: number
  avgProgress: number
}

export interface EnqueueTransferRequest {
  studyUid: string
  targetAe: string
  priority?: 'HIGH' | 'NORMAL' | 'LOW'
  // [v3.0.6.11-96 Wave 2B (D)] C-STORE ↔ worklist 联动: 可选关联检查
  examId?: string
  accessionNumber?: string
}

export const dicomDimseApi = {
  cEcho: (body: CEchoRequest) =>
    api.post<DimseResponse>('/dicom-dimse/echo', body),

  // [v3.0.6.11-92] W2-B P2: 支持 FormData 文件上传 (multipart, DicomDimsePage C-STORE 迁移)
  // [v3.0.6.11-96 Wave 3A P2] FormData 走 XHR 上传并回调逐帧进度 (0-100)
  cStore: (body: CStoreRequest | FormData, onProgress?: (percent: number) => void) =>
    body instanceof FormData
      ? api.uploadWithProgress<DimseResponse>('/dicom-dimse/store', body, onProgress)
      : api.post<DimseResponse>('/dicom-dimse/store', body),

  cFind: (body: CFindMwlRequest) =>
    api.post<DimseResponse>('/dicom-dimse/find', body),

  cMove: (body: CMoveRequest) =>
    api.post<DimseResponse>('/dicom-dimse/move', body),

  uploadToS3: (body: UploadS3Request) =>
    api.post<DimseResponse>('/dicom-dimse/upload', body),

  // [G005 v3.0.6.11-86 Wave 4B (G-03)] TLS 配置 (全局 + 节点级)
  getTlsConfig: () => api.get<DicomTlsConfig>('/dicom-dimse/tls-config'),

  updateTlsConfig: (body: Partial<DicomTlsConfig>) =>
    api.put<DicomTlsConfig>('/dicom-dimse/tls-config', body),

  getNodeTls: (id: string) =>
    api.get<NodeTlsStatus>(`/dicom-dimse/nodes/${encodeURIComponent(id)}/tls`),

  setNodeTls: (id: string, enabled: boolean) =>
    api.put<NodeTlsStatus>(`/dicom-dimse/nodes/${encodeURIComponent(id)}/tls`, { enabled }),

  // [G005 v3.0.6.11-86 Wave 4B (G-05)] MPPS 进度
  sendMpps: (body: { studyUid: string; status: 'IN_PROGRESS' | 'COMPLETED' | 'DISCONTINUED'; performedSteps?: MppsPerformedStep[] }) =>
    api.post<MppsRecord>('/dicom-dimse/mpps', body),

  listMpps: () => api.get<MppsRecord[]>('/dicom-dimse/mpps'),

  // [G005 v3.0.6.11-90 Wave 4A (PACS P0-1)] DICOM C-STORE 传输队列
  listTransfers: () => api.get<TransferRecord[]>('/dicom-dimse/transfers'),

  enqueueTransfer: (body: EnqueueTransferRequest) =>
    api.post<TransferRecord>('/dicom-dimse/transfers', body),

  getTransferStats: () => api.get<TransferStats>('/dicom-dimse/transfers/stats'),

  retryTransfer: (id: string) =>
    api.post<TransferRecord>(`/dicom-dimse/transfers/${encodeURIComponent(id)}/retry`),

  pauseTransfer: (id: string) =>
    api.post<TransferRecord>(`/dicom-dimse/transfers/${encodeURIComponent(id)}/pause`),

  resumeTransfer: (id: string) =>
    api.post<TransferRecord>(`/dicom-dimse/transfers/${encodeURIComponent(id)}/resume`),

  cancelTransfer: (id: string) =>
    api.post<TransferRecord>(`/dicom-dimse/transfers/${encodeURIComponent(id)}/cancel`),
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

  // [G005 Wave4A G-06] PET-CT SUV 定量 (fusionApi.getSuv 对齐)
  getSuv: (studyId: string) =>
    api.get<SuvResult>(`/fusion/suv/${encodeURIComponent(studyId)}`),
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

// [G005 Wave4B] G-01 Encapsulated PDF (DICOM PDF 封装, SOP Class 1.2.840.10008.5.1.4.1.1.104.1)
export interface EncapsulatePdfPayload {
  reportId?: string
  studyId?: string
  pdfUrl?: string
  pdfBase64?: string
}

export interface EncapsulatedPdf {
  id: string
  reportId: string
  sopClassUid: string
  sopInstanceUid: string
  studyInstanceUid: string
  pdfEmbedded: string
  size: number
  generatedFrom: 'input' | 'url' | 'report-text'
  generatedAt: string
}

export const encapsulatedPdfApi = {
  encapsulate: (payload: EncapsulatePdfPayload) =>
    api.post<EncapsulatedPdf>('/dicom-sr/encapsulate-pdf', payload),

  findById: (id: string) =>
    api.get<EncapsulatedPdf>(`/dicom-sr/encapsulated/${encodeURIComponent(id)}`),
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
