/**
 * G005 放射RIS系统 v3.0.5.1 - R3.AI 智能 Service (全 mock)
 * A5-REPORT / 80 点
 *
 * 全部 mock 实现，延迟 200-1500ms 模拟推理时间。
 */

import type {
  AIDraftResult,
  AIPreReview,
  AIRiskPrediction,
  AIDifferentialDx,
  AISynonymSuggestion,
  AILesionDetection,
  AIUsageLog,
  AIHealth,
  AIQuota,
  AIUsageRank,
  AIReference,
  AIScenario,
  AIDraftStage,
  AIConfidenceLevel,
} from '../../types/R3/R3.AI';
import { api } from '../api/client';
import {
  AI_DRAFTS,
  AI_PRE_REVIEWS,
  AI_RISK_PREDICTIONS,
  AI_DIFFERENTIAL_DXS,
  AI_SYNONYM_SUGGESTIONS,
  AI_LESION_DETECTIONS,
  AI_USAGE_LOGS,
  AI_HEALTH,
  AI_QUOTAS,
  AI_USAGE_RANK,
  AI_SCENARIO_DETAILS,
  AI_ERROR_LOGS,
  AI_CONTINUATION_CANDIDATES,
} from '../../data/reportAIMock';

const MIN_DELAY_MS = 200;
const MAX_DELAY_MS = 1500;

// [G005 BackendParity] 场景 → 后端 POST /ai/generate 请求字段映射
const SCENARIO_TARGET: Record<AIScenario, { modality: string; bodyPart: string }> = {
  'chest-ct': { modality: 'CT', bodyPart: '胸部' },
  'head-mri': { modality: 'MR', bodyPart: '头颅' },
  'abdomen-ct': { modality: 'CT', bodyPart: '腹部' },
  'spine-mri': { modality: 'MR', bodyPart: '脊柱' },
  'breast-mg': { modality: 'MG', bodyPart: '乳腺' },
  'cardiac-cta': { modality: 'CT', bodyPart: '心脏' },
};

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function randomDelay(min = MIN_DELAY_MS, max = MAX_DELAY_MS): Promise<void> {
  return delay(min + Math.random() * (max - min));
}

function nowIso(): string {
  return new Date().toISOString();
}

function uuid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function logUsage(entry: Omit<AIUsageLog, 'id' | 'calledAt'>): void {
  const log: AIUsageLog = {
    ...entry,
    id: uuid('usage'),
    calledAt: nowIso(),
  };
  AI_USAGE_LOGS.push(log);
  if (AI_USAGE_LOGS.length > 500) AI_USAGE_LOGS.shift();
}

export interface GenerateDraftParams {
  scenario: AIScenario;
  clinicalHistory: string;
  reportId?: string;
}

export interface GenerateDraftProgress {
  stage: AIDraftStage;
  percent: number;
  message: string;
}

export class AIService {
  async generateDraft(
    params: GenerateDraftParams,
    onProgress?: (p: GenerateDraftProgress) => void
  ): Promise<AIDraftResult> {
    const stages: GenerateDraftProgress[] = [
      { stage: 'extracting-history', percent: 15, message: '提取病史' },
      { stage: 'analyzing-images', percent: 35, message: '分析影像' },
      { stage: 'generating-findings', percent: 55, message: '生成所见' },
      { stage: 'generating-diagnosis', percent: 75, message: '生成诊断' },
      { stage: 'generating-impression', percent: 90, message: '生成意见' },
      { stage: 'post-processing', percent: 98, message: '后处理' },
      { stage: 'done', percent: 100, message: '完成' },
    ];

    const start = Date.now();
    for (const s of stages) {
      onProgress?.(s);
      await delay(140 + Math.random() * 160);
    }

    // [G005 BackendParity] 优先真实后端 POST /ai/generate; 失败/空响应回退本地确定性生成
    const remote = await this.generateFromBackend(params, start);
    if (remote) {
      logUsage({
        userId: 'current',
        reportId: remote.reportId,
        endpoint: '/api/v1/ai/generate',
        requestTokens: remote.tokenUsage.prompt,
        responseTokens: remote.tokenUsage.completion,
        processingMs: remote.processingMs,
        success: true,
      });
      return remote;
    }

    const template = AI_SCENARIO_DETAILS[params.scenario];
    const references: AIReference[] = template.radsSystem
      ? [
          { id: 'ref-' + uuid('r'), title: `${template.radsSystem} 分类标准`, source: 'ACR', year: 2022 },
        ]
      : [];

    const result: AIDraftResult = {
      id: uuid('aidraft'),
      reportId: params.reportId ?? 'new-' + Date.now().toString(36),
      scenario: params.scenario,
      clinicalHistory: params.clinicalHistory,
      findings: template.templateFindings.replace('{finding}', '本次检查所见详见描述'),
      diagnosis: template.templateDiagnosis.replace('{finding}', '详见所见').replace('{category}', '3'),
      impression: 'AI 生成的诊断意见，请医师核对后采纳。',
      recommendations: '随访建议',
      confidence: {
        overall: 0.78 + Math.random() * 0.15,
        findings: 0.8 + Math.random() * 0.15,
        diagnosis: 0.75 + Math.random() * 0.15,
        impression: 0.8 + Math.random() * 0.15,
        level: 'medium',
      },
      references,
      generatedAt: nowIso(),
      modelVersion: 'v2.3-mock',
      tokenUsage: { prompt: 200 + Math.floor(Math.random() * 100), completion: 400 + Math.floor(Math.random() * 200), total: 600 + Math.floor(Math.random() * 300) },
      processingMs: Date.now() - start,
    };

    logUsage({
      userId: 'current',
      reportId: result.reportId,
      endpoint: '/api/v1/ai/generate',
      requestTokens: result.tokenUsage.prompt,
      responseTokens: result.tokenUsage.completion,
      processingMs: result.processingMs,
      success: true,
    });

    return result;
  }

