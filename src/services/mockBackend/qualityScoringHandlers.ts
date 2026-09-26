/**
 * G005 RIS v3.0.5.1 - MSW Handlers for R3.QUALITY.SCORING
 *
 * 20 handlers: 15 维度评分 (60点) + 阈值/历史/报表/奖励联动/模板 (20点)
 * [v3.0.6.12-B3] top-5 高频路由 (dimensions / evaluate / scores/:id / kpi / threshold-config) 读写 store
 */
import { http, HttpResponse, delay } from 'msw';
import { v4 as uuidv4 } from 'uuid';
// [v3.0.6.12-B3] top-5 路由从 store 读写
import { list, get, create } from './store';

// v3.0.6.8-105-fix: vitest/jsdom 下 window.location.origin 可能不是 localhost:5173,
//   会导致 MSW 拦截不到 fetch. 与 handlers.ts 同源: 加 process.env.VITEST 短路.
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1');

const isoNow = () => new Date().toISOString();
const isoOffset = (h: number) => new Date(Date.now() + h * 3600 * 1000).toISOString();

const success = (data: unknown, status = 200) =>
  HttpResponse.json({ success: true, data }, { status });

// [v3.0.6.12-B3] 同步路径下从 store 不可用时的硬编码 fallback (与原 SCORING_DIMENSIONS_MOCK 等价,
//   保证 vitest/jsdom 在 store 初始化前访问时仍返回非空数据)
const SCORING_DIMENSIONS_FALLBACK = [
  { key: 'completeness_findings', category: 'completeness', name: '检查所见完整性', weight: 0.04 },
  { key: 'completeness_impression', category: 'completeness', name: '诊断印象完整性', weight: 0.04 },
  { key: 'completeness_recommendation', category: 'completeness', name: '建议完整性', weight: 0.03 },
  { key: 'completeness_structured', category: 'completeness', name: '结构化字段完整', weight: 0.05 },
  { key: 'completeness_signature', category: 'completeness', name: '签名完整', weight: 0.04 },
  { key: 'accuracy_diagnosis_match', category: 'accuracy', name: '所见-诊断一致', weight: 0.06 },
  { key: 'accuracy_anatomy_laterality', category: 'accuracy', name: '解剖方位正确', weight: 0.04 },
  { key: 'accuracy_clinical_reference', category: 'accuracy', name: '结合临床', weight: 0.04 },
  { key: 'accuracy_critical_marking', category: 'accuracy', name: '危急值标记', weight: 0.04 },
  { key: 'accuracy_no_contradiction', category: 'accuracy', name: '无逻辑矛盾', weight: 0.02 },
  { key: 'timeliness_tat_met', category: 'timeliness', name: 'TAT 达标', weight: 0.08 },
  { key: 'timeliness_priority_handling', category: 'timeliness', name: '优先级处理', weight: 0.04 },
  { key: 'timeliness_on_time_rate', category: 'timeliness', name: '个人按时率', weight: 0.04 },
  { key: 'timeliness_submit_within_window', category: 'timeliness', name: '提交及时', weight: 0.02 },
  { key: 'timeliness_sign_within_window', category: 'timeliness', name: '签发及时', weight: 0.02 },
];

// [G005 demo] 30 天评分趋势 seed (确定性, 无 Math.random), 保证 KPI 折线/卡片非空
function buildTrend30d(): Array<{ date: string; avgScore: number; evaluated: number; gradeA: number }> {
  const base = Date.UTC(2026, 7, 25); // 2026-08-25
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(base + i * 86400000);
    return {
      date: d.toISOString().slice(0, 10),
      avgScore: 85 + ((i * 7 + 3) % 8),
      evaluated: 30 + ((i * 5 + 11) % 20),
      gradeA: 12 + ((i * 3 + 2) % 8),
    };
  });
}

// [v3.0.6.12-B3] 读 store 失败/空时返回的硬编码 KPI 快照
const KPI_FALLBACK = {
  totalEvaluated: 1248,
  avgTotal: 88.6,
  publishableRate: 81.7,
  bonusEligibleRate: 41.3,
  gradeDistribution: { A: 542, B: 478, C: 168, D: 60 },
  trend30d: buildTrend30d(),
};

// [v3.0.6.12-B3] 读 store 失败/空时返回的硬编码阈值配置
const THRESHOLD_CONFIG_FALLBACK = {
  id: 'default',
  criticalMaxMinutes: 30,
  emergencyMaxHours: 2,
  routineMaxHours: 24,
  inpatientMaxHours: 12,
  publishBlockThreshold: 60,
  bonusThreshold: 85,
  hardFailCodes: ['critical-not-marked', 'left-right-confusion'],
  version: 5,
  updatedAt: isoOffset(-72),
  updatedBy: 'D001',
};

// [v3.0.6.12-B3] 顶层统一包装: 任何 store 异常都降级到 fallback, 不破坏路由响应
function safeListDimensions(): Array<{ id: string; key: string; category: string; name: string; weight: number }> {
  try {
    const items = list<{ id: string; key: string; category: string; name: string; weight: number }>('quality_dimensions');
    return items.length > 0 ? items : SCORING_DIMENSIONS_FALLBACK as any;
  } catch {
    return SCORING_DIMENSIONS_FALLBACK as any;
  }
}

