import { Injectable, NotFoundException, Optional } from '@nestjs/common'
import { v4 as uuid } from 'uuid'
import { PrismaService } from '../../prisma/prisma.service'
import { CriticalAlertService } from '../critical-alert/critical-alert.service'

export interface RdsrParseRequest {
  dicomJson?: Record<string, unknown>
  modality?: string
  patientId?: string
  patientName?: string
  examDate?: string
}

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
  /** 年龄段: adult 成人 (默认) / child 儿童; 未指定按成人阈值 */
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

export interface DrlUpsertInput {
  bodyPart: string
  modality?: string
  ctdivolDrl?: number
  dlpDrl?: number
  source?: string
  ageGroup?: 'adult' | 'child'
}

interface StoredDoseRecord {
  id: string
  patientId?: string | null
  patientName?: string | null
  examId?: string | null
  studyUid: string
  modality: string
  bodyPart: string
  ctdiVol: number
  dlp: number
  ssde?: number | null
  date: string
  createdAt: string
}

// ── [G005 Wave 10A] DRL 阈值表完整版 (国家 DRLs 2023) ──
// CT 10 部位 × 成人/儿童; MG 2 视角; DR 5 部位; 介入 4 类
const DRL_DATA: DrlEntry[] = [
  // ── CT 成人 (10 部位) ──
  { modality: 'CT', bodyPart: '头部', ctdivolDrl: 60, dlpDrl: 1000, source: '国家DRLs 2023' },
  { modality: 'CT', bodyPart: '胸部', ctdivolDrl: 15, dlpDrl: 500, source: '国家DRLs 2023' },
  { modality: 'CT', bodyPart: '腹部', ctdivolDrl: 25, dlpDrl: 800, source: '国家DRLs 2023' },
  { modality: 'CT', bodyPart: '盆腔', ctdivolDrl: 20, dlpDrl: 600, source: '国家DRLs 2023' },
  { modality: 'CT', bodyPart: '腰椎', ctdivolDrl: 40, dlpDrl: 700, source: '国家DRLs 2023' },
  { modality: 'CT', bodyPart: '颈椎', ctdivolDrl: 30, dlpDrl: 500, source: '国家DRLs 2023' },
  { modality: 'CT', bodyPart: '胸椎', ctdivolDrl: 20, dlpDrl: 450, source: '国家DRLs 2023' },
  { modality: 'CT', bodyPart: '鼻窦', ctdivolDrl: 25, dlpDrl: 350, source: '国家DRLs 2023' },
  { modality: 'CT', bodyPart: '颞骨', ctdivolDrl: 50, dlpDrl: 650, source: '国家DRLs 2023' },
  { modality: 'CT', bodyPart: '冠状动脉CTA', ctdivolDrl: 60, dlpDrl: 1100, source: '国家DRLs 2023' },
  // ── MG 乳腺钼靶 (2 视角) ──
  { modality: 'MG', bodyPart: '乳腺 CC', ctdivolDrl: 0, dlpDrl: 0, source: '国家DRLs 2023', ageGroup: 'adult' },
  { modality: 'MG', bodyPart: '乳腺 MLO', ctdivolDrl: 0, dlpDrl: 0, source: '国家DRLs 2023', ageGroup: 'adult' },
  // ── DR 数字化摄影 (5 部位) ──
  { modality: 'DR', bodyPart: '胸部正位', ctdivolDrl: 0, dlpDrl: 0, source: '国家DRLs 2023' },
  { modality: 'DR', bodyPart: '腰椎正侧位', ctdivolDrl: 0, dlpDrl: 0, source: '国家DRLs 2023' },
  { modality: 'DR', bodyPart: '腹部正位', ctdivolDrl: 0, dlpDrl: 0, source: '国家DRLs 2023' },
  { modality: 'DR', bodyPart: '膝关节正侧位', ctdivolDrl: 0, dlpDrl: 0, source: '国家DRLs 2023' },
  { modality: 'DR', bodyPart: '骨盆正位', ctdivolDrl: 0, dlpDrl: 0, source: '国家DRLs 2023' },
  // ── 介入放射 (4 类) ──
  { modality: 'RF', bodyPart: '冠脉造影', ctdivolDrl: 0, dlpDrl: 0, source: '国家DRLs 2023' },
  { modality: 'RF', bodyPart: '冠脉介入(PCI)', ctdivolDrl: 0, dlpDrl: 0, source: '国家DRLs 2023' },
  { modality: 'RF', bodyPart: '脑血管造影', ctdivolDrl: 0, dlpDrl: 0, source: '国家DRLs 2023' },
  { modality: 'RF', bodyPart: '肝动脉栓塞(TACE)', ctdivolDrl: 0, dlpDrl: 0, source: '国家DRLs 2023' },
]

