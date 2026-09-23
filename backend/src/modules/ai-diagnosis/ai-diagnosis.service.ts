import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import {
  extraSeedLung,
  extraSeedBreast,
  extraSeedFracture,
  extraSeedCardiac,
} from './seed-cases'

export interface AccuracyRequest {
  startDate: string
  endDate: string
  siteId?: string
  modality?: string
}

export interface AccuracyResult {
  sensitivity: number
  specificity: number
  ppv: number
  npv: number
  accuracy: number
  totalCases: number
  aiPositive: number
  aiNegative: number
  physicianPositive: number
  physicianNegative: number
}

export interface TrendPoint {
  date: string
  sensitivity: number
  specificity: number
  accuracy: number
  totalCases: number
}

// ── 肺结节 CAD ───────────────────────────────────────────────────────────────
export interface LungNodule {
  id: string
  studyId: string
  patientName: string
  modality: string
  sliceLocation: number
  x: number
  y: number
  z: number
  diameter: number
  volume: number
  density: 'solid' | 'partSolid' | 'groundGlass' | 'calcified'
  malignancyRisk: number
  characteristics: string[]
  lidcId?: string
}

export interface LungCadResult {
  id: string
  studyId: string
  patientName: string
  modality: string
  noduleCount: number
  nodules: LungNodule[]
  overallRisk: 'low' | 'moderate' | 'high' | 'very_high'
  recommendation: string
  modelVersion: string
  status: 'auto' | 'reviewed' | 'confirmed'
  createdAt: string
}

export interface LungCadReviewDto {
  noduleId: string
  status: 'confirmed' | 'rejected' | 'amended'
  amendedDiagnosis?: string
  comment?: string
}

// ── 乳腺 CAD ─────────────────────────────────────────────────────────────────
export interface BreastLesion {
  id: string
  studyId: string
  view: string
  x: number
  y: number
  width: number
  height: number
  type: 'mass' | 'calcification' | 'architectural_distortion' | 'asymmetry'
  shape: 'round' | 'oval' | 'irregular'
  margin: 'circumscribed' | 'obscured' | 'spiculated' | 'microlobulated'
  density: 'high' | 'equal' | 'low'
  biRads: '2' | '3' | '4a' | '4b' | '4c' | '5'
  malignancyRisk: number
}

export interface BreastCadResult {
  id: string
  studyId: string
  patientName: string
  modality: string
  lesionCount: number
  lesions: BreastLesion[]
  overallBiRads: string
  recommendation: string
  modelVersion: string
  status: 'auto' | 'reviewed' | 'confirmed'
  createdAt: string
}

export interface BreastCadReviewDto {
  lesionId: string
  status: 'confirmed' | 'rejected' | 'amended'
  amendedBiRads?: string
  comment?: string
}

// ── 骨折 CAD ─────────────────────────────────────────────────────────────────
export interface FractureFinding {
  id: string
  studyId: string
  bone: string
  fractureType: 'simple' | 'comminuted' | 'open' | 'stress' | 'pathological' | 'avulsion'
  location: string
  displacement: 'minimal' | 'moderate' | 'significant'
  comminution: boolean
  jointInvolvement: boolean
  confidence: number
  boundingBox: { x: number; y: number; width: number; height: number }
}

export interface FractureCadResult {
  id: string
  studyId: string
  patientName: string
  modality: string
  bodyPart: string
  fractureCount: number
  fractures: FractureFinding[]
  severity: 'mild' | 'moderate' | 'severe'
  recommendation: string
  modelVersion: string
  status: 'auto' | 'reviewed' | 'confirmed'
  createdAt: string
}

export interface FractureCadReviewDto {
  findingId: string
  status: 'confirmed' | 'rejected' | 'amended'
  amendedDiagnosis?: string
  comment?: string
}

// ── 心脏 AI ──────────────────────────────────────────────────────────────────
export interface CardiacMeasurement {
  id: string
  studyId: string
  parameter: string
  value: number
  unit: string
  normalRange: { min: number; max: number }
  abnormal: boolean
}

export interface CardiacStenosis {
  vessel: string
  segment: string
  stenosisPercent: number
  severity: 'normal' | 'mild' | 'moderate' | 'severe' | 'occluded'
  calcified: boolean
}

export interface CardiacAiResult {
  id: string
  studyId: string
  patientName: string
  modality: 'CT' | 'MR'
  measurements: CardiacMeasurement[]
  ejectionFraction?: number
  lvVolume?: number
  lvMass?: number
  cadRads?: '0' | '1' | '2' | '3' | '4' | '5'
  stenosis: CardiacStenosis[]
  overallAssessment: string
  recommendation: string
  modelVersion: string
  status: 'auto' | 'reviewed' | 'confirmed'
  createdAt: string
}

export interface CardiacAiReviewDto {
  status: 'confirmed' | 'rejected' | 'amended'
  amendedAssessment?: string
  comment?: string
}

// ── 通用响应包装 ─────────────────────────────────────────────────────────────
export interface ApiOk<T> {
  success: true
  data: T
}

function ok<T>(data: T): ApiOk<T> {
  return { success: true, data }
}

function rand(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100
}

