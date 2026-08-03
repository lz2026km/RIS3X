import { api, invalidateApiCache } from "./client";

// AI Orchestrator API (G005 AI 编排平台)
// Backend: /ai-platform/*  (aiplatform.controller)
// 模型注册 → 部署 → 工作流集成 → 推理任务 → 二次检出

export type AiModelStatus = "REGISTERED" | "DEPLOYED" | "UNDEPLOYED" | "FAILED";

export interface AiFinding {
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  confidence: number;
}

export interface AiOrchestrationModel {
  id: string;
  name: string;
  version: string;
  vendor: string | null;
  category: string | null;
  status: AiModelStatus;
  endpoint: string | null;
  triggerConditions?: Record<string, unknown> | null;
  deployedAt: string | null;
  config?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  deploymentCount: number;
  integrationCount: number;
}

export interface AiWorkflowIntegration {
  id: string;
  modelId: string;
  name: string;
  triggerConditions: Record<string, unknown>;
  targetWorkflow: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  model?: { id: string; name: string; version: string; vendor: string | null; category: string | null };
}

export type AiJobStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";

export interface AiJob {
  id: string;
  modelId: string;
  examId: string | null;
  status: AiJobStatus;
  trigger: string;
  result?: {
    modelId?: string;
    summary?: string;
    findings?: AiFinding[];
    structured?: { radiologistRecommended?: boolean; priority?: string };
    heatmapUrl?: string | null;
  } | null;
  error?: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  model?: { id: string; name: string; version: string; vendor: string | null; category: string | null; endpoint: string | null };
}

export interface AiTestResult {
  id: string;
  reachable: boolean;
  latencyMs: number;
  timeoutMs: number;
  status: string;
  message: string;
  endpoint: string | null;
  testedAt: string;
}

export interface RegisterModelDto {
  name: string;
  version: string;
  vendor: string;
  category?: string;
  endpoint: string;
  description?: string;
  triggerConditions?: Record<string, unknown>;
  config?: Record<string, unknown>;
}

export interface CreateIntegrationDto {
  modelId: string;
  name?: string;
  triggerConditions: Record<string, unknown>;
  targetWorkflow: string;
}

export interface TriggerJobDto {
  modelId: string;
  examId: string;
  trigger?: string;
}

export interface TriggerEventDto {
  trigger: "ON_STUDY_COMPLETE" | "ON_REPORT_SAVE" | "ON_EXAM_CREATE" | "MANUAL";
  examId: string;
  modality?: string;
  bodyPart?: string;
  payload?: Record<string, unknown>;
}

function unwrap<T>(res: { success: boolean; data: unknown }): T {
  const body = res.data as { data?: T } | T | null;
  if (body && typeof body === "object" && "data" in body && (body as { data: unknown }).data !== undefined) {
    return (body as { data: T }).data;
  }
  return body as T;
}

function unwrapList<T>(res: { success: boolean; data: unknown }): T[] {
  const v = unwrap<T[]>(res);
  return Array.isArray(v) ? v : [];
}

export const aiOrchestratorApi = {
  // ===== 模型注册表 =====
  listModels: async () => {
    const res = await api.get<unknown>("/ai-platform/models");
    return { ...res, data: unwrapList<AiOrchestrationModel>(res) };
  },

  getModel: async (id: string) => {
    const res = await api.get<unknown>(`/ai-platform/models/${id}`);
    return { ...res, data: unwrap<AiOrchestrationModel[]>(res)[0] };
  },

  registerModel: async (data: RegisterModelDto) => {
    const res = await api.post<unknown>("/ai-platform/models", data);
    await invalidateApiCache("/ai-platform/models");
    return { ...res, data: unwrap<AiOrchestrationModel[]>(res)[0] };
  },

  deployModel: async (id: string, endpoint?: string) => {
    const res = await api.post<unknown>(`/ai-platform/models/${id}/deploy`, endpoint ? { endpoint } : {});
    await invalidateApiCache("/ai-platform/models");
    return { ...res, data: unwrap<AiOrchestrationModel[]>(res)[0] };
  },

  undeployModel: async (id: string) => {
    const res = await api.post<unknown>(`/ai-platform/models/${id}/undeploy`, {});
    await invalidateApiCache("/ai-platform/models");
    return { ...res, data: unwrap<AiOrchestrationModel[]>(res)[0] };
  },

  testModel: async (id: string, timeoutMs?: number) => {
    const res = await api.post<unknown>(`/ai-platform/models/${id}/test`, timeoutMs ? { timeoutMs } : {});
    return { ...res, data: unwrap<AiTestResult[]>(res)[0] };
  },

  // ===== 工作流集成 =====
  listIntegrations: async () => {
    const res = await api.get<unknown>("/ai-platform/workflow/integrations");
    return { ...res, data: unwrapList<AiWorkflowIntegration>(res) };
  },

  createIntegration: async (data: CreateIntegrationDto) => {
    const res = await api.post<unknown>("/ai-platform/workflow/integrations", data);
    await invalidateApiCache("/ai-platform/workflow/integrations");
    return { ...res, data: unwrap<AiWorkflowIntegration[]>(res)[0] };
  },

  triggerWorkflowEvent: async (data: TriggerEventDto) => {
    const res = await api.post<unknown>("/ai-platform/workflow/trigger", data);
    await invalidateApiCache("/ai-platform/jobs");
    return res;
  },

  // ===== 推理任务 =====
  listJobs: async (params?: { status?: string; modelId?: string }) => {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.modelId) query.set("modelId", params.modelId);
    const qs = query.toString();
    const res = await api.get<unknown>(`/ai-platform/jobs${qs ? `?${qs}` : ""}`);
    return { ...res, data: unwrapList<AiJob>(res) };
  },

  getJob: async (id: string) => {
    const res = await api.get<unknown>(`/ai-platform/jobs/${id}`);
    return { ...res, data: unwrap<AiJob[]>(res)[0] };
  },

  triggerJob: async (data: TriggerJobDto) => {
    const res = await api.post<unknown>("/ai-platform/jobs", data);
    await invalidateApiCache("/ai-platform/jobs");
    return { ...res, data: unwrap<AiJob[]>(res)[0] };
  },
};
