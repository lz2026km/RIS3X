import { api, invalidateApiCache } from "./client";

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
      `/ai-platform/tasks?${new URLSearchParams(
        Object.fromEntries(
          Object.entries(params ?? {}).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]),
        ),
      ).toString()}`,
    ),

  getTask: (id: string) => api.get<AiPlatformTask>(`/ai-platform/tasks/${id}`),

  cancelTask: (id: string) =>
    api.post<AiPlatformTask>(`/ai-platform/tasks/${id}/cancel`, {}),

  getStats: () => api.get<AiPlatformStats>("/ai-platform/stats"),

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