  /**
   * [G005 BackendParity] 调用后端 POST /ai/generate。
   * 兼容三种响应形状:
   *  1. 真实 NestJS `{ provider, sections:[{heading,content}], confidence }`
   *  2. MSW 完整草稿形状 AIDraftResult
   *  3. MSW 提示词形状 `{ content, usage }`
   * 任何异常/空响应返回 null, 由调用方回退本地生成。
   */
  private async generateFromBackend(
    params: GenerateDraftParams,
    start: number
  ): Promise<AIDraftResult | null> {
    try {
      const target = SCENARIO_TARGET[params.scenario];
      const res = await api.post<unknown>('/ai/generate', {
        modality: target.modality,
        bodyPart: target.bodyPart,
        findings: params.clinicalHistory,
        clinicalHistory: params.clinicalHistory,
      });
      if (!res.success || res.data == null) return null;
      const data = res.data as Record<string, unknown>;

      // 形状 2: 已完整返回草稿
      if (
        typeof data.findings === 'string' &&
        typeof data.impression === 'string'
      ) {
        return { ...(data as unknown as AIDraftResult) };
      }

      // 形状 1: sections 数组
      const sections = Array.isArray(data.sections)
        ? (data.sections as Array<{ heading?: string; content?: string }>)
        : [];
      const pick = (keys: string[]): string =>
        sections.find((s) => keys.some((k) => (s.heading ?? '').includes(k)))
          ?.content ?? '';
      const findings =
        pick(['影像所见', '所见']) ||
        (typeof data.content === 'string' ? data.content : '');
      const impression = pick(['影像诊断', '诊断意见', '意见', '印象']);
      if (!findings && !impression) return null;

      const rawConfidence =
        typeof data.confidence === 'number' ? data.confidence : 0.85;
      const level: AIConfidenceLevel =
        rawConfidence >= 0.85 ? 'high' : rawConfidence >= 0.6 ? 'medium' : 'low';
      return {
        id: uuid('aidraft'),
        reportId: params.reportId ?? 'new-' + Date.now().toString(36),
        scenario: params.scenario,
        clinicalHistory: params.clinicalHistory,
        findings,
        diagnosis: impression,
        impression,
        recommendations: pick(['建议']),
        confidence: {
          overall: rawConfidence,
          findings: rawConfidence,
          diagnosis: rawConfidence,
          impression: rawConfidence,
          level,
        },
        references: [],
        generatedAt: nowIso(),
        modelVersion: `backend:${typeof data.provider === 'string' ? data.provider : 'mock'}`,
        tokenUsage: { prompt: 0, completion: 0, total: 0 },
        processingMs: Date.now() - start,
      };
    } catch {
      return null;
    }
  }

  async listDrafts(): Promise<AIDraftResult[]> {
    await randomDelay(150, 300);
    return [...AI_DRAFTS];
  }

  async continueWriting(prefix: string): Promise<{ candidates: string[]; processingMs: number }> {
    const start = Date.now();
    await randomDelay();
    return {
      candidates: AI_CONTINUATION_CANDIDATES.map((c) => prefix + c),
      processingMs: Date.now() - start,
    };
  }

  async rewrite(text: string, mode: 'rewrite' | 'expand' | 'shorten' | 'translate'): Promise<{ result: string; processingMs: number }> {
    const start = Date.now();
    await randomDelay();
    const result =
      mode === 'expand'
        ? text + '，详见影像所见。'
        : mode === 'shorten'
          ? text.split('，').slice(0, 2).join('，')
          : mode === 'translate'
            ? `[EN] ${text}`
            : text.replace(/，。/g, '。');
    return { result, processingMs: Date.now() - start };
  }

  async preReview(reportId: string): Promise<AIPreReview | null> {
    await randomDelay();
    return AI_PRE_REVIEWS.find((p) => p.reportId === reportId) ?? null;
  }

  async listPreReviews(): Promise<AIPreReview[]> {
    await randomDelay();
    return [...AI_PRE_REVIEWS];
  }

