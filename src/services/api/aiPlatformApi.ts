import { api } from "./client";

// AI Platform (AI 平台管理) API
// Backend: /ai-platform/*

export interface AiPlatformModel {
  id: string;
  name: string;
  version: string;
  type: "diagnosis" | "segmentation" | "detection" | "classification" | "nlp";
  modality: string[];
  status: "active" | "inactive" | "deprecated";
  accuracy?: number;
  endpoint: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiPlatformTask {
  id: string;
  modelId: string;
  modelName: string;
  studyId: string;
  patientId: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress?: number;
  result?: Record<string, unknown>;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface AiPlatformInferenceDto {
  modelId: string;
  studyId: string;
  parameters?: Record<string, unknown>;
}

export interface AiPlatformStats {
  totalModels: number;
  activeModels: number;
  totalInferences: number;
  avgLatencyMs: number;
  successRate: number;
  dailyUsage: { date: string; count: number }[];
}

export const aiPlatformApi = {
  listModels: () => api.get<AiPlatformModel[]>("/ai-platform/models"),

  getModel: (id: string) =>
    api.get<AiPlatformModel>(`/ai-platform/models/${id}`),

  deployModel: (data: Partial<AiPlatformModel>) =>
    api.post<AiPlatformModel>("/ai-platform/models", data),

  updateModel: (id: string, data: Partial<AiPlatformModel>) =>
    api.put<AiPlatformModel>(`/ai-platform/models/${id}`, data),

  deleteModel: (id: string) => api.delete(`/ai-platform/models/${id}`),

  inference: (data: AiPlatformInferenceDto) =>
    api.post<AiPlatformTask>("/ai-platform/inference", data),

  listTasks: (params?: {
    modelId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }) =>
    api.get<AiPlatformTask[]>(
      `/ai-platform/tasks?${new URLSearchParams(params ?? {}).toString()}`,
    ),

  getTask: (id: string) => api.get<AiPlatformTask>(`/ai-platform/tasks/${id}`),

  cancelTask: (id: string) =>
    api.post<AiPlatformTask>(`/ai-platform/tasks/${id}/cancel`, {}),

  getStats: () => api.get<AiPlatformStats>("/ai-platform/stats"),

  // [v3.0.6.11-50] 对接后端 GET /ai-platform/medical-devices (aiplatform.controller)
  listMedicalDevices: () =>
    api.get<{ data: Array<Record<string, unknown>> }>(
      "/ai-platform/medical-devices",
    ),
};
