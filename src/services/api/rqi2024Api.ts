/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 2B - 放射影像专业医疗质量控制指标 (2024 年版) API
 *
 * 依据: 国卫办医政函〔2024〕150 号 附件4 《放射影像专业医疗质量控制指标 (2024 年版)》
 * 后端: backend/src/modules/rqi-2024 (孤儿模块, 无 DB 自动 seed 回退) +
 *       backend/src/modules/quality-indicators (40 条扩展指标常量镜像)
 *
 * 端点:
 *   GET  /rqi-2024/indicators?period=&dateFrom=&dateTo=  7 指标当期汇总
 *   GET  /rqi-2024/detail/:code                          单指标分子/分母明细下钻
 *   GET  /rqi-2024/trend?code=&months=12                 指标月度趋势
 *   GET  /rqi-2024/dashboard                             总览 (7 指标 + 达标数/率 + 环比)
 *   GET  /rqi-2024/config                                目标值/阈值配置
 *   PUT  /rqi-2024/config                                目标值/阈值配置更新
 *   POST /rqi-2024/export                                导出 (CSV/JSON)
 *   GET  /quality-indicators/extended                    40 条扩展指标 (结构/过程/结果)
 */
import { api, invalidateApiCache } from './client'

// ================= 枚举 / 常量 =================

export const RQI_INDICATOR_CODES = [
  'RQI-IIA-01',
  'RQI-RRC-02',
  'RQI-RWS-03',
  'RQI-RCV-04',
  'RQI-ICME-05',
  'RQI-RCR-06',
  'RQI-RCR-07',
] as const

export type RqiIndicatorCode = (typeof RQI_INDICATOR_CODES)[number]

export type RqiIndicatorStatus = 'pass' | 'warn' | 'fail'
export type RqiIndicatorUnit = '%' | '‰'
export type RqiIndicatorDirection = 'higher' | 'lower'
export type RqiGranularity = 'month' | 'quarter' | 'year'
export type RqiItemKind = 'exam' | 'report' | 'critical' | 'contrast'
export type RqiSource = 'database' | 'seed'
export type RqiExportFormat = 'csv' | 'json'
export type RqiCategoryKey = 'structure' | 'process' | 'outcome'

// ================= 查询 / 指标 =================

export interface RqiWindowParams {
  period?: string
  dateFrom?: string
  dateTo?: string
}

export interface RqiDimensionResult {
  dimension: string
  label: string
  numerator: number
  denominator: number
  rate: number
  status: RqiIndicatorStatus
}

export interface RqiIndicator {
  code: RqiIndicatorCode
  name: string
  numerator: number
  denominator: number
  rate: number
  unit: RqiIndicatorUnit
  target: number
  direction: RqiIndicatorDirection
  status: RqiIndicatorStatus
  period: string
  granularity: RqiGranularity
  standard: string
  byDimension?: RqiDimensionResult[]
}

export interface RqiIndicatorsResult {
  source: RqiSource
  period: string
  granularity: RqiGranularity
  dateFrom: string
  dateTo: string
  standard: string
  count: number
  indicators: RqiIndicator[]
}

// ================= 明细下钻 =================

export interface RqiDetailItem {
  id: string
  kind: RqiItemKind
  label: string
  inNumerator: boolean
  inDenominator: boolean
  dimension?: string
  detail: Record<string, string | number | boolean | undefined>
}

export interface RqiDetailResult {
  source?: RqiSource
  indicator: RqiIndicator
  numeratorIds: string[]
  denominatorIds: string[]
  items: RqiDetailItem[]
}

// ================= 趋势 / 总览 =================

export interface RqiTrendPoint {
  month: string
  numerator: number
  denominator: number
  rate: number
  unit: RqiIndicatorUnit
  target: number
  status: RqiIndicatorStatus
}

export interface RqiTrendResult {
  source: RqiSource
  code: RqiIndicatorCode
  name: string
  months: number
  points: RqiTrendPoint[]
}

export interface RqiMomItem {
  code: RqiIndicatorCode
  name: string
  current: number
  previous: number
  delta: number
  trend: 'up' | 'down' | 'flat'
  unit: RqiIndicatorUnit
}

export interface RqiDashboardResult {
  source: RqiSource
  generatedAt: string
  period: string
  granularity: RqiGranularity
  standard: string
  total: number
  passCount: number
  warnCount: number
  failCount: number
  passRate: number
  indicators: RqiIndicator[]
  mom: RqiMomItem[]
}

// ================= 目标值配置 =================

export interface RqiIndicatorConfig {
  code: RqiIndicatorCode
  name: string
  target: number
  warnMargin: number
  direction: RqiIndicatorDirection
  unit: RqiIndicatorUnit
}

export interface RqiIndicatorConfigInput {
  code: RqiIndicatorCode
  target: number
  warnMargin?: number
  direction?: RqiIndicatorDirection
}

