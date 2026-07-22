import { api } from './client'

export interface RdsrResult {
  id: string
  studyInstanceUid: string
  modality: string
  bodyPart: string
  ctdivol: number
  dlp: number
  ssde?: number
  totalExposure: number
  numberOfEvents: number
  examDate: string
  alertLevel: 'normal' | 'warning' | 'critical'
}

export interface DrlEntry {
  modality: string
  bodyPart: string
  ctdivolDrl: number
  dlpDrl: number
  source: string
}

export interface RdsrStats {
  totalExams: number
  avgCtdivol: number
  avgDlp: number
  maxCtdivol: number
  maxDlp: number
  warningCount: number
  criticalCount: number
  trend: { date: string; avgCtdivol: number; avgDlp: number }[]
}

export const rdsrApi = {
  parse: (dicomJson?: Record<string, unknown>, modality?: string) =>
    api.post<RdsrResult>('/rdsr/parse', { dicomJson, modality }),

  getDrls: (modality?: string, bodyPart?: string) =>
    api.get<DrlEntry[]>('/rdsr/drls', { params: { modality, bodyPart } }),

  getStats: (dateFrom?: string, dateTo?: string, modality?: string) =>
    api.get<RdsrStats>('/rdsr/stats', { params: { dateFrom, dateTo, modality } }),
}
