export interface PatientDoseRecord {
  id: string;
  patientId: string;
  patientName: string;
  gender: string;
  age: number;
  modality: string;
  examItem: string;
  examDate: string;
  doseType: string;
  doseValue: number;
  doseUnit: string;
  alertLevel: "normal" | "warning" | "critical";
  threshold: number;
  device: string;
  examCount: number;
  cumulativeDLP: number;
  isPediatric?: boolean;
  pediatricAgeGroup?: string;
}

export interface DeviceDoseData {
  device: string;
  todayDLP: number;
  todayCTDI: number;
  todayDAP: number;
  alertCount: number;
  status: "normal" | "warning" | "critical";
  examCount: number;
  utilizationRate: number;
  avgCTDI: number;
  maxCTDI: number;
}

export interface DoseAlert {
  id: string;
  patientName: string;
  modality: string;
  examItem: string;
  doseValue: number;
  threshold: number;
  alertLevel: "critical" | "warning";
  device: string;
  time: string;
  status: "pending" | "acknowledged";
  notes?: string;
}

export interface CumulativeStats {
  totalPatientsToday: number;
  highDosePatients: number;
  totalDLPToday: number;
  doseAlertsToday: number;
  averageDLP: { CT: number; DR: number; DSA: number; MG: number };
  totalExamCount: number;
  criticalAlerts: number;
  warningAlerts: number;
  deviceOnlineCount: number;
  averageCTDIvol: number;
  doseReductionRate: number;
}

export interface MonthlyDoseTrend {
  month: string;
  ctAvgDLP: number;
  chestCTAvgDLP: number;
  abdomenCTAvgDLP: number;
  headCTAvgDLP: number;
}

export interface BreastDoseRecord {
  id: string;
  patientId: string;
  patientName: string;
  age: number;
  examDate: string;
  agd: number;
  doseUnit: string;
  referenceValue: number;
  alertLevel: "normal" | "warning" | "critical";
  recallStatus: "none" | "recalled" | "completed";
  device: string;
}

export interface PediatricDoseRecord {
  id: string;
  patientId: string;
  patientName: string;
  age: number;
  ageGroup: string;
  gender: string;
  examDate: string;
  modality: string;
  examItem: string;
  doseValue: number;
  doseUnit: string;
  doseReductionFactor: number;
  alertLevel: "normal" | "warning" | "critical";
  device: string;
}

export interface DICOMSRRecord {
  id: string;
  patientName: string;
  patientId: string;
  studyDate: string;
  modality: string;
  examItem: string;
  ctdivol: number;
  dlp: number;
  totalDose: number;
  doseUnit: string;
  drlReference: number;
  drlCompliant: boolean;
  device: string;
}

export interface CumulativeDosePoint {
  date: string;
  cumulativeDLP: number;
  threshold: number;
  examCount: number;
}

export interface StaffDoseRecord {
  id: string;
  staffName: string;
  department: string;
  role: string;
  monthlyDose: number;
  annualDose: number;
  annualLimit: number;
  doseUnit: string;
  complianceRate: number;
  readings: { month: string; dose: number }[];
}

export interface DRLRecord {
  modality: string;
  examType: string;
  nationalDRL: number;
  localDRL: number;
  hospitalAvg: number;
  exceedCount: number;
  totalCount: number;
  compliancePercent: number;
  unit: string;
}

export interface ControlChartPoint {
  date: string;
  mean: number;
  ucl: number;
  lcl: number;
  range: number;
  rangeUcl: number;
}

export interface PediatricProtocol {
  ageGroup: string;
  weightMin: number;
  weightMax: number;
  recommendedKVP: number;
  recommendedMAS: number;
  doseReductionFactor: number;
  protocolName: string;
}

export interface DeviceHistoryPoint {
  date: string;
  DLP: number;
  CTDIvol: number;
  DAP: number;
  examCount: number;
}

export interface AAPMReference {
  examType: string;
  aapmRef: number;
  euRef: number;
  hospitalAvg: number;
  exceedRate: number;
}
