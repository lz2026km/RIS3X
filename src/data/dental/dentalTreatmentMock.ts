// [v3.0.6.8-53] 口腔治疗管理 mock (Day 3)
export type TreatmentType = 'Restorative' | 'Endodontic' | 'Periodontal' | 'Implant' | 'Orthodontic' | 'Extraction' | 'Surgery' | 'Pediatric';
export type TreatmentStatus = 'Planned' | 'InProgress' | 'Completed' | 'Cancelled' | 'Deferred';
export type ToothSurface = 'O' | 'M' | 'D' | 'B' | 'L';

export interface DentalTreatment {
  id: string;
  patientId: string;
  patientName: string;
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

const PATIENT_NAMES = ['张伟','王芳','李娜','刘敏','陈静','杨丽','黄强','赵磊','吴军','周洋'];
const DOCTORS = ['王主任','李主任','张主任','刘主任','陈主任'];
const DIAGNOSES = [
  '深龋', '牙髓炎急性', '牙髓炎慢性', '根尖周炎', '牙周炎', '阻生智齿',
  '单颗牙缺失', '前牙拥挤', '后牙反合', '下颌骨囊肿',
];
const PLANS = [
  '根管治疗后全冠修复', '充填治疗 (树脂)', '牙周基础治疗 + SRP', '阻生齿拔除',
  '种植体植入 (Straumann BLT)', '隐形矫正 (Invisalign)', '嵌体修复 (E-max)', '窝沟封闭',
];

export function randInt(a: number, b: number) { return Math.floor(Math.random() * (b - a + 1)) + a; }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]!; }

export const MOCK_DENTAL_TREATMENTS: DentalTreatment[] = Array.from({ length: 300 }, (_, i) => {
  const type = pick(['Restorative','Endodontic','Periodontal','Implant','Orthodontic','Extraction','Surgery','Pediatric'] as TreatmentType[]);
  const status = pick(['Planned','InProgress','Completed','Cancelled'] as TreatmentStatus[]);
  const toothNo = pick([11,16,21,26,31,36,41,46,13,23,33,43,17,27,37,47]);
  return {
    id: `TREAT${String(100000 + i)}`,
    patientId: `P${String(100000 + i)}`,
    patientName: pick(PATIENT_NAMES),
    type,
    toothNo,
    toothSurface: type === 'Restorative' ? pick(['O','M','D','B','L'] as ToothSurface[]) : undefined,
    diagnosis: pick(DIAGNOSES),
    plan: pick(PLANS),
    status,
    priority: pick(['Routine','Routine','Routine','Urgent','Emergency'] as any),
    cost: pick([200,500,1000,2000,5000,8000,12000]),
    insuranceCoverage: pick([50,60,70,80]),
    currency: 'CNY',
    assignedDoctor: pick(DOCTORS),
    startDate: status === 'Completed' || status === 'InProgress' ? new Date(Date.now() - randInt(1, 90) * 24 * 3600 * 1000).toISOString().slice(0,10) : undefined,
    completedDate: status === 'Completed' ? new Date(Date.now() - randInt(0, 30) * 24 * 3600 * 1000).toISOString().slice(0,10) : undefined,
    createdAt: new Date(Date.now() - randInt(1, 180) * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  };
});
