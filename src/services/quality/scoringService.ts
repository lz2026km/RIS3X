/**
 * G005 RIS v3.0.5.1 - R3.QUALITY.SCORING 质控评分服务
 *
 * 80 点: 15 维度评分 + 5 个辅助能力(阈值/历史/报表/奖励联动/模板)
 * [v3.0.6.16-8] 维度/等级/评分走真后端 (quality/rubric); 无后端支撑的辅助能力如实标记 demo;
 *   评分失败不再伪造成功。
 */
import {
  SCORING_DIMENSIONS,
  SCORING_THRESHOLDS,
  INITIAL_THRESHOLD_CONFIG,
  SCORE_HISTORY,
  BONUS_LINKAGES,
  TEMPLATE_SCORE_RULES,
  SCORING_KPI,
  SAMPLE_SUBMISSIONS,
  computeTemplateScore,
  getScoreHistory,
} from "../../data/qualityScoringMock";
import {
  qualityScoringCenterApi,
  type GradeBand,
  type QualityRubric,
  type RubricEvaluationResult,
  type RubricSubmission,
} from "../api/qualityScoringCenterApi";
import type {
  ScoringDimension,
  ScoringThresholdConfig,
  ThresholdConfig,
  ScoreHistoryEntry,
  ScoreHistoryQuery,
  ScoreHistoryResponse,
  BonusLinkage,
  TemplateScoreRule,
  ScoreTemplateResult,
  QualityScoringKPI,
  ScoringEvaluationResult,
  ScoringSubmission,
  QualityScoreReport,
  ScoringDimensionKey,
  ScoringDimensionCategory,
  ScoringGrade,
} from "../../types/R3/R3.QUALITY.SCORING";

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const uuid = () =>
  "qs-" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const CATEGORY_COLOR: Record<ScoringDimensionCategory, string> = {
  completeness: "var(--color-primary-500)",
  accuracy: "#10b981",
  timeliness: "var(--color-warning-500)",
};
const CATEGORY_ICON: Record<ScoringDimensionCategory, string> = {
  completeness: "📄",
  accuracy: "🎯",
  timeliness: "⏱",
};
const BAND_BG: Record<string, string> = {
  A: "#d1fae5",
  B: "#dbeafe",
  C: "#fef3c7",
  D: "#fee2e2",
};

const inMemoryThreshold: ThresholdConfig = clone(INITIAL_THRESHOLD_CONFIG);
const inMemoryEvaluations: ScoringEvaluationResult[] = [];
const inMemoryHistory: ScoreHistoryEntry[] = clone(SCORE_HISTORY);
const inMemoryBonusLinkages: BonusLinkage[] = clone(BONUS_LINKAGES);

// ============================================================
// 后端量表 → 本地模型
// ============================================================
function mapRubricDimensions(rubric: QualityRubric): ScoringDimension[] {
  const out: ScoringDimension[] = [];
  for (const dim of rubric.dimensions) {
    const category = dim.key as ScoringDimensionCategory;
    for (const sub of dim.subItems) {
      out.push({
        key: sub.key as ScoringDimensionKey,
        category,
        name: sub.name,
        nameEn: sub.nameEn ?? "",
        description: sub.description ?? dim.description ?? "",
        descriptionEn: "",
        weight: Math.round(dim.weight * sub.weight * 1000) / 1000,
        enabled: true,
        color: CATEGORY_COLOR[category] ?? "#64748b",
        icon: CATEGORY_ICON[category] ?? "📄",
        rules: sub.rules.map((r) => ({
          key: r.key,
          name: r.name,
          nameEn: "",
          description: r.explanation ?? "",
          weight: r.weight,
          evaluator: "auto" as const,
          detector: r.kind,
        })),
        passingRule: sub.description ?? dim.description ?? "",
        passingRuleEn: "",
        source: "database",
      });
    }
  }
  return out;
}

function mapGradeBands(bands: GradeBand[]): ScoringThresholdConfig[] {
  return bands.map((b) => ({
    grade: b.grade as ScoringGrade,
    minScore: b.min,
    maxScore: b.max,
    color: b.color,
    bg: BAND_BG[b.grade] ?? "#f1f5f9",
    border: b.color,
    label: b.label,
    labelEn: b.labelEn ?? "",
    publishable: b.publishable,
    bonusEligible: b.bonusEligible,
    description: b.label,
    descriptionEn: b.labelEn ?? "",
    source: "database",
  }));
}

