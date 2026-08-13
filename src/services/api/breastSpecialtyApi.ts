// Breast Specialty API — BI-RADS 评分 · 乳腺工作流 · 筛查管理
// [v3.0.6.11-81] W1-B P1: 后端无 /breast/* 端点 (仅 MSW mock), 页面为演示页。
// [v3.0.6.11-83] W1-B: BreastSpecialtyPage 已优先接真实 breastCadApi (/ai-diagnosis/breast-cad),
// 本文件全部方法 MOCK_ONLY 保留为演示回退 (页面加载失败时兜底), 保持 import 兼容。
// 全部方法标注 MOCK_ONLY: 返回本地演示数据, 不发网络请求 (避免 404)。
// [G005 v3.0.6.11-91 W1-B P1 第12轮] 死封装清理:
//   · createScreening: 页面已改走 screeningApi.create (POST /screening/queue 真实队列, BreastSpecialtyPage L202),
//     本方法仅作筛查登记演示回退 → 标注 DEPRECATED (不删, 保持 import 兼容)。
//   · 其余 13 方法 0 引用 (无页面调用) → 标注 DEPRECATED 保留清理标记。
import type { ApiResponse } from './types';

export type BiRadsCategory = 0 | 1 | 2 | 3 | '4A' | '4B' | 4 | 5 | 6;
export type BreastDensity = 'a' | 'b' | 'c' | 'd';
export type ScreeningOutcome = 'normal' | 'benign' | 'probably-benign' | 'suspicious' | 'highly-suspicious' | 'known-malignancy';

export interface BreastLesion {
  id: string;
  quadrant: string;
  shape: string;
  margin: string;
  widthMm: number;
  biRadsCategory: BiRadsCategory;
  recommendation: string;
}

export interface BreastExam {
  id: string;
  patientId: string;
  patientName: string;
  examDate: string;
  modality: 'MG' | 'US' | 'MRI' | 'TOMO';
  laterality: 'L' | 'R' | 'B';
  breastDensity: BreastDensity;
  biRadsCategory: BiRadsCategory;
  lesions: BreastLesion[];
  status: 'scheduled' | 'acquired' | 'reviewing' | 'reported' | 'audited';
}

export interface ScreeningRecord {
  id: string;
  patientId: string;
  patientName: string;
  age: number;
  riskLevel: 'average' | 'intermediate' | 'high';
  biRadsLatest: BiRadsCategory;
  outcome: ScreeningOutcome;
  date: string;
}

function mockOk<T>(data: T): Promise<ApiResponse<T>> {
  return Promise.resolve({ success: true, data });
}

export const breastSpecialtyApi = {
  // ===== DEPRECATED (第12轮): 全部方法 0 引用, 仅 createScreening 作页面演示回退 =====
  // MOCK_ONLY: 本地演示数据, 不发网络请求 (避免 404)
  calculateBiRads: (_lesions: Partial<BreastLesion>[]) =>
    mockOk<{ biRads: BiRadsCategory; confidence: number }>({ biRads: 3, confidence: 0.82 }),
  getBiRadsDistribution: (_params?: Record<string, any>) =>
    mockOk<Record<string, number>>({ '1': 42, '2': 31, '3': 15, '4A': 7, '4B': 3, '5': 2 }),
  getLesions: (_params?: Record<string, any>) =>
    mockOk<BreastLesion[]>([]),
  analyzeLesion: (_data: { imageUrl: string; modality: string }) =>
    mockOk<BreastLesion>({ id: `lesion-${Date.now()}`, quadrant: '右上外', shape: '不规则', margin: '毛刺', widthMm: 12, biRadsCategory: '4A', recommendation: '建议穿刺活检' }),
  assessDensity: (_data: { imageUrl: string }) =>
    mockOk<{ density: BreastDensity; confidence: number }>({ density: 'c', confidence: 0.85 }),
  getScreeningList: (_params?: Record<string, any>) =>
    mockOk<ScreeningRecord[]>([
      { id: 'S001', patientId: 'P100001', patientName: '张秀兰', age: 52, riskLevel: 'average', biRadsLatest: 1, outcome: 'normal', date: '2026-07-15' },
      { id: 'S002', patientId: 'P100002', patientName: '李芳', age: 45, riskLevel: 'intermediate', biRadsLatest: '4A', outcome: 'suspicious', date: '2026-07-14' },
      { id: 'S003', patientId: 'P100003', patientName: '王丽华', age: 61, riskLevel: 'high', biRadsLatest: 5, outcome: 'highly-suspicious', date: '2026-07-13' },
    ]),
  // DEPRECATED: 页面登记已走 screeningApi.create (真实), 仅演示回退
  createScreening: (data: Partial<ScreeningRecord>) =>
    mockOk<ScreeningRecord>({
      id: `S-${Date.now().toString().slice(-6)}`,
      patientId: data.patientId ?? '',
      patientName: data.patientName ?? '',
      age: data.age ?? 0,
      riskLevel: data.riskLevel ?? 'average',
      biRadsLatest: data.biRadsLatest ?? 1,
      outcome: data.outcome ?? 'normal',
      date: data.date ?? new Date().toISOString().split('T')[0] ?? '',
    }),
  recallPatient: (_id: string, reason: string) =>
    mockOk<{ id: string; recalled: boolean; reason: string }>({ id: _id, recalled: true, reason }),
  assessRisk: (patientId: string) =>
    mockOk<{ patientId: string; riskLevel: 'average' | 'intermediate' | 'high' }>({ patientId, riskLevel: 'intermediate' }),
  getExams: (_params?: Record<string, any>) =>
    mockOk<BreastExam[]>([]),
  createExam: (data: Partial<BreastExam>) =>
    mockOk<BreastExam>({
      id: `E-${Date.now().toString().slice(-6)}`,
      patientId: data.patientId ?? '',
      patientName: data.patientName ?? '',
      examDate: data.examDate ?? new Date().toISOString().split('T')[0] ?? '',
      modality: data.modality ?? 'MG',
      laterality: data.laterality ?? 'L',
      breastDensity: data.breastDensity ?? 'b',
      biRadsCategory: data.biRadsCategory ?? 1,
      lesions: data.lesions ?? [],
      status: data.status ?? 'scheduled',
    }),
  getWorkflowStatus: () =>
    mockOk<{ queue: any[]; stats: any }>({ queue: [], stats: { total: 0, pending: 0 } }),
  advanceWorkflow: (examId: string, action: string) =>
    mockOk<{ examId: string; action: string; ok: boolean }>({ examId, action, ok: true }),
  getDepartmentStats: (_params?: Record<string, any>) =>
    mockOk<any>({ monthlyExams: [120, 98, 135, 110, 142, 128], recallRate: 8.2 }),
};

export default breastSpecialtyApi;
