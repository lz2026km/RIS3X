// [W3-2] 跨科室治疗计划 API (TreatmentPlanCenterPage)
// 后端暂无专用控制器, MSW 提供 /treatment-plans/* 内存实现。
import { api } from './client';

export type PlanStatus = 'planned' | 'in_progress' | 'completed' | 'pending';

export interface TreatmentPlan {
  id: string;
  patientId: string;
  patient: string;
  type: string;
  status: PlanStatus;
  progress: number;
  department: string;
  startDate: string;
  desc: string;
  outcome?: string;
  timeline?: Array<{ step: string; date: string; status: PlanStatus | 'completed' | 'in_progress' | 'pending' }>;
  createdAt: string;
  updatedAt: string;
}

export const treatmentPlanApi = {
  list: () => api.get<TreatmentPlan[]>('/treatment-plans'),

  create: (data: Omit<TreatmentPlan, 'id' | 'createdAt' | 'updatedAt' | 'progress'>) =>
    api.post<TreatmentPlan>('/treatment-plans', data),

  update: (id: string, data: Partial<TreatmentPlan>) =>
    api.patch<TreatmentPlan>(`/treatment-plans/${id}`, data),

  remove: (id: string) =>
    api.delete<void>(`/treatment-plans/${id}`),

  transition: (id: string, status: PlanStatus) =>
    api.post<TreatmentPlan>(`/treatment-plans/${id}/transition`, { status }),

  getTimeline: (id: string) =>
    api.get<TreatmentPlan['timeline']>(`/treatment-plans/${id}/timeline`),
};

export default treatmentPlanApi;