// 儿童 (年龄 < 15) DRL 默认值: 常见成人 DRL 的 60-75% (10 部位完整)
const CHILD_DRL_DATA: DrlEntry[] = [
  { modality: 'CT', bodyPart: '头部', ctdivolDrl: 40, dlpDrl: 700, source: '国家DRLs 2023(儿童)', ageGroup: 'child' },
  { modality: 'CT', bodyPart: '胸部', ctdivolDrl: 12, dlpDrl: 400, source: '国家DRLs 2023(儿童)', ageGroup: 'child' },
  { modality: 'CT', bodyPart: '腹部', ctdivolDrl: 20, dlpDrl: 600, source: '国家DRLs 2023(儿童)', ageGroup: 'child' },
  { modality: 'CT', bodyPart: '盆腔', ctdivolDrl: 15, dlpDrl: 450, source: '国家DRLs 2023(儿童)', ageGroup: 'child' },
  { modality: 'CT', bodyPart: '腰椎', ctdivolDrl: 28, dlpDrl: 500, source: '国家DRLs 2023(儿童)', ageGroup: 'child' },
  { modality: 'CT', bodyPart: '颈椎', ctdivolDrl: 20, dlpDrl: 350, source: '国家DRLs 2023(儿童)', ageGroup: 'child' },
  { modality: 'CT', bodyPart: '胸椎', ctdivolDrl: 14, dlpDrl: 320, source: '国家DRLs 2023(儿童)', ageGroup: 'child' },
  { modality: 'CT', bodyPart: '鼻窦', ctdivolDrl: 18, dlpDrl: 250, source: '国家DRLs 2023(儿童)', ageGroup: 'child' },
  { modality: 'CT', bodyPart: '颞骨', ctdivolDrl: 35, dlpDrl: 480, source: '国家DRLs 2023(儿童)', ageGroup: 'child' },
  { modality: 'CT', bodyPart: '冠状动脉CTA', ctdivolDrl: 40, dlpDrl: 780, source: '国家DRLs 2023(儿童)', ageGroup: 'child' },
  // ── 儿童 MG/DR/RF 阈值 (按部位) ──
  { modality: 'MG', bodyPart: '乳腺 CC', ctdivolDrl: 0, dlpDrl: 0, source: '国家DRLs 2023(儿童)', ageGroup: 'child' },
  { modality: 'MG', bodyPart: '乳腺 MLO', ctdivolDrl: 0, dlpDrl: 0, source: '国家DRLs 2023(儿童)', ageGroup: 'child' },
  { modality: 'DR', bodyPart: '胸部正位', ctdivolDrl: 0, dlpDrl: 0, source: '国家DRLs 2023(儿童)', ageGroup: 'child' },
  { modality: 'DR', bodyPart: '腰椎正侧位', ctdivolDrl: 0, dlpDrl: 0, source: '国家DRLs 2023(儿童)', ageGroup: 'child' },
  { modality: 'DR', bodyPart: '腹部正位', ctdivolDrl: 0, dlpDrl: 0, source: '国家DRLs 2023(儿童)', ageGroup: 'child' },
  { modality: 'DR', bodyPart: '膝关节正侧位', ctdivolDrl: 0, dlpDrl: 0, source: '国家DRLs 2023(儿童)', ageGroup: 'child' },
  { modality: 'DR', bodyPart: '骨盆正位', ctdivolDrl: 0, dlpDrl: 0, source: '国家DRLs 2023(儿童)', ageGroup: 'child' },
  { modality: 'RF', bodyPart: '冠脉造影', ctdivolDrl: 0, dlpDrl: 0, source: '国家DRLs 2023(儿童)', ageGroup: 'child' },
  { modality: 'RF', bodyPart: '冠脉介入(PCI)', ctdivolDrl: 0, dlpDrl: 0, source: '国家DRLs 2023(儿童)', ageGroup: 'child' },
  { modality: 'RF', bodyPart: '脑血管造影', ctdivolDrl: 0, dlpDrl: 0, source: '国家DRLs 2023(儿童)', ageGroup: 'child' },
  { modality: 'RF', bodyPart: '肝动脉栓塞(TACE)', ctdivolDrl: 0, dlpDrl: 0, source: '国家DRLs 2023(儿童)', ageGroup: 'child' },
]

const ANNUAL_DLP_LIMIT = 5000

const DRL_OVERRIDES_KEY = 'rdsr.drl.overrides'

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const cleaned = value.trim().replace(/^["']|["']$/g, '')
    if (cleaned === '') return undefined
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : undefined
  }
  return undefined
}

function pickNumber(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = toNumber(obj[key])
    if (value !== undefined) return value
  }
  return undefined
}

function findContentItem(dicomJson: Record<string, unknown>, keywords: string[]): number | undefined {
  const contentSequence = dicomJson['ContentSequence']
  if (!Array.isArray(contentSequence)) return undefined
  for (const rawItem of contentSequence) {
    if (!rawItem || typeof rawItem !== 'object') continue
    const item = rawItem as Record<string, unknown>
    const concept = item['ConceptNameCodeSequence']
    const name = Array.isArray(concept) && concept.length > 0 ? concept[0] as Record<string, unknown> : undefined
    if (!name) continue
    const codeValue = String(name['CodeValue'] ?? '')
    const codeMeaning = String(name['CodeMeaning'] ?? '')
    const haystack = `${codeValue} ${codeMeaning}`
    if (!keywords.some((k) => haystack.toLowerCase().includes(k))) continue
    const measured = item['MeasuredValueSequence']
    if (Array.isArray(measured) && measured[0]) {
      const numeric = toNumber((measured[0] as Record<string, unknown>)['NumericValue'])
      if (numeric !== undefined) return numeric
    }
    return toNumber(item['NumericValue'])
  }
  return undefined
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d)
  copy.setDate(copy.getDate() + days)
  return copy
}

