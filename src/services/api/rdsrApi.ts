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
  ageGroup?: 'adult' | 'child'
}

export interface DrlCheckRecordInput {
  patientId?: string
  patientName?: string
  modality: string
  bodyPart: string
  ctdivol?: number
  dlp?: number
  ssde?: number
  examDate?: string
  age?: number
  ageGroup?: 'adult' | 'child'
}

export interface DrlCheckResult {
  id: string
  patientId?: string | null
  patientName?: string | null
  modality: string
  bodyPart: string
  ctdivol: number
  dlp: number
  ssde?: number
  examDate: string
  ageGroup: 'adult' | 'child'
  level: 'warning' | 'critical'
  ctdivolDrl: number
  dlpDrl: number
  exceededBy: { ctdivol: number; dlp: number }
  reason: string
  criticalAlertId?: string
}

export interface DrlCheckSummary {
  checked: number
  overLimitCount: number
  warningCount: number
  criticalCount: number
  generatedAlertCount: number
  overLimit: DrlCheckResult[]
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
  ageGroup?: 'adult' | 'child'
}

// [W10-B] 儿童剂量记录 (GET /rdsr/pediatric); 后端暂无该端点, 由 MSW 提供
export interface PediatricDoseRecordDto {
  id: string
  patientId: string
  patientName: string
  age: number
  ageGroup: string
  gender: string
  examDate: string
  modality: string
  examItem: string
  doseValue: number
  doseUnit: string
  doseReductionFactor: number
  alertLevel: 'normal' | 'warning' | 'critical'
  device: string
}

// [G005 W8-Dose] 工作人员个人剂量监测 (GET /rdsr/staff)
export interface StaffDoseReadingDto {
  month: string
  dose: number
}

export interface StaffDoseRecordDto {
  id: string
  staffName: string
  department: string
  role: string
  monthlyDose: number
  annualDose: number
  annualLimit: number
  doseUnit: string
  complianceRate: number
  readings: StaffDoseReadingDto[]
}

// [G005 W8-Dose] 乳腺摄影 AGD 剂量 (GET /rdsr/breast)
export interface BreastDoseRecordDto {
  id: string
  patientId: string
  patientName: string
  age: number
  examDate: string
  agd: number
  doseUnit: string
  referenceValue: number
  alertLevel: 'normal' | 'warning' | 'critical'
  recallStatus: 'none' | 'recalled' | 'completed'
  device: string
}

// [G005 W8-Dose] 设备近 7 日剂量历史 (GET /rdsr/device/:id/history)
export interface DeviceHistoryPointDto {
  date: string
  DLP: number
  CTDIvol: number
  DAP: number
  examCount: number
}

// [G005 W8-Dose] 剂量总览 (GET /rdsr/overview)
export interface DeviceDoseCardDto {
  device: string
  todayDLP: number
  todayCTDI: number
  todayDAP: number
  alertCount: number
  status: 'normal' | 'warning' | 'critical'
  examCount: number
  utilizationRate: number
  avgCTDI: number
  maxCTDI: number
}

export interface DoseHistoryPointDto {
  date: string
  CT: number
  MR: number
  DR: number
  DSA: number
  MG: number
}

export interface CtdivolTrendPointDto {
  date: string
  CT1: number
  CT2: number
  threshold: number
}

export interface DeviceDapPointDto {
  device: string
  DAP: number
  threshold: number
  avgDAP: number
}

export interface DoseOverviewDto {
  deviceDose: DeviceDoseCardDto[]
  doseHistory: DoseHistoryPointDto[]
  ctdivolTrend: CtdivolTrendPointDto[]
  deviceDap: DeviceDapPointDto[]
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

  getDrls: (modality?: string, bodyPart?: string, ageGroup?: "adult" | "child") =>
    api.get<DrlEntry[]>(withQuery("/rdsr/drl", { modality, bodyPart, ageGroup })),

  // [v3.0.6.11-104 Wave 2A] 兼容旧路径 GET /rdsr/drls (与 /rdsr/drl 同返回)
  getDrlsLegacy: (modality?: string, bodyPart?: string, ageGroup?: "adult" | "child") =>
    api.get<DrlEntry[]>(withQuery("/rdsr/drls", { modality, bodyPart, ageGroup })),

  updateDrl: (payload: DrlUpsertPayload) =>
    api.post<DrlEntry[]>("/rdsr/drl", payload),

  check: (records: DrlCheckRecordInput[]) =>
    api.post<DrlCheckSummary>("/rdsr/check", { records }),

  getStats: (dateFrom?: string, dateTo?: string, modality?: string) =>
    api.get<RdsrStats>(withQuery("/rdsr/stats", { dateFrom, dateTo, modality })),

  getToday: () => api.get<TodayDoseStats>("/rdsr/today"),

  // [W10-B] 儿童剂量记录 (页面 PediatricDoseManagement)
  getPediatric: () => api.get<PediatricDoseRecordDto[]>("/rdsr/pediatric"),

  // [G005 W8-Dose] 工作人员个人剂量监测 (页面 StaffDoseMonitoring)
  getStaffDose: () => api.get<StaffDoseRecordDto[]>("/rdsr/staff"),

  // [G005 W8-Dose] 乳腺摄影 AGD 剂量 (页面 BreastDoseTracking)
  getBreast: () => api.get<BreastDoseRecordDto[]>("/rdsr/breast"),

  // [G005 W8-Dose] 设备近 7 日剂量历史 (页面 DeviceHistoryModal)
  getDeviceHistory: (deviceId: string) =>
    api.get<DeviceHistoryPointDto[]>(`/rdsr/device/${encodeURIComponent(deviceId)}/history`),

  // [G005 W8-Dose] 剂量总览 (页面 DoseTrackPage overview)
  getOverview: () => api.get<DoseOverviewDto>("/rdsr/overview"),

  searchPatients: (search?: string) =>
    api.get<PatientDoseSummary[]>(withQuery("/rdsr/patients", { search })),

  getPatientCumulative: (patientId: string) =>
    api.get<CumulativeDose>(`/rdsr/patients/${encodeURIComponent(patientId)}/cumulative`),

  getAlerts: (status?: "pending" | "acknowledged") =>
    api.get<DoseAlert[]>(withQuery("/rdsr/alerts", { status })),

  ackAlert: (id: string) =>
    api.post<DoseAlert>(`/rdsr/alerts/${encodeURIComponent(id)}/ack`),
};
