// Cardiac Specialty API — 心脏分析 · 冠脉评估 · 心功能
// [v3.0.6.11-81] W1-B P1: 后端无 /cardiac/* 端点 (仅 MSW mock), 页面为演示页。
// 全部方法标注 MOCK_ONLY: 返回本地演示数据, 不发网络请求 (避免 404)。
import type { ApiResponse } from './types';

export type CoronarySegmentName = 'LM' | 'LAD-p' | 'LAD-m' | 'LAD-d' | 'LCX-p' | 'LCX-m' | 'LCX-d' | 'RCA-p' | 'RCA-m' | 'RCA-d';
export type StenosisSeverity = 'normal' | 'mild' | 'moderate' | 'severe' | 'occluded';
export type CadRadsScore = 0 | 1 | 2 | 3 | '4A' | '4B' | 5 | 'N';
export type ValveType = 'aortic' | 'mitral' | 'tricuspid' | 'pulmonic';
export type ValveSeverity = 'normal' | 'mild' | 'moderate' | 'severe';

export interface CoronarySegment {
  segment: CoronarySegmentName;
  stenosisPercent: number;
  stenosisSeverity: StenosisSeverity;
  plaqueType: string;
  lengthMm: number;
}

export interface CalciumScore {
  totalAgatston: number;
  lm: number;
  lad: number;
  lcx: number;
  rca: number;
  percentile: number;
}

export interface VentricularFunction {
  chamber: string;
  edvMl: number;
  esvMl: number;
  efPercent: number;
  strokeVolumeMl: number;
}

export interface ValveAssessment {
  valve: ValveType;
  severity: ValveSeverity;
  gradientPeak?: number;
  valveArea?: number;
}

export interface CardiacAnalysis {
  id: string;
  patientId: string;
  patientName: string;
  modality: 'CCTA' | 'CMR' | 'Echo' | 'Cath';
  studyDate: string;
  coronarySegments: CoronarySegment[];
  calciumScore?: CalciumScore;
  lvFunction?: VentricularFunction;
  valves: ValveAssessment[];
  cadRads: CadRadsScore;
  status: 'scheduled' | 'acquired' | 'analyzing' | 'reviewed' | 'reported';
}

function mockOk<T>(data: T): Promise<ApiResponse<T>> {
  return Promise.resolve({ success: true, data });
}

// 本地演示数据集 (保证演示页有可渲染数据)
const DEMO_ANALYSES: CardiacAnalysis[] = [
  {
    id: 'CV-001',
    patientId: 'P300001',
    patientName: '刘建国',
    modality: 'CCTA',
    studyDate: '2026-07-10',
    coronarySegments: [
      { segment: 'LM', stenosisPercent: 0, stenosisSeverity: 'normal', plaqueType: 'none', lengthMm: 10 },
      { segment: 'LAD-p', stenosisPercent: 75, stenosisSeverity: 'severe', plaqueType: 'calcified', lengthMm: 22 },
      { segment: 'LAD-m', stenosisPercent: 40, stenosisSeverity: 'moderate', plaqueType: 'mixed', lengthMm: 18 },
      { segment: 'LCX-p', stenosisPercent: 20, stenosisSeverity: 'mild', plaqueType: 'non-calcified', lengthMm: 15 },
      { segment: 'RCA-p', stenosisPercent: 0, stenosisSeverity: 'normal', plaqueType: 'none', lengthMm: 20 },
    ],
    calciumScore: { totalAgatston: 342, lm: 20, lad: 210, lcx: 62, rca: 50, percentile: 82 },
    lvFunction: { chamber: 'LV', edvMl: 128, esvMl: 42, efPercent: 67, strokeVolumeMl: 86 },
    valves: [{ valve: 'aortic', severity: 'mild' }],
    cadRads: '4A',
    status: 'reviewed',
  },
  {
    id: 'CV-002',
    patientId: 'P300002',
    patientName: '陈桂英',
    modality: 'CMR',
    studyDate: '2026-07-08',
    coronarySegments: [
      { segment: 'LAD-p', stenosisPercent: 30, stenosisSeverity: 'mild', plaqueType: 'mixed', lengthMm: 20 },
      { segment: 'RCA-d', stenosisPercent: 55, stenosisSeverity: 'moderate', plaqueType: 'calcified', lengthMm: 14 },
    ],
    lvFunction: { chamber: 'LV', edvMl: 145, esvMl: 72, efPercent: 50, strokeVolumeMl: 73 },
    valves: [{ valve: 'mitral', severity: 'moderate' }],
    cadRads: 2,
    status: 'reported',
  },
  {
    id: 'CV-003',
    patientId: 'P300003',
    patientName: '王德福',
    modality: 'CCTA',
    studyDate: '2026-07-05',
    coronarySegments: [
      { segment: 'LAD-m', stenosisPercent: 85, stenosisSeverity: 'severe', plaqueType: 'calcified', lengthMm: 16 },
      { segment: 'RCA-m', stenosisPercent: 65, stenosisSeverity: 'moderate', plaqueType: 'mixed', lengthMm: 12 },
    ],
    calciumScore: { totalAgatston: 512, lm: 30, lad: 310, lcx: 88, rca: 84, percentile: 94 },
    lvFunction: { chamber: 'LV', edvMl: 132, esvMl: 60, efPercent: 55, strokeVolumeMl: 72 },
    valves: [{ valve: 'aortic', severity: 'severe', gradientPeak: 42 }],
    cadRads: '4B',
    status: 'analyzing',
  },
];