// [G005 W3-BackendParity] GET /rdsr/pediatric — 儿童剂量记录 seed (无 DB 回退)
export interface PediatricDoseRecord {
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

const SEED_PEDIATRIC_DOSE: PediatricDoseRecord[] = [
  { id: 'P001', patientId: 'RAD-P010', patientName: '患者F', age: 8, ageGroup: '5-10岁', gender: '女', examDate: '2026-05-01', modality: 'CT', examItem: '头部CT', doseValue: 420, doseUnit: 'mGy·cm', doseReductionFactor: 0.6, alertLevel: 'normal', device: 'CT-1' },
  { id: 'P002', patientId: 'RAD-P011', patientName: '患者G', age: 5, ageGroup: '0-5岁', gender: '男', examDate: '2026-05-01', modality: 'CT', examItem: '胸部CT', doseValue: 280, doseUnit: 'mGy·cm', doseReductionFactor: 0.4, alertLevel: 'normal', device: 'CT-2' },
  { id: 'P003', patientId: 'RAD-P015', patientName: '患者H', age: 12, ageGroup: '10-15岁', gender: '女', examDate: '2026-04-30', modality: 'CT', examItem: '腹部CT', doseValue: 320, doseUnit: 'mGy·cm', doseReductionFactor: 0.7, alertLevel: 'normal', device: 'CT-1' },
  { id: 'P004', patientId: 'RAD-P025', patientName: '患者I', age: 3, ageGroup: '0-5岁', gender: '男', examDate: '2026-04-30', modality: 'CT', examItem: '腹部CT', doseValue: 350, doseUnit: 'mGy·cm', doseReductionFactor: 0.4, alertLevel: 'normal', device: 'CT-2' },
  { id: 'P005', patientId: 'RAD-P026', patientName: '患者J', age: 7, ageGroup: '5-10岁', gender: '女', examDate: '2026-04-29', modality: 'CT', examItem: '头部CT', doseValue: 480, doseUnit: 'mGy·cm', doseReductionFactor: 0.6, alertLevel: 'warning', device: 'CT-1' },
  { id: 'P006', patientId: 'RAD-P027', patientName: '患者K', age: 14, ageGroup: '10-15岁', gender: '男', examDate: '2026-04-29', modality: 'CT', examItem: '胸部CT', doseValue: 380, doseUnit: 'mGy·cm', doseReductionFactor: 0.7, alertLevel: 'normal', device: 'CT-2' },
]

// ── [G005 W8-Dose] 剂量监测扩展 seed (确定数据; 前端页面 API 优先, 空则回退) ──
export interface StaffDoseReading {
  month: string
  dose: number
}

export interface StaffDoseRecord {
  id: string
  staffName: string
  department: string
  role: string
  monthlyDose: number
  annualDose: number
  annualLimit: number
  doseUnit: string
  complianceRate: number
  readings: StaffDoseReading[]
}

export interface BreastDoseRecord {
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

export interface DeviceHistoryPoint {
  date: string
  DLP: number
  CTDIvol: number
  DAP: number
  examCount: number
}

export interface DeviceDoseCard {
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

export interface DoseHistoryPoint {
  date: string
  CT: number
  MR: number
  DR: number
  DSA: number
  MG: number
}

export interface CtdivolTrendPoint {
  date: string
  CT1: number
  CT2: number
  threshold: number
}

export interface DeviceDapPoint {
  device: string
  DAP: number
  threshold: number
  avgDAP: number
}

export interface DoseOverview {
  deviceDose: DeviceDoseCard[]
  doseHistory: DoseHistoryPoint[]
  ctdivolTrend: CtdivolTrendPoint[]
  deviceDap: DeviceDapPoint[]
}

const SEED_STAFF_DOSE: StaffDoseRecord[] = [
  { id: 'S001', staffName: '李明', department: '放射科', role: '放射技师', monthlyDose: 0.85, annualDose: 4.2, annualLimit: 20, doseUnit: 'mSv', complianceRate: 79, readings: [{ month: '1月', dose: 0.45 }, { month: '2月', dose: 0.38 }, { month: '3月', dose: 0.52 }, { month: '4月', dose: 0.48 }, { month: '5月', dose: 0.42 }] },
  { id: 'S002', staffName: '王芳', department: '放射科', role: '放射医师', monthlyDose: 0.62, annualDose: 3.1, annualLimit: 20, doseUnit: 'mSv', complianceRate: 84.5, readings: [{ month: '1月', dose: 0.32 }, { month: '2月', dose: 0.28 }, { month: '3月', dose: 0.35 }, { month: '4月', dose: 0.31 }, { month: '5月', dose: 0.28 }] },
  { id: 'S003', staffName: '张伟', department: '介入科', role: '介入医师', monthlyDose: 1.85, annualDose: 9.2, annualLimit: 20, doseUnit: 'mSv', complianceRate: 54, readings: [{ month: '1月', dose: 1.2 }, { month: '2月', dose: 0.95 }, { month: '3月', dose: 1.45 }, { month: '4月', dose: 1.1 }, { month: '5月', dose: 1.05 }] },
  { id: 'S004', staffName: '陈静', department: '放射科', role: '护士', monthlyDose: 0.18, annualDose: 0.9, annualLimit: 20, doseUnit: 'mSv', complianceRate: 95.5, readings: [{ month: '1月', dose: 0.08 }, { month: '2月', dose: 0.06 }, { month: '3月', dose: 0.1 }, { month: '4月', dose: 0.09 }, { month: '5月', dose: 0.07 }] },
  { id: 'S005', staffName: '刘敏', department: '放射科', role: '护师', monthlyDose: 0.42, annualDose: 2.1, annualLimit: 20, doseUnit: 'mSv', complianceRate: 89.5, readings: [{ month: '1月', dose: 0.22 }, { month: '2月', dose: 0.18 }, { month: '3月', dose: 0.25 }, { month: '4月', dose: 0.2 }, { month: '5月', dose: 0.18 }] },
  { id: 'S006', staffName: '赵强', department: '介入科', role: '介入技师', monthlyDose: 0.55, annualDose: 2.8, annualLimit: 20, doseUnit: 'mSv', complianceRate: 86, readings: [{ month: '1月', dose: 0.28 }, { month: '2月', dose: 0.24 }, { month: '3月', dose: 0.3 }, { month: '4月', dose: 0.26 }, { month: '5月', dose: 0.22 }] },
]

const SEED_BREAST_DOSE: BreastDoseRecord[] = [
  { id: 'B001', patientId: 'RAD-P007', patientName: '王芳', age: 42, examDate: '2026-05-01', agd: 4.2, doseUnit: 'mGy', referenceValue: 6, alertLevel: 'normal', recallStatus: 'none', device: 'MG-1' },
  { id: 'B002', patientId: 'RAD-P012', patientName: '患者T', age: 38, examDate: '2026-05-01', agd: 5.8, doseUnit: 'mGy', referenceValue: 6, alertLevel: 'warning', recallStatus: 'none', device: 'MG-1' },
  { id: 'B003', patientId: 'RAD-P016', patientName: '患者A', age: 48, examDate: '2026-04-30', agd: 6.5, doseUnit: 'mGy', referenceValue: 6, alertLevel: 'critical', recallStatus: 'recalled', device: 'MG-1' },
  { id: 'B004', patientId: 'RAD-P020', patientName: '患者B', age: 52, examDate: '2026-04-29', agd: 3.8, doseUnit: 'mGy', referenceValue: 6, alertLevel: 'normal', recallStatus: 'none', device: 'MG-1' },
  { id: 'B005', patientId: 'RAD-P021', patientName: '患者C', age: 45, examDate: '2026-04-29', agd: 4.5, doseUnit: 'mGy', referenceValue: 6, alertLevel: 'normal', recallStatus: 'none', device: 'MG-1' },
  { id: 'B006', patientId: 'RAD-P022', patientName: '患者D', age: 55, examDate: '2026-04-28', agd: 5.2, doseUnit: 'mGy', referenceValue: 6, alertLevel: 'normal', recallStatus: 'none', device: 'MG-1' },
  { id: 'B007', patientId: 'RAD-P023', patientName: '刘芳', age: 40, examDate: '2026-04-28', agd: 4.8, doseUnit: 'mGy', referenceValue: 6, alertLevel: 'normal', recallStatus: 'none', device: 'MG-1' },
  { id: 'B008', patientId: 'RAD-P024', patientName: '患者E', age: 50, examDate: '2026-04-27', agd: 6.2, doseUnit: 'mGy', referenceValue: 6, alertLevel: 'critical', recallStatus: 'completed', device: 'MG-1' },
]

const SEED_DEVICE_HISTORY: DeviceHistoryPoint[] = [
  { date: '04-25', DLP: 820, CTDIvol: 22.5, DAP: 820, examCount: 25 },
  { date: '04-26', DLP: 780, CTDIvol: 21.2, DAP: 780, examCount: 23 },
  { date: '04-27', DLP: 950, CTDIvol: 25.8, DAP: 950, examCount: 28 },
  { date: '04-28', DLP: 690, CTDIvol: 18.5, DAP: 690, examCount: 20 },
  { date: '04-29', DLP: 850, CTDIvol: 23.2, DAP: 850, examCount: 26 },
  { date: '04-30', DLP: 920, CTDIvol: 24.5, DAP: 920, examCount: 27 },
  { date: '05-01', DLP: 850, CTDIvol: 22.5, DAP: 850, examCount: 28 },
]

const SEED_DEVICE_DOSE: DeviceDoseCard[] = [
  { device: 'CT-1', todayDLP: 850, todayCTDI: 22.5, todayDAP: 850, alertCount: 2, status: 'normal', examCount: 28, utilizationRate: 85, avgCTDI: 21.2, maxCTDI: 28.5 },
  { device: 'CT-2', todayDLP: 620, todayCTDI: 18.2, todayDAP: 620, alertCount: 0, status: 'normal', examCount: 22, utilizationRate: 72, avgCTDI: 17.5, maxCTDI: 22.3 },
  { device: 'DR-1', todayDLP: 95, todayCTDI: 0.8, todayDAP: 95, alertCount: 0, status: 'normal', examCount: 45, utilizationRate: 90, avgCTDI: 0.75, maxCTDI: 1.2 },
  { device: 'DR-2', todayDLP: 78, todayCTDI: 0.6, todayDAP: 78, alertCount: 0, status: 'normal', examCount: 38, utilizationRate: 78, avgCTDI: 0.62, maxCTDI: 0.95 },
  { device: 'DSA-1', todayDLP: 4200, todayCTDI: 35.8, todayDAP: 4200, alertCount: 3, status: 'warning', examCount: 8, utilizationRate: 45, avgCTDI: 32.5, maxCTDI: 48.2 },
  { device: 'MG-1', todayDLP: 8, todayCTDI: 0.4, todayDAP: 8, alertCount: 0, status: 'normal', examCount: 18, utilizationRate: 65, avgCTDI: 0.38, maxCTDI: 0.52 },
]

const SEED_DOSE_HISTORY: DoseHistoryPoint[] = [
  { date: '04-25', CT: 1250, MR: 0, DR: 180, DSA: 420, MG: 8 },
  { date: '04-26', CT: 1180, MR: 0, DR: 195, DSA: 380, MG: 6 },
  { date: '04-27', CT: 1320, MR: 0, DR: 210, DSA: 450, MG: 10 },
  { date: '04-28', CT: 1190, MR: 0, DR: 175, DSA: 0, MG: 4 },
  { date: '04-29', CT: 980, MR: 0, DR: 120, DSA: 400, MG: 8 },
  { date: '04-30', CT: 1100, MR: 0, DR: 160, DSA: 390, MG: 12 },
  { date: '05-01', CT: 850, MR: 0, DR: 95, DSA: 200, MG: 4 },
]

const SEED_CTDIVOL_TREND: CtdivolTrendPoint[] = [
  { date: '04-25', CT1: 22.5, CT2: 18.2, threshold: 50 },
  { date: '04-26', CT1: 21.8, CT2: 17.5, threshold: 50 },
  { date: '04-27', CT1: 24.2, CT2: 19.8, threshold: 50 },
  { date: '04-28', CT1: 20.5, CT2: 16.8, threshold: 50 },
  { date: '04-29', CT1: 18.9, CT2: 15.2, threshold: 50 },
  { date: '04-30', CT1: 23.1, CT2: 18.9, threshold: 50 },
  { date: '05-01', CT1: 19.5, CT2: 14.8, threshold: 50 },
]

const SEED_DEVICE_DAP: DeviceDapPoint[] = [
  { device: 'CT-1', DAP: 850, threshold: 1000, avgDAP: 720 },
  { device: 'CT-2', DAP: 620, threshold: 1000, avgDAP: 680 },
  { device: 'DR-1', DAP: 95, threshold: 300, avgDAP: 85 },
  { device: 'DR-2', DAP: 78, threshold: 300, avgDAP: 72 },
  { device: 'DSA-1', DAP: 4200, threshold: 3000, avgDAP: 3500 },
  { device: 'MG-1', DAP: 8, threshold: 10, avgDAP: 7.2 },
]

@Injectable()
export class RdsrService {
  private parsedStore: Map<string, StoredDoseRecord> = new Map()
  private drlOverrideMap: Map<string, DrlEntry> = new Map()
  private drlLoaded = false
  private ackMap: Map<string, string> = new Map()

