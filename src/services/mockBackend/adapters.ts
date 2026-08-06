// [v3.0.6.8-32] 主数据池 → API DTO 适配函数
// 把 v27 master pool (1720 实体) + v27 generators (1910 预生成)
// 映射到前端 API client 期望的 DTO 结构
import { PATIENT_MASTER, DEVICE_MASTER, DOCTOR_MASTER } from '../../data/master';
import { EXAM_REPORT_PRE, QUALITY_SCORE_PRE } from '../../data/_generators';
import type { PatientMaster, DeviceMaster, DoctorMaster, ExamItemMaster } from '../../data/master';
import type { ExamReportRecord, DoctorPerformanceRecord, CriticalValueEvent, CosignTask, RadiologyKPIDaily, QualityScoreRecord } from '../../data/_generators/medicalDataGen';

// ==================== PatientDto ====================
export interface PatientDto {
  id: string;
  name: string;
  gender: string;
  age: number;
  birthDate: string;
  phone: string;
  idCard: string;
  bloodType: string;
  patientType: string;
  referringDepartment: string;
  referringDoctor: string;
  chiefComplaint: string;
  clinicalDiagnosis: string;
  icd10: string;
  modality: string;
  bodyPart: string;
  examItem: string;
  registeredAt: string;
  examDate: string;
  status: string;
  priority: string;
  isVIP: boolean;
  tags: string[];
}

export function toPatientDto(p: PatientMaster): PatientDto {
  return {
    id: p.id,
    name: p.name,
    gender: p.gender,
    age: p.age,
    birthDate: p.birthDate,
    phone: p.phone,
    idCard: p.idCard,
    bloodType: p.bloodType,
    patientType: p.type,
    referringDepartment: p.referringDepartment,
    referringDoctor: p.referringDoctor,
    chiefComplaint: p.chiefComplaint,
    clinicalDiagnosis: p.clinicalDiagnosis,
    icd10: p.icd10,
    modality: p.modality,
    bodyPart: p.bodyPart,
    examItem: p.examItem,
    registeredAt: p.registeredAt,
    examDate: p.examDate,
    status: p.status,
    priority: p.priority,
    isVIP: p.isVIP,
    tags: p.tags,
  };
}

// ==================== DeviceDto ====================
export interface DeviceDto {
  id: string;
  modality: string;
  brand: string;
  model: string;
  serialNumber: string;
  assetCode: string;
  room: string;
  floor: string;
  building: string;
  purchaseDate: string;
  purchasePrice: number;
  warrantyExpiry: string;
  vendorContact: string;
  tubeCount: number;
  sliceCount: number;
  fieldStrength: number;
  detectorType: string;
  status: string;
  totalScans: number;
  monthlyScans: number;
  avgScanDurationMin: number;
  lastMaintenanceAt: string;
  nextMaintenanceAt: string;
  maintenanceCycle: string;
  totalDowntime: number;
  monthlyDowntime: number;
  imageQualityGrade: string;
  doseComplianceRate: number;
  defectRate: number;
  installedAt: string;
  responsibleEngineer: string;
  responsibleDoctor: string;
  notes: string;
  utilization: number;
}

export function toDeviceDto(d: DeviceMaster): DeviceDto {
  return {
    id: d.id,
    modality: d.modality,
    brand: d.brand,
    model: d.model,
    serialNumber: d.serialNumber,
    assetCode: d.assetCode,
    room: d.room,
    floor: d.floor,
    building: d.building,
    purchaseDate: d.purchaseDate,
    purchasePrice: d.purchasePrice,
    warrantyExpiry: d.warrantyExpiry,
    vendorContact: d.vendorContact,
    tubeCount: d.tubeCount,
    sliceCount: d.sliceCount,
    fieldStrength: d.fieldStrength,
    detectorType: d.detectorType,
    status: d.status,
    totalScans: d.totalScans,
    monthlyScans: d.monthlyScans,
    avgScanDurationMin: d.avgScanDurationMin,
    lastMaintenanceAt: d.lastMaintenanceAt,
    nextMaintenanceAt: d.nextMaintenanceAt,
    maintenanceCycle: d.maintenanceCycle,
    totalDowntime: d.totalDowntime,
    monthlyDowntime: d.monthlyDowntime,
    imageQualityGrade: d.imageQualityGrade,
    doseComplianceRate: d.doseComplianceRate,
    defectRate: d.defectRate,
    installedAt: d.installedAt,
    responsibleEngineer: d.responsibleEngineer,
    responsibleDoctor: d.responsibleDoctor,
    notes: d.notes,
    utilization: Math.round(100 - (d.monthlyDowntime / 720) * 100),
  };
}

