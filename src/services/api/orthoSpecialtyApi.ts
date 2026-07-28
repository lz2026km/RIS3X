// Ortho Specialty API — 骨科影像分析 · 关节 · 脊柱 · 骨密度
import { api } from './client';

const ORTHO_API = '/ortho';

export type JointType = 'shoulder' | 'elbow' | 'wrist' | 'hip' | 'knee' | 'ankle' | 'cervical' | 'lumbar';
export type KellgrenLawrenceGrade = '0' | 'I' | 'II' | 'III' | 'IV';
export type OsteoarthritisGrade = 0 | 1 | 2 | 3 | 4;

export interface JointMeasurement {
  jointSpaceWidthMm: number;
  normalRange: [number, number];
  alignmentAngleDeg: number;
  jointEffusion: boolean;
  osteophytes: boolean;
}

export interface FractureAnalysis {
  id: string;
  joint: JointType;
  bone: string;
  fractureType: string;
  displacement: boolean;
  intraArticular: boolean;
}

export interface SpineAnalysis {
  id: string;
  level: string;
  discPathology: string;
  canalStenosis: 'none' | 'mild' | 'moderate' | 'severe';
  alignment: 'normal' | 'spondylolisthesis' | 'retrolisthesis' | 'scoliosis';
}

export interface BmdResult {
  id: string;
  site: string;
  tScore: number;
  zScore: number;
  category: 'normal' | 'osteopenia' | 'osteoporosis' | 'severe-osteoporosis';
}

export interface OrthoStudy {
  id: string;
  patientId: string;
  patientName: string;
  modality: 'XR' | 'CT' | 'MRI' | 'US' | 'DEXA';
  joint: JointType;
  studyDate: string;
  klGrade?: KellgrenLawrenceGrade;
  fractures?: FractureAnalysis[];
  spineAnalysis?: SpineAnalysis[];
  bmdResult?: BmdResult;
  status: 'scheduled' | 'acquired' | 'analyzing' | 'reviewed' | 'reported';
}

function buildQuery(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return '';
  const filtered = Object.entries(params).filter(([_, v]) => v !== undefined && v !== '');
  if (filtered.length === 0) return '';
  return '?' + new URLSearchParams(filtered as [string, string][]).toString();
}

export const orthoSpecialtyApi = {
  getJointStudies: (params?: Record<string, any>) => api.get<OrthoStudy[]>(`${ORTHO_API}/joints${buildQuery(params)}`),
  analyzeJoint: (studyId: string) => api.post<{ measurements: JointMeasurement; grade: OsteoarthritisGrade }>(`${ORTHO_API}/joints/${studyId}/analyze`, {}),
  getFractures: (params?: Record<string, any>) => api.get<FractureAnalysis[]>(`${ORTHO_API}/fractures${buildQuery(params)}`),
  detectFracture: (studyId: string) => api.post<{ fractures: FractureAnalysis[] }>(`${ORTHO_API}/fractures/${studyId}/detect`, {}),
  getSpineStudies: (params?: Record<string, any>) => api.get<OrthoStudy[]>(`${ORTHO_API}/spine${buildQuery(params)}`),
  analyzeSpine: (studyId: string) => api.post<{ levels: SpineAnalysis[] }>(`${ORTHO_API}/spine/${studyId}/analyze`, {}),
  measureCobbAngle: (studyId: string) => api.get<{ angleDeg: number }>(`${ORTHO_API}/spine/${studyId}/cobb`),
  getBmdStudies: (params?: Record<string, any>) => api.get<BmdResult[]>(`${ORTHO_API}/bmd${buildQuery(params)}`),
  analyzeBmd: (studyId: string) => api.post<BmdResult>(`${ORTHO_API}/bmd/${studyId}/analyze`, {}),
  computeFrax: (data: Record<string, any>) => api.post<{ hipFrax: number; spineFrax: number }>(`${ORTHO_API}/bmd/frax`, data),
  getOrthoStats: (params?: Record<string, any>) => api.get<any>(`${ORTHO_API}/stats${buildQuery(params)}`),
};

export default orthoSpecialtyApi;