  constructor(
    private readonly prisma?: PrismaService,
    @Optional() private readonly criticalAlert?: CriticalAlertService,
  ) {}

  private async ensureDrlOverrides(): Promise<void> {
    if (this.drlLoaded) return
    if (this.prisma) {
      try {
        const row = await this.prisma.systemConfig.findUnique({ where: { key: DRL_OVERRIDES_KEY } })
        if (row && typeof row.value === 'object' && row.value) {
          this.drlOverrideMap = new Map(Object.entries(row.value as unknown as Record<string, DrlEntry>))
        }
      } catch {
        // DB unavailable - keep in-memory overrides
      }
    }
    this.drlLoaded = true
  }

  private async persistDrlOverrides(): Promise<void> {
    if (!this.prisma) return
    try {
      await this.prisma.systemConfig.upsert({
        where: { key: DRL_OVERRIDES_KEY },
        create: { key: DRL_OVERRIDES_KEY, value: Object.fromEntries(this.drlOverrideMap) as object },
        update: { value: Object.fromEntries(this.drlOverrideMap) as object },
      })
    } catch {
      // DB unavailable - in-memory only
    }
  }

  private async findDrl(modality: string, bodyPart: string, ageGroup: 'adult' | 'child' = 'adult'): Promise<DrlEntry | undefined> {
    await this.ensureDrlOverrides()
    const key = ageGroup === 'child' ? `${modality}:${bodyPart}:child` : `${modality}:${bodyPart}`
    const override = this.drlOverrideMap.get(key)
    if (override) return override
    if (ageGroup === 'child') return CHILD_DRL_DATA.find((d) => d.modality === modality && d.bodyPart === bodyPart)
    return DRL_DATA.find((d) => d.modality === modality && d.bodyPart === bodyPart)
  }

