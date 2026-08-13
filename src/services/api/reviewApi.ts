// [v3.0.6.11-81] W1-B P0: review API 清理
//
// 背景: 后端无 /review/* 与 /reviews/* (初核/终核/复审 仅存在于 MSW mock 层),
//       cosign (双签) 为真实后端端点 (backend/src/cosign/cosign.controller.ts)。
// [v3.0.6.11-92] W2-B P2: 与 cosignApi.ts 双套合并 — cosignApi 仅保留 listPending
//       (ReviewCheckPage 在用); 重复方法 approve/reject/getStats/listHistory/listRules/
//       createRule/getPending 已删, 主实现收敛到 cosignApi.ts (CoSignPage/ReviewCenterPage
//       /reviewService 均走 coSignApi)。
// 处理:
//   - 删除孤儿方法: initialCheckApi / finalCheckApi / reviewApi (/review /reviews 段)。
//   - 保留 cosignApi 段 (后端有)。
//   - 调用方 ReviewCheckPage 已改用 reportApi(状态机 INITIAL_REVIEW/FINAL_REVIEW/CO_SIGN_REVIEW)
//     + cosignApi。
import { api } from './client';

// ============= Cosign (双签) — 主实现见 ./cosignApi.ts (coSignApi) =============
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

export const cosignApi = {
  listPending: (params?: { status?: string; pageSize?: number }) =>
    api.get<CosignPendingDto[]>(`/cosign/pending?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),
};
