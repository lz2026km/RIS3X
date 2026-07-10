// [v3.0.6.11-20] OLAP handler: 13 measures 完整支持
// 数据源:
//   - 优先: src/data/kpiHistory.ts (36 个 KPI × 1096 天 = 39,456 条)
//   - 兜底: store 内存集合 (exams / reports / criticalEvents / qualityScores)
import { http, HttpResponse, delay } from 'msw';
import { list } from './store';
import { KPI_HISTORY } from '../../data/kpiHistory';

// ============================================================
// Metadata
// ============================================================
export const DIMENSIONS = [
  { id: 'date', name: '日期', type: 'date', description: '检查日期' },
  { id: 'modality', name: '检查类型', type: 'categorical', description: '设备模态 (CT/MR/DR/MG/DSA)' },
  { id: 'device', name: '设备', type: 'categorical', description: '检查设备名称' },
  { id: 'doctor', name: '医生', type: 'categorical', description: '报告医生/审核医生' },
  { id: 'department', name: '科室', type: 'categorical', description: '申请科室/检查科室' },
  { id: 'body_part', name: '检查部位', type: 'categorical', description: '检查身体部位' },
  { id: 'age_group', name: '年龄分组', type: 'categorical', description: '患者年龄段' },
  { id: 'gender', name: '性别', type: 'categorical', description: '患者性别' },
  { id: 'patient_type', name: '患者类型', type: 'categorical', description: '门诊/住院/急诊/体检' },
  { id: 'report_state', name: '报告状态', type: 'categorical', description: '报告当前状态' },
];

export const METRICS = [
  { id: 'exam_count', name: '检查量', dimension: 'exam', aggregation: 'sum', format: 'number', unit: '例', description: '检查总人次' },
  { id: 'exam_revenue', name: '检查收入', dimension: 'exam', aggregation: 'sum', format: 'currency', unit: '元', description: '检查总收入金额' },
  { id: 'report_count', name: '报告量', dimension: 'report', aggregation: 'sum', format: 'number', unit: '份', description: '报告总数' },
  { id: 'report_overtime', name: '超时报告数', dimension: 'report', aggregation: 'sum', format: 'number', unit: '份', description: '超出SLA未签发报告数' },
  { id: 'quality_score_avg', name: '平均质控评分', dimension: 'quality', aggregation: 'avg', format: 'decimal', unit: '分', description: '质控平均得分' },
  { id: 'critical_count', name: '危急值数量', dimension: 'critical', aggregation: 'sum', format: 'number', unit: '例', description: '危急值报告数' },
  { id: 'critical_response_time', name: '危急值及时率', dimension: 'critical', aggregation: 'avg', format: 'percent', unit: '%', description: '危急值通知及时率(响应时间反指标)' },
  { id: 'device_usage_rate', name: '设备使用率', dimension: 'device', aggregation: 'avg', format: 'percent', unit: '%', description: '设备平均使用率' },
  { id: 'patient_satisfaction', name: '患者满意度', dimension: 'survey', aggregation: 'avg', format: 'decimal', unit: '分', description: '患者满意度平均分' },
  { id: 'positive_rate', name: '阳性检出率', dimension: 'exam', aggregation: 'avg', format: 'percent', unit: '%', description: '影像诊断与最终诊断符合率' },
  { id: 'consultation_count', name: '会诊量', dimension: 'performance', aggregation: 'sum', format: 'number', unit: '例', description: '会诊例数(按检查量4%估算)' },
  { id: 'ai_adoption_rate', name: 'AI采纳率', dimension: 'ai', aggregation: 'avg', format: 'percent', unit: '%', description: 'AI辅助建议被医生采纳的比例' },
  { id: 'workload_avg', name: '人均工作量', dimension: 'performance', aggregation: 'avg', format: 'decimal', unit: '例', description: '单台设备日均检查量' },
];

const METRIC_IDS = new Set(METRICS.map((m) => m.id));

// ============================================================
// Measure → KPI 映射表
//   - sum:  周期内累加 daily value (例: 检查量、收入)
//   - avg:  周期内 daily value 的均值 (例: 质量分、使用率)
//   - derived: 自定义派生 (例: 会诊量 = 检查量 × 4%)
// ============================================================
type AggKind = 'sum' | 'avg' | 'derived';

interface MeasureCfg {
  kpiIds: string[];
  agg: AggKind;
  transform?: (sum: number, count: number) => number;
}

const MEASURE_TO_KPI: Record<string, MeasureCfg> = {
  exam_count:             { kpiIds: ['kpi-001'], agg: 'sum' },
  exam_revenue:           { kpiIds: ['kpi-060'], agg: 'sum' },
  report_count:           { kpiIds: ['kpi-002'], agg: 'sum' },
  report_overtime:        { kpiIds: ['kpi-013'], agg: 'sum' },
  quality_score_avg:      { kpiIds: ['kpi-021'], agg: 'avg' },
  critical_count:         { kpiIds: ['kpi-031'], agg: 'sum' },
  critical_response_time: { kpiIds: ['kpi-030'], agg: 'avg' },
  device_usage_rate:      { kpiIds: ['kpi-040'], agg: 'avg' },
  patient_satisfaction:   { kpiIds: ['kpi-071'], agg: 'avg' },
  positive_rate:          { kpiIds: ['kpi-023'], agg: 'avg' },
  consultation_count:     { kpiIds: ['kpi-001'], agg: 'derived', transform: (sum) => Math.round(sum * 0.04) },
  ai_adoption_rate:       { kpiIds: ['kpi-051'], agg: 'avg' },
  workload_avg:           { kpiIds: ['kpi-041'], agg: 'avg' },
};