  async detectDefects(text: string): Promise<{ defects: AIPreReview['defects']; processingMs: number }> {
    const start = Date.now();
    await randomDelay();
    const defects: AIPreReview['defects'] = [];
    if (text.length < 20) {
      defects.push({ id: uuid('def'), type: 'missing-key-finding', field: 'examFindings', severity: 'medium', description: '内容过短，建议补充' });
    }
    if (text.includes('考虑')) {
      defects.push({ id: uuid('def'), type: 'terminology-error', field: 'diagnosis', severity: 'low', description: '"考虑"建议替换为更明确的诊断' });
    }
    return { defects, processingMs: Date.now() - start };
  }

  async detectCritical(text: string): Promise<{ hits: AIPreReview['criticalHits']; processingMs: number }> {
    const start = Date.now();
    await randomDelay();
    const criticalKeywords = ['脑疝', '主动脉夹层', '肺栓塞', '气胸', 'D-二聚体升高'];
    const hits = criticalKeywords
      .filter((kw) => text.includes(kw))
      .map((kw) => ({
        id: uuid('crit'),
        keyword: kw,
        matchType: 'exact' as const,
        field: 'examFindings',
        confidence: 0.9,
        recommendation: '疑似危急值，建议双签',
      }));
    return { hits, processingMs: Date.now() - start };
  }

  async getSynonyms(text: string): Promise<AISynonymSuggestion[]> {
    await randomDelay(300, 700);
    return AI_SYNONYM_SUGGESTIONS.filter((s) => text.includes(s.original));
  }

  async findSimilar(reportId: string): Promise<AIDifferentialDx['similarCases']> {
    await randomDelay();
    const ddx = AI_DIFFERENTIAL_DXS.find((d) => d.reportId === reportId);
    return ddx?.similarCases ?? [];
  }

  async detectLesions(reportId: string): Promise<AILesionDetection | null> {
    await randomDelay();
    return AI_LESION_DETECTIONS.find((l) => l.reportId === reportId) ?? null;
  }

  async listLesions(): Promise<AILesionDetection[]> {
    await randomDelay();
    return [...AI_LESION_DETECTIONS];
  }

  async predictRisk(reportId: string): Promise<AIRiskPrediction | null> {
    await randomDelay();
    return AI_RISK_PREDICTIONS.find((r) => r.reportId === reportId) ?? null;
  }

  async listRiskPredictions(): Promise<AIRiskPrediction[]> {
    await randomDelay();
    return [...AI_RISK_PREDICTIONS];
  }

  async differentialDx(reportId: string): Promise<AIDifferentialDx | null> {
    await randomDelay();
    return AI_DIFFERENTIAL_DXS.find((d) => d.reportId === reportId) ?? null;
  }

  async listDifferentialDx(): Promise<AIDifferentialDx[]> {
    await randomDelay();
    return [...AI_DIFFERENTIAL_DXS];
  }

  async correctErrors(text: string): Promise<{ corrected: string; errors: { id: string; field: string; description: string }[]; processingMs: number }> {
    const start = Date.now();
    await randomDelay(400, 800);
    const errors: { id: string; field: string; description: string }[] = [];
    if (text.includes('的的')) errors.push({ id: uuid('err'), field: 'examFindings', description: '"的的"为重复字' });
    if (text.includes('做做')) errors.push({ id: uuid('err'), field: 'examFindings', description: '"做做"为重复字' });
    return {
      corrected: text.replace(/的的/g, '的').replace(/做做/g, '做'),
      errors,
      processingMs: Date.now() - start,
    };
  }

  async getHealth(): Promise<AIHealth> {
    await delay(80);
    return { ...AI_HEALTH, checkedAt: nowIso(), avgLatencyMs: 700 + Math.floor(Math.random() * 200) };
  }

  async getQuota(userId: string): Promise<AIQuota | null> {
    await delay(80);
    return AI_QUOTAS.find((q) => q.userId === userId) ?? null;
  }

  async listQuotas(): Promise<AIQuota[]> {
    await delay(100);
    return [...AI_QUOTAS];
  }

  async listUsageRank(): Promise<AIUsageRank[]> {
    await delay(150);
    return [...AI_USAGE_RANK];
  }

  async listUsageLogs(): Promise<AIUsageLog[]> {
    await delay(120);
    return [...AI_USAGE_LOGS];
  }

  async listErrorLogs(): Promise<typeof AI_ERROR_LOGS> {
    await delay(100);
    return [...AI_ERROR_LOGS];
  }

  async evaluate(): Promise<{ acceptanceRate: number; avgLatencyMs: number; totalCalls: number; period: string }> {
    await delay(150);
    return { acceptanceRate: 0.785, avgLatencyMs: 850, totalCalls: 4128, period: 'month' };
  }

  getOrchestrator(): AIOrchestrator {
    return _orchestratorInstance;
  }

  getMarketplace(): MarketplaceService {
    return _marketplaceInstance;
  }

  getStreaming(): StreamingClient {
    return _streamingInstance;
  }
}

import { AIOrchestrator } from './orchestrator/AIOrchestrator';
import { MarketplaceService } from './marketplace/MarketplaceService';
import { StreamingClient } from './streaming/StreamingClient';

const _orchestratorInstance = new AIOrchestrator();
const _marketplaceInstance = new MarketplaceService();
const _streamingInstance = new StreamingClient();

export const aiService = new AIService();