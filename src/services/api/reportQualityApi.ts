import { api, invalidateApiCache, invalidateApiCacheByPrefix } from "./client";

// === Types (matching backend responses) ===

export interface QualityRuleDimension {
  key: string;
  label: string;
  max: number;
  weight: number;
}

export interface QualityGrade {
  grade: string;
  min: number;
  label: string;
}

export interface QualityRulesResponse {
  version: string;
  dimensions: QualityRuleDimension[];
  grades: QualityGrade[];
  keywords: string[];
  blacklist: string[];
}

export interface ScoreRule {
  key: string;
  value: unknown;
}

export interface DefectEntry {
  id: string;
  action: string;
  resource: string;
  detail: unknown;
  createdAt: string;
}

export interface QualityStatsData {
  total: number;
  avgScore: number;
}

export interface EvaluateDto {
  reportId: string;
  findings: string;
  conclusion: string;
  suggestion?: string;
  radsCategory?: string;
  hasCritical?: boolean;
  verified?: boolean;
  structuredCompletion?: number;
}

export interface QualityEvaluation {
  id: string;
  reportId: string;
  totalScore: number;
  grade: string;
  dimensions: Array<{
    key: string;
    label: string;
    score: number;
    max: number;
    weight: number;
    issues: string[];
  }>;
  evaluatedAt: string;
  suggestions: string[];
}

// === API Methods ===
// [v3.0.6.11-50] 路径统一:
//   - rules/evaluate/history/trend/re-evaluate → /reports/quality/* (reports-quality.controller)
//   - score-rules/defect-library/ai-report-drafts/stats → /report-quality-ext/* (report-quality-ext.controller)

export const reportQualityApi = {
  // ── Quality rules & evaluation (reports-quality.controller) ──

  getRules: () => api.get<QualityRulesResponse>("/reports/quality/rules"),

  evaluate: (data: EvaluateDto) =>
    api.post<QualityEvaluation>("/reports/quality/evaluate", data),

  getHistory: (reportId: string) =>
    api.get<QualityEvaluation[]>(`/reports/quality/history/${reportId}`),

  getTrend: (reportId: string, days?: number) =>
    api.get<QualityEvaluation[]>(
      `/reports/quality/trend/${reportId}?days=${days ?? 30}`,
    ),

  reEvaluate: (reportId: string, data: EvaluateDto) =>
    api.post<QualityEvaluation>(
      `/reports/quality/re-evaluate/${reportId}`,
      data,
    ),

  // ── Score rules (report-quality-ext.controller) ──

  getScoreRules: () =>
    api.get<{ data: ScoreRule[] }>("/report-quality-ext/score-rules"),

  createScoreRule: async (data: unknown) => {
    const res = await api.post<{ data: ScoreRule[] }>(
      "/report-quality-ext/score-rules",
      data,
    );
    await invalidateApiCache("/report-quality-ext/score-rules");
    return res;
  },

  updateScoreRule: async (id: string, data: unknown) => {
    const res = await api.put<{ data: ScoreRule[] }>(
      `/report-quality-ext/score-rules/${id}`,
      data,
    );
    await invalidateApiCache("/report-quality-ext/score-rules");
    return res;
  },

  // ── Defect library ──

  getDefectLibrary: () =>
    api.get<{ data: DefectEntry[] }>("/report-quality-ext/defect-library"),

  createDefectEntry: async (data: unknown) => {
    const res = await api.post<{ data: DefectEntry[] }>(
      "/report-quality-ext/defect-library",
      data,
    );
    await invalidateApiCache("/report-quality-ext/defect-library");
    return res;
  },

  updateDefectEntry: async (id: string, data: unknown) => {
    const res = await api.put<{ data: DefectEntry[] }>(
      `/report-quality-ext/defect-library/${id}`,
      data,
    );
    await invalidateApiCache("/report-quality-ext/defect-library");
    return res;
  },

  // ── AI report drafts ──

  getAiReportDrafts: () =>
    api.get<{ data: unknown[] }>("/report-quality-ext/ai-report-drafts"),

  createAiReportDraft: async (data: unknown) => {
    const res = await api.post<{ data: unknown[] }>(
      "/report-quality-ext/ai-report-drafts",
      data,
    );
    await invalidateApiCache("/report-quality-ext/ai-report-drafts");
    return res;
  },

  // ── Stats ──

  getStats: () =>
    api.get<{ data: QualityStatsData }>("/report-quality-ext/stats"),
};