// ============================================================
// Aggregation engine (pure functions, 可测试)
// ============================================================
export type Granularity = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface AggregationOptions {
  measures: string[];
  dimensions?: string[];
  granularity?: Granularity;
  filters?: Array<{ dimension: string; operator: string; value: unknown }>;
}

export interface AggregationResult {
  rows: Record<string, unknown>[];
  source: 'kpiHistory' | 'collection-fallback';
}

function getPeriodKey(date: string, granularity: Granularity): string {
  if (granularity === 'daily') return date;
  if (granularity === 'yearly') return date.substring(0, 4);
  if (granularity === 'weekly') {
    const d = new Date(date + 'T00:00:00Z');
    const year = d.getUTCFullYear();
    const start = Date.UTC(year, 0, 1);
    const dayOfYear = Math.floor((d.getTime() - start) / 86400000);
    const week = Math.floor(dayOfYear / 7) + 1;
    return `${year}-W${String(week).padStart(2, '0')}`;
  }
  return date.substring(0, 7);
}

function applyDateFilter(period: string, granularity: Granularity, filters: Array<{ dimension: string; operator: string; value: unknown }>): boolean {
  const dateFilter = filters?.find((f) => f.dimension === 'date' && f.operator === 'between');
  if (!dateFilter || !Array.isArray(dateFilter.value)) return true;
  const [start, end] = dateFilter.value as [string, string];
  if (granularity === 'monthly') {
    const ps = period;
    const ss = start.substring(0, 7);
    const es = end.substring(0, 7);
    return ps >= ss && ps <= es;
  }
  if (granularity === 'yearly') {
    const ps = period;
    const ss = start.substring(0, 4);
    const es = end.substring(0, 4);
    return ps >= ss && ps <= es;
  }
  return period >= start && period <= end;
}

function roundForMeasure(agg: AggKind, val: number): number {
  if (!Number.isFinite(val)) return 0;
  if (agg === 'avg') return Math.round(val * 10) / 10;
  return Math.round(val);
}

export function aggregateFromKpiHistory(opts: AggregationOptions): AggregationResult {
  const measures = (opts.measures || []).filter((m) => METRIC_IDS.has(m));
  const dimensions = opts.dimensions || ['date'];
  const granularity: Granularity = opts.granularity || 'monthly';
  const filters = opts.filters || [];

  const periods = new Set<string>();
  // measure -> period -> { sum, count }
  const periodAgg = new Map<string, Map<string, { sum: number; count: number }>>();

  for (const measure of measures) {
    const cfg = MEASURE_TO_KPI[measure];
    if (!cfg) continue;
    if (!periodAgg.has(measure)) periodAgg.set(measure, new Map());
    const m = periodAgg.get(measure)!;

    for (const kpiId of cfg.kpiIds) {
      const days = KPI_HISTORY[kpiId];
      if (!days || days.length === 0) continue;
      for (const day of days) {
        if (!day || typeof day.date !== 'string' || typeof day.value !== 'number') continue;
        const period = getPeriodKey(day.date, granularity);
        if (!applyDateFilter(period, granularity, filters)) continue;
        periods.add(period);
        if (!m.has(period)) m.set(period, { sum: 0, count: 0 });
        const a = m.get(period)!;
        a.sum += day.value;
        a.count += 1;
      }
    }
  }

  const sortedPeriods = Array.from(periods).sort();
  const maxRows = granularity === 'daily' ? 90 : granularity === 'yearly' ? 10 : 60;
  const periodsToUse = sortedPeriods.slice(-maxRows);

  const rows: Record<string, unknown>[] = periodsToUse.map((p) => {
    const row: Record<string, unknown> = { date: p };
    for (const d of dimensions) {
      if (d !== 'date') row[d] = null;
    }
    for (const m of measures) row[m] = 0;
    return row;
  });

  const periodToRow = new Map<string, Record<string, unknown>>();
  periodsToUse.forEach((p, i) => {
    const r = rows[i];
    if (r) periodToRow.set(p, r);
  });

  for (const measure of measures) {
    const cfg = MEASURE_TO_KPI[measure];
    if (!cfg) continue;
    const m = periodAgg.get(measure);
    if (!m) continue;
    for (const [period, agg] of m) {
      const row = periodToRow.get(period);
      if (!row) continue;
      let val: number;
      if (cfg.agg === 'sum') {
        val = agg.sum;
      } else if (cfg.agg === 'avg') {
        val = agg.count > 0 ? agg.sum / agg.count : 0;
      } else {
        val = cfg.transform ? cfg.transform(agg.sum, agg.count) : agg.sum;
      }
      row[measure] = roundForMeasure(cfg.agg, val);
    }
  }

  return { rows, source: 'kpiHistory' };
}