function toRubricSubmission(s: ScoringSubmission): RubricSubmission {
  return {
    reportId: s.reportId,
    patientName: s.patientName,
    modality: s.modality,
    findings: s.findings,
    impression: s.impression,
    diagnosis: s.diagnosis,
    recommendation: s.recommendation,
    structuredFieldsComplete: s.structuredFieldsComplete,
    signed: s.signed,
    criticalMarked: s.criticalMarked,
    priority: s.priority,
    submitAt: s.submitAt,
    reviewStartedAt: s.reviewStartedAt,
    signedAt: s.signedAt,
  };
}

function mapRubricEvaluation(
  r: RubricEvaluationResult,
  submission?: ScoringSubmission,
): ScoringEvaluationResult {
  const dimensionScores = {} as Record<ScoringDimensionKey, number>;
  const categoryScores: Record<ScoringDimensionCategory, number> = {
    completeness: 0,
    accuracy: 0,
    timeliness: 0,
  };
  const evidence: ScoringEvaluationResult["evidence"] = [];
  let weightedTotal = 0;
  for (const dim of r.dimensions) {
    const category = dim.key as ScoringDimensionCategory;
    categoryScores[category] = dim.score;
    weightedTotal += dim.weightedScore;
    for (const sub of dim.subItems) {
      dimensionScores[sub.key as ScoringDimensionKey] = sub.score;
      for (const rule of sub.rules) {
        if (evidence.length < 30) {
          evidence.push({
            dimension: sub.key as ScoringDimensionKey,
            rule: rule.name,
            score: rule.score,
            explanation: rule.explanation,
          });
        }
      }
    }
  }
  return {
    scoreId: r.evaluationId,
    reportId: r.reportId ?? submission?.reportId ?? "",
    dimensionScores,
    categoryScores,
    weightedTotal: Math.round(weightedTotal * 10) / 10,
    totalScore: r.totalScore,
    grade: r.grade as ScoringGrade,
    passed: r.passed,
    publishable: r.publishable,
    bonusEligible: r.bonusEligible,
    hardFailTriggered: r.hardFailTriggered,
    evaluatedAt: r.evaluatedAt,
    modelVersion: `${r.standard} (rubric v${r.rubricVersion})`,
    evaluator: "auto",
    evidence,
    durationMs: 0,
  };
}

function pushHistory(
  result: ScoringEvaluationResult,
  submission: ScoringSubmission,
): void {
  const historyEntry: ScoreHistoryEntry = {
    id: "sh-" + uuid(),
    scoreId: result.scoreId,
    reportId: result.reportId,
    patientName: submission.patientName,
    modality: submission.modality,
    doctorId: submission.doctorId,
    doctorName: submission.doctorName,
    department: submission.department,
    categoryScores: result.categoryScores,
    totalScore: result.totalScore,
    grade: result.grade,
    evaluatedBy: result.evaluator,
    evaluatedAt: result.evaluatedAt,
    trigger: "manual",
    deltaVsPrev: 0,
  };
  inMemoryHistory.unshift(historyEntry);
}