export const qualityScoringHandlers = [
  // ========== 1. 15 维度 (60 点) ==========
  // 1.1 列出 15 维度   [v3.0.6.12-B3] 从 store 读 quality_dimensions
  http.get(`${API_BASE}/quality/scoring/dimensions`, async () => {
    await delay(120);
    return success(safeListDimensions());
  }),

  // 1.2 单维度详情
  http.get(`${API_BASE}/quality/scoring/dimensions/:key`, async ({ params }) => {
    await delay(80);
    let dim: any = null;
    try { dim = get<any>('quality_dimensions', String(params.key)) ?? null; } catch {}
    if (!dim) dim = SCORING_DIMENSIONS_FALLBACK.find((d) => d.key === params.key) ?? null;
    return success(dim);
  }),

  // 1.3 维度启用/禁用
  

  // 1.4 单维度重新评分
  

  // 1.5 触发评分 (核心)   [v3.0.6.12-B3] 写入 store quality_scores
  http.post(`${API_BASE}/quality/scoring/evaluate`, async ({ request }) => {
    await delay(400);
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const reportId = String(body.reportId ?? 'rpt-' + uuidv4().slice(0, 8));
    // [v3.0.6.12-B3] 维度基础权重优先来自 store, fallback 到硬编码
    const dimensions = safeListDimensions();
    const dimensionScores: Record<string, number> = {};
    dimensions.forEach((d) => {
      dimensionScores[d.key] = Math.round(80 + Math.random() * 18);
    });
    const totalScore = Math.round(
      (Object.entries(dimensionScores) as Array<[string, number]>).reduce(
        (sum, [k, v]) => sum + v * (dimensions.find((d) => d.key === k)?.weight ?? 0),
        0,
      ) * 100,
    ) / 100;
    const scoreId = 'qs-' + uuidv4().slice(0, 8);
    const item = {
      id: scoreId,
      scoreId,
      reportId,
      dimensionScores,
      categoryScores: {
        completeness: 92,
        accuracy: 90,
        timeliness: 88,
      },
      totalScore,
      grade: totalScore >= 90 ? 'A' : totalScore >= 75 ? 'B' : totalScore >= 60 ? 'C' : 'D',
      passed: totalScore >= 60,
      publishable: totalScore >= 60,
      bonusEligible: totalScore >= 85,
      hardFailTriggered: [],
      evaluatedAt: isoNow(),
      modelVersion: 'scoring-v3.0.5.1',
      evaluator: 'auto',
      durationMs: 320,
    };
    try { create('quality_scores', item); } catch {}
    return success(item);
  }),

  // 1.6 批量评分
  

  // 1.7 评分结果详情   [v3.0.6.12-B3] 读 store quality_scores
  http.get(`${API_BASE}/quality/scoring/scores/:id`, async ({ params }) => {
    await delay(120);
    const id = String(params.id);
    let stored: any = null;
    try { stored = get<any>('quality_scores', id); } catch {}
    if (stored) return success(stored);
    // [v3.0.6.12-B3] 兜底: 兼容 GET 一个不存在的旧 id (例如 E2E 用 'mock-1' 之类) 时不报 404
    const dimensions = safeListDimensions();
    const dimensionScores: Record<string, number> = {};
    dimensions.forEach((d) => { dimensionScores[d.key] = 85 + Math.random() * 12; });
    return success({
      id,
      scoreId: id,
      reportId: 'rpt-' + uuidv4().slice(0, 8),
      dimensionScores,
      totalScore: 92,
      grade: 'A',
      evaluatedAt: isoOffset(-2),
    });
  }),

  // 1.8 评分 KPI   [v3.0.6.12-B3] 读 store quality_kpi
  // [G005 demo] trend30d 为空时回退 30 点 seed (store seed 或 fallback 均已填充, 此处为双保险)
  http.get(`${API_BASE}/quality/scoring/kpi`, async () => {
    await delay(150);
    let data: any = null;
    try { data = get<any>('quality_kpi', 'current'); } catch {}
    const base = data ?? KPI_FALLBACK;
    const trend30d = Array.isArray(base?.trend30d) && base.trend30d.length > 0
      ? base.trend30d
      : buildTrend30d();
    return success({ ...base, trend30d });
  }),

  // ========== 2. 阈值配置 (4 点) ==========
  // [v3.0.6.12-B3] 读 store quality_threshold_config
  http.get(`${API_BASE}/quality/scoring/threshold-config`, async () => {
    await delay(100);
    let data: any = null;
    try { data = get<any>('quality_threshold_config', 'default'); } catch {}
    return success(data ?? THRESHOLD_CONFIG_FALLBACK);
  }),

  // [v3.0.6.12-B3] threshold-config PUT 同时写 store, 保持 GET/PUT 一致
  http.put(`${API_BASE}/quality/scoring/threshold-config`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as Record<string, unknown>;
    const item = { ...body, id: 'default', version: 6, updatedAt: isoNow() };
    try { create('quality_threshold_config', item); } catch {}
    return success(item);
  }),

  // ========== 3. 评分历史 (4 点) ==========
  

  // ========== 4. 报告生成 (4 点) ==========
  

  

  // ========== 5. 奖励联动 (4 点) ==========
  

  

  

  // ========== 6. 模板评分 (4 点) ==========
  

  

  
];