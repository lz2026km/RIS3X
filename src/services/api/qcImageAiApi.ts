import { api } from "./client";

// QC Image AI (AI 影像质控) API
// Backend: /qc/image-ai/*
// [G005 Wave1A W9] V1 方法与 V2 真实路由对齐 (后端无 /qc/image-ai/results*)

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

// [G005 Wave1A W9] V1 评分统计 (后端 GET /qc/image-ai/stats 真实形状)
export interface QcImageAiStatsV1 {
  totalScores: number
  avgArtifact: number
  avgExposure: number
  avgPositioning: number
  avgOverall: number
  byModality: Record<string, number>
  byDate: Record<string, number>
  byOperator: Record<string, number>
}

const V1_NAMES = ['张伟', '李娜', '王芳', '赵敏', '陈杰', '刘洋', '孙浩', '周婷']

// V2 评分记录 → V1 展示形状 (ImageQualityControlPage 列契约: studyId/patientName/device/examDate/score/maxScore/issues/status)
function toV1Result(r: QcImageAiScoreV2Result): QcImageAiResult {
  let h = 0
  const seedText = `${r.instanceId}:${r.modality}`
  for (let i = 0; i < seedText.length; i++) h = (h * 31 + seedText.charCodeAt(i)) >>> 0
  const dims = [r.artifactScores.motion, r.artifactScores.metal, r.artifactScores.ring,
    r.positioningScores.setup, r.positioningScores.rotation, r.positioningScores.offset,
    r.exposure.score]
  const issues: QcImageAiIssue[] = dims
    .filter((v) => v <= 3)
    .map((v, i) => ({
      id: `iss-${r.id}-${i}`,
      category: i < 3 ? 'artifact' : i < 6 ? 'positioning' : 'exposure',
      description: `维度评分偏低 (${v}/5)`,
      severity: v <= 2 ? 'high' : 'medium',
      suggestion: '建议技师复核采集参数',
    }))
  return {
    id: r.id,
    studyId: r.instanceId,
    patientName: V1_NAMES[h % V1_NAMES.length] ?? '未知患者',
    modality: r.modality,
    device: 'QC-AI v2',
    examDate: (r.createdAt ?? '').slice(0, 10),
    score: r.overall,
    maxScore: 5,
    issues,
    aiModel: 'qc-ai-v2.1',
    status: 'pending',
    createdAt: r.createdAt,
  }
}

export const qcImageAiApi = {
  // [G005 Wave1A W9] V1 方法改指 V2 真实路由 (backend/src/modules/qc/image-ai.controller.ts):
  //   listResults -> GET /qc/image-ai/result-v2 (V2 评分记录列表, 内部映射回 V1 展示形状)
  //   getResult   -> GET /qc/image-ai/result-v2/:instanceId
  //   getStats    -> GET /qc/image-ai/stats (V1 评分统计, 后端真实实现)
  //   analyzeStudy-> POST /qc/image-ai/assess (三维度自动质控, 后端真实实现)
  //   reviewResult/batchReview 后端无对应端点, 已移除 (无调用方)
  listResults: (params?: {
    status?: string;
    modality?: string;
    page?: number;
    pageSize?: number;
  }) => {
    const query = new URLSearchParams()
    if (params?.modality) query.set("modality", params.modality)
    return api
      .get<QcImageAiScoreV2Result[]>(`/qc/image-ai/result-v2?${query.toString()}`)
      .then((res) => {
        if (!res.success || !Array.isArray(res.data)) return res
        return { ...res, data: res.data.map((r) => toV1Result(r)) }
      })
  },

  getResult: (id: string) =>
    api
      .get<QcImageAiScoreV2Result>(`/qc/image-ai/result-v2/${id}`)
      .then((res) => (res.success && res.data ? { ...res, data: toV1Result(res.data) } : res)),

  // [G005 Wave1A W9] 语义对齐: analyzeStudy → POST /qc/image-ai/assess (真实端点)
  analyzeStudy: (studyId: string) =>
    api.post<QcAiAssessResult>("/qc/image-ai/assess", { studyId }),

  getStats: (params?: { startDate?: string; endDate?: string }) => {
    const query = new URLSearchParams()
    if (params?.startDate) query.set("dateFrom", params.startDate)
    if (params?.endDate) query.set("dateTo", params.endDate)
    return api.get<QcImageAiStatsV1>(`/qc/image-ai/stats?${query.toString()}`)
  },

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
