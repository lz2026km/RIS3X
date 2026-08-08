import { dicomWebApi } from './dicomApi'

// [G005 W3-A] WADO-RS API client — 改调后端 DICOMweb (/dicom-web/studies)
// 后端无 /dicom/wado-rs/* 前缀; QIDO-RS 检索 / WADO-RS 元数据均由 @Controller('dicom-web') 提供。
// 本文件保留 WadoRs 命名与返回形状, 底层复用 dicomWebApi 并做字段映射 (页面无需改动)。

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

function toStudy(d: {
  studyInstanceUID: string
  patientName: string
  patientID: string
  studyDate: string
  studyDescription?: string
  modalitiesInStudy?: string[]
  numberOfStudyRelatedSeries?: number
  numberOfStudyRelatedInstances?: number
}): WadoRsStudy {
  return {
    studyInstanceUid: d.studyInstanceUID,
    patientName: d.patientName,
    patientId: d.patientID,
    studyDate: d.studyDate,
    studyDescription: d.studyDescription ?? '',
    modality: (d.modalitiesInStudy ?? [])[0] ?? '',
    seriesCount: d.numberOfStudyRelatedSeries ?? 0,
    instanceCount: d.numberOfStudyRelatedInstances ?? 0,
  }
}

function toSeries(d: {
  seriesInstanceUID: string
  seriesNumber: number
  modality: string
  seriesDescription?: string
  numberOfSeriesRelatedInstances?: number
  bodyPartExamined?: string
}): WadoRsSeries {
  return {
    seriesInstanceUid: d.seriesInstanceUID,
    seriesNumber: d.seriesNumber,
    modality: d.modality,
    seriesDescription: d.seriesDescription ?? '',
    instanceCount: d.numberOfSeriesRelatedInstances ?? 0,
    bodyPart: d.bodyPartExamined ?? '',
  }
}

function toInstance(d: {
  sopInstanceUID: string
  sopClassUID: string
  instanceNumber: number
  seriesInstanceUID: string
  studyInstanceUID: string
}, studyUid: string, seriesUid: string): WadoRsInstance {
  return {
    sopInstanceUid: d.sopInstanceUID,
    instanceNumber: d.instanceNumber,
    sopClassUid: d.sopClassUID,
    transferSyntaxUid: '',
    wadoUri: dicomWebApi.retrieveInstanceUrl(studyUid, seriesUid, d.sopInstanceUID),
  }
}

export const wadoRsApi = {
  queryStudies: async (params?: WadoRsQueryParams) => {
    const q: Record<string, string> = {}
    if (params?.patientId) q.PatientID = params.patientId
    if (params?.modality) q.Modality = params.modality
    if (params?.pageSize) q.limit = String(params.pageSize)
    if (params?.page) q.offset = String((params.page - 1) * (params.pageSize ?? 50))
    const res = await dicomWebApi.searchStudies(
      Object.keys(q).length > 0 ? (q as { PatientID?: string; Modality?: string; limit?: number; offset?: number }) : undefined,
    )
    return {
      success: res.success,
      data: (res.data ?? []).map(toStudy),
      error: res.error,
    }
  },

  getStudy: async (studyUid: string) => {
    const res = await dicomWebApi.searchStudies({ StudyInstanceUID: studyUid })
    const hit = (res.data ?? []).find((s) => s.studyInstanceUID === studyUid)
    return {
      success: res.success && !!hit,
      data: hit ? toStudy(hit) : null,
      error: hit ? undefined : { code: 'NOT_FOUND', message: `Study ${studyUid} not found` },
    }
  },

  getSeries: async (studyUid: string) => {
    const res = await dicomWebApi.searchSeries(studyUid)
    return {
      success: res.success,
      data: (res.data ?? []).map(toSeries),
      error: res.error,
    }
  },

  getInstances: async (studyUid: string, seriesUid: string) => {
    const res = await dicomWebApi.searchInstances(studyUid, seriesUid)
    return {
      success: res.success,
      data: (res.data ?? []).map((d) => toInstance(d, studyUid, seriesUid)),
      error: res.error,
    }
  },

  getInstance: async (studyUid: string, seriesUid: string, instanceUid: string) => {
    const res = await dicomWebApi.searchInstances(studyUid, seriesUid)
    const hit = (res.data ?? []).find((d) => d.sopInstanceUID === instanceUid)
    return {
      success: res.success && !!hit,
      data: hit ? toInstance(hit, studyUid, seriesUid) : null,
      error: hit ? undefined : { code: 'NOT_FOUND', message: `Instance ${instanceUid} not found` },
    }
  },

  getMetadata: (studyUid: string, seriesUid?: string, instanceUid?: string) =>
    dicomWebApi.retrieveMetadata(studyUid, seriesUid ?? '', instanceUid ?? ''),
}
