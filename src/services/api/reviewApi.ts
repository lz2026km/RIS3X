// [v3.0.6.11-81] W1-B P0: review API 清理
//
// 背景: 后端无 /review/* 与 /reviews/* (初核/终核/复审 仅存在于 MSW mock 层),
//       cosign (双签) 为真实后端端点 (backend/src/cosign/cosign.controller.ts)。
// 处理:
//   - 删除孤儿方法: initialCheckApi / finalCheckApi / reviewApi (/review /reviews 段)。
//   - 保留 cosignApi 段 (后端有)。
//   - 调用方 ReviewCheckPage 已改用 reportApi(状态机 INITIAL_REVIEW/FINAL_REVIEW/CO_SIGN_REVIEW)
//     + cosignApi。
import { api } from './client';

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
