import { api, invalidateApiCache } from './client'
import { API_BASE } from './client'
import { getToken } from '../../utils/auth'

// SR Report (结构化报告) API
// [G005 W3-A] Backend: /api/dicom-sr/* (原 /dicom/sr-report/* 后端无对应, 已对齐)

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

// [G005 W3-A] SrReport 段路径对齐: /dicom/sr-report/* -> /dicom-sr (后端 @Controller('dicom-sr'))
//   listReports   -> GET  /dicom-sr (文档列表)
//   getReport     -> GET  /dicom-sr/:id
//   createReport  -> POST /dicom-sr/generate
//   finalizeReport-> POST /dicom-sr/:id/finalize
//   getReportByStudy -> GET /dicom-sr + 客户端按 studyInstanceUid 过滤
//   updateReport / deleteReport 后端无对应端点, 已移除 (无调用方)。
export const srReportApi = {
  listReports: (params?: SrReportQueryParams) =>
    api.get<SrDocument[]>(`/dicom-sr?${new URLSearchParams((params ?? {}) as Record<string, string>).toString()}`),

  getReport: (id: string) =>
    api.get<SrDocument>(`/dicom-sr/${encodeURIComponent(id)}`),

  createReport: async (data: CreateSrReportDto) => {
    const res = await api.post<SrDocument>('/dicom-sr/generate', {
      reportId: data.studyInstanceUid,
      templateId: 'tid1500',
      findings: data.conclusion,
      impression: data.recommendations,
    })
    await invalidateApiCache('/dicom-sr')
    return res
  },

  finalizeReport: async (id: string) => {
    const res = await api.post<SrDocument>(`/dicom-sr/${encodeURIComponent(id)}/finalize`, {})
    await invalidateApiCache(`/dicom-sr/${encodeURIComponent(id)}`)
    return res
  },

  getReportByStudy: async (studyUid: string) => {
    const res = await api.get<SrDocument[]>('/dicom-sr')
    if (!res.success) return res
    return { ...res, data: (res.data ?? []).filter((d) => d.studyInstanceUid === studyUid) }
  },

  // [G005 Wave1A P0] 下载 SR 文档 (后端 GET /dicom-sr/:id/download, application/dicom Blob)
  download: (id: string) => srDocumentApi.downloadDocument(id),
}

// ────────────────────────────────────────────────────────────────────────────
// v3.0.6.11-60: DICOM SR 文档全链路 (Backend: /api/dicom-sr/*)
// 生成 → 存储 → 查看(结构化树) → ORU^R01 回传
// ────────────────────────────────────────────────────────────────────────────

export type SrStatus = 'draft' | 'finalized' | 'pushed'

export interface SrConceptName {
  code: string
  scheme: string
  meaning: string
}

export interface SrContentItem {
  relationshipType: string
  conceptName: SrConceptName
  valueType: 'TEXT' | 'CODE' | 'NUM' | 'DATE' | 'UIDREF'
  value?: string
  code?: SrConceptName
  children?: SrContentItem[]
}

export interface SrSection {
  conceptName: SrConceptName
  title: string
  items: SrContentItem[]
}

export interface SrContentTree {
  templateId: string
  templateLabel: string
  context: {
    patient: { name: string; id: string; birthDate: string; sex: string }
    study: { uid: string; date: string; time: string; description: string; accessionNumber: string; modality: string }
    report: { id: string; authorId: string; authorName: string; findings: string; impression: string; conclusion: string; recommendations: string; reportDate: string }
  }
  sections: SrSection[]
  codedEntries: SrConceptName[]
}

export interface SrDocument {
  id: string
  reportId: string
  templateId: string
  tid: string
  status: SrStatus
  sopInstanceUid: string
  studyInstanceUid: string
  seriesInstanceUid: string
  sopClassUid: string
  patientName: string
  patientId: string
  modality: string
  title: string
  content: SrContentTree
  rawContent: string
  hl7ControlId?: string | null
  hl7Message?: string | null
  pushedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface GenerateSrPayload {
  reportId: string
  templateId: 'tid1500' | 'tid2000'
  findings?: string
  impression?: string
}

export interface PushOruResult {
  document: SrDocument
  oru: { message: string; controlId: string; pushed: boolean; ackStatus: string }
}

export interface SrTemplateInfo {
  id: string
  label: string
  labelEn: string
  description: string
  tid: string
}

const SR_PATH = '/dicom-sr'

export const srDocumentApi = {
  listDocuments: () => api.get<SrDocument[]>(SR_PATH),

  getDocument: (id: string) => api.get<SrDocument>(`${SR_PATH}/${id}`),

  getDocumentByReport: (reportId: string) =>
    api.get<SrDocument>(`${SR_PATH}/by-report/${reportId}`),

  getTemplates: () => api.post<SrTemplateInfo[]>(`${SR_PATH}/templates`, {}),

  generateByReport: async (payload: GenerateSrPayload) => {
    const res = await api.post<SrDocument>(`${SR_PATH}/generate`, payload)
    await invalidateApiCache(SR_PATH)
    return res
  },

  finalizeDocument: async (id: string) => {
    const res = await api.post<SrDocument>(`${SR_PATH}/${id}/finalize`, {})
    await invalidateApiCache(SR_PATH)
    await invalidateApiCache(`${SR_PATH}/${id}`)
    return res
  },

  pushOru: async (id: string) => {
    const res = await api.post<PushOruResult>(`${SR_PATH}/${id}/push-oru`, {})
    await invalidateApiCache(SR_PATH)
    await invalidateApiCache(`${SR_PATH}/${id}`)
    return res
  },

  downloadDocument: async (id: string): Promise<{ blob: Blob; filename: string } | null> => {
    const url = `${API_BASE}${SR_PATH}/${id}/download`
    const token = getToken()
    try {
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!res.ok) return null
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition') ?? ''
      const m = cd.match(/filename="?([^";]+)"?/)
      return { blob, filename: m?.[1] ?? `${id}.sr` }
    } catch {
      return null
    }
  },
}