// ============================================================
// 兜底聚合: 从 store 其他集合聚合
// ============================================================
export interface CollectionFallbackSources {
  exams?: unknown[];
  reports?: unknown[];
  criticals?: unknown[];
  quality?: unknown[];
}

export function aggregateFromCollections(
  opts: AggregationOptions,
  sources?: CollectionFallbackSources,
): AggregationResult {
  const measures = (opts.measures || []).filter((m) => METRIC_IDS.has(m));
  const dimensions = opts.dimensions || ['date'];
  const granularity: Granularity = opts.granularity || 'monthly';

  const exams = (sources?.exams ?? list<any>('exams')) as any[];
  const reports = (sources?.reports ?? list<any>('reports')) as any[];
  const criticals = (sources?.criticals ?? list<any>('criticalEvents')) as any[];
  const quality = (sources?.quality ?? list<any>('qualityScores')) as any[];

  const today = new Date();
  const period = granularity === 'daily'
    ? today.toISOString().substring(0, 10)
    : granularity === 'yearly'
      ? today.toISOString().substring(0, 4)
      : today.toISOString().substring(0, 7);

  // 基础指标兜底
  const revenueSum = exams.reduce((s, e) => s + (Number(e?.price) || Number(e?.amount) || Number(e?.totalAmount) || 0), 0);
  const overtimeCount = reports.filter((r: any) => r?.isOvertime === true || r?.overtime === true || r?.isOvertime === 1).length;
  const qualityScores = quality
    .map((q: any) => Number(q?.score ?? q?.qualityScore ?? q?.qcScore))
    .filter((v: number) => Number.isFinite(v));
  const qualityAvg = qualityScores.length > 0
    ? qualityScores.reduce((s: number, v: number) => s + v, 0) / qualityScores.length
    : NaN;

  const baselineExamCount = exams.length || reports.length || 200;
  const baselineRevenue = revenueSum > 0 ? revenueSum : Math.round(baselineExamCount * 1250);

  const fallback: Record<string, number> = {
    exam_count: baselineExamCount,
    exam_revenue: baselineRevenue,
    report_count: reports.length || Math.round(baselineExamCount * 0.9),
    report_overtime: overtimeCount || Math.max(2, Math.round(baselineExamCount * 0.015)),
    quality_score_avg: Number.isFinite(qualityAvg) ? Math.round(qualityAvg * 10) / 10 : 88.5,
    critical_count: criticals.length || 3,
    critical_response_time: 95.5,
    device_usage_rate: 78.0,
    patient_satisfaction: 89.0,
    positive_rate: 72.5,
    consultation_count: Math.round(baselineExamCount * 0.04),
    ai_adoption_rate: 65.5,
    workload_avg: Math.round(baselineExamCount / 30),
  };

  const row: Record<string, unknown> = { date: period };
  for (const d of dimensions) {
    if (d !== 'date') row[d] = null;
  }
  for (const m of measures) {
    const v = fallback[m];
    row[m] = v !== undefined ? v : 0;
  }

  return { rows: [row], source: 'collection-fallback' };
}

// ============================================================
// MSW Handlers
// ============================================================
const METADATA = { metrics: METRICS, dimensions: DIMENSIONS };

export const olapHandlers = [
  http.get('/api/v1/olap/metadata', async () => {
    await delay(80);
    return HttpResponse.json(METADATA);
  }),

  http.post('/api/v1/olap/query', async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as {
      dimensions?: string[];
      measures?: string[];
      granularity?: Granularity;
      filters?: Array<{ dimension: string; operator: string; value: unknown }>;
    };
    const dimensions: string[] = body?.dimensions || [];
    const measures: string[] = (body?.measures || []).filter((m) => METRIC_IDS.has(m));
    const granularity: Granularity = body?.granularity || 'monthly';
    const filters = body?.filters || [];

    const columns = [
      ...dimensions.map((d: string) => {
        const found = DIMENSIONS.find((dd) => dd.id === d);
        return { key: d, name: found?.name || d, type: 'dimension' };
      }),
      ...measures.map((m: string) => {
        const found = METRICS.find((mm) => mm.id === m);
        return { key: m, name: found?.name || m, type: 'measure' };
      }),
    ];

    let result: AggregationResult;
    const kpiCount = Object.keys(KPI_HISTORY || {}).length;
    if (kpiCount > 0) {
      const r = aggregateFromKpiHistory({ measures, dimensions, granularity, filters });
      result = r.rows.length > 0 ? r : aggregateFromCollections({ measures, dimensions, granularity });
    } else {
      result = aggregateFromCollections({ measures, dimensions, granularity });
    }

    return HttpResponse.json({
      columns,
      rows: result.rows,
      total: result.rows.length,
      generatedAt: new Date().toISOString(),
      query: body,
      source: result.source,
    });
  }),
];
