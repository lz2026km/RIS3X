import { api } from './client'

export interface ExposureParamsDto {
  kVp?: number
  mAs?: number
  aec?: boolean
  rotationTime?: number
  pitch?: number
  thickness?: number
  collimation?: string
  reconstruction?: string
}

export interface ScanRangeDto {
  from?: number
  to?: number
  length?: number
  orientation?: string
  landmarks?: string[]
}

export interface ProtocolRecordDto {
  id: string
  code: string
  name: string
  modality: string
  bodyPart: string
  description?: string
  contrast: boolean
  seriesCount: number
  expectedImages: number
  exposureParams: ExposureParamsDto
  scanRange?: ScanRangeDto
  contrastProtocolId?: string
  source: string
  createdAt: string
  updatedAt: string
}

export interface SeriesRecordDto {
  id: string
  examId: string
  seriesNumber: number
  seriesInstanceUid: string
  description: string
  modality: string
  imageCount: number
  acquiredAt: string
  exposureParams?: ExposureParamsDto
  source: string
}

export type SeriesQcQuality = 'PASS' | 'REJECT'

export interface SeriesQcRecordDto {
  id: string
  examId: string
  seriesNumber: number
  quality: SeriesQcQuality
  reason?: string
  score?: number
  scoredBy?: string
  scoredAt: string
  retakeCount: number
  source: string
}

export interface ExamProtocolStateDto {
  examId: string
  protocolId?: string
  protocolName?: string
  seriesCount?: number
  expectedImages?: number
  exposureParams?: ExposureParamsDto
  scanRange?: ScanRangeDto
  contrastProtocolId?: string
  updatedAt?: string
  source: string
}

export interface ProtocolValidationDto {
  expectedImages: number
  capturedImages: number
  capturedSeries: number
  expectedSeries: number
  matches: boolean
  imageCountMismatch: boolean
  delta: number
  message: string
}

export interface ExamDoseRecordDto {
  id: string
  examId: string
  studyUid: string
  modality: string
  bodyPart: string
  ctdiVol: number
  dlp: number
  ssde?: number
  source: string
  recordedAt: string
  updatedAt: string
}

export interface ExamExecutionSummaryDto {
  examId: string
  accessionNumber?: string
  protocol: ProtocolRecordDto | null
  state: ExamProtocolStateDto
  series: SeriesRecordDto[]
  validation: ProtocolValidationDto
  seriesQc: SeriesQcRecordDto[]
  qcSummary: { total: number; passed: number; rejected: number }
  dose: ExamDoseRecordDto | null
  retakeCount: number
  mppsStatus?: string
}

export type MwlItemState = 'SCHEDULED' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED' | 'DISCONTINUED'

export interface MwlWorklistItemDto {
  id: string
  accessionNumber: string
  patientName: string
  patientId: string
  modality: string
  bodyPart: string
  studyInstanceUid: string
  seriesInstanceUid: string
  requestedProcedureId: string
  requestedProcedureDescription: string
  scheduledStationAeTitle: string
  scheduledDate: string
  scheduledTime: string
  contrast: boolean
  contrastAgent?: string
  priority: string
  state: MwlItemState
  mppsStatus?: MwlItemState
  examId?: string
  deviceId?: string
  source: string
}

export interface MwlQueryResultDto {
  queryRetrieveLevel: string
  sopClassUid: string
  matches: number
  source: string
  items: MwlWorklistItemDto[]
  dataset: Array<Record<string, unknown>>
}

export interface MwlQueryParams {
  modality?: string
  date?: string
  dateFrom?: string
  dateTo?: string
  patientName?: string
  patientId?: string
  accessionNumber?: string
  stationAE?: string
}

export interface MppsLinkedRecordDto {
  studyUid: string
  status: 'IN_PROGRESS' | 'COMPLETED' | 'DISCONTINUED'
  patientName?: string
  patientId?: string
  modality?: string
  accessionNumber?: string
  requestedProcedureId?: string
  examId?: string
  startedAt?: string
  completedAt?: string
  updatedAt: string
  source: string
}

