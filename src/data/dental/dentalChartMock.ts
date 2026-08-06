// [v3.0.6.8-53] 口腔: 牙位图 (FDI 编号) mock 数据
export interface ToothState {
  toothNo: number; // FDI 11-48 / 51-85
  status: 'Healthy' | 'Caries' | 'Missing' | 'Restored' | 'Implant' | 'RootCanal' | 'Crown' | 'Bridge' | 'Partial';
  surfaces: {
    O: 'Healthy' | 'Caries-Mild' | 'Caries-Moderate' | 'Caries-Severe' | 'Restored' | 'Filling' | 'Sealant';
    M: string; // same as above
    D: string;
    B: string;
    L: string;
  };
  cariesGrade?: 'ICDAS-0' | 'ICDAS-1' | 'ICDAS-2' | 'ICDAS-3' | 'ICDAS-4' | 'ICDAS-5' | 'ICDAS-6';
  periodontal?: { pd: number; cal: number; bop: boolean; mob: number; furcation: number };
  notes: string;
}

export interface DentalChart {
  patientId: string;
  patientName: string;
  age: number;
  teeth: Record<number, ToothState>;
  numberingSystem: 'FDI' | 'Universal' | 'Palmer';
  createdAt: string;
  updatedAt: string;
}

// 生成牙位图
const FIRST_NAMES = ['张', '王', '李', '刘', '陈', '杨', '黄', '赵', '吴', '周'];
const GIVEN_NAMES = ['伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '军', '洋'];

const FDI_TEETH = [
  11,12,13,14,15,16,17,18,  21,22,23,24,25,26,27,28,  31,32,33,34,35,36,37,38,  41,42,43,44,45,46,47,48,
];
const SURFACES = ['O', 'M', 'D', 'B', 'L'];
const CARIES_GRADES = ['ICDAS-0', 'ICDAS-1', 'ICDAS-2', 'ICDAS-3', 'ICDAS-4', 'ICDAS-5', 'ICDAS-6'];

function generateTooth(toothNo: number): ToothState {
  const r = Math.random();
  const status: ToothState['status'] = r < 0.3 ? 'Healthy' : r < 0.45 ? 'Caries' : r < 0.65 ? 'Restored' : r < 0.75 ? 'Missing' : r < 0.85 ? 'Crown' : r < 0.93 ? 'RootCanal' : 'Implant';
  const surfaces: any = {};
  const healthy = Math.random() > 0.5;
  for (const s of SURFACES) {
    surfaces[s] = healthy ? 'Healthy' : 'Caries-Moderate';
  }
  return {
    toothNo,
    status,
    surfaces,
    cariesGrade: status === 'Caries' ? CARIES_GRADES[Math.floor(Math.random() * 5) + 1] as any : undefined,
    periodontal: Math.random() > 0.7 ? { pd: Math.floor(Math.random() * 6) + 2, cal: Math.floor(Math.random() * 4), bop: Math.random() > 0.5, mob: Math.floor(Math.random() * 3), furcation: Math.floor(Math.random() * 4) } : undefined,
    notes: '',
  };
}

export const MOCK_DENTAL_CHARTS: DentalChart[] = Array.from({ length: 200 }, (_, i) => {
  const teeth: Record<number, ToothState> = {};Math.floor(Math.random() * 8) + 2;
  for (const t of FDI_TEETH) {
    if (Math.random() < 0.1) continue; // missing tooth
    teeth[t] = generateTooth(t);
  }
  return {
    patientId: `P${String(100000 + i)}`,
    patientName: FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)] + GIVEN_NAMES[Math.floor(Math.random() * GIVEN_NAMES.length)],
    age: Math.floor(Math.random() * 60) + 10,
    teeth,
    numberingSystem: 'FDI',
    createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 3600 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
  };
});

export function getDentalChart(patientId: string): DentalChart | undefined {
  return MOCK_DENTAL_CHARTS.find(c => c.patientId === patientId);
}
