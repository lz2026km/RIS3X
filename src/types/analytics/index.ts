/**
 * G005 放射RIS - Analytics 类型定义 v3.0.7
 * Phase A1-A12: KPI 引擎 / 实时大盘 / 报告生成 / 图表转换 / 导出 / 热力图 /
 *              时序 / 预测 / 队列 / 基准
 */

// ============================================================
// 通用
// ============================================================
export type KpiCategory =
  | 'volume'        // 数量
  | 'timeliness'    // 时效
  | 'quality'       // 质量
  | 'efficiency'    // 效率
  | 'safety'        // 安全
  | 'finance'       // 财务
  | 'experience'    // 体验
  | 'utilization'   // 利用率
  | 'satisfaction'; // 满意度

export type KpiFormat = 'number' | 'percent' | 'minutes' | 'hours' | 'days' | 'currency' | 'score';

export type TrendDirection = 'up' | 'down' | 'flat';

export type Period = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface TimeRange {
  start: string; // ISO date
  end: string;
}

// ============================================================
// KPI 指标定义
// ============================================================
export interface KpiDefinition {
  id: string;
  code: string;            // 业务代号 KPI-001
  name: string;            // 中文名
  category: KpiCategory;
  format: KpiFormat;
  unit: string;            // 后缀显示
  description: string;
  formula?: string;        // 计算公式(描述)
  higherIsBetter: boolean; // 越高越好?
  target?: number;         // 目标值
  warning?: number;        // 警戒值
  source: string;          // 数据源
  tags: string[];
  refreshSec: number;      // 刷新周期(秒)
}

export interface KpiValue {
  kpiId: string;
  value: number;
  previous?: number;       // 上一周期
  yoy?: number;            // 同比
  mom?: number;            // 环比
  trend: TrendDirection;
  target?: number;
  achieved?: number;       // 完成率(百分比)
  sparkline?: number[];    // 最近 N 个数据点
  updatedAt: string;
}

export interface KpiSnapshot {
  period: Period;
  range: TimeRange;
  values: KpiValue[];
  generatedAt: string;
}

// ============================================================
// 实时大盘
// ============================================================
export interface RealtimeTick {
  kpiId: string;
  value: number;
  delta: number;
  ts: number;
}

export interface RealtimeDashboardConfig {
  intervalMs: number;
  kpis: string[];
  paused: boolean;
}

export type RealtimeListener = (tick: RealtimeTick) => void;

// ============================================================
// 自定义报告
// ============================================================
export interface ReportSection {
  id: string;
  title: string;
  type: 'kpi-grid' | 'chart' | 'table' | 'text' | 'heatmap' | 'cohort' | 'benchmark';
  source: string;          // 数据源(图表ID / KPI ID)
  options?: Record<string, unknown>;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  sections: ReportSection[];
  schedule?: 'manual' | 'daily' | 'weekly' | 'monthly';
  recipients?: string[];
  createdAt: string;
}

// ============================================================
// 可视化
// ============================================================
export type ChartKind =
  | 'line'
  | 'bar'
  | 'pie'
  | 'area'
  | 'scatter'
  | 'radar'
  | 'funnel'
  | 'sankey'
  | 'heatmap'
  | 'gauge'
  | 'sparkline';

export interface ChartSeries {
  name: string;
  data: Array<{ x: string | number; y: number; meta?: Record<string, unknown> }>;
  color?: string;
  type?: 'line' | 'bar' | 'area';
}

export interface ChartPayload {
  kind: ChartKind;
  title: string;
  xAxis?: { label: string; type: 'category' | 'time' | 'number' };
  yAxis?: { label: string };
  series: ChartSeries[];
  meta?: Record<string, unknown>;
}

// ============================================================
// 导出
// ============================================================
export type ExportFormat = 'xlsx' | 'csv' | 'pdf' | 'json';

export interface ExportRequest {
  format: ExportFormat;
  filename: string;
  sheets?: ExportSheet[];
  title?: string;
  author?: string;
  metadata?: Record<string, string | number>;
}

export interface ExportSheet {
  name: string;
  columns: Array<{ key: string; header: string; width?: number }>;
  rows: Array<Record<string, unknown>>;
}

// ============================================================
// 热力图
// ============================================================
export interface HeatmapCell {
  row: string;
  col: string;
  value: number;
  intensity: number; // 0..1
}

export interface HeatmapData {
  rows: string[];
  cols: string[];
  cells: HeatmapCell[];
  min: number;
  max: number;
  legend: { low: string; mid: string; high: string };
}

// ============================================================
// 时序
// ============================================================
export interface TimeSeriesPoint {
  t: string;        // ISO
  v: number;
  meta?: Record<string, unknown>;
}

export interface TimeSeries {
  id: string;
  name: string;
  unit?: string;
  points: TimeSeriesPoint[];
  interval: 'hour' | 'day' | 'week' | 'month';
}

// ============================================================
// 预测
// ============================================================
export type ForecastMethod = 'linear' | 'moving-avg' | 'exp-smoothing' | 'arima-lite' | 'seasonal-naive';

export interface ForecastPoint {
  t: string;
  predicted: number;
  lower: number;
  upper: number;
}

export interface ForecastResult {
  method: ForecastMethod;
  seriesId: string;
  horizon: number;
  history: TimeSeriesPoint[];
  forecast: ForecastPoint[];
  metrics: {
    mae: number;
    mape: number; // %
    rmse: number;
  };
  generatedAt: string;
}

// ============================================================
// 队列分析
// ============================================================
export interface CohortDefinition {
  id: string;
  name: string;
  filter: CohortFilter;
  size: number;
}

export interface CohortFilter {
  ageMin?: number;
  ageMax?: number;
  gender?: '男' | '女';
  modality?: string[];
  bodyPart?: string[];
  diagnosis?: string[];
  dateRange?: TimeRange;
}

export interface CohortComparisonRow {
  cohortId: string;
  cohortName: string;
  size: number;
  metrics: Record<string, number>;
}

export interface CohortRetention {
  cohortId: string;
  period: number; // 月数
  retention: number; // 0..1
}

// ============================================================
// 基准
// ============================================================
export interface BenchmarkStandard {
  id: string;
  name: string;
  source: string;
  metrics: Array<{
    code: string;
    name: string;
    value: number;
    unit: string;
    direction: 'higher-better' | 'lower-better';
  }>;
}

export interface BenchmarkGap {
  metricCode: string;
  metricName: string;
  ours: number;
  benchmark: number;
  delta: number;          // ours - benchmark
  deltaPercent: number;   // (ours-benchmark)/benchmark * 100
  status: 'exceeds' | 'meets' | 'lags' | 'critical';
}
export type DashboardWidget = any;