function hashStr(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

// ── 内存 seed 数据 (schema.prisma 暂无 AiDiagnosis 模型,沿用 cad 模块的内存 seed 模式) ──
const seededLung: LungCadResult[] = [
  {
    id: 'LUNG-001',
    studyId: 'LS20260718-001',
    patientName: '张伟',
    modality: 'CT',
    noduleCount: 3,
    nodules: [
      { id: 'LUNG-001-N1', studyId: 'LS20260718-001', patientName: '张伟', modality: 'CT', sliceLocation: 126, x: 120, y: 180, z: 0, diameter: 14.5, volume: 1.6, density: 'partSolid', malignancyRisk: 0.78, characteristics: ['分叶状', '毛刺', '胸膜牵拉'], lidcId: 'LIDC-IDRI-0001' },
      { id: 'LUNG-001-N2', studyId: 'LS20260718-001', patientName: '张伟', modality: 'CT', sliceLocation: 98, x: 300, y: 250, z: 12, diameter: 4.2, volume: 0.04, density: 'calcified', malignancyRisk: 0.06, characteristics: ['钙化'], lidcId: 'LIDC-IDRI-0001' },
      { id: 'LUNG-001-N3', studyId: 'LS20260718-001', patientName: '张伟', modality: 'CT', sliceLocation: 154, x: 380, y: 100, z: 5, diameter: 8.1, volume: 0.28, density: 'groundGlass', malignancyRisk: 0.41, characteristics: ['磨玻璃', '边界模糊'], lidcId: 'LIDC-IDRI-0001' },
    ],
    overallRisk: 'high',
    recommendation: '右肺上叶 14.5mm 混合磨玻璃结节,建议 3 个月后低剂量 CT 随访复查,必要时 PET-CT 或穿刺活检。',
    modelVersion: 'lungcad-v3.2.1',
    status: 'auto',
    createdAt: '2026-07-18T09:30:00.000Z',
  },
  {
    id: 'LUNG-002',
    studyId: 'LS20260719-003',
    patientName: '李秀英',
    modality: 'CT',
    noduleCount: 1,
    nodules: [
      { id: 'LUNG-002-N1', studyId: 'LS20260719-003', patientName: '李秀英', modality: 'CT', sliceLocation: 87, x: 210, y: 320, z: 8, diameter: 3.6, volume: 0.02, density: 'solid', malignancyRisk: 0.12, characteristics: ['光滑', '类圆形'], lidcId: 'LIDC-IDRI-0034' },
    ],
    overallRisk: 'low',
    recommendation: '右上肺 3.6mm 实性小结节,考虑良性,建议年度常规复查。',
    modelVersion: 'lungcad-v3.2.1',
    status: 'reviewed',
    createdAt: '2026-07-19T11:20:00.000Z',
  },
  {
    id: 'LUNG-003',
    studyId: 'LS20260721-007',
    patientName: '王建国',
    modality: 'CT',
    noduleCount: 2,
    nodules: [
      { id: 'LUNG-003-N1', studyId: 'LS20260721-007', patientName: '王建国', modality: 'CT', sliceLocation: 143, x: 95, y: 210, z: 3, diameter: 9.8, volume: 0.49, density: 'solid', malignancyRisk: 0.62, characteristics: ['分叶状', '毛刺'], lidcId: 'LIDC-IDRI-0087' },
      { id: 'LUNG-003-N2', studyId: 'LS20260721-007', patientName: '王建国', modality: 'CT', sliceLocation: 135, x: 350, y: 140, z: 9, diameter: 5.5, volume: 0.09, density: 'partSolid', malignancyRisk: 0.35, characteristics: ['混合密度'], lidcId: 'LIDC-IDRI-0087' },
    ],
    overallRisk: 'moderate',
    recommendation: '左肺下叶 9.8mm 实性结节伴分叶/毛刺,建议 6 个月后 CT 随访,必要时增强检查。',
    modelVersion: 'lungcad-v3.2.1',
    status: 'auto',
    createdAt: '2026-07-21T14:05:00.000Z',
  },
  {
    id: 'LUNG-004',
    studyId: 'LS20260725-012',
    patientName: '陈芳',
    modality: 'CT',
    noduleCount: 4,
    nodules: [
      { id: 'LUNG-004-N1', studyId: 'LS20260725-012', patientName: '陈芳', modality: 'CT', sliceLocation: 112, x: 140, y: 260, z: 0, diameter: 22.3, volume: 5.8, density: 'solid', malignancyRisk: 0.91, characteristics: ['分叶状', '毛刺', '血管集束征'], lidcId: 'LIDC-IDRI-0123' },
      { id: 'LUNG-004-N2', studyId: 'LS20260725-012', patientName: '陈芳', modality: 'CT', sliceLocation: 108, x: 260, y: 90, z: 4, diameter: 6.2, volume: 0.12, density: 'groundGlass', malignancyRisk: 0.44, characteristics: ['磨玻璃'], lidcId: 'LIDC-IDRI-0123' },
      { id: 'LUNG-004-N3', studyId: 'LS20260725-012', patientName: '陈芳', modality: 'CT', sliceLocation: 120, x: 400, y: 300, z: 6, diameter: 3.9, volume: 0.03, density: 'solid', malignancyRisk: 0.15, characteristics: ['光滑'], lidcId: 'LIDC-IDRI-0123' },
      { id: 'LUNG-004-N4', studyId: 'LS20260725-012', patientName: '陈芳', modality: 'CT', sliceLocation: 116, x: 190, y: 380, z: 2, diameter: 5.1, volume: 0.07, density: 'calcified', malignancyRisk: 0.05, characteristics: ['钙化'], lidcId: 'LIDC-IDRI-0123' },
    ],
    overallRisk: 'very_high',
    recommendation: '左肺上叶 22.3mm 实性结节,高度可疑恶性,建议立即转诊胸外科并考虑穿刺活检。',
    modelVersion: 'lungcad-v3.2.1',
    status: 'confirmed',
    createdAt: '2026-07-25T16:40:00.000Z',
  },
  ...extraSeedLung,
]

const seededBreast: BreastCadResult[] = [
  {
    id: 'BREAST-001',
    studyId: 'BS20260715-002',
    patientName: '刘敏',
    modality: 'MG',
    lesionCount: 2,
    lesions: [
      { id: 'BREAST-001-L1', studyId: 'BS20260715-002', view: 'CC-L', x: 152, y: 96, width: 24, height: 21, type: 'mass', shape: 'irregular', margin: 'spiculated', density: 'high', biRads: '4c', malignancyRisk: 0.83 },
      { id: 'BREAST-001-L2', studyId: 'BS20260715-002', view: 'MLO-L', x: 180, y: 120, width: 8, height: 6, type: 'calcification', shape: 'round', margin: 'circumscribed', density: 'high', biRads: '4a', malignancyRisk: 0.28 },
    ],
    overallBiRads: '4c',
    recommendation: '左乳不规则毛刺肿块伴簇状钙化,BI-RADS 4c,建议穿刺活检明确病理。',
    modelVersion: 'breastcad-v2.8.0',
    status: 'auto',
    createdAt: '2026-07-15T10:10:00.000Z',
  },
  {
    id: 'BREAST-002',
    studyId: 'BS20260716-005',
    patientName: '赵丽',
    modality: 'MG',
    lesionCount: 1,
    lesions: [
      { id: 'BREAST-002-L1', studyId: 'BS20260716-005', view: 'MLO-R', x: 210, y: 85, width: 12, height: 11, type: 'mass', shape: 'oval', margin: 'circumscribed', density: 'equal', biRads: '3', malignancyRisk: 0.09 },
    ],
    overallBiRads: '3',
    recommendation: '右乳 1.2cm 类圆形边界清楚肿块,BI-RADS 3,建议 6 个月后复查。',
    modelVersion: 'breastcad-v2.8.0',
    status: 'reviewed',
    createdAt: '2026-07-16T13:25:00.000Z',
  },
  {
    id: 'BREAST-003',
    studyId: 'BS20260720-009',
    patientName: '孙晓红',
    modality: 'US',
    lesionCount: 1,
    lesions: [
      { id: 'BREAST-003-L1', studyId: 'BS20260720-009', view: 'US-R', x: 120, y: 140, width: 30, height: 26, type: 'mass', shape: 'irregular', margin: 'microlobulated', density: 'low', biRads: '4b', malignancyRisk: 0.57 },
    ],
    overallBiRads: '4b',
    recommendation: '右乳低回声不规则肿块,微分叶边缘,BI-RADS 4b,建议病理学检查。',
    modelVersion: 'breastcad-v2.8.0',
    status: 'auto',
    createdAt: '2026-07-20T15:50:00.000Z',
  },
  {
    id: 'BREAST-004',
    studyId: 'BS20260724-014',
    patientName: '周倩',
    modality: 'MG',
    lesionCount: 3,
    lesions: [
      { id: 'BREAST-004-L1', studyId: 'BS20260724-014', view: 'CC-R', x: 95, y: 110, width: 18, height: 17, type: 'mass', shape: 'round', margin: 'circumscribed', density: 'high', biRads: '2', malignancyRisk: 0.04 },
      { id: 'BREAST-004-L2', studyId: 'BS20260724-014', view: 'CC-R', x: 220, y: 160, width: 40, height: 35, type: 'architectural_distortion', shape: 'irregular', margin: 'spiculated', density: 'equal', biRads: '4a', malignancyRisk: 0.31 },
      { id: 'BREAST-004-L3', studyId: 'BS20260724-014', view: 'MLO-R', x: 180, y: 200, width: 15, height: 12, type: 'asymmetry', shape: 'oval', margin: 'obscured', density: 'equal', biRads: '3', malignancyRisk: 0.12 },
    ],
    overallBiRads: '4a',
    recommendation: '右乳结构扭曲伴轻度不对称致密,BI-RADS 4a,建议超声补充检查。',
    modelVersion: 'breastcad-v2.8.0',
    status: 'confirmed',
    createdAt: '2026-07-24T09:15:00.000Z',
  },
  ...extraSeedBreast,
]

const seededFracture: FractureCadResult[] = [
  {
    id: 'FRACTURE-001',
    studyId: 'FS20260714-001',
    patientName: '刘强',
    modality: 'DR',
    bodyPart: '前臂',
    fractureCount: 1,
    fractures: [
      { id: 'FRACTURE-001-F1', studyId: 'FS20260714-001', bone: '桡骨', fractureType: 'simple', location: '桡骨远端', displacement: 'minimal', comminution: false, jointInvolvement: false, confidence: 0.94, boundingBox: { x: 210, y: 150, width: 90, height: 70 } },
    ],
    severity: 'mild',
    recommendation: '右桡骨远端简单骨折,轻微移位,建议保守治疗并石膏固定。',
    modelVersion: 'fracturecad-v1.9.3',
    status: 'confirmed',
    createdAt: '2026-07-14T08:45:00.000Z',
  },
  {
    id: 'FRACTURE-002',
    studyId: 'FS20260717-006',
    patientName: '张立军',
    modality: 'CT',
    bodyPart: '踝部',
    fractureCount: 2,
    fractures: [
      { id: 'FRACTURE-002-F1', studyId: 'FS20260717-006', bone: '胫骨', fractureType: 'comminuted', location: '胫骨远端', displacement: 'significant', comminution: true, jointInvolvement: true, confidence: 0.97, boundingBox: { x: 160, y: 220, width: 120, height: 85 } },
      { id: 'FRACTURE-002-F2', studyId: 'FS20260717-006', bone: '腓骨', fractureType: 'simple', location: '腓骨下段', displacement: 'moderate', comminution: false, jointInvolvement: true, confidence: 0.89, boundingBox: { x: 290, y: 230, width: 80, height: 60 } },
    ],
    severity: 'severe',
    recommendation: '左踝胫骨粉碎性骨折累及关节面,伴腓骨骨折,建议手术治疗。',
    modelVersion: 'fracturecad-v1.9.3',
    status: 'auto',
    createdAt: '2026-07-17T12:30:00.000Z',
  },
  {
    id: 'FRACTURE-003',
    studyId: 'FS20260722-011',
    patientName: '王春梅',
    modality: 'DR',
    bodyPart: '手腕',
    fractureCount: 1,
    fractures: [
      { id: 'FRACTURE-003-F1', studyId: 'FS20260722-011', bone: '舟骨', fractureType: 'stress', location: '腕舟骨腰部', displacement: 'minimal', comminution: false, jointInvolvement: false, confidence: 0.71, boundingBox: { x: 240, y: 190, width: 60, height: 45 } },
    ],
    severity: 'mild',
    recommendation: '右腕舟骨应力性骨折,未见明显移位,建议制动 6 周后复查。',
    modelVersion: 'fracturecad-v1.9.3',
    status: 'reviewed',
    createdAt: '2026-07-22T17:20:00.000Z',
  },
  {
    id: 'FRACTURE-004',
    studyId: 'FS20260726-015',
    patientName: '李海涛',
    modality: 'DR',
    bodyPart: '髋部',
    fractureCount: 1,
    fractures: [
      { id: 'FRACTURE-004-F1', studyId: 'FS20260726-015', bone: '股骨颈', fractureType: 'pathological', location: '股骨颈基底部', displacement: 'moderate', comminution: false, jointInvolvement: true, confidence: 0.93, boundingBox: { x: 180, y: 260, width: 110, height: 80 } },
    ],
    severity: 'severe',
    recommendation: '左股骨颈病理性骨折,中度移位,建议骨科会诊评估手术方案。',
    modelVersion: 'fracturecad-v1.9.3',
    status: 'auto',
    createdAt: '2026-07-26T10:55:00.000Z',
  },
  ...extraSeedFracture,
]

const seededCardiac: CardiacAiResult[] = [
  {
    id: 'CARDIAC-001',
    studyId: 'CS20260713-001',
    patientName: '马永刚',
    modality: 'CT',
    measurements: [
      { id: 'CARDIAC-001-M1', studyId: 'CS20260713-001', parameter: '左心室射血分数(EF)', value: 45, unit: '%', normalRange: { min: 50, max: 75 }, abnormal: true },
      { id: 'CARDIAC-001-M2', studyId: 'CS20260713-001', parameter: '左心室舒张末期容积(LVEDV)', value: 128, unit: 'mL', normalRange: { min: 77, max: 195 }, abnormal: false },
      { id: 'CARDIAC-001-M3', studyId: 'CS20260713-001', parameter: '左心室收缩末期容积(LVESV)', value: 70, unit: 'mL', normalRange: { min: 19, max: 72 }, abnormal: false },
      { id: 'CARDIAC-001-M4', studyId: 'CS20260713-001', parameter: '左心室质量(LV Mass)', value: 168, unit: 'g', normalRange: { min: 96, max: 200 }, abnormal: false },
    ],
    ejectionFraction: 45,
    lvVolume: 128,
    lvMass: 168,
    cadRads: '3',
    stenosis: [
      { vessel: '左前降支(LAD)', segment: '近段', stenosisPercent: 65, severity: 'moderate', calcified: true },
      { vessel: '左回旋支(LCX)', segment: '中段', stenosisPercent: 30, severity: 'mild', calcified: true },
      { vessel: '右冠状动脉(RCA)', segment: '近段', stenosisPercent: 15, severity: 'mild', calcified: false },
    ],
    overallAssessment: '左前降支近段 65% 狭窄,CAD-RADS 3,建议负荷心肌灌注显像进一步评估。',
    recommendation: '建议冠脉造影评估 LAD 狭窄,同时控制危险因素、规范药物治疗。',
    modelVersion: 'cardiacai-v2.4.1',
    status: 'auto',
    createdAt: '2026-07-13T09:40:00.000Z',
  },
  {
    id: 'CARDIAC-002',
    studyId: 'CS20260716-004',
    patientName: '郑秀兰',
    modality: 'CT',
    measurements: [
      { id: 'CARDIAC-002-M1', studyId: 'CS20260716-004', parameter: '左心室射血分数(EF)', value: 58, unit: '%', normalRange: { min: 50, max: 75 }, abnormal: false },
      { id: 'CARDIAC-002-M2', studyId: 'CS20260716-004', parameter: '冠状动脉钙化积分(Agatston)', value: 214, unit: 'AU', normalRange: { min: 0, max: 100 }, abnormal: true },
      { id: 'CARDIAC-002-M3', studyId: 'CS20260716-004', parameter: '左心室舒张末期容积(LVEDV)', value: 110, unit: 'mL', normalRange: { min: 77, max: 195 }, abnormal: false },
    ],
    ejectionFraction: 58,
    lvVolume: 110,
    cadRads: '2',
    stenosis: [
      { vessel: '左回旋支(LCX)', segment: '远段', stenosisPercent: 45, severity: 'mild', calcified: true },
    ],
    overallAssessment: '轻度冠脉粥样硬化,CAD-RADS 2,钙化积分 214,建议生活方式干预。',
    recommendation: '建议控制血脂、戒烟限酒,一年后复查冠脉 CTA。',
    modelVersion: 'cardiacai-v2.4.1',
    status: 'reviewed',
    createdAt: '2026-07-16T14:20:00.000Z',
  },
  {
    id: 'CARDIAC-003',
    studyId: 'CS20260719-008',
    patientName: '陈国栋',
    modality: 'CT',
    measurements: [
      { id: 'CARDIAC-003-M1', studyId: 'CS20260719-008', parameter: '左心室射血分数(EF)', value: 32, unit: '%', normalRange: { min: 50, max: 75 }, abnormal: true },
      { id: 'CARDIAC-003-M2', studyId: 'CS20260719-008', parameter: '冠状动脉钙化积分(Agatston)', value: 895, unit: 'AU', normalRange: { min: 0, max: 100 }, abnormal: true },
      { id: 'CARDIAC-003-M3', studyId: 'CS20260719-008', parameter: '左心室收缩末期容积(LVESV)', value: 96, unit: 'mL', normalRange: { min: 19, max: 72 }, abnormal: true },
    ],
    ejectionFraction: 32,
    lvVolume: 142,
    lvMass: 210,
    cadRads: '4',
    stenosis: [
      { vessel: '左前降支(LAD)', segment: '近段', stenosisPercent: 90, severity: 'severe', calcified: true },
      { vessel: '左主干(LM)', segment: '开口部', stenosisPercent: 55, severity: 'moderate', calcified: true },
      { vessel: '右冠状动脉(RCA)', segment: '中段', stenosisPercent: 80, severity: 'severe', calcified: false },
    ],
    overallAssessment: '三支病变,左前降支近段 90% 狭窄,CAD-RADS 4,建议急诊心内科会诊。',
    recommendation: '建议尽快冠脉造影并评估血运重建,同时完善心力衰竭评估。',
    modelVersion: 'cardiacai-v2.4.1',
    status: 'confirmed',
    createdAt: '2026-07-19T11:00:00.000Z',
  },
  {
    id: 'CARDIAC-004',
    studyId: 'CS20260723-013',
    patientName: '吴秀梅',
    modality: 'MR',
    measurements: [
      { id: 'CARDIAC-004-M1', studyId: 'CS20260723-013', parameter: '左心室射血分数(EF)', value: 62, unit: '%', normalRange: { min: 50, max: 75 }, abnormal: false },
      { id: 'CARDIAC-004-M2', studyId: 'CS20260723-013', parameter: '右心室射血分数(RVEF)', value: 55, unit: '%', normalRange: { min: 44, max: 70 }, abnormal: false },
      { id: 'CARDIAC-004-M3', studyId: 'CS20260723-013', parameter: '左心室舒张末期容积(LVEDV)', value: 105, unit: 'mL', normalRange: { min: 77, max: 195 }, abnormal: false },
    ],
    ejectionFraction: 62,
    lvVolume: 105,
    lvMass: 122,
    cadRads: '0',
    stenosis: [],
    overallAssessment: '心脏结构及功能未见明显异常,CAD-RADS 0,EF 62%。',
    recommendation: '未见明显异常,建议定期随访。',
    modelVersion: 'cardiacai-v2.4.1',
    status: 'auto',
    createdAt: '2026-07-23T15:35:00.000Z',
  },
  ...extraSeedCardiac,
]

@Injectable()
export class AiDiagnosisService {
  // ── 肺结节 CAD ────────────────────────────────────────────────────────────
  async listLungCad(): Promise<ApiOk<LungCadResult[]>> {
    return ok([...seededLung])
  }

  async getLungCad(id: string): Promise<ApiOk<LungCadResult>> {
    const result = seededLung.find((r) => r.id === id)
    if (!result) throw new NotFoundException(`Lung CAD result ${id} not found`)
    return ok(result)
  }

  async analyzeLungCad(studyId: string): Promise<ApiOk<LungCadResult>> {
    const existing = seededLung.find((r) => r.studyId === studyId)
    if (existing) return ok(existing)
    const h = hashStr(studyId)
    const count = 1 + (h % 3)
    const densities: LungNodule['density'][] = ['solid', 'partSolid', 'groundGlass', 'calcified']
    const nodules: LungNodule[] = Array.from({ length: count }, (_, i) => {
      const density = densities[(h + i) % densities.length]
      const diameter = Math.round((4 + ((h + i * 7) % 180) / 10) * 10) / 10
      return {
        id: `LUNG-AN-${h}-N${i + 1}`,
        studyId,
        patientName: '待确认',
        modality: 'CT',
        sliceLocation: 100 + ((h + i * 13) % 80),
        x: 60 + ((h + i * 29) % 340),
        y: 60 + ((h + i * 17) % 340),
        z: i,
        diameter,
        volume: Math.round(diameter ** 3 * 0.00052 * 1000) / 1000,
        density,
        malignancyRisk: Math.round((0.05 + ((h + i * 11) % 80) / 100) * 100) / 100,
        characteristics: density === 'calcified' ? ['钙化'] : ['边界不清'],
      }
    })
    const maxRisk = Math.max(...nodules.map((n) => n.malignancyRisk))
    const overallRisk: LungCadResult['overallRisk'] =
      maxRisk > 0.7 ? 'high' : maxRisk > 0.4 ? 'moderate' : 'low'
    const result: LungCadResult = {
      id: `LUNG-AN-${h}`,
      studyId,
      patientName: '待确认',
      modality: 'CT',
      noduleCount: count,
      nodules,
      overallRisk,
      recommendation: 'AI 自动分析完成,建议由影像科医师复核确认。',
      modelVersion: 'lungcad-v3.2.1',
      status: 'auto',
      createdAt: new Date().toISOString(),
    }
    seededLung.unshift(result)
    return ok(result)
  }

  async reviewLungCad(id: string, dto: LungCadReviewDto): Promise<ApiOk<LungCadResult>> {
    const result = seededLung.find((r) => r.id === id)
    if (!result) throw new NotFoundException(`Lung CAD result ${id} not found`)
    result.status = dto.status === 'confirmed' ? 'confirmed' : 'reviewed'
    const nodule = result.nodules.find((n) => n.id === dto.noduleId)
    if (nodule && dto.amendedDiagnosis) nodule.characteristics = [dto.amendedDiagnosis]
    return ok(result)
  }

  async lungCadStats(): Promise<ApiOk<Record<string, unknown>>> {
    const totalStudies = seededLung.length
    const totalNodules = seededLung.reduce((s, r) => s + r.noduleCount, 0)
    const riskCounts = new Map<string, number>()
    for (const r of seededLung) riskCounts.set(r.overallRisk, (riskCounts.get(r.overallRisk) ?? 0) + 1)
    const sizes = [
      { range: '<5mm', count: 0 },
      { range: '5-10mm', count: 0 },
      { range: '10-20mm', count: 0 },
      { range: '>20mm', count: 0 },
    ]
    for (const r of seededLung) {
      for (const n of r.nodules) {
        if (n.diameter < 5) sizes[0]!.count += 1
        else if (n.diameter < 10) sizes[1]!.count += 1
        else if (n.diameter < 20) sizes[2]!.count += 1
        else sizes[3]!.count += 1
      }
    }
    return ok({
      totalStudies,
      totalNodules,
      avgNodulesPerStudy: totalStudies ? Math.round((totalNodules / totalStudies) * 10) / 10 : 0,
      riskDistribution: Array.from(riskCounts, ([risk, count]) => ({ risk, count })),
      sizeDistribution: sizes,
    })
  }

  // ── 乳腺 CAD ──────────────────────────────────────────────────────────────
  async listBreastCad(): Promise<ApiOk<BreastCadResult[]>> {
    return ok([...seededBreast])
  }

  async getBreastCad(id: string): Promise<ApiOk<BreastCadResult>> {
    const result = seededBreast.find((r) => r.id === id)
    if (!result) throw new NotFoundException(`Breast CAD result ${id} not found`)
    return ok(result)
  }

  async analyzeBreastCad(studyId: string): Promise<ApiOk<BreastCadResult>> {
    const existing = seededBreast.find((r) => r.studyId === studyId)
    if (existing) return ok(existing)
    const h = hashStr(studyId)
    const biRadsValues: BreastLesion['biRads'][] = ['2', '3', '4a', '4b', '4c', '5']
    const biRads = biRadsValues[h % biRadsValues.length]
    const lesion: BreastLesion = {
      id: `BREAST-AN-${h}-L1`,
      studyId,
      view: h % 2 === 0 ? 'CC-L' : 'MLO-R',
      x: 100 + (h % 200),
      y: 80 + (h % 180),
      width: 12 + (h % 18),
      height: 10 + (h % 16),
      type: 'mass',
      shape: 'irregular',
      margin: 'spiculated',
      density: 'high',
      biRads,
      malignancyRisk: Math.round((0.1 + (h % 70) / 100) * 100) / 100,
    }
    const result: BreastCadResult = {
      id: `BREAST-AN-${h}`,
      studyId,
      patientName: '待确认',
      modality: 'MG',
      lesionCount: 1,
      lesions: [lesion],
      overallBiRads: biRads,
      recommendation: 'AI 自动分析完成,建议由影像科医师复核确认。',
      modelVersion: 'breastcad-v2.8.0',
      status: 'auto',
      createdAt: new Date().toISOString(),
    }
    seededBreast.unshift(result)
    return ok(result)
  }

  async reviewBreastCad(id: string, dto: BreastCadReviewDto): Promise<ApiOk<BreastCadResult>> {
    const result = seededBreast.find((r) => r.id === id)
    if (!result) throw new NotFoundException(`Breast CAD result ${id} not found`)
    result.status = dto.status === 'confirmed' ? 'confirmed' : 'reviewed'
    if (dto.amendedBiRads) result.overallBiRads = dto.amendedBiRads
    return ok(result)
  }

  async breastCadStats(): Promise<ApiOk<Record<string, unknown>>> {
    const biRadsCounts = new Map<string, number>()
    const typeCounts = new Map<string, number>()
    let totalLesions = 0
    for (const r of seededBreast) {
      biRadsCounts.set(r.overallBiRads, (biRadsCounts.get(r.overallBiRads) ?? 0) + 1)
      totalLesions += r.lesions.length
      for (const l of r.lesions) typeCounts.set(l.type, (typeCounts.get(l.type) ?? 0) + 1)
    }
    return ok({
      totalStudies: seededBreast.length,
      totalLesions,
      biRadsDistribution: Array.from(biRadsCounts, ([biRads, count]) => ({ biRads, count })),
      typeDistribution: Array.from(typeCounts, ([type, count]) => ({ type, count })),
    })
  }

  // ── 骨折 CAD ──────────────────────────────────────────────────────────────
  async listFractureCad(): Promise<ApiOk<FractureCadResult[]>> {
    return ok([...seededFracture])
  }

  async getFractureCad(id: string): Promise<ApiOk<FractureCadResult>> {
    const result = seededFracture.find((r) => r.id === id)
    if (!result) throw new NotFoundException(`Fracture CAD result ${id} not found`)
    return ok(result)
  }

  async analyzeFractureCad(studyId: string): Promise<ApiOk<FractureCadResult>> {
    const existing = seededFracture.find((r) => r.studyId === studyId)
    if (existing) return ok(existing)
    const h = hashStr(studyId)
    const bones = ['桡骨', '尺骨', '胫骨', '腓骨', '股骨颈', '肱骨']
    const severity: FractureCadResult['severity'] =
      h % 3 === 0 ? 'severe' : h % 3 === 1 ? 'moderate' : 'mild'
    const result: FractureCadResult = {
      id: `FRACTURE-AN-${h}`,
      studyId,
      patientName: '待确认',
      modality: 'DR',
      bodyPart: '四肢',
      fractureCount: 1,
      fractures: [
        {
          id: `FRACTURE-AN-${h}-F1`,
          studyId,
          bone: bones[h % bones.length]!,
          fractureType: 'simple',
          location: '骨干',
          displacement: severity === 'severe' ? 'significant' : 'minimal',
          comminution: h % 4 === 0,
          jointInvolvement: h % 5 === 0,
          confidence: Math.round((0.75 + (h % 20) / 100) * 100) / 100,
          boundingBox: { x: 150 + (h % 100), y: 180 + (h % 80), width: 90, height: 70 },
        },
      ],
      severity,
      recommendation: 'AI 自动分析完成,建议由影像科医师复核确认。',
      modelVersion: 'fracturecad-v1.9.3',
      status: 'auto',
      createdAt: new Date().toISOString(),
    }
    seededFracture.unshift(result)
    return ok(result)
  }

  async reviewFractureCad(id: string, dto: FractureCadReviewDto): Promise<ApiOk<FractureCadResult>> {
    const result = seededFracture.find((r) => r.id === id)
    if (!result) throw new NotFoundException(`Fracture CAD result ${id} not found`)
    result.status = dto.status === 'confirmed' ? 'confirmed' : 'reviewed'
    if (dto.amendedDiagnosis) result.recommendation = dto.amendedDiagnosis
    return ok(result)
  }

  async fractureCadStats(): Promise<ApiOk<Record<string, unknown>>> {
    const boneCounts = new Map<string, number>()
    const typeCounts = new Map<string, number>()
    let totalFractures = 0
    for (const r of seededFracture) {
      totalFractures += r.fractures.length
      for (const f of r.fractures) {
        boneCounts.set(f.bone, (boneCounts.get(f.bone) ?? 0) + 1)
        typeCounts.set(f.fractureType, (typeCounts.get(f.fractureType) ?? 0) + 1)
      }
    }
    return ok({
      totalStudies: seededFracture.length,
      totalFractures,
      boneDistribution: Array.from(boneCounts, ([bone, count]) => ({ bone, count })),
      typeDistribution: Array.from(typeCounts, ([type, count]) => ({ type, count })),
    })
  }

  // ── 心脏 AI ───────────────────────────────────────────────────────────────
  async listCardiacAi(): Promise<ApiOk<CardiacAiResult[]>> {
    return ok([...seededCardiac])
  }

  async getCardiacAi(id: string): Promise<ApiOk<CardiacAiResult>> {
    const result = seededCardiac.find((r) => r.id === id)
    if (!result) throw new NotFoundException(`Cardiac AI result ${id} not found`)
    return ok(result)
  }

  async analyzeCardiacAi(studyId: string): Promise<ApiOk<CardiacAiResult>> {
    const existing = seededCardiac.find((r) => r.studyId === studyId)
    if (existing) return ok(existing)
    const h = hashStr(studyId)
    const cadRads: CardiacAiResult['cadRads'] = (String(h % 6) as CardiacAiResult['cadRads'])
    const result: CardiacAiResult = {
      id: `CARDIAC-AN-${h}`,
      studyId,
      patientName: '待确认',
      modality: 'CT',
      measurements: [
        { id: `CARDIAC-AN-${h}-M1`, studyId, parameter: '左心室射血分数(EF)', value: 45 + (h % 25), unit: '%', normalRange: { min: 50, max: 75 }, abnormal: false },
        { id: `CARDIAC-AN-${h}-M2`, studyId, parameter: '冠状动脉钙化积分(Agatston)', value: 50 + (h % 400), unit: 'AU', normalRange: { min: 0, max: 100 }, abnormal: true },
      ],
      ejectionFraction: 45 + (h % 25),
      lvVolume: 100 + (h % 50),
      lvMass: 110 + (h % 60),
      cadRads,
      stenosis: [
        { vessel: '左前降支(LAD)', segment: '近段', stenosisPercent: 10 + (h % 60), severity: 'mild', calcified: h % 2 === 0 },
      ],
      overallAssessment: 'AI 自动分析完成,建议由影像科医师复核确认。',
      recommendation: '建议定期随访,必要时行冠脉 CTA。',
      modelVersion: 'cardiacai-v2.4.1',
      status: 'auto',
      createdAt: new Date().toISOString(),
    }
    seededCardiac.unshift(result)
    return ok(result)
  }

  async reviewCardiacAi(id: string, dto: CardiacAiReviewDto): Promise<ApiOk<CardiacAiResult>> {
    const result = seededCardiac.find((r) => r.id === id)
    if (!result) throw new NotFoundException(`Cardiac AI result ${id} not found`)
    result.status = dto.status === 'confirmed' ? 'confirmed' : 'reviewed'
    if (dto.amendedAssessment) result.overallAssessment = dto.amendedAssessment
    return ok(result)
  }

  async cardiacAiStats(): Promise<ApiOk<Record<string, unknown>>> {
    const cadRadsCounts = new Map<string, number>()
    const stenosisCounts = new Map<string, number>()
    let efSum = 0
    let efCount = 0
    for (const r of seededCardiac) {
      if (r.cadRads) cadRadsCounts.set(r.cadRads, (cadRadsCounts.get(r.cadRads) ?? 0) + 1)
      for (const s of r.stenosis) stenosisCounts.set(s.severity, (stenosisCounts.get(s.severity) ?? 0) + 1)
      if (r.ejectionFraction != null) {
        efSum += r.ejectionFraction
        efCount += 1
      }
    }
    return ok({
      totalStudies: seededCardiac.length,
      avgEjectionFraction: efCount ? Math.round((efSum / efCount) * 10) / 10 : 0,
      cadRadsDistribution: Array.from(cadRadsCounts, ([cadRads, count]) => ({ cadRads, count })),
      stenosisDistribution: Array.from(stenosisCounts, ([severity, count]) => ({ severity, count })),
    })
  }

  // ── 各模型统计 ─────────────────────────────────────────────────────────────
  async stats(): Promise<ApiOk<Record<string, unknown>>> {
    const lung = await this.lungCadStats()
    const lungData = lung.data as unknown as { totalStudies: number; riskDistribution: Array<{ risk: string; count: number }> }
    const breast = await this.breastCadStats()
    const breastData = breast.data as unknown as { totalStudies: number; biRadsDistribution: Array<{ biRads: string; count: number }> }
    const fracture = await this.fractureCadStats()
    const fractureData = fracture.data as unknown as { totalStudies: number }
    const cardiac = await this.cardiacAiStats()
    const cardiacData = cardiac.data as unknown as { totalStudies: number; cadRadsDistribution: Array<{ cadRads: string; count: number }> }
    return ok({
      lungCad: { total: lungData.totalStudies, highRisk: lungData.riskDistribution.filter((r) => r.risk === 'high' || r.risk === 'very_high').reduce((s, r) => s + r.count, 0), statuses: this.statusBreakdown(seededLung.map((r) => r.status)) },
      breastCad: { total: breastData.totalStudies, biRads4Plus: breastData.biRadsDistribution.filter((b) => ['4a', '4b', '4c', '5'].includes(b.biRads)).reduce((s, b) => s + b.count, 0), statuses: this.statusBreakdown(seededBreast.map((r) => r.status)) },
      fractureCad: { total: fractureData.totalStudies, severe: seededFracture.filter((r) => r.severity === 'severe').length, statuses: this.statusBreakdown(seededFracture.map((r) => r.status)) },
      cardiacAi: { total: cardiacData.totalStudies, cadRads3Plus: cardiacData.cadRadsDistribution.filter((c) => ['3', '4', '5'].includes(c.cadRads)).reduce((s, c) => s + c.count, 0), statuses: this.statusBreakdown(seededCardiac.map((r) => r.status)) },
      accuracy: { overall: 91.2, sensitivity: 92.5, specificity: 89.8 },
    })
  }

  private statusBreakdown(statuses: string[]): Array<{ status: string; count: number }> {
    const counts = new Map<string, number>()
    for (const s of statuses) counts.set(s, (counts.get(s) ?? 0) + 1)
    return Array.from(counts, ([status, count]) => ({ status, count }))
  }

  // ── 批量确认 / 模型重训 (W1-B: 对齐前端 aiDiagnosisApi.batchConfirm / retrainModel) ──

  async batchConfirm(dto: { ids: string[]; status: 'confirmed' | 'rejected'; model?: string }): Promise<ApiOk<Array<LungCadResult | BreastCadResult | FractureCadResult | CardiacAiResult>>> {
    const pools: Array<Array<LungCadResult | BreastCadResult | FractureCadResult | CardiacAiResult>> = []
    if (!dto.model || dto.model === 'lung-cad') pools.push(seededLung)
    if (!dto.model || dto.model === 'breast-cad') pools.push(seededBreast)
    if (!dto.model || dto.model === 'fracture-cad') pools.push(seededFracture)
    if (!dto.model || dto.model === 'cardiac-ai') pools.push(seededCardiac)
    const wanted = new Set(dto.ids)
    const updated: Array<LungCadResult | BreastCadResult | FractureCadResult | CardiacAiResult> = []
    for (const pool of pools) {
      for (const r of pool) {
        if (wanted.has(r.id)) {
          r.status = dto.status === 'confirmed' ? 'confirmed' : 'reviewed'
          updated.push(r)
        }
      }
    }
    return ok(updated)
  }

  async retrainModel(modelVersion: string): Promise<ApiOk<{ modelVersion: string; status: string; startedAt: string; message: string }>> {
    return ok({
      modelVersion,
      status: 'TRAINING',
      startedAt: new Date().toISOString(),
      message: `模型 ${modelVersion} 已进入训练队列 (模拟),训练完成后将自动上线`,
    })
  }

  // ── 准确率 (保留原实现) ────────────────────────────────────────────────────
  async accuracy(req: AccuracyRequest): Promise<AccuracyResult> {    const total = Math.round(Math.random() * 2000 + 500)
    const acc = rand(82, 96)
    const sens = rand(80, 97)
    const spec = rand(78, 95)
    const ppv = rand(75, 94)
    const npv = rand(80, 96)
    const aiPos = Math.round(total * rand(0.4, 0.6))
    const aiNeg = total - aiPos
    const physPos = Math.round(total * rand(0.35, 0.55))
    const physNeg = total - physPos
    return {
      sensitivity: sens,
      specificity: spec,
      ppv,
      npv,
      accuracy: acc,
      totalCases: total,
      aiPositive: aiPos,
      aiNegative: aiNeg,
      physicianPositive: physPos,
      physicianNegative: physNeg,
    }
  }

  async trend(req: AccuracyRequest): Promise<TrendPoint[]> {
    const start = new Date(req.startDate)
    const end = new Date(req.endDate)
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000))
    return Array.from({ length: Math.min(days, 90) }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      return {
        date: d.toISOString().slice(0, 10),
        sensitivity: rand(78, 98),
        specificity: rand(76, 96),
        accuracy: rand(80, 97),
        totalCases: Math.round(Math.random() * 100 + 20),
      }
    })
  }

  // ── [G005 Wave 10A] 病例库总览 (seed 扩充后 4 模型合计) ─────────────────────
  async listCaseLibrary() {
    const summarize = <T extends { id: string; studyId: string; patientName: string; status: string; createdAt: string }>(
      pool: T[],
      category: '形态' | 'BI-RADS' | '部位' | 'CAD-RADS',
      groupKey: (c: T) => string,
    ) => {
      const byKey = new Map<string, number>()
      for (const c of pool) byKey.set(groupKey(c), (byKey.get(groupKey(c)) ?? 0) + 1)
      return {
        total: pool.length,
        byCategory: Array.from(byKey.entries()).map(([key, count]) => ({ key, count })),
      }
    }
    return ok({
      lungCad: summarize(seededLung, '形态', (c) => (c.nodules[0]?.characteristics[0] ?? '其他')),
      breastCad: summarize(seededBreast, 'BI-RADS', (c) => c.overallBiRads),
      fractureCad: summarize(seededFracture, '部位', (c) => c.bodyPart),
      cardiacAi: summarize(seededCardiac, 'CAD-RADS', (c) => c.cadRads ?? 'MR'),
      generatedAt: new Date().toISOString(),
    })
  }

  async getCaseById(model: string, id: string) {
    const pool =
      model === 'lung-cad' ? seededLung
        : model === 'breast-cad' ? seededBreast
        : model === 'fracture-cad' ? seededFracture
        : model === 'cardiac-ai' ? seededCardiac
        : null
    if (!pool) throw new NotFoundException(`未知模型: ${model}`)
    const found = pool.find((c) => c.id === id)
    if (!found) throw new NotFoundException(`病例不存在: ${model}/${id}`)
    return ok(found)
  }

  // ── [G005 W3-BackendParity] 通用模型路由 (前端 aiDiagnosisApi.listResults/getResult/confirmResult) ──
  // 支持 4 个模型: lung-cad | breast-cad | fracture-cad | cardiac-ai; 其他模型 400。
  static readonly SUPPORTED_MODELS = ['lung-cad', 'breast-cad', 'fracture-cad', 'cardiac-ai'] as const

  private resolveModelPool(model: string): Array<Record<string, unknown>> {
    const pool =
      model === 'lung-cad' ? seededLung
        : model === 'breast-cad' ? seededBreast
        : model === 'fracture-cad' ? seededFracture
        : model === 'cardiac-ai' ? seededCardiac
        : null
    if (!pool) {
      throw new BadRequestException(`不支持的 AI 模型: ${model} (支持: ${AiDiagnosisService.SUPPORTED_MODELS.join(', ')})`)
    }
    return pool as unknown as Array<Record<string, unknown>>
  }

  /** GET /ai-diagnosis/:model/results */
  listResultsByModel(model: string, filter: { status?: string; modality?: string } = {}) {
    const pool = this.resolveModelPool(model)
    let data = pool
    if (filter.status) data = data.filter((r) => r.status === filter.status)
    if (filter.modality) data = data.filter((r) => r.modality === filter.modality)
    return ok(data)
  }

  /** GET /ai-diagnosis/:model/results/:id */
  getResultByModel(model: string, id: string) {
    const pool = this.resolveModelPool(model)
    const found = pool.find((r) => r.id === id)
    if (!found) throw new NotFoundException(`AI 结果不存在: ${model}/${id}`)
    return ok(found)
  }

  /** POST /ai-diagnosis/:model/results/:id/review */
  reviewResultByModel(model: string, id: string, body: Record<string, unknown>) {
    const pool = this.resolveModelPool(model)
    const found = pool.find((r) => r.id === id)
    if (!found) throw new NotFoundException(`AI 结果不存在: ${model}/${id}`)
    const status = String(body.status ?? 'confirmed')
    found.status = status === 'confirmed' ? 'confirmed' : 'reviewed'
    if (body.comment !== undefined) found.comment = body.comment
    if (body.amendedDiagnosis !== undefined) found.recommendation = body.amendedDiagnosis
    if (body.amendedAssessment !== undefined) found.overallAssessment = body.amendedAssessment
    if (body.amendedBiRads !== undefined) found.overallBiRads = body.amendedBiRads
    found.reviewedAt = new Date().toISOString()
    return ok(found)
  }
}
