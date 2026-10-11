// [v3.0.6.8-53] 口腔: 牙位图 (FDI 编号) mock 数据
// [G005 dental-demo-fill] 60 张牙位图 = 20 名患者 × 3 次快照 (初诊/术中/复查),
//   patientId 全部指向 dentalEmrMock 患者池; 确定性 mulberry32, 无模块级 Math.random()。
import { mulberry32, hashSeed } from '../../utils/seededRandom';
import { MOCK_DENTAL_PATIENTS } from './dentalEmrMock';

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
  id: string; // chartId, 跨表关联键 (study.treatment/ chart.treatment 记录)
  patientId: string;
  patientName: string;
  age: number;
  teeth: Record<number, ToothState>;
  numberingSystem: 'FDI' | 'Universal' | 'Palmer';
  snapshotDate: string; // 快照日期 (初诊/术中/复查)
  snapshotType: 'initial' | 'mid-treatment' | 'review';
  isPrimary: boolean; // 当前主牙位图 (getDentalChart 默认返回)
  createdAt: string;
  updatedAt: string;
}

const FDI_TEETH = [
  11,12,13,14,15,16,17,18,  21,22,23,24,25,26,27,28,  31,32,33,34,35,36,37,38,  41,42,43,44,45,46,47,48,
];
const SURFACES = ['O', 'M', 'D', 'B', 'L'];
const CARIES_GRADES = ['ICDAS-0', 'ICDAS-1', 'ICDAS-2', 'ICDAS-3', 'ICDAS-4', 'ICDAS-5', 'ICDAS-6'];

// 3 次快照 (每患者): 初诊建档 / 治疗中 / 最新复查 → 最后一张为主图
const SNAPSHOTS = [
  { snapshotDate: '2025-11-14', snapshotType: 'initial' as const },
  { snapshotDate: '2026-04-17', snapshotType: 'mid-treatment' as const },
  { snapshotDate: '2026-09-18', snapshotType: 'review' as const },
];

export const CHARTS_PER_PATIENT = SNAPSHOTS.length; // 3 → 20 × 3 = 60 charts

export function dentalChartIdFor(patientIdx: number, snapIdx: number): string {
  return 'DCH-' + String(patientIdx * CHARTS_PER_PATIENT + snapIdx + 1).padStart(6, '0');
}

export const PRIMARY_CHART_BY_PATIENT: Record<string, string> = Object.fromEntries(
  MOCK_DENTAL_PATIENTS.map((p, idx) => [p.id, dentalChartIdFor(idx, CHARTS_PER_PATIENT - 1)]),
);

export function getPrimaryChartId(patientId: string): string | undefined {
  return PRIMARY_CHART_BY_PATIENT[patientId];
}

function generateTooth(toothNo: number, r: () => number): ToothState {
  const v = r();
  const status: ToothState['status'] = v < 0.3 ? 'Healthy' : v < 0.45 ? 'Caries' : v < 0.65 ? 'Restored' : v < 0.75 ? 'Missing' : v < 0.85 ? 'Crown' : v < 0.93 ? 'RootCanal' : 'Implant';
  const surfaces: any = {};
  const healthy = r() > 0.5;
  for (const s of SURFACES) {
    surfaces[s] = healthy ? 'Healthy' : 'Caries-Moderate';
  }
  return {
    toothNo,
    status,
    surfaces,
    cariesGrade: status === 'Caries' ? CARIES_GRADES[Math.floor(r() * 5) + 1] as any : undefined,
    periodontal: r() > 0.7 ? { pd: Math.floor(r() * 6) + 2, cal: Math.floor(r() * 4), bop: r() > 0.5, mob: Math.floor(r() * 3), furcation: Math.floor(r() * 4) } : undefined,
    notes: '',
  };
}

export const MOCK_DENTAL_CHARTS: DentalChart[] = (() => {
  const out: DentalChart[] = [];
  MOCK_DENTAL_PATIENTS.forEach((patient, patientIdx) => {
    SNAPSHOTS.forEach((snap, snapIdx) => {
      const r = mulberry32(hashSeed(`dental-chart-${patient.id}-${snapIdx}`));
      const teeth: Record<number, ToothState> = {};
      // 后期快照缺牙只增不减 (治疗前→治疗后的一致性)
      const missingProb = 0.06 + snapIdx * 0.02;
      for (const t of FDI_TEETH) {
        if (r() < missingProb) continue; // missing tooth
        teeth[t] = generateTooth(t, r);
      }
      const isPrimary = snapIdx === SNAPSHOTS.length - 1;
      out.push({
        id: dentalChartIdFor(patientIdx, snapIdx),
        patientId: patient.id,
        patientName: patient.name,
        age: patient.age,
        teeth,
        numberingSystem: 'FDI',
        snapshotDate: snap.snapshotDate,
        snapshotType: snap.snapshotType,
        isPrimary,
        createdAt: `${snap.snapshotDate}T09:30:00.000Z`,
        updatedAt: `${snap.snapshotDate}T10:15:00.000Z`,
      });
    });
  });
  return out;
})();

// 每患者最新 (主) 牙位图; 兼容旧占位 id 'P100000' → 首位患者
const PRIMARY_CHARTS: Record<string, DentalChart> = Object.fromEntries(
  MOCK_DENTAL_CHARTS.filter(c => c.isPrimary).map(c => [c.patientId, c]),
);

export function getDentalChart(patientId: string): DentalChart | undefined {
  if (patientId === 'P100000') {
    const first = MOCK_DENTAL_PATIENTS[0];
    return first ? PRIMARY_CHARTS[first.id] : undefined;
  }
  return PRIMARY_CHARTS[patientId];
}

export function getDentalChartById(id: string): DentalChart | undefined {
  return MOCK_DENTAL_CHARTS.find(c => c.id === id);
}

export function getDentalChartsByPatient(patientId: string): DentalChart[] {
  return MOCK_DENTAL_CHARTS.filter(c => c.patientId === patientId);
}