export const scoringService = {
  // ============ 维度 (60 点核心: 15 维度) ============
  async listDimensions(): Promise<ScoringDimension[]> {
    try {
      const res = await qualityScoringCenterApi.getRubric();
      if (res.success && res.data) {
        const mapped = mapRubricDimensions(res.data);
        if (mapped.length > 0) return mapped;
      }
    } catch {
      /* fall through to demo */
    }
    return clone(SCORING_DIMENSIONS).map((d) => ({
      ...d,
      source: "demo" as const,
    }));
  },

  async getThresholds(): Promise<ScoringThresholdConfig[]> {
    try {
      const res = await qualityScoringCenterApi.getGradeBands();
      if (res.success && Array.isArray(res.data) && res.data.length > 0)
        return mapGradeBands(res.data);
    } catch {
      /* fall through to demo */
    }
    return clone(SCORING_THRESHOLDS).map((t) => ({
      ...t,
      source: "demo" as const,
    }));
  },

  async evaluate(
    submission: ScoringSubmission,
  ): Promise<ScoringEvaluationResult> {
    const res = await qualityScoringCenterApi.evaluate({
      reportId: submission.reportId,
      submission: toRubricSubmission(submission),
    });
    if (!res.success || !res.data)
      throw new Error(res.error?.message ?? "评分失败: 后端评分接口不可用");
    const result = mapRubricEvaluation(res.data, submission);
    inMemoryEvaluations.unshift(clone(result));
    pushHistory(result, submission);
    return clone(result);
  },

  async batchEvaluate(
    submissions: ScoringSubmission[],
  ): Promise<ScoringEvaluationResult[]> {
    const out: ScoringEvaluationResult[] = [];
    for (const s of submissions) {
      out.push(await scoringService.evaluate(s));
    }
    return out;
  },

  async evaluateSample(sampleIndex = 0): Promise<ScoringEvaluationResult> {
    const sub = SAMPLE_SUBMISSIONS[sampleIndex] ?? SAMPLE_SUBMISSIONS[0]!;
    return scoringService.evaluate(sub);
  },

  // ============ 阈值配置 (4 点) ============
  async getThresholdConfig(): Promise<ThresholdConfig> {
    // TAT 阈值无对应后端端点, 如实标记 demo
    return { ...clone(inMemoryThreshold), source: "demo" };
  },

  async updateThresholdConfig(
    patch: Partial<ThresholdConfig>,
    userId: string,
  ): Promise<ThresholdConfig> {
    const res = await qualityScoringCenterApi.updateRubric({
      passThreshold: patch.publishBlockThreshold,
      bonusThreshold: patch.bonusThreshold,
    });
    if (!res.success || !res.data)
      throw new Error(res.error?.message ?? "阈值配置保存失败: 后端接口不可用");
    Object.assign(inMemoryThreshold, patch);
    inMemoryThreshold.version = res.data.version;
    inMemoryThreshold.updatedAt = res.data.updatedAt;
    inMemoryThreshold.updatedBy = userId;
    return { ...clone(inMemoryThreshold), source: "database" };
  },

  // ============ 评分历史 (4 点) ============
  async getHistory(
    query: ScoreHistoryQuery = {},
  ): Promise<ScoreHistoryResponse> {
    const base = getScoreHistory(query);
    const items = base.items.map((entry) => {
      const extra = inMemoryHistory.find((h) => h.scoreId === entry.scoreId);
      return { ...(extra ?? entry), source: "demo" as const };
    });
    return { ...base, items };
  },

  async getScoreById(scoreId: string): Promise<ScoringEvaluationResult | null> {
    const found = inMemoryEvaluations.find((e) => e.scoreId === scoreId);
    return found ? clone(found) : null;
  },

  // ============ 报告生成 (4 点) ============
  async generateReport(
    scoreId: string,
    format: QualityScoreReport["format"],
    userId: string,
  ): Promise<QualityScoreReport> {
    const evaluation = inMemoryEvaluations.find((e) => e.scoreId === scoreId);
    if (!evaluation) {
      throw new Error("评分报告生成失败: 未找到该评分记录, 请先执行评分");
    }
    const fallback = evaluation;
    const dims = SCORING_DIMENSIONS;
    const items: QualityScoreReport["items"] = dims.map((dim) => {
      const raw = fallback.dimensionScores[dim.key] ?? 0;
      return {
        dimension: dim.key,
        category: dim.category,
        name: dim.name,
        score: raw,
        weight: dim.weight,
        weightedScore: Math.round(raw * dim.weight * 100) / 100,
        issues:
          fallback.hardFailTriggered.length > 0
            ? [
                {
                  code: fallback.hardFailTriggered[0]!,
                  description: "一票否决",
                  severity: "critical",
                },
              ]
            : [],
      };
    });
    const catWeights = {
      completeness: dims
        .filter((d) => d.category === "completeness")
        .reduce((a, d) => a + d.weight, 0),
      accuracy: dims
        .filter((d) => d.category === "accuracy")
        .reduce((a, d) => a + d.weight, 0),
      timeliness: dims
        .filter((d) => d.category === "timeliness")
        .reduce((a, d) => a + d.weight, 0),
    };
    const threshold = inMemoryThreshold;
    const summary: QualityScoreReport["summary"] = {
      strengths: dims
        .filter((d) => (fallback.dimensionScores[d.key] ?? 0) >= 90)
        .map((d) => d.name),
      weaknesses: dims
        .filter((d) => (fallback.dimensionScores[d.key] ?? 0) < 75)
        .map((d) => d.name),
      recommendations: [],
    };
    if (fallback.totalScore < threshold.publishBlockThreshold) {
      summary.recommendations.push("总分低于发布阈值,请修改后重新提交");
    }
    if (fallback.hardFailTriggered.length > 0) {
      summary.recommendations.push(
        "存在一票否决项: " + fallback.hardFailTriggered.join(", "),
      );
    }
    const report: QualityScoreReport = {
      id: "rep-" + uuid(),
      scoreId,
      reportId: fallback.reportId,
      generatedAt: new Date().toISOString(),
      generatedBy: userId,
      totalScore: fallback.totalScore,
      grade: fallback.grade,
      categoryScores: {
        completeness: {
          raw: fallback.categoryScores.completeness,
          weighted:
            fallback.categoryScores.completeness * catWeights.completeness,
          weight: catWeights.completeness,
        },
        accuracy: {
          raw: fallback.categoryScores.accuracy,
          weighted: fallback.categoryScores.accuracy * catWeights.accuracy,
          weight: catWeights.accuracy,
        },
        timeliness: {
          raw: fallback.categoryScores.timeliness,
          weighted: fallback.categoryScores.timeliness * catWeights.timeliness,
          weight: catWeights.timeliness,
        },
      },
      items,
      summary,
      bonusEligible: fallback.bonusEligible,
      publishable: fallback.publishable,
      format,
      downloadUrl: `/api/v1/quality/scoring/reports/${scoreId}/download.${format}`,
    };
    return clone(report);
  },

  // ============ 奖励联动 (4 点) —— 后端无对应端点, 本地演示 ============
  async listBonusLinkages(): Promise<BonusLinkage[]> {
    return inMemoryBonusLinkages.map((b) => ({
      ...clone(b),
      source: "demo" as const,
    }));
  },

  async updateBonusLinkage(
    id: string,
    patch: Partial<BonusLinkage>,
  ): Promise<BonusLinkage> {
    const b = inMemoryBonusLinkages.find((x) => x.id === id);
    if (!b) throw new Error("Bonus linkage not found");
    Object.assign(b, patch);
    return clone(b);
  },

  async triggerBonusLinkage(id: string): Promise<BonusLinkage> {
    const b = inMemoryBonusLinkages.find((x) => x.id === id);
    if (!b) throw new Error("Bonus linkage not found");
    b.triggeredCount += 1;
    b.lastTriggeredAt = new Date().toISOString();
    return clone(b);
  },

  // ============ 模板评分 (4 点) —— 本地演示 ============
  async listTemplates(): Promise<TemplateScoreRule[]> {
    return clone(TEMPLATE_SCORE_RULES).map((tpl) => ({
      ...tpl,
      source: "demo" as const,
    }));
  },

  async scoreTemplate(
    templateId: string,
    submission?: ScoringSubmission,
  ): Promise<ScoreTemplateResult> {
    const sub = submission ?? SAMPLE_SUBMISSIONS[0]!;
    return computeTemplateScore(templateId, sub);
  },

  async scoreTemplateBatch(
    templateId: string,
    submissions: ScoringSubmission[],
  ): Promise<ScoreTemplateResult[]> {
    return submissions.map((s) => computeTemplateScore(templateId, s));
  },

  // ============ KPI —— 本地演示 ============
  async getKPI(): Promise<QualityScoringKPI> {
    return { ...clone(SCORING_KPI), source: "demo" };
  },

  // ============ 提交样例 ============
  async listSampleSubmissions(): Promise<ScoringSubmission[]> {
    return clone(SAMPLE_SUBMISSIONS);
  },
};

export type ScoringService = typeof scoringService;
export default scoringService;