export interface ExamMppsDto {
  accessionNumber: string
  examId: string | null
  total: number
  mwlState?: MwlItemState
  items: MppsLinkedRecordDto[]
}

function buildQuery(params?: MwlQueryParams): string {
  const sp = new URLSearchParams()
  if (params) Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') sp.set(k, String(v)) })
  const q = sp.toString()
  return q ? `?${q}` : ''
}

export const execApi = {
  listProtocols: (params?: { modality?: string; bodyPart?: string }) =>
    api.get<{ items: ProtocolRecordDto[]; total: number }>(`/protocols${buildQuery(params as MwlQueryParams)}`),

  getProtocol: (id: string) => api.get<ProtocolRecordDto>(`/protocols/${encodeURIComponent(id)}`),

  createProtocol: (body: Partial<ProtocolRecordDto> & { code: string; name: string; modality: string; bodyPart: string }) =>
    api.post<ProtocolRecordDto>('/protocols', body),

  getExamExecution: (examId: string) => api.get<ExamExecutionSummaryDto>(`/exam/${encodeURIComponent(examId)}/execution`),

  getExamProtocol: (examId: string) => api.get<ExamExecutionSummaryDto>(`/exam/${encodeURIComponent(examId)}/protocol`),

  setExamProtocol: (examId: string, body: {
    protocolId?: string
    seriesCount?: number
    expectedImages?: number
    exposureParams?: ExposureParamsDto
    scanRange?: ScanRangeDto
    contrastProtocolId?: string
  }) => api.put<ExamProtocolStateDto>(`/exam/${encodeURIComponent(examId)}/protocol`, body),

  listSeries: (examId: string) =>
    api.get<{ items: SeriesRecordDto[]; total: number }>(`/exam/${encodeURIComponent(examId)}/series`),

  registerSeries: (examId: string, body: { seriesNumber: number; imageCount: number; description?: string; seriesInstanceUid?: string; modality?: string; acquiredAt?: string; exposureParams?: ExposureParamsDto }) =>
    api.post<SeriesRecordDto>(`/exam/${encodeURIComponent(examId)}/series`, body),

  listSeriesQc: (examId: string) =>
    api.get<{ items: SeriesQcRecordDto[]; total: number }>(`/exam/${encodeURIComponent(examId)}/series-qc`),

  submitSeriesQc: (examId: string, body: { items: Array<{ seriesNumber: number; quality: SeriesQcQuality; reason?: string; score?: number }>; scoredBy?: string; note?: string }) =>
    api.post<{ records: SeriesQcRecordDto[]; retakeTriggered: boolean; retakeCount: number; validation: ProtocolValidationDto }>(
      `/exam/${encodeURIComponent(examId)}/series-qc`,
      body,
    ),

  getDose: (examId: string) => api.get<ExamDoseRecordDto | null>(`/exam/${encodeURIComponent(examId)}/dose`),

  writeDose: (examId: string, body: {
    ctdivol?: number
    dlp?: number
    ssde?: number
    studyUid?: string
    bodyPart?: string
    modality?: string
    source?: 'RDSR' | 'MANUAL'
  }) => api.post<ExamDoseRecordDto>(`/exam/${encodeURIComponent(examId)}/dose`, body),
}

export const mwlApi = {
  worklistItems: (params?: MwlQueryParams) =>
    api.get<{ items: MwlWorklistItemDto[]; total: number; source: string }>(`/dicom-dimse/mwl/worklist-items${buildQuery(params)}`),

  query: (body: MwlQueryParams) =>
    api.post<MwlQueryResultDto>('/dicom-dimse/mwl/query', body),

  getExamMpps: (accessionNumber: string) =>
    api.get<ExamMppsDto>(`/exam/${encodeURIComponent(accessionNumber)}/mpps`),

  sendMpps: (body: { studyUid: string; status: 'IN_PROGRESS' | 'COMPLETED' | 'DISCONTINUED'; accessionNumber?: string; requestedProcedureId?: string; examId?: string }) =>
    api.post<MppsLinkedRecordDto>('/dicom-dimse/mpps', body),
}

export type { MwlQueryResultDto as MwlQueryResult }
