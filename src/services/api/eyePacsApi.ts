import { api } from './client'

const EYE_PACS = '/eye/pacs'

export interface EyeStudyDto {
  id: string
  patientId: string
  patientName: string
  modality: string
  studyDate: string
  device: string
  eyeSide?: string
  images?: unknown[]
}

export interface EyeMeasurementDto {
  id: string
  studyId: string
  type: string
  value: number
  unit: string
  description: string
}

export interface KeyImageDto {
  id: string
  studyId: string
  reason: string
  flaggedBy: string
  flaggedAt: string
}

export interface LesionSegmentationDto {
  id: string
  studyId: string
  type: string
  area: number
  distanceFromFovea: number
  quadrant: string
  confidence: number
}

export interface AiDiagnosisDto {
  id: string
  studyId: string
  modelName: string
  diagnosis: string
  confidence: number
  severity: string
  timestamp: string
  confirmed: boolean
}

export interface EyeAnnotationDto {
  id: string
  studyId: string
  x: number
  y: number
  label: string
  createdBy: string
}

export const eyePacsApi = {
  getStudies: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : ''
    return api.get<EyeStudyDto[]>(`${EYE_PACS}/studies${qs}`)
  },
  getStudy: (id: string) => api.get<EyeStudyDto>(`${EYE_PACS}/studies/${id}`),
  getMeasurements: (studyId?: string) =>
    api.get<EyeMeasurementDto[]>(`${EYE_PACS}/measurements${studyId ? '?studyId=' + encodeURIComponent(studyId) : ''}`),
  getKeyImages: (studyId?: string) =>
    api.get<KeyImageDto[]>(`${EYE_PACS}/key-images${studyId ? '?studyId=' + encodeURIComponent(studyId) : ''}`),
  getLesionSegmentations: (studyId?: string) =>
    api.get<LesionSegmentationDto[]>(`${EYE_PACS}/lesion-segmentations${studyId ? '?studyId=' + encodeURIComponent(studyId) : ''}`),
  getAnnotations: (studyId?: string) =>
    api.get<EyeAnnotationDto[]>(`${EYE_PACS}/annotations${studyId ? '?studyId=' + encodeURIComponent(studyId) : ''}`),
}
