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
  patientId?: string | null
  patientName?: string | null
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

export interface BodyPartDoseStat {
  bodyPart: string
  examCount: number
  avgDlp: number
  avgCtdiVol: number
  overDrlCount: number
}

export interface TodayDoseStats {
  date: string
  totalExams: number
  avgDlp: number
  avgCtdiVol: number
  maxDlp: number
  overDrlCount: number
  warningCount: number
  criticalCount: number
  bodyPartDistribution: BodyPartDoseStat[]
}

export interface PatientDoseSummary {
  patientId: string
  patientName: string
  examCount: number
  firstExamDate: string
  lastExamDate: string
  totalDlp30d: number
  totalDlp1y: number
  overDrlCount: number
}

export interface CumulativeDose {
  patientId: string
  patientName: string
  totalExams: number
  totalDlp30d: number
  totalDlp1y: number
  totalCtdiVol1y: number
  annualLimit: number
  percentOfLimit30d: number
  percentOfLimit1y: number
  monthlyTrend: { month: string; totalDlp: number }[]
  exams: RdsrResult[]
}

export interface DoseAlert {
  id: string
  patientId: string | null
  patientName: string
  modality: string
  bodyPart: string
  ctdivol: number
  dlp: number
  ssde?: number
  date: string
  level: 'warning' | 'critical'
  ctdivolDrl: number
  dlpDrl: number
  acknowledged: boolean
  ackedAt?: string
}

export interface DrlUpsertPayload {
  bodyPart: string
  modality?: string
  ctdivolDrl?: number
  dlpDrl?: number
  source?: string
}

const withQuery = (
  path: string,
  params?: Record<string, string | number | undefined>,
): string => {
  if (!params) return path;
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(
      ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`,
    )
    .join("&");
  return qs ? `${path}?${qs}` : path;
};

export const rdsrApi = {
  parse: (dicomJson?: Record<string, unknown>, modality?: string, extra?: { patientId?: string; patientName?: string; examDate?: string }) =>
    api.post<RdsrResult>("/rdsr/parse", { dicomJson, modality, ...extra }),

  getDrls: (modality?: string, bodyPart?: string) =>
    api.get<DrlEntry[]>(withQuery("/rdsr/drl", { modality, bodyPart })),

  updateDrl: (payload: DrlUpsertPayload) =>
    api.post<DrlEntry[]>("/rdsr/drl", payload),

  getStats: (dateFrom?: string, dateTo?: string, modality?: string) =>
    api.get<RdsrStats>(withQuery("/rdsr/stats", { dateFrom, dateTo, modality })),

  getToday: () => api.get<TodayDoseStats>("/rdsr/today"),

  searchPatients: (search?: string) =>
    api.get<PatientDoseSummary[]>(withQuery("/rdsr/patients", { search })),

  getPatientCumulative: (patientId: string) =>
    api.get<CumulativeDose>(`/rdsr/patients/${encodeURIComponent(patientId)}/cumulative`),

  getAlerts: (status?: "pending" | "acknowledged") =>
    api.get<DoseAlert[]>(withQuery("/rdsr/alerts", { status })),

  ackAlert: (id: string) =>
    api.post<DoseAlert>(`/rdsr/alerts/${encodeURIComponent(id)}/ack`),
};
