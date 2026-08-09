import { api, invalidateApiCache } from "./client";

// QC Image AI (AI 影像质控) API
// Backend: /qc/image-ai/*

export interface QcImageAiResult {
  id: string;
  studyId: string;
  patientName: string;
  modality: string;
  device: string;
  examDate: string;
  score: number;
  maxScore: number;
  issues: QcImageAiIssue[];
  aiModel: string;
  status: "pending" | "reviewed" | "accepted" | "rejected";
  reviewerId?: string;
  reviewerName?: string;
  createdAt: string;
}

export interface QcImageAiIssue {
  id: string;
  category: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  location?: string;
  suggestion?: string;
}

export interface QcImageAiReviewDto {
  status: "accepted" | "rejected";
  comment?: string;
}

export interface QcImageAiBatchDto {
  studyIds: string[];
}

export interface QcImageAiStats {
  totalReviewed: number;
  avgScore: number;
  issueDistribution: { category: string; count: number; percentage: number }[];
  qualityTrend: { date: string; avgScore: number }[];
}

// [v3.0.6.11-50] V2 评分 (对齐 backend/src/modules/qc/image-ai.service.ts)

export interface QcImageAiArtifactScoresV2 {
  motion: number;
  metal: number;
  ring: number;
}

export interface QcImageAiPositioningScoresV2 {
  setup: number;
  rotation: number;
  offset: number;
}

export interface QcImageAiExposureV2 {
  value: "不足" | "正常" | "过度";
  score: number;
}

export interface QcImageAiScoreV2Dto {
  instanceId: string;
  modality: string;
  artifactScores: QcImageAiArtifactScoresV2;
  positioningScores: QcImageAiPositioningScoresV2;
  exposure: QcImageAiExposureV2;
  overall: number;
  operatorId?: string;
}

export interface QcImageAiScoreV2Result extends QcImageAiScoreV2Dto {
  id: string;
  createdAt: string;
}

export interface QcImageAiStatsV2 {
  totalScores: number;
  avgArtifactMotion: number;
  avgArtifactMetal: number;
  avgArtifactRing: number;
  avgArtifactOverall: number;
  avgPositioningSetup: number;
  avgPositioningRotation: number;
  avgPositioningOffset: number;
  avgPositioningOverall: number;
  avgExposureScore: number;
  avgOverall: number;
  byModality: Record<string, number>;
  byDate: Record<string, number>;
  byOperator: Record<string, number>;
}

export interface QcImageAiStatsV2Query {
  modality?: string;
  dateFrom?: string;
  dateTo?: string;
  operatorId?: string;
}

// [G005 Wave4A] G-24 三维度自动质控 (伪影/曝光/体位) — 对齐 backend POST /qc/image-ai/assess
export interface QcAiDimensionAssessment {
  score: number; // 0-100
  label: string;
  issues: string[];
}

export interface QcAiAssessDto {
  studyId: string;
  instanceId?: string;
  modality?: string;
  bodyPart?: string;
}

export interface QcAiAssessResult {
  studyId: string;
  instanceId?: string;
  modality: string;
  bodyPart: string;
  assessedAt: string;
  artifact: QcAiDimensionAssessment;
  exposure: QcAiDimensionAssessment;
  positioning: QcAiDimensionAssessment;
  overall: { score: number; label: string };
}

export const qcImageAiApi = {
  listResults: (params?: {
    status?: string;
    modality?: string;
    page?: number;
    pageSize?: number;
  }) =>
    api.get<QcImageAiResult[]>(
      `/qc/image-ai/results?${new URLSearchParams(params ?? {}).toString()}`,
    ),

  getResult: (id: string) =>
    api.get<QcImageAiResult>(`/qc/image-ai/results/${id}`),

  reviewResult: async (id: string, data: QcImageAiReviewDto) => {
    const res = await api.post<QcImageAiResult>(
      `/qc/image-ai/results/${id}/review`,
      data,
    );
    await invalidateApiCache("/qc/image-ai/results");
    return res;
  },

  batchReview: async (
    data: QcImageAiBatchDto & { status: "accepted" | "rejected" },
  ) => {
    const res = await api.post<QcImageAiResult[]>(
      "/qc/image-ai/batch-review",
      data,
    );
    await invalidateApiCache("/qc/image-ai/results");
    return res;
  },

  analyzeStudy: (studyId: string) =>
    api.post<QcImageAiResult>(`/qc/image-ai/analyze/${studyId}`, {}),

  getStats: (params?: { startDate?: string; endDate?: string }) =>
    api.get<QcImageAiStats>(
      `/qc/image-ai/stats?${new URLSearchParams(params ?? {}).toString()}`,
    ),

  // [v3.0.6.11-50] V2 端点 (backend/src/modules/qc/image-ai.controller.ts)

  scoreV2: (data: QcImageAiScoreV2Dto) =>
    api.post<QcImageAiScoreV2Result>("/qc/image-ai/score-v2", data),

  getResultV2: (instanceId: string) =>
    api.get<QcImageAiScoreV2Result>(`/qc/image-ai/result-v2/${instanceId}`),

  getStatsV2: (params?: QcImageAiStatsV2Query) =>
    api.get<QcImageAiStatsV2>(
      `/qc/image-ai/stats-v2?${new URLSearchParams(params ?? {}).toString()}`,
    ),

  // [G005 Wave4A] G-24 AI 自动质控三维度评估 (伪影/曝光/体位 + 总分)
  assess: (data: QcAiAssessDto) =>
    api.post<QcAiAssessResult>("/qc/image-ai/assess", data),
};
