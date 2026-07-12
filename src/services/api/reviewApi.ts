// [v3.0.6.8-48] PR4: 初核 + 终核 + 复审 API client
import { api } from './client';

// ============= 初核 =============
export interface InitialCheckItemDto {
  id: string;
  reportId: string;
  patientName: string;
  modality: string;
  bodyPart: string;
  reviewer?: string;
  reviewerId?: string;
  status: 'pending' | 'approved' | 'rejected' | 'overridden';
  checkItems: Array<{ name: string; passed: boolean; note?: string }>;
  note?: string;
  createdAt: string;
  reviewedAt?: string;
}

export interface InitialCheckListParams {
  status?: string;
  reviewerId?: string;
  dateFrom?: string;
  dateTo?: string;
  pageSize?: number;
}

export const initialCheckApi = {
  list: (params?: InitialCheckListParams) =>
    api.get<InitialCheckItemDto[]>(`/review/initial-check?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  getById: (id: string) =>
    api.get<InitialCheckItemDto>(`/review/initial-check/${id}`),

  submit: (data: { reportId: string; checkItems: Array<{ name: string; passed: boolean; note?: string }>; note?: string }) =>
    api.post<InitialCheckItemDto>('/review/initial-check', data),

  approve: (id: string, data: { note?: string }) =>
    api.post<InitialCheckItemDto>(`/review/initial-check/${id}/approve`, data),

  reject: (id: string, data: { reason: string; items?: string[] }) =>
    api.post<InitialCheckItemDto>(`/review/initial-check/${id}/reject`, data),

  override: (id: string, data: { reason: string }) =>
    api.post<InitialCheckItemDto>(`/review/initial-check/${id}/override`, data),

  summary: () =>
    api.get<{ total: number; pending: number; approved: number; rejected: number; overridden: number }>('/review/initial-check/summary'),
};

// ============= 终核 =============
export interface FinalCheckItemDto {
  id: string;
  reportId: string;
  templateId?: string;
  templateName?: string;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'multi-sig-pending';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  reviewerId?: string;
  score?: number;
  notes?: Array<{ id: string; text: string; author: string; createdAt: string }>;
  createdAt: string;
  approvedAt?: string;
}

export const finalCheckApi = {
  list: (params?: { status?: string; priority?: string; pageSize?: number }) =>
    api.get<FinalCheckItemDto[]>(`/review/final-check?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  getById: (id: string) =>
    api.get<FinalCheckItemDto>(`/review/final-check/${id}`),

  submit: (data: { reportId: string; templateId?: string; priority?: string }) =>
    api.post<FinalCheckItemDto>('/review/final-check', data),

  score: (id: string, data: { score: number; notes?: string }) =>
    api.post<FinalCheckItemDto>(`/review/final-check/${id}/score`, data),

  approve: (id: string, data: { finalNote?: string }) =>
    api.post<FinalCheckItemDto>(`/review/final-check/${id}/approve`, data),

  reject: (id: string, data: { reason: string; requiredChanges: string[] }) =>
    api.post<FinalCheckItemDto>(`/review/final-check/${id}/reject`, data),

  addNote: (id: string, data: { text: string }) =>
    api.post<FinalCheckItemDto>(`/review/final-check/${id}/notes`, data),

  summary: () =>
    api.get<{ total: number; pending: number; approved: number; rejected: number; avgScore: number; avgTAT: number }>('/review/final-check/summary'),
};

// ============= 复审 (合并) =============
export interface ReviewItemDto {
  id: string;
  reportId: string;
  type: 'initial' | 'final' | 'cosign' | 'amend';
  status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'escalated';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  assignee: string;
  assigneeName: string;
  sla: { deadline: string; remaining: number; breached: boolean };
  createdAt: string;
  completedAt?: string;
}

export const reviewApi = {
  list: (params?: { type?: string; status?: string; priority?: string; pageSize?: number }) =>
    api.get<ReviewItemDto[]>(`/reviews?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  getById: (id: string) =>
    api.get<ReviewItemDto>(`/reviews/${id}`),

  assign: (id: string, data: { assignee: string }) =>
    api.post<ReviewItemDto>(`/reviews/${id}/assign`, data),

  approve: (id: string, data: { note?: string }) =>
    api.post<ReviewItemDto>(`/reviews/${id}/approve`, data),

  reject: (id: string, data: { reason: string }) =>
    api.post<ReviewItemDto>(`/reviews/${id}/reject`, data),

  escalate: (id: string, data: { toUser: string; reason: string }) =>
    api.post<ReviewItemDto>(`/reviews/${id}/escalate`, data),

  workload: (params?: { reviewerId?: string }) =>
    api.get<{ reviewerId: string; pending: number; completed: number; avgTAT: number }>(`/reviews/workload?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  sla: () =>
    api.get<{ total: number; breached: number; onTime: number }>('/reviews/sla'),
};

// ============= Cosign (双签) =============
export interface CosignPendingDto {
  id: string;
  reportId: string;
  patientName: string;
  modality: string;
  bodyPart: string;
  priority: string;
  submittedAt: string;
  authorId?: string;
  authorName: string;
  reason: string;
  level: string;
  waitingHours: number;
  clinicalInfo?: string;
}

export interface CosignHistoryDto {
  id: string;
  reportId: string;
  action: string;
  actor: string;
  actorId: string;
  timestamp: string;
  detail?: string;
}

export interface CosignRuleDto {
  id: string;
  name: string;
  trigger: string;
  enabled: boolean;
  createdAt: string;
}

export interface CosignStatsDto {
  total: number;
  pending: number;
  avgHours: number;
  totalSigned?: number;
  totalRejected?: number;
  onTimeRate?: number;
  avgResponseMinutes?: number;
}

export const cosignApi = {
  listPending: (params?: { status?: string; pageSize?: number }) =>
    api.get<CosignPendingDto[]>(`/cosign/pending?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  getPending: (id: string) =>
    api.get<CosignPendingDto>(`/cosign/pending/${id}`),

  approve: (id: string, data: { note?: string; certificateId?: string }) =>
    api.post<CosignPendingDto>(`/cosign/pending/${id}/approve`, data),

  reject: (id: string, data: { reason: string }) =>
    api.post<CosignPendingDto>(`/cosign/pending/${id}/reject`, data),

  listHistory: (params?: { reportId?: string; pageSize?: number }) =>
    api.get<CosignHistoryDto[]>(`/cosign/history?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  listRules: () =>
    api.get<CosignRuleDto[]>('/cosign/rules'),

  createRule: (data: { name: string; trigger: string; enabled?: boolean }) =>
    api.post<CosignRuleDto>('/cosign/rules', data),

  getStats: () =>
    api.get<CosignStatsDto>('/cosign/stats'),
};
