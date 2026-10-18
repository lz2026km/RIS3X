import { invalidateApiCache } from "./client";
import { aiPlatformApi } from "./aiPlatformApi";
import type { CreateWorkflowIntegrationDto } from "./aiPlatformApi";

// AI Orchestrator API (G005 AI 编排平台)
// Backend: /ai-platform/*  (aiplatform.controller)
// 模型注册 → 部署 → 工作流集成 → 推理任务 → 二次检出
//
// [W1-C 去重] 本模块与 aiPlatformApi 重复封装同一批 /ai-platform/* 端点。
//   aiPlatformApi 为权威实现; 本模块保留编排语义的类型化方法签名, 请求全部委托,
//   便于 AIOrchestrationPage 继续按编排模型类型消费。

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
  model?: {
    id: string;
    name: string;
    version: string;
    vendor: string | null;
    category: string | null;
  };
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
  model?: {
    id: string;
    name: string;
    version: string;
    vendor: string | null;
    category: string | null;
    endpoint: string | null;
  };
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

export const aiOrchestratorApi = {
  // ===== 模型注册表 =====
  listModels: async () => {
    const res = await aiPlatformApi.listModels();
    return { ...res, data: res.data as unknown as AiOrchestrationModel[] };
  },

  /** @deprecated 无页面直接引用 — 保留签名, 委托 aiPlatformApi.getModel */
  getModel: async (id: string) => {
    const res = await aiPlatformApi.getModel(id);
    return { ...res, data: res.data as unknown as AiOrchestrationModel };
  },

  registerModel: async (data: RegisterModelDto) => {
    const res = await aiPlatformApi.deployModel(data);
    await invalidateApiCache("/ai-platform/models");
    return { ...res, data: res.data as unknown as AiOrchestrationModel };
  },

  deployModel: async (id: string, endpoint?: string) => {
    const res = await aiPlatformApi.updateModel(
      id,
      endpoint ? { endpoint } : {},
    );
    await invalidateApiCache("/ai-platform/models");
    return { ...res, data: res.data as unknown as AiOrchestrationModel };
  },

  undeployModel: async (id: string) => {
    const res = await aiPlatformApi.deleteModel(id);
    await invalidateApiCache("/ai-platform/models");
    return { ...res, data: res.data as unknown as AiOrchestrationModel };
  },

  testModel: async (id: string, timeoutMs?: number) => {
    const res = await aiPlatformApi.testModel(id, timeoutMs);
    return { ...res, data: res.data as unknown as AiTestResult };
  },

  // ===== 工作流集成 =====
  listIntegrations: async () => {
    const res = await aiPlatformApi.listWorkflowIntegrations();
    return { ...res, data: res.data as unknown as AiWorkflowIntegration[] };
  },

  createIntegration: async (data: CreateIntegrationDto) => {
    const res = await aiPlatformApi.createWorkflowIntegration(
      data as unknown as CreateWorkflowIntegrationDto,
    );
    await invalidateApiCache("/ai-platform/workflow/integrations");
    return { ...res, data: res.data as unknown as AiWorkflowIntegration };
  },

  triggerWorkflowEvent: async (data: TriggerEventDto) => {
    const res = await aiPlatformApi.triggerWorkflowEvent(data);
    await invalidateApiCache("/ai-platform/jobs");
    return res;
  },

  // ===== 推理任务 =====
  listJobs: async (params?: { status?: string; modelId?: string }) => {
    const res = await aiPlatformApi.listTasks(params);
    return { ...res, data: res.data as unknown as AiJob[] };
  },

  getJob: async (id: string) => {
    const res = await aiPlatformApi.getTask(id);
    return { ...res, data: res.data as unknown as AiJob };
  },

  triggerJob: async (data: TriggerJobDto) => {
    const res = await aiPlatformApi.inference({
      modelId: data.modelId,
      studyId: data.examId,
      parameters: data.trigger ? { trigger: data.trigger } : {},
    });
    await invalidateApiCache("/ai-platform/jobs");
    return { ...res, data: res.data as unknown as AiJob };
  },
};