// ==================== UserDto ====================
export interface UserDto {
  id: string;
  name: string;
  username: string;
  role: string;
  department: string;
  title: string;
  subspecialty: string;
  yearsOfExperience: number;
  certifications: string[];
  schedule: string;
  monthlyExamCount: number;
  monthlyReportCount: number;
  monthlyCriticalValueCount: number;
  monthlyCosignCount: number;
  annualQCScore: number;
  defectRate: number;
  timelyRate: number;
  joinedAt: string;
  avatar: string;
  isActive: boolean;
}

export function toUserDto(d: DoctorMaster): UserDto {
  return {
    id: d.id,
    name: d.name,
    username: d.id.toLowerCase(),
    role: d.title,
    department: d.department,
    title: d.title,
    subspecialty: d.subspecialty,
    yearsOfExperience: d.yearsOfExperience,
    certifications: d.certifications,
    schedule: d.schedule,
    monthlyExamCount: d.monthlyExamCount,
    monthlyReportCount: d.monthlyReportCount,
    monthlyCriticalValueCount: d.monthlyCriticalValueCount,
    monthlyCosignCount: d.monthlyCosignCount,
    annualQCScore: d.annualQCScore,
    defectRate: d.defectRate as unknown as number,
    timelyRate: d.timelyRate as unknown as number,
    joinedAt: d.joinedAt,
    avatar: d.avatar,
    isActive: d.active,
  };
}

// ==================== ExamDto (从 EXAM_REPORT_PRE) ====================
export interface ExamDto {
  id: string;
  examId: string;
  patientId: string;
  patientName: string;
  gender: string;
  age: number;
  modality: string;
  bodyPart: string;
  status: string;
  priority: string;
  scheduledAt: string;
  patientType: string;
  deviceId: string;
  deviceModel: string;
  doctorId: string;
  contrastUsed: boolean;
  radiationDose: number;
  dlp: number;
  technicianId: string;
  imageCount: number;
  examItem: string;
  examItemCode: string;
  icd10: string;
  clinicalDiagnosis: string;
  hasCriticalValue: boolean;
}

export function toExamDto(r: ExamReportRecord): ExamDto {
  return {
    id: r.reportId,
    examId: r.reportId,
    patientId: r.patientId,
    patientName: r.patientName,
    gender: r.patientGender,
    age: r.patientAge,
    modality: r.modality,
    bodyPart: r.bodyPart,
    status: r.status,
    priority: r.priority,
    scheduledAt: r.examAt,
    patientType: '门诊',
    deviceId: r.deviceId,
    deviceModel: r.deviceModel,
    deviceName: r.deviceModel, // 别名 (DicomViewerPage 等老页面用)
    doctorId: r.reportDoctorId,
    contrastUsed: r.criticalValueType !== null && r.criticalValueType !== undefined,
    radiationDose: 0,
    dlp: 0,
    technicianId: r.doctorId,
    imageCount: 0,
    examItem: r.examItem,
    examItemName: r.examItem, // 别名
    examItemCode: r.examItemCode,
    icd10: r.icd10,
    clinicalDiagnosis: r.clinicalDiagnosis,
    hasCriticalValue: r.hasCriticalValue,
  } as any;
}

// ==================== ReportDto ====================
export interface ReportDto {
  id: string;
  reportId: string;
  patientId: string;
  patientName: string;
  examId: string;
  modality: string;
  bodyPart: string;
  status: string;
  findings: string;
  diagnosis: string;
  impression: string;
  recommendations: string;
  createdTime: string;
  updatedTime: string;
  doctorId: string;
  qualityScore: number;
  reviewerId: string;
  coSignerId: string;
  qcGrade: string;
  defectCount: number;
  icd10: string;
  clinicalDiagnosis: string;
  priority: string;
  hasCriticalValue: boolean;
}