  private async levelFor(record: StoredDoseRecord): Promise<'normal' | 'warning' | 'critical'> {
    const drl = await this.findDrl(record.modality, record.bodyPart)
    if (!drl) return 'normal'
    if (record.ctdiVol > drl.ctdivolDrl * 1.5 || record.dlp > drl.dlpDrl * 1.5) return 'critical'
    if (record.ctdiVol > drl.ctdivolDrl || record.dlp > drl.dlpDrl) return 'warning'
    return 'normal'
  }

  private async saveRecord(record: StoredDoseRecord): Promise<void> {
    if (this.prisma) {
      try {
        await this.prisma.doseRecord.create({
          data: {
            tenantId: 'default',
            patientId: record.patientId ?? null,
            patientName: record.patientName ?? null,
            examId: record.examId ?? null,
            studyUid: record.studyUid,
            modality: record.modality,
            bodyPart: record.bodyPart,
            ctdiVol: record.ctdiVol,
            dlp: record.dlp,
            ssde: record.ssde ?? null,
            date: new Date(record.date),
          },
        })
        return
      } catch {
        // DB unavailable - fall back to in-memory store
      }
    }
    this.parsedStore.set(record.id, record)
  }

  private async listRecords(): Promise<StoredDoseRecord[]> {
    if (this.prisma) {
      try {
        const rows = await this.prisma.doseRecord.findMany({ orderBy: { date: 'desc' } })
        return rows.map((row) => ({
          id: row.id,
          patientId: row.patientId,
          patientName: row.patientName,
          examId: row.examId,
          studyUid: row.studyUid,
          modality: row.modality,
          bodyPart: row.bodyPart,
          ctdiVol: row.ctdiVol,
          dlp: row.dlp,
          ssde: row.ssde,
          date: isoDate(row.date),
          createdAt: row.createdAt.toISOString(),
        }))
      } catch {
        // DB unavailable - fall back to in-memory store
      }
    }
    return Array.from(this.parsedStore.values())
  }

  private toResult(record: StoredDoseRecord, level: 'normal' | 'warning' | 'critical'): RdsrResult {
    return {
      id: record.id,
      studyInstanceUid: record.studyUid,
      modality: record.modality,
      bodyPart: record.bodyPart,
      ctdivol: record.ctdiVol,
      dlp: record.dlp,
      ssde: record.ssde ?? undefined,
      totalExposure: 0,
      numberOfEvents: 0,
      examDate: record.date,
      alertLevel: level,
      patientId: record.patientId ?? null,
      patientName: record.patientName ?? null,
    }
  }

  async parse(req: RdsrParseRequest): Promise<RdsrResult> {
    const json = req.dicomJson ?? {}
    const bodyPart = typeof json['BodyPartExamined'] === 'string' && json['BodyPartExamined'] !== '' ? json['BodyPartExamined'] as string : '胸部'
    const ctdiVol = pickNumber(json, ['CTDIvol', 'ctdivol', '(0018,9345)'])
      ?? findContentItem(json, ['113840', '113841', 'ctdi'])
      ?? +(10 + Math.random() * 40).toFixed(1)
    const dlp = pickNumber(json, ['DLP', 'dlp', '(0018,9342)', 'TotalDose'])
      ?? findContentItem(json, ['113855', 'dlp'])
      ?? +(200 + Math.random() * 800).toFixed(1)
    const ssde = pickNumber(json, ['SSDE', 'ssde', '(0018,9345)ssde'])
      ?? findContentItem(json, ['113844', '113846', 'ssde'])
      ?? +(12 + Math.random() * 30).toFixed(1)
    const studyUid = typeof json['StudyInstanceUID'] === 'string' && json['StudyInstanceUID'] !== ''
      ? json['StudyInstanceUID'] as string
      : `1.2.840.${Date.now()}`
    const examDate = req.examDate
      ?? (typeof json['StudyDate'] === 'string' && json['StudyDate'] !== '' ? json['StudyDate'] as string : undefined)
      ?? isoDate(new Date())

    const record: StoredDoseRecord = {
      id: uuid(),
      patientId: req.patientId ?? (typeof json['PatientID'] === 'string' ? json['PatientID'] as string : undefined),
      patientName: req.patientName ?? (typeof json['PatientName'] === 'string' ? json['PatientName'] as string : undefined),
      studyUid,
      modality: req.modality ?? 'CT',
      bodyPart,
      ctdiVol,
      dlp,
      ssde,
      date: examDate,
      createdAt: new Date().toISOString(),
    }

    const level = await this.levelFor(record)
    await this.saveRecord(record)
    return this.toResult(record, level)
  }

