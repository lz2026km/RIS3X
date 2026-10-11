// [v3.0.6.8-53] 口腔治疗管理 mock (Day 3)
// [G005 dental-demo-fill] 100 条治疗 = 20 名患者 × 5 条, patientId/studyId/chartId 全关联;
//   确定性 mulberry32 (种子 = 治疗编号), 无模块级 Math.random()。
import { mulberry32, hashSeed } from '../../utils/seededRandom';
import {
  MOCK_DENTAL_PATIENTS,
  dentalTreatmentIdFor,
  dentalStudyIdFor,
} from './dentalEmrMock';
import { getPrimaryChartId } from './dentalChartMock';

export type TreatmentType = 'Restorative' | 'Endodontic' | 'Periodontal' | 'Implant' | 'Orthodontic' | 'Extraction' | 'Surgery' | 'Pediatric';
export type TreatmentStatus = 'Planned' | 'InProgress' | 'Completed' | 'Cancelled' | 'Deferred';
export type ToothSurface = 'O' | 'M' | 'D' | 'B' | 'L';

export interface DentalTreatment {
  id: string;
  patientId: string;
  patientName: string;
  chartId?: string; // 关联牙位图 (dentalChartMock)
  studyId?: string; // 关联影像 (dentalImagingMock)
  type: TreatmentType;
  toothNo: number;
  toothSurface?: ToothSurface;
  diagnosis: string;
  plan: string;
  status: TreatmentStatus;
  priority: 'Routine' | 'Urgent' | 'Emergency';
  cost: number;
  insuranceCoverage: number;
  currency: string;
  assignedDoctor: string;
  startDate?: string;
  completedDate?: string;
  createdAt: string;
  updatedAt: string;
}

const TYPE_POOL: TreatmentType[] = ['Restorative', 'Endodontic', 'Periodontal', 'Implant', 'Orthodontic', 'Extraction', 'Surgery', 'Pediatric'];
const DIAGNOSES = [
  '深龋', '牙髓炎急性', '牙髓炎慢性', '根尖周炎', '牙周炎', '阻生智齿',
  '单颗牙缺失', '前牙拥挤', '后牙反合', '下颌骨囊肿',
];
const PLANS = [
  '根管治疗后全冠修复', '充填治疗 (树脂)', '牙周基础治疗 + SRP', '阻生齿拔除',
  '种植体植入 (Straumann BLT)', '隐形矫正 (Invisalign)', '嵌体修复 (E-max)', '窝沟封闭',
];
const TYPE_BY_PLAN: Record<string, TreatmentType> = {
  '根管治疗后全冠修复': 'Endodontic',
  '充填治疗 (树脂)': 'Restorative',
  '牙周基础治疗 + SRP': 'Periodontal',
  '阻生齿拔除': 'Extraction',
  '种植体植入 (Straumann BLT)': 'Implant',
  '隐形矫正 (Invisalign)': 'Orthodontic',
  '嵌体修复 (E-max)': 'Restorative',
  '窝沟封闭': 'Pediatric',
};

const ANCHOR_MS = Date.parse('2026-10-01T00:00:00.000Z');
const DAY_MS = 24 * 3600 * 1000;

export function randInt(a: number, b: number, key?: string) {
  const r = mulberry32(hashSeed(key ?? `dental-treat-rand-${a}-${b}-${MOCK_DENTAL_TREATMENTS.length}`));
  return Math.floor(r() * (b - a + 1)) + a;
}

function pickBy<T>(r: () => number, arr: readonly T[]): T {
  return arr[Math.floor(r() * arr.length)]!;
}

function dateShift(days: number): string {
  return new Date(ANCHOR_MS + days * DAY_MS).toISOString().slice(0, 10);
}

export const MOCK_DENTAL_TREATMENTS: DentalTreatment[] = (() => {
  const out: DentalTreatment[] = [];
  for (let i = 0; i < 100; i++) {
    const patientIdx = Math.floor(i / 5) % MOCK_DENTAL_PATIENTS.length; // 20 × 5
    const j = i % 5;
    const patient = MOCK_DENTAL_PATIENTS[patientIdx]!;
    const id = dentalTreatmentIdFor(patientIdx, j);
    const r = mulberry32(hashSeed(`dental-treatment-${id}`));
    const plan = pickBy(r, PLANS);
    const type = TYPE_BY_PLAN[plan] ?? pickBy(r, TYPE_POOL);
    const status = pickBy(r, ['Completed', 'Completed', 'Completed', 'InProgress', 'Planned', 'Cancelled'] as TreatmentStatus[]);
    const toothNo = pickBy(r, [11, 16, 21, 26, 31, 36, 41, 46, 13, 23, 33, 43, 17, 27, 37, 47]);
    const cost = pickBy(r, [200, 500, 1000, 2000, 5000, 8000, 12000]);
    const insurancePct = pickBy(r, [0.5, 0.6, 0.7, 0.8]);
    const createdDaysAgo = 10 + Math.floor(r() * 170);
    out.push({
      id,
      patientId: patient.id,
      patientName: patient.name,
      chartId: getPrimaryChartId(patient.id),
      studyId: j < 3 ? dentalStudyIdFor(patientIdx, j) : undefined, // 前 3 条治疗关联同患者影像
      type,
      toothNo,
      toothSurface: type === 'Restorative' ? pickBy(r, ['O', 'M', 'D', 'B', 'L'] as ToothSurface[]) : undefined,
      diagnosis: pickBy(r, DIAGNOSES),
      plan,
      status,
      priority: pickBy(r, ['Routine', 'Routine', 'Routine', 'Urgent', 'Emergency'] as const),
      cost,
      insuranceCoverage: Math.round(cost * insurancePct),
      currency: 'CNY',
      assignedDoctor: patient.dentist === '王医生' ? '王主任' : patient.dentist === '李医生' ? '李主任' : patient.dentist === '赵医生' ? '刘主任' : patient.dentist === '刘医生' ? '陈主任' : '张主任',
      startDate: status === 'Completed' || status === 'InProgress' ? dateShift(-(createdDaysAgo - 2)) : undefined,
      completedDate: status === 'Completed' ? dateShift(-Math.floor(createdDaysAgo / 3)) : undefined,
      createdAt: new Date(ANCHOR_MS - createdDaysAgo * DAY_MS).toISOString(),
      updatedAt: new Date(ANCHOR_MS - Math.floor(createdDaysAgo / 2) * DAY_MS).toISOString(),
    });
  }
  return out;
})();
