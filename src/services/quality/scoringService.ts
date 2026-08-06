/**
 * G005 RIS v3.0.5.1 - R3.QUALITY.SCORING 质控评分服务
 *
 * 80 点: 15 维度评分 + 5 个辅助能力(阈值/历史/报表/奖励联动/模板)
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
  evaluateScoring,
  computeTemplateScore,
  getScoreHistory,
} from '../../data/qualityScoringMock';
import type { ScoringDimension, ScoringThresholdConfig, ThresholdConfig, ScoreHistoryEntry, ScoreHistoryQuery, ScoreHistoryResponse, BonusLinkage, TemplateScoreRule, ScoreTemplateResult, QualityScoringKPI, ScoringEvaluationResult, ScoringSubmission, QualityScoreReport, ScoringDimensionKey } from '../../types/R3/R3.QUALITY.SCORING';

const LATENCY_MIN = 120;
const LATENCY_MAX = 800;
const randomLatency = () => Math.floor(Math.random() * (LATENCY_MAX - LATENCY_MIN)) + LATENCY_MIN;
const wait = (ms?: number) => new Promise<void>((r) => setTimeout(r, ms ?? randomLatency()));
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const uuid = () => 'qs-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

const inMemoryThreshold: ThresholdConfig = clone(INITIAL_THRESHOLD_CONFIG);
const inMemoryEvaluations: ScoringEvaluationResult[] = [];
const inMemoryHistory: ScoreHistoryEntry[] = clone(SCORE_HISTORY);
const inMemoryBonus: BonusLinkage[] = clone(BONUS_LINKAGES);

export const scoringService = {
  // ============ 维度 (60 点核心: 15 维度) ============
  async listDimensions(): Promise<ScoringDimension[]> {
    await wait();
    return clone(SCORING_DIMENSIONS);
  },

  async getThresholds(): Promise<ScoringThresholdConfig[]> {
    await wait();
    return clone(SCORING_THRESHOLDS);
  },

  async evaluate(submission: ScoringSubmission): Promise<ScoringEvaluationResult> {
    await wait(400);
    const result = evaluateScoring(submission, inMemoryThreshold);
    inMemoryEvaluations.unshift(clone(result));
    const historyEntry: ScoreHistoryEntry = {
      id: 'sh-' + uuid(),
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
      trigger: 'manual',
      deltaVsPrev: 0,
    };
    inMemoryHistory.unshift(historyEntry);
    return clone(result);
  },

  async batchEvaluate(submissions: ScoringSubmission[]): Promise<ScoringEvaluationResult[]> {
    await wait(1200);
    return submissions.map((s) => {
      const r = evaluateScoring(s, inMemoryThreshold);
      inMemoryEvaluations.unshift(clone(r));
      return clone(r);
    });
  },

  async evaluateSample(sampleIndex = 0): Promise<ScoringEvaluationResult> {
    await wait(400);
    const sub = SAMPLE_SUBMISSIONS[sampleIndex] ?? SAMPLE_SUBMISSIONS[0];
    return scoringService.evaluate(sub);
  },

  // ============ 阈值配置 (4 点) ============
  async getThresholdConfig(): Promise<ThresholdConfig> {
    await wait();
    return clone(inMemoryThreshold);
  },

  async updateThresholdConfig(patch: Partial<ThresholdConfig>, userId: string): Promise<ThresholdConfig> {
    await wait();
    Object.assign(inMemoryThreshold, patch);
    inMemoryThreshold.version += 1;
    inMemoryThreshold.updatedAt = new Date().toISOString();
    inMemoryThreshold.updatedBy = userId;
    return clone(inMemoryThreshold);
  },

  // ============ 评分历史 (4 点) ============
  async getHistory(query: ScoreHistoryQuery = {}): Promise<ScoreHistoryResponse> {
    await wait();
    const base = getScoreHistory(query);
    const items = base.items.map((entry) => {
      const extra = inMemoryHistory.find((h) => h.scoreId === entry.scoreId);
      return extra ?? entry;
    });
    return { ...base, items };
  },

  async getScoreById(scoreId: string): Promise<ScoringEvaluationResult | null> {
    await wait();
    const found = inMemoryEvaluations.find((e) => e.scoreId === scoreId);
    return found ? clone(found) : null;
  },

  // ============ 报告生成 (4 点) ============
  async generateReport(
    scoreId: string,
    format: QualityScoreReport['format'],
    userId: string,
  ): Promise<QualityScoreReport> {
    await wait(800);
    const evaluation = inMemoryEvaluations.find((e) => e.scoreId === scoreId);
    const fallback: ScoringEvaluationResult = evaluation ?? {
      scoreId,
      reportId: 'rpt-unknown',
      dimensionScores: {} as Record<ScoringDimensionKey, number>,
      categoryScores: { completeness: 90, accuracy: 92, timeliness: 88 },
      weightedTotal: 90,
      totalScore: 90,
      grade: 'A',
      passed: true,
      publishable: true,
      bonusEligible: true,
      hardFailTriggered: [],
      evaluatedAt: new Date().toISOString(),
      modelVersion: 'scoring-v3.0.5.1',
      evaluator: 'auto',
      evidence: [],
      durationMs: 0,
    };
    const dims = SCORING_DIMENSIONS;
    const items: QualityScoreReport['items'] = dims.map((dim) => {
      const raw = fallback.dimensionScores[dim.key] ?? 0;
      return {
        dimension: dim.key,
        category: dim.category,
        name: dim.name,
        score: raw,
        weight: dim.weight,
        weightedScore: Math.round(raw * dim.weight * 100) / 100,
        issues: fallback.hardFailTriggered.length > 0 ? [{ code: fallback.hardFailTriggered[0]!, description: '一票否决', severity: 'critical' }] : [],
      };
    });
    const catWeights = {
      completeness: dims.filter((d) => d.category === 'completeness').reduce((a, d) => a + d.weight, 0),
      accuracy: dims.filter((d) => d.category === 'accuracy').reduce((a, d) => a + d.weight, 0),
      timeliness: dims.filter((d) => d.category === 'timeliness').reduce((a, d) => a + d.weight, 0),
    };
    const threshold = inMemoryThreshold;
    const summary: QualityScoreReport['summary'] = {
      strengths: dims.filter((d) => (fallback.dimensionScores[d.key] ?? 0) >= 90).map((d) => d.name),
      weaknesses: dims.filter((d) => (fallback.dimensionScores[d.key] ?? 0) < 75).map((d) => d.name),
      recommendations: [],
    };
    if (fallback.totalScore < threshold.publishBlockThreshold) {
      summary.recommendations.push('总分低于发布阈值,请修改后重新提交');
    }
    if (fallback.hardFailTriggered.length > 0) {
      summary.recommendations.push('存在一票否决项: ' + fallback.hardFailTriggered.join(', '));
    }
    const report: QualityScoreReport = {
      id: 'rep-' + uuid(),
      scoreId,
      reportId: fallback.reportId,
      generatedAt: new Date().toISOString(),
      generatedBy: userId,
      totalScore: fallback.totalScore,
      grade: fallback.grade,
      categoryScores: {
        completeness: { raw: fallback.categoryScores.completeness, weighted: fallback.categoryScores.completeness * catWeights.completeness, weight: catWeights.completeness },
        accuracy: { raw: fallback.categoryScores.accuracy, weighted: fallback.categoryScores.accuracy * catWeights.accuracy, weight: catWeights.accuracy },
        timeliness: { raw: fallback.categoryScores.timeliness, weighted: fallback.categoryScores.timeliness * catWeights.timeliness, weight: catWeights.timeliness },
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

  // ============ 奖励联动 (4 点) ============
  async listBonusLinkages(): Promise<BonusLinkage[]> {
    await wait();
    return clone(inMemoryBonus);
  },

  async updateBonusLinkage(id: string, patch: Partial<BonusLinkage>): Promise<BonusLinkage> {
    await wait();
    const b = inMemoryBonus.find((x) => x.id === id);
    if (!b) throw new Error('Bonus linkage not found');
    Object.assign(b, patch);
    return clone(b);
  },

  async triggerBonusLinkage(id: string): Promise<BonusLinkage> {
    await wait(300);
    const b = inMemoryBonus.find((x) => x.id === id);
    if (!b) throw new Error('Bonus linkage not found');
    b.triggeredCount += 1;
    b.lastTriggeredAt = new Date().toISOString();
    return clone(b);
  },

  // ============ 模板评分 (4 点) ============
  async listTemplates(): Promise<TemplateScoreRule[]> {
    await wait();
    return clone(TEMPLATE_SCORE_RULES);
  },

  async scoreTemplate(templateId: string, submission?: ScoringSubmission): Promise<ScoreTemplateResult> {
    await wait(400);
    const sub = submission ?? SAMPLE_SUBMISSIONS[0]!;
    return computeTemplateScore(templateId, sub);
  },

  async scoreTemplateBatch(templateId: string, submissions: ScoringSubmission[]): Promise<ScoreTemplateResult[]> {
    await wait(1000);
    return submissions.map((s) => computeTemplateScore(templateId, s));
  },

  // ============ KPI ============
  async getKPI(): Promise<QualityScoringKPI> {
    await wait();
    return clone(SCORING_KPI);
  },

  // ============ 提交样例 ============
  async listSampleSubmissions(): Promise<ScoringSubmission[]> {
    await wait();
    return clone(SAMPLE_SUBMISSIONS);
  },
};

export type ScoringService = typeof scoringService;
export default scoringService;