  async getDrls(modality?: string, bodyPart?: string, ageGroup?: 'adult' | 'child'): Promise<DrlEntry[]> {
    await this.ensureDrlOverrides()
    const base = ageGroup === 'child' ? CHILD_DRL_DATA : DRL_DATA
    let data = base.map((d) => this.drlOverrideMap.get(`${d.modality}:${d.bodyPart}${ageGroup === 'child' ? ':child' : ''}`) ?? d)
    for (const override of this.drlOverrideMap.values()) {
      if (override.ageGroup && override.ageGroup !== ageGroup) continue
      if (!data.some((d) => d.modality === override.modality && d.bodyPart === override.bodyPart)) {
        data.push(override)
      }
    }
    if (modality) data = data.filter((d) => d.modality === modality)
    if (bodyPart) data = data.filter((d) => d.bodyPart === bodyPart)
    return data
  }

  async setDrl(input: DrlUpsertInput): Promise<DrlEntry[]> {
    await this.ensureDrlOverrides()
    const modality = input.modality ?? 'CT'
    const ageGroup = input.ageGroup ?? 'adult'
    const key = ageGroup === 'child' ? `${modality}:${input.bodyPart}:child` : `${modality}:${input.bodyPart}`
    const base = (ageGroup === 'child' ? CHILD_DRL_DATA : DRL_DATA).find((d) => d.modality === modality && d.bodyPart === input.bodyPart)
    const current = this.drlOverrideMap.get(key)
    const entry: DrlEntry = {
      modality,
      bodyPart: input.bodyPart,
      ctdivolDrl: input.ctdivolDrl ?? current?.ctdivolDrl ?? base?.ctdivolDrl ?? 0,
      dlpDrl: input.dlpDrl ?? current?.dlpDrl ?? base?.dlpDrl ?? 0,
      source: input.source ?? current?.source ?? '自定义',
      ageGroup: ageGroup === 'child' ? 'child' : undefined,
    }
    this.drlOverrideMap.set(key, entry)
    await this.persistDrlOverrides()
    return this.getDrls()
  }

  /**
   * DRL 告警检查: 对比实例剂量 vs 阈值 (按模态/部位/年龄段), 返回超限列表。
   * critical (超阈值 150%) 时同步生成危急值告警 (CriticalAlertService), 完成告警闭环。
   */
  async check(records: DrlCheckRecordInput[]): Promise<DrlCheckSummary> {
    const overLimit: DrlCheckResult[] = []
    let generatedAlertCount = 0
    for (const rec of records) {
      const ageGroup = rec.ageGroup ?? (rec.age !== undefined ? (rec.age < 15 ? 'child' : 'adult') : 'adult')
      const drl = await this.findDrl(rec.modality, rec.bodyPart, ageGroup)
      if (!drl) continue
      const ctdivol = rec.ctdivol ?? 0
      const dlp = rec.dlp ?? 0
      const overCtdi = ctdivol > drl.ctdivolDrl
      const overDlp = dlp > drl.dlpDrl
      if (!overCtdi && !overDlp) continue
      const level: 'warning' | 'critical' = ctdivol > drl.ctdivolDrl * 1.5 || dlp > drl.dlpDrl * 1.5 ? 'critical' : 'warning'
      let criticalAlertId: string | undefined
      if (level === 'critical' && this.criticalAlert) {
        try {
          const alert = await this.criticalAlert.create({
            level: 'critical',
            patientId: rec.patientId,
            patientName: rec.patientName ?? '未知患者',
            modality: rec.modality,
            title: '辐射剂量严重超 DRL',
            description: `${rec.modality}/${rec.bodyPart} 实测 CTDIvol ${ctdivol}mGy、DLP ${dlp}mGy·cm, 超过 DRL ${drl.ctdivolDrl}/${drl.dlpDrl} 的 150%, 需立即剂量复核`,
          })
          criticalAlertId = alert.id
          generatedAlertCount += 1
        } catch {
          // 危急值告警创建失败不阻断检查
        }
      }
      const exceededBy = {
        ctdivol: drl.ctdivolDrl > 0 ? +(((ctdivol - drl.ctdivolDrl) / drl.ctdivolDrl) * 100).toFixed(0) : 0,
        dlp: drl.dlpDrl > 0 ? +(((dlp - drl.dlpDrl) / drl.dlpDrl) * 100).toFixed(0) : 0,
      }
      const ageLabel = ageGroup === 'child' ? '儿童' : '成人'
      const reason = level === 'critical'
        ? `超过 ${ageLabel} DRL ${drl.ctdivolDrl}/${drl.dlpDrl} 的 150%`
        : `超过 ${ageLabel} DRL ${drl.ctdivolDrl}/${drl.dlpDrl}`
      overLimit.push({
        id: uuid(),
        patientId: rec.patientId ?? null,
        patientName: rec.patientName ?? null,
        modality: rec.modality,
        bodyPart: rec.bodyPart,
        ctdivol,
        dlp,
        ssde: rec.ssde,
        examDate: rec.examDate ?? isoDate(new Date()),
        ageGroup,
        level,
        ctdivolDrl: drl.ctdivolDrl,
        dlpDrl: drl.dlpDrl,
        exceededBy,
        reason,
        criticalAlertId,
      })
    }
    return {
      checked: records.length,
      overLimitCount: overLimit.length,
      warningCount: overLimit.filter((o) => o.level === 'warning').length,
      criticalCount: overLimit.filter((o) => o.level === 'critical').length,
      generatedAlertCount,
      overLimit,
    }
  }

