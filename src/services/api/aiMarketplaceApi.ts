import { api } from "./client";

export interface AiModel {
  id: string;
  name: string;
  version: string;
  modality: string;
  description: string;
  status: "running" | "stopped" | "error";
  deployedAt: string;
  accuracy?: number;
}

export interface ModelHealth {
  cpu: number;
  memory: number;
  gpu?: number;
  uptime: string;
  requestCount: number;
  errorRate: number;
}

export interface ModelUsage {
  totalRequests: number;
  successRate: number;
  avgLatency: number;
  dailyStats: { date: string; count: number }[];
}

export interface DeployModelDto {
  name: string;
  version: string;
  modality: string;
  description?: string;
}

export interface ModelStatus {
  id: string;
  status: "running" | "stopped" | "error";
  deployedAt?: string;
}

// [v3.0.6.11-50] 路径统一: /ai/marketplace/* → /ai-marketplace/* (backend modules/ai-marketplace.controller)
//   方法面已对齐后端实际端点: list / models/deploy / models/:id / models/:id/status

export const aiMarketplaceApi = {
  listModels: () => api.get<AiModel[]>("/ai-marketplace/models"),

  deployModel: (dto: DeployModelDto) =>
    api.post<AiModel>("/ai-marketplace/models/deploy", dto),

  removeModel: (id: string) => api.delete(`/ai-marketplace/models/${id}`),

  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
  getModelStatus: (id: string) =>
    api.get<ModelStatus>(`/ai-marketplace/models/${id}/status`),
};
