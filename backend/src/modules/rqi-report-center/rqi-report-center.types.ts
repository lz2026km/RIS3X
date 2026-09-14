/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 2A - 放射影像质控指标国家上报中心 (rqi-report-center)
 *
 * 在 rqi-2024 (7 条国标指标计算) 之上实现「按周期生成上报数据 → 提交 → 回执」闭环:
 *   DRAFT --submit--> SUBMITTED --accept--> ACCEPTED (回执号)
 *                              \--reject--> REJECTED --reopen--> DRAFT (可重报)
 *
 * 孤儿模块模式: 不新增 DB 表 (不修改 prisma schema), 批次以内存 overlay 存储,
 * 无 DB 时可启动; 无任何内存批次时回退确定性 seed (同输入恒同输出)。
 *
 * 上报数据复用 Rqi2024Service 的 7 指标计算结果, 不重复实现指标口径。
 */
import type {
  IndicatorCode,
  IndicatorDirection,
  IndicatorStatus,
  IndicatorUnit,
  RqiGranularity,
} from '../rqi-2024/rqi-2024.types'

// ================= 状态机 =================

export const REPORT_BATCH_STATUSES = ['DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED'] as const
export type ReportBatchStatus = (typeof REPORT_BATCH_STATUSES)[number]

/**
 * 上报批次状态机合法流转表 (参考 worklist EXAM_TRANSITIONS 门禁模式):
 *   DRAFT → SUBMITTED
 *   SUBMITTED → ACCEPTED | REJECTED
 *   REJECTED → DRAFT (驳回后可重报)
 *   ACCEPTED 为终态
 * 非法流转一律 400 INVALID_TRANSITION。
 */
export const REPORT_TRANSITIONS: Record<ReportBatchStatus, ReportBatchStatus[]> = {
  DRAFT: ['SUBMITTED'],
  SUBMITTED: ['ACCEPTED', 'REJECTED'],
  ACCEPTED: [],
  REJECTED: ['DRAFT'],
}

export function canTransition(from: ReportBatchStatus, to: ReportBatchStatus): boolean {
  if (from === to) return true
  return (REPORT_TRANSITIONS[from] ?? []).includes(to)
}

// ================= 上报周期 =================

/** 上报周期粒度: 月 | 季 | 年 (复用 rqi-2024 的 granularity 口径) */
export type ReportPeriod = RqiGranularity
export const REPORT_PERIODS: ReportPeriod[] = ['month', 'quarter', 'year']

/** 按时上报宽限期 (周期结束日 + N 天为上报截止): 月 15 天 / 季 30 天 / 年 60 天 */
export const ON_TIME_GRACE_DAYS: Record<ReportPeriod, number> = {
  month: 15,
  quarter: 30,
  year: 60,
}

// ================= 上报指标明细 =================

export interface ReportIndicatorEntry {
  code: IndicatorCode
  name: string
  numerator: number
  denominator: number
  rate: number
  unit: IndicatorUnit
  target: number
  direction: IndicatorDirection
  status: IndicatorStatus
  standard: string
}

// ================= 上报批次 =================

export interface RqiReportBatch {
  id: string
  /** 请求周期: 'month' | 'quarter' | 'year' | 'YYYY-MM' | 'YYYY-Qn' | 'YYYY' */
  period: string
  /** 解析后的统计周期标签, 如 2026-08 / 2026-Q3 / 2026 */
  periodLabel: string
  granularity: ReportPeriod
  status: ReportBatchStatus
  createdAt: string
  createdBy: string
  submittedAt: string | null
  receiptAt: string | null
  indicators: ReportIndicatorEntry[]
  fileName: string
  contentHash: string
  receiptNo: string | null
  remark: string | null
  rejectReason: string | null
  dateFrom: string
  dateTo: string
  source: 'memory' | 'seed'
}

// ================= 输入 / 输出 =================

export interface CreateBatchInput {
  period: string
  createdBy: string
}

export interface ListBatchFilter {
  status?: ReportBatchStatus
  period?: string
  page?: number
  pageSize?: number
}

export interface ReportBatchListResult {
  items: RqiReportBatch[]
  total: number
  page: number
  pageSize: number
  source: 'memory' | 'seed'
}

export interface AcceptBatchInput {
  receiptNo: string
  remark?: string
  receiptAt?: string
}

export interface RejectBatchInput {
  reason: string
  remark?: string
  receiptAt?: string
}

export type ReportExportFormat = 'csv' | 'json'

export interface ReportExportResult {
  format: ReportExportFormat
  content: string
  filename: string
  contentHash: string
}

export interface ReportHistoryItem {
  id: string
  period: string
  periodLabel: string
  granularity: ReportPeriod
  status: ReportBatchStatus
  createdAt: string
  createdBy: string
  submittedAt: string | null
  receiptAt: string | null
  receiptNo: string | null
  remark: string | null
  rejectReason: string | null
}

export interface ReportHistoryResult {
  items: ReportHistoryItem[]
  total: number
  page: number
  pageSize: number
  source: 'memory' | 'seed'
}

export interface ReportStatsResult {
  total: number
  draftCount: number
  submittedCount: number
  acceptedCount: number
  rejectedCount: number
  byStatus: Record<ReportBatchStatus, number>
  /** 已提交批次数 (含后续回执) */
  reportableCount: number
  onTimeCount: number
  /** 按时上报率 (%) = 按时上报批次数 ÷ 已提交批次数 ×100 */
  onTimeRate: number
  latest: ReportHistoryItem | null
  source: 'memory' | 'seed'
}

export const DEFAULT_REPORT_PAGE_SIZE = 20
