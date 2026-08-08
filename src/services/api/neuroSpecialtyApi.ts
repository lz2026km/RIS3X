// Neuro Specialty API — 神经专科 (脑卒中/脑肿瘤/癫痫/动脉瘤)
// [v3.0.6.11-81] W2-B: 后端无 /neuro/* controller → MSW 演示数据 (neuroHandlers)
import { api } from './client'

export type NeuroStudyType = 'stroke' | 'tumor' | 'epilepsy' | 'aneurysm'

export interface NeuroStudy {
  id: string
  patientName: string
  age: number
  gender: 'M' | 'F'
  modality: string
  indication: string
  type: NeuroStudyType
  subtype?: 'ischemic' | 'hemorrhagic' | 'tia' | 'subarachnoid'
  vessel?: string
  aspectScore?: number
  coreMl?: number
  penumbraMl?: number
  lvo?: boolean
  tumorType?: string
  grade?: string
  sizeMm?: number
  volumeCm3?: number
  location?: string
  focus?: string
  mts?: boolean
  hippocampalAsymmetry?: number
  neckMm?: number
  ruptureRisk?: string
  date: string
  status: string
}

export interface NeuroStats {
  total: number
  todayScans: number
  strokeCount: number
  tumorCount: number
  epilepsyCount: number
  aneurysmCount: number
  lvoPositive: number
  pendingReports: number
  diseaseDistribution: Array<{ label: string; count: number; pct: number }>
}

export interface TumorGradeDist {
  grades: Array<{ grade: string; count: number }>
  types: Array<{ label: string; count: number; pct: number }>
}

export interface StrokeWindow {
  window: string
  count: number
  color: string
}

export const neuroSpecialtyApi = {
  listStudies: (params?: { type?: string; search?: string }) =>
    api.get<NeuroStudy[]>(`/neuro/studies?${new URLSearchParams((params as Record<string, string>) ?? {}).toString()}`),

  getStudy: (id: string) =>
    api.get<NeuroStudy | null>(`/neuro/studies/${id}`),

  getStats: () =>
    api.get<NeuroStats>('/neuro/stats'),

  getTumorGrades: () =>
    api.get<TumorGradeDist>('/neuro/tumor-grades'),

  getStrokeWindows: () =>
    api.get<StrokeWindow[]>('/neuro/stroke-windows'),

  analyze: () =>
    api.post<{ queued: boolean; message: string }>('/neuro/analyze'),
}

export default neuroSpecialtyApi
