import { dicomWebApi } from './dicomApi'

// [G005 W3-A] STOW-RS API client — 改调后端 DICOMweb (/dicom-web/studies)
// 后端无 /dicom/stow-rs/* 前缀; 存储走 POST /dicom-web/studies/:study (STOW-RS),
// 已存储列表复用 QIDO-RS GET /dicom-web/studies。本文件保留 StowRs 命名与返回形状。

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

function fileFromForm(formData: FormData): File | null {
  const f = formData.get('file')
  return f instanceof File ? f : null
}

async function store(formData: FormData, studyUid?: string): Promise<StowRsStoreResponse> {
  const file = fileFromForm(formData)
  if (!file) {
    return {
      contentType: 'application/dicom',
      studyInstanceUid: studyUid ?? '',
      seriesInstanceUid: '',
      receivedInstanceCount: 0,
      results: [{ studyInstanceUid: studyUid ?? '', seriesInstanceUid: '', sopInstanceUid: '', status: 'failure', failureReason: 'no file in FormData' }],
    }
  }
  const uid = studyUid ?? `STOW-${Date.now()}`
  await dicomWebApi.stowRsStore(uid, file)
  return {
    contentType: 'application/dicom',
    studyInstanceUid: uid,
    seriesInstanceUid: '',
    receivedInstanceCount: 1,
    results: [{ studyInstanceUid: uid, seriesInstanceUid: '', sopInstanceUid: '', status: 'success' }],
  }
}

export const stowRsApi = {
  storeInstances: async (data: { formData: FormData }) => {
    try {
      const storeRes = await store(data.formData)
      return { success: true, data: storeRes }
    } catch (e) {
      return {
        success: false,
        data: null,
        error: { code: 'STOW_FAILED', message: (e as Error)?.message ?? '存储失败' },
      }
    }
  },

  storeToStudy: async (studyUid: string, data: { formData: FormData }) => {
    try {
      const storeRes = await store(data.formData, studyUid)
      return { success: true, data: storeRes }
    } catch (e) {
      return {
        success: false,
        data: null,
        error: { code: 'STOW_FAILED', message: (e as Error)?.message ?? '存储失败' },
      }
    }
  },

  listStored: async (params?: StowRsQueryParams) => {
    const q: Record<string, string> = {}
    if (params?.patientId) q.PatientID = params.patientId
    if (params?.studyInstanceUid) q.StudyInstanceUID = params.studyInstanceUid
    if (params?.pageSize) q.limit = String(params.pageSize)
    if (params?.page) q.offset = String((params.page - 1) * (params.pageSize ?? 50))
    const res = await dicomWebApi.searchStudies(
      Object.keys(q).length > 0 ? (q as { PatientID?: string; StudyInstanceUID?: string; limit?: number; offset?: number }) : undefined,
    )
    const data: StowRsStoredInstance[] = (res.data ?? []).map((s) => ({
      id: s.studyInstanceUID,
      studyInstanceUid: s.studyInstanceUID,
      seriesInstanceUid: '',
      sopInstanceUid: '',
      patientName: s.patientName,
      patientId: s.patientID,
      modality: (s.modalitiesInStudy ?? [])[0] ?? '',
      studyDate: s.studyDate,
      receivedAt: '',
      storedBy: '',
    }))
    return { success: res.success, data, error: res.error }
  },
}
