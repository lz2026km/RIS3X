// Ortho Specialty API — 骨科影像分析 · 关节 · 脊柱 · 骨密度
// [v3.0.6.11-81] W1-B P1: 后端无 /ortho/* 端点 (仅 MSW mock), 页面为演示页 (0 调用方)。
// 全部方法标注 MOCK_ONLY: 返回本地演示数据, 不发网络请求 (避免 404)。
import type { ApiResponse } from './types';

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

function mockOk<T>(data: T): Promise<ApiResponse<T>> {
  return Promise.resolve({ success: true, data });
}

export const orthoSpecialtyApi = {
  // MOCK_ONLY: 本地演示数据
  getJointStudies: (_params?: Record<string, any>) =>
    mockOk<OrthoStudy[]>([
      { id: 'OX001', patientId: 'P200001', patientName: '张伟', modality: 'XR', joint: 'knee', studyDate: '2026-07-15', klGrade: 'III', status: 'reviewed' },
      { id: 'OX002', patientId: 'P200002', patientName: '李芳', modality: 'XR', joint: 'hip', studyDate: '2026-07-14', klGrade: 'II', status: 'reported' },
    ]),
  analyzeJoint: (_studyId: string) =>
    mockOk<{ measurements: JointMeasurement; grade: OsteoarthritisGrade }>({ measurements: { jointSpaceWidthMm: 4.2, normalRange: [4, 7], alignmentAngleDeg: 178, jointEffusion: false, osteophytes: true }, grade: 2 }),
  getFractures: (_params?: Record<string, any>) =>
    mockOk<FractureAnalysis[]>([]),
  detectFracture: (_studyId: string) =>
    mockOk<{ fractures: FractureAnalysis[] }>({ fractures: [] }),
  getSpineStudies: (_params?: Record<string, any>) =>
    mockOk<OrthoStudy[]>([]),
  analyzeSpine: (_studyId: string) =>
    mockOk<{ levels: SpineAnalysis[] }>({ levels: [] }),
  measureCobbAngle: (_studyId: string) =>
    mockOk<{ angleDeg: number }>({ angleDeg: 12 }),
  getBmdStudies: (_params?: Record<string, any>) =>
    mockOk<BmdResult[]>([]),
  analyzeBmd: (_studyId: string) =>
    mockOk<BmdResult>({ id: _studyId, site: '腰椎 L1-L4', tScore: -1.2, zScore: -0.8, category: 'osteopenia' }),
  computeFrax: (_data: Record<string, any>) =>
    mockOk<{ hipFrax: number; spineFrax: number }>({ hipFrax: 4.5, spineFrax: 6.2 }),
  getOrthoStats: (_params?: Record<string, any>) =>
    mockOk<any>({ totalStudies: 22, fractureCount: 2, severeOA: 3 }),
};

export default orthoSpecialtyApi;