export function toReportDto(r: ExamReportRecord, q?: QualityScoreRecord): ReportDto {
  return {
    id: r.reportId,
    reportId: r.reportId,
    patientId: r.patientId,
    patientName: r.patientName,
    examId: r.reportId,
    modality: r.modality,
    bodyPart: r.bodyPart,
    status: mapReportStatus(r.status),
    findings: r.findings,
    diagnosis: r.impression,
    impression: r.impression,
    createdTime: r.examAt,
    updatedTime: r.signedAt || r.reviewedAt || r.reportAt,
    doctorId: r.reportDoctorId,
    qualityScore: q?.totalScore ?? r.qcScore,
    reviewerId: r.reviewDoctorId || '',
    coSignerId: r.cosignDoctorId || '',
    qcGrade: q?.grade ?? (r.qcScore >= 95 ? 'A+' : r.qcScore >= 90 ? 'A' : r.qcScore >= 85 ? 'B+' : r.qcScore >= 80 ? 'B' : r.qcScore >= 75 ? 'C' : 'D'),
    defectCount: r.defectCount,
    icd10: r.icd10,
    clinicalDiagnosis: r.clinicalDiagnosis,
    priority: r.priority,
    hasCriticalValue: r.hasCriticalValue,
    // [v3.0.6.11-70] P0: 驳回原因透出 (transition → REJECTED 写入)
    rejectReason: (r as any).rejectReason,
    // [v3.0.6.11-70] P0: 报告正文透出 (所见/诊断/建议)
    recommendations: (r as any).recommendations ?? '',
  };
}

function mapReportStatus(s: ExamReportRecord['status']): string {
  const map: Record<string, string> = {
    draft: '草稿',
    submitted: '已提交',
    reviewed: '已审核',
    cosigned: '已双签',
    published: '已发布',
  };
  return map[s] || s;
}

// ==================== 适配批量 ====================
export function adaptAllPatients(): PatientDto[] {
  return PATIENT_MASTER.map(toPatientDto);
}
export function adaptAllDevices(): DeviceDto[] {
  return DEVICE_MASTER.map(toDeviceDto);
}
export function adaptAllUsers(): UserDto[] {
  return DOCTOR_MASTER.map(toUserDto);
}
export function adaptAllExams(): ExamDto[] {
  return EXAM_REPORT_PRE.map(toExamDto);
}
export function adaptAllReports(): ReportDto[] {
  const qMap = new Map<string, QualityScoreRecord>();
  QUALITY_SCORE_PRE.forEach(q => qMap.set(q.reportId, q));
  return EXAM_REPORT_PRE.map(r => toReportDto(r, qMap.get(r.reportId)));
}

// ==================== Doctor Performance DTO ====================
export interface DoctorPerformanceDto {
  id: string;
  doctorId: string;
  doctorName: string;
  title: string;
  month: string;
  reportCount: number;
  defectCount: number;
  criticalValueCount: number;
  cosignCount: number;
  avgTAT: number;
  qcScore: number;
  grade: string;
  timelyRate: number;
  defectRate: number;
  radPathMatch: number;
  peerReview: number;
}

export function toDoctorPerformanceDto(r: DoctorPerformanceRecord): DoctorPerformanceDto {
  return {
    id: r.id,
    doctorId: r.doctorId,
    doctorName: r.doctorName,
    title: r.title,
    month: r.month,
    reportCount: r.reportCount,
    defectCount: r.defectCount,
    criticalValueCount: r.criticalValueCount,
    cosignCount: r.cosignCount,
    avgTAT: r.avgTAT,
    qcScore: r.qcScore,
    grade: r.grade,
    timelyRate: r.timelyRate,
    defectRate: r.defectRate,
    radPathMatch: r.radPathMatch,
    peerReview: r.peerReview,
  };
}

// ==================== Daily KPI DTO ====================
export interface DailyKpiDto {
  date: string;
  examCount: number;
  reportCount: number;
  criticalCount: number;
  cosignCount: number;
  avgTAT: number;
  defectCount: number;
  qcAvgScore: number;
  byModality: Record<string, number>;
  topDevices: { deviceId: string; count: number }[];
}

export function toDailyKpiDto(k: RadiologyKPIDaily): DailyKpiDto {
  return {
    date: k.date,
    examCount: k.examCount,
    reportCount: k.reportCount,
    criticalCount: k.criticalCount,
    cosignCount: k.cosignCount,
    avgTAT: k.avgTAT,
    defectCount: k.defectCount,
    qcAvgScore: k.qcAvgScore,
    byModality: k.byModality,
    topDevices: k.topDevices,
  };
}