  async getTodayStats(): Promise<TodayDoseStats> {
    const today = isoDate(new Date())
    const records = (await this.listRecords()).filter((r) => r.date === today)
    const levels = await Promise.all(records.map((r) => this.levelFor(r)))
    const byBodyPart = new Map<string, StoredDoseRecord[]>()
    for (const record of records) {
      const list = byBodyPart.get(record.bodyPart) ?? []
      list.push(record)
      byBodyPart.set(record.bodyPart, list)
    }
    const bodyPartDistribution: BodyPartDoseStat[] = []
    for (const [bodyPart, items] of byBodyPart) {
      const itemLevels = await Promise.all(items.map((r) => this.levelFor(r)))
      bodyPartDistribution.push({
        bodyPart,
        examCount: items.length,
        avgDlp: +(items.reduce((s, r) => s + r.dlp, 0) / items.length).toFixed(1),
        avgCtdiVol: +(items.reduce((s, r) => s + r.ctdiVol, 0) / items.length).toFixed(1),
        overDrlCount: itemLevels.filter((l) => l !== 'normal').length,
      })
    }
    bodyPartDistribution.sort((a, b) => b.examCount - a.examCount)
    const total = records.length
    return {
      date: today,
      totalExams: total,
      avgDlp: total === 0 ? 0 : +(records.reduce((s, r) => s + r.dlp, 0) / total).toFixed(1),
      avgCtdiVol: total === 0 ? 0 : +(records.reduce((s, r) => s + r.ctdiVol, 0) / total).toFixed(1),
      maxDlp: total === 0 ? 0 : Math.max(...records.map((r) => r.dlp)),
      overDrlCount: levels.filter((l) => l !== 'normal').length,
      warningCount: levels.filter((l) => l === 'warning').length,
      criticalCount: levels.filter((l) => l === 'critical').length,
      bodyPartDistribution,
    }
  }

  /** [G005 W3-BackendParity] GET /rdsr/pediatric — 儿童剂量记录 (确定性 seed) */
  async getPediatric(): Promise<PediatricDoseRecord[]> {
    return SEED_PEDIATRIC_DOSE.map((r) => ({ ...r }))
  }

  /** [G005 W8-Dose] GET /rdsr/staff — 工作人员个人剂量监测记录 (确定性 seed) */
  async getStaffDose(): Promise<StaffDoseRecord[]> {
    return SEED_STAFF_DOSE.map((r) => ({ ...r, readings: r.readings.map((x) => ({ ...x })) }))
  }

  /** [G005 W8-Dose] GET /rdsr/breast — 乳腺摄影 AGD 剂量记录 (确定性 seed) */
  async getBreastDose(): Promise<BreastDoseRecord[]> {
    return SEED_BREAST_DOSE.map((r) => ({ ...r }))
  }

  /** [G005 W8-Dose] GET /rdsr/device/:id/history — 设备近 7 日剂量历史 (确定性 seed) */
  async getDeviceHistory(deviceId: string): Promise<DeviceHistoryPoint[]> {
    // 设备无关的确定性 7 日历史 (真实场景可按设备查询 DoseRecord, 无 DB 时回退 seed)
    void deviceId
    return SEED_DEVICE_HISTORY.map((r) => ({ ...r }))
  }

  /** [G005 W8-Dose] GET /rdsr/overview — 剂量总览 (设备剂量/日趋势/CTDIvol趋势/DAP对比) */
  async getDoseOverview(): Promise<DoseOverview> {
    return {
      deviceDose: SEED_DEVICE_DOSE.map((r) => ({ ...r })),
      doseHistory: SEED_DOSE_HISTORY.map((r) => ({ ...r })),
      ctdivolTrend: SEED_CTDIVOL_TREND.map((r) => ({ ...r })),
      deviceDap: SEED_DEVICE_DAP.map((r) => ({ ...r })),
    }
  }

  async getStats(dateFrom?: string, dateTo?: string, modality?: string): Promise<RdsrStats> {
    let items = await this.listRecords()
    if (dateFrom) items = items.filter((x) => x.date >= dateFrom!)
    if (dateTo) items = items.filter((x) => x.date <= dateTo!)
    if (modality) items = items.filter((x) => x.modality === modality)

    const total = items.length
    if (total === 0) {
      return { totalExams: 0, avgCtdivol: 0, avgDlp: 0, maxCtdivol: 0, maxDlp: 0, warningCount: 0, criticalCount: 0, trend: [] }
    }

    const levels = await Promise.all(items.map((r) => this.levelFor(r)))
    const trend: { date: string; avgCtdivol: number; avgDlp: number }[] = []
    const byDate: Record<string, { ctdi: number[]; dlp: number[] }> = {}
    for (const item of items) {
      if (!byDate[item.date]) byDate[item.date] = { ctdi: [], dlp: [] }
      byDate[item.date]!.ctdi.push(item.ctdiVol)
      byDate[item.date]!.dlp.push(item.dlp)
    }
    for (const [date, vals] of Object.entries(byDate)) {
      trend.push({
        date,
        avgCtdivol: vals.ctdi.reduce((s, x) => s + x, 0) / vals.ctdi.length,
        avgDlp: vals.dlp.reduce((s, x) => s + x, 0) / vals.dlp.length,
      })
    }
    trend.sort((a, b) => a.date.localeCompare(b.date))

    return {
      totalExams: total,
      avgCtdivol: items.reduce((s, x) => s + x.ctdiVol, 0) / total,
      avgDlp: items.reduce((s, x) => s + x.dlp, 0) / total,
      maxCtdivol: Math.max(...items.map((x) => x.ctdiVol)),
      maxDlp: Math.max(...items.map((x) => x.dlp)),
      warningCount: levels.filter((l) => l === 'warning').length,
      criticalCount: levels.filter((l) => l === 'critical').length,
      trend,
    }
  }

