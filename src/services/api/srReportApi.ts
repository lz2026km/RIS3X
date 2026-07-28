import { api, invalidateApiCache } from './client'

// SR Report (结构化报告) API
// Backend: /api/v1/dicom/sr-report/*

export interface SrReport {
  id: string
  studyInstanceUid: string
  seriesInstanceUid: string
  sopInstanceUid: string
  patientName: string
  patientId: string
  modality: string
  reportType: 'comprehensive' | 'key_object' | 'measurement' | 'textural'
  title: string
  content: SrReportContent
  status: 'draft' | 'final' | 'amended'
  authorId: string
  authorName: string
  createdAt: string
  updatedAt: string
}

export interface SrReportContent {
  patient: { name: string; id: string; birthDate?: string }
  study: { uid: string; date: string; description: string }
  findings: SrFinding[]
  conclusion: string
  recommendations?: string
}

export interface SrFinding {
  id: string
  category: string
  description: string
  measurements?: SrMeasurement[]
  location?: string
  severity?: string
  confidence?: number
}

export interface SrMeasurement {
  id: string
  name: string
  value: number
  unit: string
  normalRange?: { min: number; max: number }
}

export interface CreateSrReportDto {
  studyInstanceUid: string
  reportType: 'comprehensive' | 'key_object' | 'measurement' | 'textural'
  title: string
  findings: Omit<SrFinding, 'id'>[]
  conclusion: string
  recommendations?: string
}

export interface SrReportQueryParams {
  studyInstanceUid?: string
  patientId?: string
  reportType?: string
  status?: string
  page?: number
  pageSize?: number
}

export const srReportApi = {
  listReports: (params?: SrReportQueryParams) =>
    api.get<SrReport[]>(`/dicom/sr-report/reports?${new URLSearchParams(params ?? {}).toString()}`),

  getReport: (id: string) =>
    api.get<SrReport>(`/dicom/sr-report/reports/${id}`),

  createReport: async (data: CreateSrReportDto) => {
    const res = await api.post<SrReport>('/dicom/sr-report/reports', data)
    await invalidateApiCache('/dicom/sr-report/reports')
    return res
  },

  updateReport: async (id: string, data: Partial<CreateSrReportDto>) => {
    const res = await api.put<SrReport>(`/dicom/sr-report/reports/${id}`, data)
    await invalidateApiCache(`/dicom/sr-report/reports/${id}`)
    return res
  },

  finalizeReport: async (id: string) => {
    const res = await api.post<SrReport>(`/dicom/sr-report/reports/${id}/finalize`, {})
    await invalidateApiCache(`/dicom/sr-report/reports/${id}`)
    return res
  },

  deleteReport: async (id: string) => {
    const res = await api.delete(`/dicom/sr-report/reports/${id}`)
    await invalidateApiCache('/dicom/sr-report/reports')
    return res
  },

  getReportByStudy: (studyUid: string) =>
    api.get<SrReport[]>(`/dicom/sr-report/studies/${studyUid}/reports`),
}
