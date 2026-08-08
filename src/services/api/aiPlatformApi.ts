import { api, invalidateApiCache } from "./client";
import type { ApiResponse } from "./types";

// AI Platform (AI 平台管理) API
// Backend: /ai-platform/*
// [W1-B] 对齐后端 aiplatform.controller: 无 PUT/DELETE /models/:id、无 /inference /tasks,
//        模型生命周期用 POST /models/:id/{deploy|undeploy|test},推理任务用 POST/GET /jobs。

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
  vendor?: string;
  createdAt: string;
  updatedAt: string;
}

// [W1-B] 对齐 backend prisma AiJob 字段 (listAiJobs / getAiJob / triggerAiJob)
export interface AiPlatformTask {
  id: string;
  modelId: string;
  examId?: string | null;
  modelName?: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
  trigger?: string;
  result?: {
    summary?: string;
    findings?: unknown[];
    structured?: Record<string, unknown>;
    heatmapUrl?: string | null;
  } | null;
  error?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  model?: {
    id: string;
    name: string;
    version: string;
    vendor: string | null;
    category: string | null;
    endpoint: string | null;
  };
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

// [v3.0.6.11-75] 对齐 backend aiplatform.service.listAiQcResults (auditLog resource=ai-qc)
export interface AiPlatformQcResult {
  id: string;
  action?: string;
  resource?: string;
  detail?: Record<string, unknown>;
  tenantId?: string;
  createdAt?: string;
}

// [v3.0.6.11-75] 对齐 backend prisma Device 模型 (listAiMedicalDevices)
export interface AiPlatformMedicalDevice {
  id: string;
  code: string;
  name: string;
  modality: string;
  manufacturer?: string | null;
  location?: string | null;
  state: string;
  todayExams: number;
  todayUsageMin: number;
  createdAt: string;
  updatedAt: string;
}

// [W1-D] 对齐 backend aiplatform.service 既有端点 (auditLog resource=ai-*):
//   结构化报告 / 编排 / 融合 / 辅助 / 市场 均返回审计记录数组 { data: [...] }
export interface AiPlatformRecord {
  id: string;
  action?: string;
  resource?: string;
  detail?: Record<string, unknown> | null;
  tenantId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// [W1-D] 对齐 backend GenerateStructuredReportSchema
export interface GenerateStructuredReportDto {
  studyId: string;
  templateId: string;
  findings?: string[];
  additionalContext?: Record<string, unknown>;
}

// [W1-D] 对齐 backend CreateAiOrchestrationSchema
export interface CreateAiOrchestrationDto {
  workflowName: string;
  steps: Array<{ order: number; action: string; params: Record<string, unknown> }>;
  trigger?: "ON_STUDY_COMPLETE" | "ON_REPORT_SAVE" | "MANUAL";
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

// 后端模型/任务端点统一返回 { data: [item] } (数组包装),取第一项
function unwrapOne<T>(res: { success: boolean; data: unknown }): T {
  const v = unwrap<unknown>(res);
  if (Array.isArray(v)) return (v[0] ?? null) as T;
  return v as T;
}

export const aiPlatformApi = {
  listModels: async () => {
    const res = await api.get<unknown>("/ai-platform/models");
    return { ...res, data: unwrapList<AiPlatformModel>(res) };
  },

  getModel: async (id: string) => {
    const res = await api.get<unknown>(`/ai-platform/models/${id}`);
    return { ...res, data: unwrapOne<AiPlatformModel>(res) };
  },

  // 后端 POST /ai-platform/models = 注册模型 (CreateAiModelSchema: name/version/vendor/endpoint)
  deployModel: async (data: Partial<AiPlatformModel>) => {
    const res = await api.post<unknown>("/ai-platform/models", {
      name: data.name,
      version: data.version ?? "1.0",
      vendor: data.vendor ?? "第三方厂商",
      category: data.type ?? undefined,
      endpoint: data.endpoint,
      description: data.description,
    });
    return { ...res, data: unwrapOne<AiPlatformModel>(res) };
  },

  // [W1-B] 后端无 PUT /models/:id;按业务语义映射:
  //   status=active            → POST /models/:id/deploy
  //   status=inactive/deprecated → POST /models/:id/undeploy
  updateModel: async (id: string, data: Partial<AiPlatformModel>) => {
    if (data.status === "inactive" || data.status === "deprecated") {
      const res = await api.post<unknown>(`/ai-platform/models/${id}/undeploy`, {});
      return { ...res, data: unwrapOne<AiPlatformModel>(res) };
    }
    const res = await api.post<unknown>(`/ai-platform/models/${id}/deploy`, data);
    return { ...res, data: unwrapOne<AiPlatformModel>(res) };
  },

  // [W1-B] 后端无 DELETE /models/:id;映射为下线操作 (undeploy)
  deleteModel: async (id: string) => {
    const res = await api.post<unknown>(`/ai-platform/models/${id}/undeploy`, {});
    return { ...res, data: unwrapOne<AiPlatformModel>(res) };
  },

  // [W1-B] 后端无 /ai-platform/inference;推理 = POST /ai-platform/jobs (CreateAiJobSchema: modelId/examId/trigger)
  inference: async (data: AiPlatformInferenceDto) => {
    const res = await api.post<unknown>("/ai-platform/jobs", {
      modelId: data.modelId,
      examId: data.studyId,
      trigger:
        typeof data.parameters?.trigger === "string"
          ? (data.parameters.trigger as string)
          : "MANUAL",
    });
    return { ...res, data: unwrapOne<AiPlatformTask>(res) };
  },

  listTasks: async (params?: { modelId?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.modelId) query.set("modelId", params.modelId);
    if (params?.status) query.set("status", params.status);
    const qs = query.toString();
    const res = await api.get<unknown>(`/ai-platform/jobs${qs ? `?${qs}` : ""}`);
    return { ...res, data: unwrapList<AiPlatformTask>(res) };
  },

  getTask: async (id: string) => {
    const res = await api.get<unknown>(`/ai-platform/jobs/${id}`);
    return { ...res, data: unwrapOne<AiPlatformTask>(res) };
  },

  // [W1-B] 后端无 POST /jobs/:id/cancel (队列为进程内模拟,无取消语义)。
  // 标注: 保留方法签名,直接返回 NOT_SUPPORTED,避免调用方误判成功或发出 404 请求。
  cancelTask: (_id: string): Promise<ApiResponse<AiPlatformTask>> =>
    Promise.resolve({
      success: false,
      data: null as unknown as AiPlatformTask,
      error: {
        code: "NOT_SUPPORTED",
        message: "后端 aiplatform 未实现任务取消(仅模拟队列)",
      },
    }),

  // [W1-B] 后端新增 GET /ai-platform/stats (由 aiModel/aiJob/auditLog 聚合)
  getStats: async () => {
    const res = await api.get<unknown>("/ai-platform/stats");
    return { ...res, data: unwrap<AiPlatformStats>(res) };
  },

  // [v3.0.6.11-50] 对接后端 GET /ai-platform/medical-devices (aiplatform.controller)
  listMedicalDevices: () =>
    api.get<{ data: AiPlatformMedicalDevice[] }>(
      "/ai-platform/medical-devices",
    ),

  // [v3.0.6.11-75] AI QC 记录 (后端: auditLog resource=ai-qc)
  listQcResults: () =>
    api.get<{ data: AiPlatformQcResult[] }>("/ai-platform/qc"),

  getQcResult: (id: string) =>
    api.get<{ data: AiPlatformQcResult[] }>(`/ai-platform/qc/${id}`),

  // ==================== [W1-D] AI 平台 7 端点补全 ====================

  // 结构化报告列表 (后端: auditLog resource=ai-structured-report)
  listStructuredReports: async () => {
    const res = await api.get<unknown>("/ai-platform/structured-reports");
    return { ...res, data: unwrapList<AiPlatformRecord>(res) };
  },

  // 从检查生成结构化报告 (后端: GenerateStructuredReportSchema)
  createStructuredReport: async (data: GenerateStructuredReportDto) => {
    const res = await api.post<unknown>("/ai-platform/structured-reports", data);
    await invalidateApiCache("/ai-platform/structured-reports");
    return { ...res, data: unwrap<AiPlatformRecord[]>(res)[0] };
  },

  // AI 编排列表 (后端: auditLog resource=ai-orchestration)
  listOrchestration: async () => {
    const res = await api.get<unknown>("/ai-platform/orchestration");
    return { ...res, data: unwrapList<AiPlatformRecord>(res) };
  },

  // 新建 AI 编排 (后端: CreateAiOrchestrationSchema)
  createOrchestration: async (data: CreateAiOrchestrationDto) => {
    const res = await api.post<unknown>("/ai-platform/orchestration", data);
    await invalidateApiCache("/ai-platform/orchestration");
    return { ...res, data: unwrap<AiPlatformRecord[]>(res)[0] };
  },

  // 融合工作区 (后端: auditLog resource=ai-fusion, 实际为 FusionJob 记录)
  listFusion: async () => {
    const res = await api.get<unknown>("/ai-platform/fusion");
    return { ...res, data: unwrapList<AiPlatformRecord>(res) };
  },

  // AI 辅助建议模板 (后端: auditLog resource=ai-assist)
  listAssist: async () => {
    const res = await api.get<unknown>("/ai-platform/assist");
    return { ...res, data: unwrapList<AiPlatformRecord>(res) };
  },

  // 模型市场 (后端: auditLog resource=ai-marketplace)
  listMarketplace: async () => {
    const res = await api.get<unknown>("/ai-platform/marketplace");
    return { ...res, data: unwrapList<AiPlatformRecord>(res) };
  },
};
