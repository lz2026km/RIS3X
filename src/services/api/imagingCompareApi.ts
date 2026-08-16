import { api } from './client'

// [G005 v3.0.6.11-101 Wave 2A] 影像对比 (imaging-compare)
// 多时点/同患者多序列/多模态并排对比 + 同步浏览 + 影像级差异指标

export type CompareGroupType = 'multi-timepoint' | 'multi-series' | 'multi-modality'

export interface CompareSyncState {
  panZoom: boolean
  wwwl: boolean
  frame: boolean
}

export interface CompareSeriesInfo {
  seriesInstanceUid: string
  studyInstanceUid: string
  modality: string
  seriesDescription: string
  instanceCount: number
  studyDate: string
}

export interface PatientStudyDto {
  studyInstanceUid: string
  accessionNumber: string
  studyDate: string
  modality: string
  bodyPart: string
  series: CompareSeriesInfo[]
}

export interface PatientListItem {
  patientId: string
  name: string
  gender: string
  studyCount: number
  lastStudyDate: string
}

export interface CompareSessionSeriesGroup {
  seriesInstanceUid: string
  label: string
  modality: string
}

export interface CompareSessionDto {
  id: string
  patientId: string
  patientName: string
  name: string
  groupType: CompareGroupType
  seriesGroups: CompareSessionSeriesGroup[]
  sync: CompareSyncState
  createdAt: string
  updatedAt: string
}

export interface HistogramBin {
  bin: number
  value: number
  countA: number
  countB: number
}

export interface DifferenceMetrics {
  seriesA: string
  seriesB: string
  sliceIndex: number
  width: number
  height: number
  pixelCount: number
  meanA: number
  meanB: number
  meanDiff: number
  varianceA: number
  varianceB: number
  varianceDiff: number
  stdDevA: number
  stdDevB: number
  histogramDiff: number
  hotRegionRatio: number
  threshold: number
  changedPixelCount: number
  source: 'derived' | 'seed'
  histogram: HistogramBin[]
}

export const imagingCompareApi = {
  listPatients: (keyword?: string) => {
    const sp = new URLSearchParams()
    if (keyword) sp.set('keyword', keyword)
    return api.get<PatientListItem[]>(`/imaging-compare/patients?${sp.toString()}`)
  },
  getPatientStudies: (patientId: string) =>
    api.get<{ patientId: string; studies: PatientStudyDto[]; source: 'db' | 'seed' }>(
      `/imaging-compare/patients/${encodeURIComponent(patientId)}/studies`,
    ),
  listSessions: (patientId?: string) => {
    const sp = new URLSearchParams()
    if (patientId) sp.set('patientId', patientId)
    return api.get<CompareSessionDto[]>(`/imaging-compare/sessions?${sp.toString()}`)
  },
  createSession: (dto: { patientId: string; name?: string; seriesGroups: { seriesInstanceUid: string; label?: string; modality?: string }[] }) =>
    api.post<CompareSessionDto>('/imaging-compare/sessions', dto),
  getSession: (id: string) => api.get<CompareSessionDto>(`/imaging-compare/sessions/${encodeURIComponent(id)}`),
  deleteSession: (id: string) => api.delete(`/imaging-compare/sessions/${encodeURIComponent(id)}`),
  getSyncState: (id: string) =>
    api.get<{ sessionId: string; sync: CompareSyncState }>(`/imaging-compare/sessions/${encodeURIComponent(id)}/sync`),
  updateSyncState: (id: string, patch: Partial<CompareSyncState>) =>
    api.patch<CompareSessionDto>(`/imaging-compare/sessions/${encodeURIComponent(id)}/sync`, patch),
  computeDifference: (id: string, dto: { seriesA: string; seriesB: string; sliceIndex?: number; threshold?: number }) =>
    api.post<DifferenceMetrics>(`/imaging-compare/sessions/${encodeURIComponent(id)}/difference`, dto),
}