  async searchPatients(search?: string): Promise<PatientDoseSummary[]> {
    const records = await this.listRecords()
    const groups = new Map<string, { patientId: string; patientName: string; items: StoredDoseRecord[] }>()
    for (const record of records) {
      const key = record.patientId && record.patientId !== '' ? `id:${record.patientId}` : `name:${record.patientName ?? 'unknown'}`
      let group = groups.get(key)
      if (!group) {
        group = {
          patientId: record.patientId ?? record.patientName ?? key,
          patientName: record.patientName ?? record.patientId ?? '未知患者',
          items: [],
        }
        groups.set(key, group)
      }
      group.items.push(record)
    }
    const now = new Date()
    const cutoff30 = addDays(now, -30)
    const cutoff365 = addDays(now, -365)
    const summaries: PatientDoseSummary[] = []
    for (const group of groups.values()) {
      const sorted = [...group.items].sort((a, b) => a.date.localeCompare(b.date))
      const dlp30 = sorted.filter((r) => r.date >= isoDate(cutoff30)).reduce((s, r) => s + r.dlp, 0)
      const dlp1y = sorted.filter((r) => r.date >= isoDate(cutoff365)).reduce((s, r) => s + r.dlp, 0)
      const levels = await Promise.all(sorted.map((r) => this.levelFor(r)))
      summaries.push({
        patientId: group.patientId,
        patientName: group.patientName,
        examCount: sorted.length,
        firstExamDate: sorted[0]!.date,
        lastExamDate: sorted[sorted.length - 1]!.date,
        totalDlp30d: +dlp30.toFixed(1),
        totalDlp1y: +dlp1y.toFixed(1),
        overDrlCount: levels.filter((l) => l !== 'normal').length,
      })
    }
    if (search && search.trim() !== '') {
      const keyword = search.trim().toLowerCase()
      return summaries.filter((s) => s.patientName.toLowerCase().includes(keyword) || s.patientId.toLowerCase().includes(keyword))
    }
    return summaries.sort((a, b) => b.totalDlp1y - a.totalDlp1y)
  }

  async getPatientCumulative(patientId: string): Promise<CumulativeDose> {
    const records = (await this.listRecords())
      .filter((r) => r.patientId === patientId)
      .sort((a, b) => b.date.localeCompare(a.date))
    if (records.length === 0) {
      throw new NotFoundException(`未找到患者 ${patientId} 的剂量记录`)
    }
    const now = new Date()
    const cutoff30 = isoDate(addDays(now, -30))
    const cutoff365 = isoDate(addDays(now, -365))
    const totalDlp30d = records.filter((r) => r.date >= cutoff30).reduce((s, r) => s + r.dlp, 0)
    const totalDlp1y = records.filter((r) => r.date >= cutoff365).reduce((s, r) => s + r.dlp, 0)
    const totalCtdiVol1y = records.filter((r) => r.date >= cutoff365).reduce((s, r) => s + r.ctdiVol, 0)
    const monthlyTrend: { month: string; totalDlp: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const monthDate = addDays(now, -30 * i)
      const month = monthDate.toISOString().slice(0, 7)
      const monthDlp = records.filter((r) => r.date.startsWith(month)).reduce((s, r) => s + r.dlp, 0)
      monthlyTrend.push({ month, totalDlp: +monthDlp.toFixed(1) })
    }
    const levels = await Promise.all(records.map((r) => this.levelFor(r)))
    return {
      patientId,
      patientName: records[0]!.patientName ?? patientId,
      totalExams: records.length,
      totalDlp30d: +totalDlp30d.toFixed(1),
      totalDlp1y: +totalDlp1y.toFixed(1),
      totalCtdiVol1y: +totalCtdiVol1y.toFixed(1),
      annualLimit: ANNUAL_DLP_LIMIT,
      percentOfLimit30d: +((totalDlp30d / ANNUAL_DLP_LIMIT) * 100).toFixed(1),
      percentOfLimit1y: +((totalDlp1y / ANNUAL_DLP_LIMIT) * 100).toFixed(1),
      monthlyTrend,
      exams: records.map((r, idx) => this.toResult(r, levels[idx]!)),
    }
  }

  async getAlerts(status?: string): Promise<DoseAlert[]> {
    const records = await this.listRecords()
    const alerts: DoseAlert[] = []
    for (const record of records) {
      const level = await this.levelFor(record)
      if (level === 'normal') continue
      const drl = await this.findDrl(record.modality, record.bodyPart)
      const ackedAt = this.ackMap.get(record.id)
      alerts.push({
        id: record.id,
        patientId: record.patientId ?? null,
        patientName: record.patientName ?? '未知患者',
        modality: record.modality,
        bodyPart: record.bodyPart,
        ctdivol: record.ctdiVol,
        dlp: record.dlp,
        ssde: record.ssde ?? undefined,
        date: record.date,
        level,
        ctdivolDrl: drl?.ctdivolDrl ?? 0,
        dlpDrl: drl?.dlpDrl ?? 0,
        acknowledged: ackedAt !== undefined,
        ackedAt,
      })
    }
    alerts.sort((a, b) => b.date.localeCompare(a.date) || b.dlp - a.dlp)
    if (status === 'pending') return alerts.filter((a) => !a.acknowledged)
    if (status === 'acknowledged') return alerts.filter((a) => a.acknowledged)
    return alerts
  }

  async ackAlert(id: string): Promise<DoseAlert> {
    const records = await this.listRecords()
    const record = records.find((r) => r.id === id)
    if (!record) throw new NotFoundException(`未找到告警 ${id}`)
    const level = await this.levelFor(record)
    if (level === 'normal') throw new NotFoundException(`记录 ${id} 未触发告警`)
    if (!this.ackMap.has(id)) this.ackMap.set(id, new Date().toISOString())
    const drl = await this.findDrl(record.modality, record.bodyPart)
    return {
      id,
      patientId: record.patientId ?? null,
      patientName: record.patientName ?? '未知患者',
      modality: record.modality,
      bodyPart: record.bodyPart,
      ctdivol: record.ctdiVol,
      dlp: record.dlp,
      ssde: record.ssde ?? undefined,
      date: record.date,
      level,
      ctdivolDrl: drl?.ctdivolDrl ?? 0,
      dlpDrl: drl?.dlpDrl ?? 0,
      acknowledged: true,
      ackedAt: this.ackMap.get(id),
    }
  }
}