// ==================== Critical Event DTO ====================
export interface CriticalEventDto {
  id: string;
  patientId: string;
  patientName: string;
  patientAge: number;
  patientGender: string;
  modality: string;
  examItem: string;
  category: string;
  value: string;
  valueType: string;
  discoveredAt: string;
  notifiedAt: string;
  acknowledgedAt: string;
  processedAt: string;
  closedAt: string | null;
  discoverDoctorId: string;
  notifyDoctorId: string;
  receiverDoctorId: string;
  clinicalDoctorId: string;
  status: string;
  notifyDurationMin: number;
  ackDurationMin: number;
  processDurationMin: number;
  totalDurationMin: number;
  slaMet: boolean;
  outcome: string | null;
  notes: string;
}

export function toCriticalEventDto(c: CriticalValueEvent): CriticalEventDto {
  return {
    id: c.id,
    patientId: c.patientId,
    patientName: c.patientName,
    patientAge: c.patientAge,
    patientGender: c.patientGender,
    modality: c.modality,
    examItem: c.examItem,
    category: c.category,
    value: c.value,
    valueType: c.valueType,
    discoveredAt: c.discoveredAt,
    notifiedAt: c.notifiedAt,
    acknowledgedAt: c.acknowledgedAt,
    processedAt: c.processedAt,
    closedAt: c.closedAt,
    discoverDoctorId: c.discoverDoctorId,
    notifyDoctorId: c.notifyDoctorId,
    receiverDoctorId: c.receiverDoctorId,
    clinicalDoctorId: c.clinicalDoctorId,
    status: c.status,
    notifyDurationMin: c.notifyDurationMin,
    ackDurationMin: c.ackDurationMin,
    processDurationMin: c.processDurationMin,
    totalDurationMin: c.totalDurationMin,
    slaMet: c.slaMet,
    outcome: c.outcome,
    notes: c.notes,
  };
}

// ==================== Cosign Task DTO ====================
export interface CosignTaskDto {
  id: string;
  reportId: string;
  patientId: string;
  patientName: string;
  modality: string;
  bodyPart: string;
  triggerReason: string;
  priority: string;
  authorId: string;
  authorName: string;
  cosignerId: string;
  cosignerName: string;
  submittedAt: string;
  cosignedAt: string | null;
  deadline: string;
  slaMinutes: number;
  elapsedMinutes: number;
  overdue: boolean;
  status: string;
  rejectReason: string | null;
  reminderCount: number;
  complexity: string;
  triggerDetails: string;
}

export function toCosignTaskDto(c: CosignTask): CosignTaskDto {
  return {
    id: c.id,
    reportId: c.reportId,
    patientId: c.patientId,
    patientName: c.patientName,
    modality: c.modality,
    bodyPart: c.bodyPart,
    triggerReason: c.triggerReason,
    priority: c.priority,
    authorId: c.authorId,
    authorName: c.authorName,
    cosignerId: c.cosignerId,
    cosignerName: c.cosignerName,
    submittedAt: c.submittedAt,
    cosignedAt: c.cosignedAt,
    deadline: c.deadline,
    slaMinutes: c.slaMinutes,
    elapsedMinutes: c.elapsedMinutes,
    overdue: c.overdue,
    status: c.status,
    rejectReason: c.rejectReason,
    reminderCount: c.reminderCount,
    complexity: c.complexity,
    triggerDetails: c.triggerDetails,
  };
}

// ==================== ExamItem DTO ====================
export interface ExamItemDto {
  code: string;
  name: string;
  modality: string;
  category: string;
  bodyPart: string;
  avgDurationMin: number;
  priceRMB: number;
  contrastAgent: string | null;
  contrastVolume: string | null;
  sliceThickness: string;
  reportTAT: number;
}

export function toExamItemDto(e: ExamItemMaster): ExamItemDto {
  return {
    code: e.code,
    name: e.name,
    modality: e.modality,
    category: e.category,
    bodyPart: e.bodyPart,
    avgDurationMin: e.avgDurationMin,
    priceRMB: e.priceRMB,
    contrastAgent: e.contrastAgent,
    contrastVolume: e.contrastVolume,
    sliceThickness: e.sliceThickness,
    reportTAT: e.reportTAT,
  };
}
