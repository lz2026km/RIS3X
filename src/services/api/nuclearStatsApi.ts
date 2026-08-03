// [v3.0.6.11-54] Phase 2 核医学统计 API client
// Backend: /nuclear-stats/*
import { api } from './client'

export interface NuclearSummary {
  month: string
  totalExams: number
  examMoM: number
  drugConsumptionCi: number
  drugDailyCi: number
  utilizationAvg: number
  positiveRate: number
  positiveMoM: number
  avgSuv: number
  suvRange: [number, number]
}

export interface NuclearDailyPoint {
  date: string
  exams: number
  petct: number
  spect: number
  drug: number
  positive: number
  suvAvg: number
  utilization: number
}

export interface NuclearMonthlyPoint {
  month: string
  exams: number
  positive: number
  utilization: number
}

export interface NuclearDeviceStat {
  name: string
  model?: string
  exams?: number
  cycles?: number
  utilization: number
  positive?: number
  avgSuv?: number
  output?: number
  purity?: number
  status: string
}

export interface NuclearSuvStats {
  avg: number
  max: number
  min: number
  std: number
  tumorAvg: number
  inflammationAvg: number
  threshold: number
  distribution: { range: string; count: number }[]
}

export interface NuclearDrugStat {
  name: string
  consumption: number
  unit: string
  percent: number
  color: string
  usage: string
}

export const nuclearStatsApi = {
  getSummary: () => api.get<NuclearSummary>('/nuclear-stats/summary'),
  getDaily: () => api.get<NuclearDailyPoint[]>('/nuclear-stats/daily'),
  getMonthly: () => api.get<NuclearMonthlyPoint[]>('/nuclear-stats/monthly'),
  getDevices: () => api.get<NuclearDeviceStat[]>('/nuclear-stats/devices'),
  getSuv: () => api.get<NuclearSuvStats>('/nuclear-stats/suv'),
  getDrugs: () => api.get<NuclearDrugStat[]>('/nuclear-stats/drugs'),
}
