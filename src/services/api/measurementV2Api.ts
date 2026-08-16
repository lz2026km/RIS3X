/**
 * G005 RIS v3.0.6.11-101 Wave 3B (影像测量 V2 + 标注 V2 双向同步) - measurementV2Api
 * 8 工具确定性测量 / 标注对象 CRUD / 像素↔世界坐标换算 / 历史版本回滚
 */
import { api } from './client'
import type { ApiResponse } from './types'

export type MeasureV2Type = 'line' | 'angle' | 'ellipseArea' | 'rectangleArea' | 'polygonArea' | 'polyline' | 'cobb' | 'calciumScore'
export type AnnotationV2Type = 'text' | 'arrow' | 'rect' | 'ellipse' | 'freehand'

export interface Point2D {
  x: number
  y: number
}

export interface MeasurementTypeMeta {
  type: MeasureV2Type
  label: string
  unit: string
  minPoints: number
  fixedPoints: number
  deterministic: boolean
  formula: string
  precision: number
}

export interface ComputeResult {
  type: MeasureV2Type
  value: number
  unit: string
  formula: string
  deterministic: boolean
  precision: number
  detail?: Record<string, number>
}

export interface MeasurementV2Version {
  version: number
  value: number
  unit: string
  points: Point2D[]
  worldPoints: Point2D[]
  label: string
  color: string
  note: string
  createdAt: string
}

export interface MeasurementV2Record {
  id: string
  studyUid: string
  seriesUid: string
  type: MeasureV2Type
  points: Point2D[]
  worldPoints: Point2D[]
  value: number
  unit: string
  label: string
  color: string
  visible: boolean
  formula: string
  deterministic: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
  version: number
  versions: MeasurementV2Version[]
  annotationId: string | null
}

export interface AnnotationV2Version {
  version: number
  type: AnnotationV2Type
  pixelPoints: Point2D[]
  worldPoints: Point2D[]
  text: string
  color: string
  fontSize: number
  note: string
  createdAt: string
}

export interface AnnotationV2Record {
  id: string
  studyUid: string
  seriesUid: string
  type: AnnotationV2Type
  pixelPoints: Point2D[]
  worldPoints: Point2D[]
  text: string
  color: string
  fontSize: number
  visible: boolean
  locked: boolean
  measurementId: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  version: number
  versions: AnnotationV2Version[]
}

export interface CreateMeasurementV2Dto {
  studyUid: string
  seriesUid?: string
  type: MeasureV2Type
  points: Point2D[]
  pixelSpacing?: [number, number]
  huValues?: number[]
  huThreshold?: number
  label?: string
  color?: string
  visible?: boolean
  createdBy?: string
}

export interface CreateAnnotationV2Dto {
  studyUid: string
  seriesUid?: string
  type: AnnotationV2Type
  pixelPoints: Point2D[]
  pixelSpacing?: [number, number]
  text?: string
  color?: string
  fontSize?: number
  visible?: boolean
  locked?: boolean
  measurementId?: string
  createdBy?: string
}

export interface ConvertCoordinatesInput {
  points: Point2D[]
  pixelSpacing: [number, number]
  direction: 'pixelToWorld' | 'worldToPixel'
}

export interface ConvertCoordinatesResult {
  points: Point2D[]
  pixelSpacing: [number, number]
  direction: 'pixelToWorld' | 'worldToPixel'
}

const unwrap = <T>(res: ApiResponse<T>): T => {
  if (res?.success && res.data !== undefined && res.data !== null) return res.data
  throw new Error(res?.error?.message ?? '接口返回异常')
}

export const measurementV2Api = {
  listTypes: () =>
    api.get<MeasurementTypeMeta[]>('/measurement-v2/types')
      .then((res) => unwrap(res)),

  seedStudyUids: () =>
    api.get<string[]>('/measurement-v2/seed-study-uids')
      .then((res) => unwrap(res)),

  compute: (body: { type: MeasureV2Type; points: Point2D[]; pixelSpacing?: [number, number]; huValues?: number[]; huThreshold?: number }) =>
    api.post<ComputeResult>('/measurement-v2/compute', body)
      .then((res) => unwrap(res)),

  convertCoordinates: (body: ConvertCoordinatesInput) =>
    api.post<ConvertCoordinatesResult>('/measurement-v2/coordinates/convert', body)
      .then((res) => unwrap(res)),

  listMeasurements: (studyUid: string) =>
    api.get<MeasurementV2Record[]>(`/measurement-v2/measurements?studyUid=${encodeURIComponent(studyUid)}&_t=${Date.now()}`)
      .then((res) => unwrap(res)),

  createMeasurement: (dto: CreateMeasurementV2Dto) =>
    api.post<MeasurementV2Record>('/measurement-v2/measurements', dto)
      .then((res) => unwrap(res)),

  updateMeasurement: (id: string, patch: Partial<CreateMeasurementV2Dto>) =>
    api.put<MeasurementV2Record>(`/measurement-v2/measurements/${id}`, patch)
      .then((res) => unwrap(res)),

  removeMeasurement: (id: string) =>
    api.delete<{ deleted: boolean; id: string }>(`/measurement-v2/measurements/${id}`)
      .then((res) => unwrap(res)),

  getMeasurementVersions: (id: string) =>
    api.get<MeasurementV2Version[]>(`/measurement-v2/measurements/${id}/versions`)
      .then((res) => unwrap(res)),

  rollbackMeasurement: (id: string, version: number) =>
    api.post<MeasurementV2Record>(`/measurement-v2/measurements/${id}/rollback`, { version })
      .then((res) => unwrap(res)),

  linkAnnotation: (measurementId: string, annotationId: string) =>
    api.post<{ measurement: MeasurementV2Record; annotation: AnnotationV2Record }>(`/measurement-v2/measurements/${measurementId}/link-annotation`, { annotationId })
      .then((res) => unwrap(res)),

  listAnnotations: (studyUid: string) =>
    api.get<AnnotationV2Record[]>(`/measurement-v2/annotations?studyUid=${encodeURIComponent(studyUid)}&_t=${Date.now()}`)
      .then((res) => unwrap(res)),

  createAnnotation: (dto: CreateAnnotationV2Dto) =>
    api.post<AnnotationV2Record>('/measurement-v2/annotations', dto)
      .then((res) => unwrap(res)),

  updateAnnotation: (id: string, patch: Partial<CreateAnnotationV2Dto>) =>
    api.put<AnnotationV2Record>(`/measurement-v2/annotations/${id}`, patch)
      .then((res) => unwrap(res)),

  removeAnnotation: (id: string) =>
    api.delete<{ deleted: boolean; id: string }>(`/measurement-v2/annotations/${id}`)
      .then((res) => unwrap(res)),

  getAnnotationVersions: (id: string) =>
    api.get<AnnotationV2Version[]>(`/measurement-v2/annotations/${id}/versions`)
      .then((res) => unwrap(res)),

  rollbackAnnotation: (id: string, version: number) =>
    api.post<AnnotationV2Record>(`/measurement-v2/annotations/${id}/rollback`, { version })
      .then((res) => unwrap(res)),
}