export interface RqiConfigResult {
  source: 'default' | 'override'
  updatedAt: string | null
  standard: string
  items: RqiIndicatorConfig[]
}

// ================= 导出 =================

export interface RqiExportInput {
  format: RqiExportFormat
  period?: string
  dateFrom?: string
  dateTo?: string
}

export interface RqiExportResult {
  format: RqiExportFormat
  content: string
  filename: string
}

// ================= 40 条扩展指标 (quality-indicators) =================

export interface RqiQualityIndicator {
  code: string
  name: string
  nameEn: string
  category: string
  categoryKey: RqiCategoryKey
  formula: string
  target: string
  frequency: string
  responsible: string
  threshold: string
}

export interface RqiQualityCategoryStat {
  category: string
  categoryKey: RqiCategoryKey
  count: number
}

export interface RqiExtendedResult {
  source: 'mirror'
  generatedAt: string
  total: number
  byCategory: Record<RqiCategoryKey, number>
  categoryStats: RqiQualityCategoryStat[]
  data: RqiQualityIndicator[]
}

export interface RqiExtendedParams {
  category?: RqiCategoryKey
  keyword?: string
}

// [v3.0.6.11-105 Wave 1C] 单条指标达标判定 + 质控标准 (quality-indicators 镜像)
export interface RqiIndicatorEvaluation {
  code: string
  name: string
  value: number
  target: string
  targetValue: number
  unit: string
  direction: 'higher' | 'lower'
  passed: boolean
  comparison: string
}

export interface RqiImageQualityLevel {
  score: number
  levelName: string
  levelNameEn: string
  description: string
  acceptable: boolean
}

export interface RqiImageQualityDimension {
  dimension: string
  dimensionEn: string
  weight: number
  levels: RqiImageQualityLevel[]
}

export interface RqiReportQualityItem {
  id: string
  category: string
  categoryEn: string
  item: string
  standard: string
  checkpoints: string[]
}

export interface RqiWorkflowQcPoint {
  id: string
  stage: string
  stageEn: string
  item: string
  standard: string
  checkMethod: string
  responsible: string
  onFailure: string
}

export interface RqiQualityStandardsResult {
  source: 'mirror'
  generatedAt: string
  imageDimensionCount: number
  reportStandardCount: number
  workflowPointCount: number
  imageQualityDimensions: RqiImageQualityDimension[]
  reportQualityStandards: RqiReportQualityItem[]
  workflowQcPoints: RqiWorkflowQcPoint[]
}

// ================= 内部工具 =================

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    search.set(key, String(value))
  }
  const qs = search.toString()
  return qs ? `?${qs}` : ''
}

// ================= API =================

export const rqi2024Api = {
  getIndicators: (params: RqiWindowParams = {}) =>
    api.get<RqiIndicatorsResult>(
      `/rqi-2024/indicators${buildQuery({ period: params.period, dateFrom: params.dateFrom, dateTo: params.dateTo })}`,
    ),

  getDetail: (code: string, params: RqiWindowParams = {}) =>
    api.get<RqiDetailResult>(
      `/rqi-2024/detail/${encodeURIComponent(code)}${buildQuery({ period: params.period, dateFrom: params.dateFrom, dateTo: params.dateTo })}`,
    ),

  getTrend: (code: string, months = 12) =>
    api.get<RqiTrendResult>(`/rqi-2024/trend${buildQuery({ code, months })}`),

  getDashboard: (params: RqiWindowParams = {}) =>
    api.get<RqiDashboardResult>(
      `/rqi-2024/dashboard${buildQuery({ period: params.period, dateFrom: params.dateFrom, dateTo: params.dateTo })}`,
    ),

  getConfig: () => api.get<RqiConfigResult>('/rqi-2024/config'),

  updateConfig: async (items: RqiIndicatorConfigInput[]) => {
    const res = await api.put<RqiConfigResult>('/rqi-2024/config', { items })
    await invalidateApiCache('/rqi-2024/config')
    await invalidateApiCache('/rqi-2024/indicators')
    await invalidateApiCache('/rqi-2024/dashboard')
    return res
  },

  exportIndicators: (input: RqiExportInput) =>
    api.post<RqiExportResult>('/rqi-2024/export', input),

  getExtendedIndicators: (params: RqiExtendedParams = {}) =>
    api.get<RqiExtendedResult>(
      `/quality-indicators/extended${buildQuery({ category: params.category, keyword: params.keyword })}`,
    ),

  // [v3.0.6.11-105 Wave 1C] 单条指标 / 达标判定 / 质控标准
  getExtendedIndicator: (code: string) =>
    api.get<RqiQualityIndicator>(`/quality-indicators/extended/${encodeURIComponent(code)}`),

  evaluateIndicator: (code: string, value: number) =>
    api.get<RqiIndicatorEvaluation>(`/quality-indicators/evaluate${buildQuery({ code, value })}`),

  getQualityStandards: () =>
    api.get<RqiQualityStandardsResult>('/quality-indicators/standards'),
}

export default rqi2024Api
