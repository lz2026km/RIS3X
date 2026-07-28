// Breast Specialty API — BI-RADS 评分 · 乳腺工作流 · 筛查管理
import { api } from './client';

const BREAST_API = '/breast';

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

function buildQuery(params?: Record<string, string | number | boolean | undefined>): string {
  if (!params) return '';
  const filtered = Object.entries(params).filter(([_, v]) => v !== undefined && v !== '');
  if (filtered.length === 0) return '';
  return '?' + new URLSearchParams(filtered as [string, string][]).toString();
}

export const breastSpecialtyApi = {
  calculateBiRads: (lesions: Partial<BreastLesion>[]) =>
    api.post<{ biRads: BiRadsCategory; confidence: number }>(`${BREAST_API}/birads/calculate`, { lesions }),
  getBiRadsDistribution: (params?: Record<string, any>) =>
    api.get<Record<string, number>>(`${BREAST_API}/birads/distribution${buildQuery(params)}`),
  getLesions: (params?: Record<string, any>) =>
    api.get<BreastLesion[]>(`${BREAST_API}/lesions${buildQuery(params)}`),
  analyzeLesion: (data: { imageUrl: string; modality: string }) =>
    api.post<BreastLesion>(`${BREAST_API}/lesions/analyze`, data),
  assessDensity: (data: { imageUrl: string }) =>
    api.post<{ density: BreastDensity; confidence: number }>(`${BREAST_API}/density/assess`, data),
  getScreeningList: (params?: Record<string, any>) =>
    api.get<ScreeningRecord[]>(`${BREAST_API}/screening/list${buildQuery(params)}`),
  createScreening: (data: Partial<ScreeningRecord>) =>
    api.post<ScreeningRecord>(`${BREAST_API}/screening`, data),
  recallPatient: (id: string, reason: string) =>
    api.post<any>(`${BREAST_API}/screening/${id}/recall`, { reason }),
  assessRisk: (patientId: string) =>
    api.post<any>(`${BREAST_API}/risk/assess`, { patientId }),
  getExams: (params?: Record<string, any>) =>
    api.get<BreastExam[]>(`${BREAST_API}/exams${buildQuery(params)}`),
  createExam: (data: Partial<BreastExam>) =>
    api.post<BreastExam>(`${BREAST_API}/exams`, data),
  getWorkflowStatus: () =>
    api.get<{ queue: any[]; stats: any }>(`${BREAST_API}/workflow/status`),
  advanceWorkflow: (examId: string, action: string) =>
    api.post<any>(`${BREAST_API}/workflow/${examId}/advance`, { action }),
  getDepartmentStats: (params?: Record<string, any>) =>
    api.get<any>(`${BREAST_API}/stats/department${buildQuery(params)}`),
};

export default breastSpecialtyApi;