export const cardiacSpecialtyApi = {
  // MOCK_ONLY: 本地演示数据
  getCoronaryAnalysis: (studyId: string) =>
    mockOk<CoronarySegment[]>(DEMO_ANALYSES.find(a => a.id === studyId)?.coronarySegments ?? []),
  analyzeCoronary: (studyId: string) =>
    mockOk<{ segments: CoronarySegment[]; cadRads: CadRadsScore }>({ segments: DEMO_ANALYSES.find(a => a.id === studyId)?.coronarySegments ?? [], cadRads: 2 }),
  getCalciumScore: (studyId: string) =>
    mockOk<CalciumScore>(DEMO_ANALYSES.find(a => a.id === studyId)?.calciumScore ?? { totalAgatston: 0, lm: 0, lad: 0, lcx: 0, rca: 0, percentile: 0 }),
  getVentricularFunction: (studyId: string) =>
    mockOk<VentricularFunction[]>(DEMO_ANALYSES.find(a => a.id === studyId)?.lvFunction ? [DEMO_ANALYSES.find(a => a.id === studyId)!.lvFunction!] : []),
  computeEjectionFraction: (studyId: string) =>
    mockOk<{ lvEf: number; rvEf: number }>({ lvEf: DEMO_ANALYSES.find(a => a.id === studyId)?.lvFunction?.efPercent ?? 55, rvEf: 58 }),
  getValveAssessment: (studyId: string) =>
    mockOk<ValveAssessment[]>(DEMO_ANALYSES.find(a => a.id === studyId)?.valves ?? []),
  getAnalyses: (_params?: Record<string, any>) =>
    mockOk<CardiacAnalysis[]>(DEMO_ANALYSES),
  getAnalysis: (id: string) =>
    mockOk<CardiacAnalysis>(DEMO_ANALYSES.find(a => a.id === id) ?? DEMO_ANALYSES[0]!),
  createAnalysis: (data: Partial<CardiacAnalysis>) =>
    mockOk<CardiacAnalysis>({
      id: `CV-${Date.now().toString().slice(-6)}`,
      patientId: data.patientId ?? '',
      patientName: data.patientName ?? '',
      modality: data.modality ?? 'CCTA',
      studyDate: data.studyDate ?? new Date().toISOString().split('T')[0] ?? '',
      coronarySegments: data.coronarySegments ?? [],
      valves: data.valves ?? [],
      cadRads: data.cadRads ?? 'N',
      status: data.status ?? 'scheduled',
    }),
  getCardiacStats: (_params?: Record<string, any>) =>
    mockOk<any>({ totalAnalyses: DEMO_ANALYSES.length, severeStenosis: 2, avgEf: 57 }),
};

export default cardiacSpecialtyApi;
