// Cardiac Specialty API — 心脏分析 · 冠脉评估 · 心功能
import { api } from './client';

const CARDIAC_SPEC_API = '/cardiac';

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

function buildQuery(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return '';
  const filtered = Object.entries(params).filter(([_, v]) => v !== undefined && v !== '');
  if (filtered.length === 0) return '';
  return '?' + new URLSearchParams(filtered as [string, string][]).toString();
}

export const cardiacSpecialtyApi = {
  getCoronaryAnalysis: (studyId: string) => api.get<CoronarySegment[]>(`${CARDIAC_SPEC_API}/coronary/${studyId}`),
  analyzeCoronary: (studyId: string) => api.post<{ segments: CoronarySegment[]; cadRads: CadRadsScore }>(`${CARDIAC_SPEC_API}/coronary/${studyId}/analyze`, {}),
  getCalciumScore: (studyId: string) => api.get<CalciumScore>(`${CARDIAC_SPEC_API}/coronary/${studyId}/calcium-score`),
  getVentricularFunction: (studyId: string) => api.get<VentricularFunction[]>(`${CARDIAC_SPEC_API}/function/${studyId}`),
  computeEjectionFraction: (studyId: string) => api.post<{ lvEf: number; rvEf: number }>(`${CARDIAC_SPEC_API}/function/${studyId}/ef`, {}),
  getValveAssessment: (studyId: string) => api.get<ValveAssessment[]>(`${CARDIAC_SPEC_API}/valves/${studyId}`),
  getAnalyses: (params?: Record<string, any>) => api.get<CardiacAnalysis[]>(`${CARDIAC_SPEC_API}/analyses${buildQuery(params)}`),
  getAnalysis: (id: string) => api.get<CardiacAnalysis>(`${CARDIAC_SPEC_API}/analyses/${id}`),
  createAnalysis: (data: Partial<CardiacAnalysis>) => api.post<CardiacAnalysis>(`${CARDIAC_SPEC_API}/analyses`, data),
  getCardiacStats: (params?: Record<string, any>) => api.get<any>(`${CARDIAC_SPEC_API}/stats${buildQuery(params)}`),
};

export default cardiacSpecialtyApi;
