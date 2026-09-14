/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 3 - 放射影像质控指标国家上报中心 API
 *
 * 在 rqi-2024 (7 条国标指标计算) 之上实现「按周期生成上报数据 → 提交 → 回执」闭环:
 *   DRAFT --submit--> SUBMITTED --accept--> ACCEPTED (回执号)
 *                              \--reject--> REJECTED --reopen--> DRAFT (可重报)
 *
 * 后端: backend/src/modules/rqi-report-center (孤儿模块, 无 DB 可启动, 内存 overlay + seed 回退)
 * 端点 (前缀 /api):
 *   POST /rqi-report-center/batches                       生成上报批次 (period/createdBy) → DRAFT
 *   GET  /rqi-report-center/batches?status=&period=&page=&pageSize=  批次列表 (周期倒序 + 分页)
 *   GET  /rqi-report-center/batches/:id                   批次详情 (含 7 指标明细)
 *   POST /rqi-report-center/batches/:id/submit            提交 (DRAFT → SUBMITTED)
 *   POST /rqi-report-center/batches/:id/accept            回执接收 (SUBMITTED → ACCEPTED, 回执号)
 *   POST /rqi-report-center/batches/:id/reject            回执驳回 (SUBMITTED → REJECTED, 原因)
 *   POST /rqi-report-center/batches/:id/reopen            驳回重报 (REJECTED → DRAFT)
 *   GET  /rqi-report-center/batches/:id/export?format=csv|json  导出上报内容 (CSV 含 BOM / JSON)
 *   GET  /rqi-report-center/history                       上报历史 (批次 + 状态 + 回执)
 *   GET  /rqi-report-center/stats                         上报统计 (批次数/各状态数/最近上报/按时上报率)
 */
import { api, invalidateApiCacheByPrefix } from './client'
import type {
  RqiGranularity,
  RqiIndicatorCode,
  RqiIndicatorDirection,
  RqiIndicatorStatus,
  RqiIndicatorUnit,
} from './rqi2024Api'

// ================= 状态机 / 周期 =================

export const REPORT_BATCH_STATUSES = ['DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED'] as const
export type ReportBatchStatus = (typeof REPORT_BATCH_STATUSES)[number]

/** 上报周期粒度: 月 | 季 | 年 (复用 rqi-2024 的 granularity 口径) */
export type ReportPeriod = RqiGranularity

export const REPORT_PERIODS: ReportPeriod[] = ['month', 'quarter', 'year']

export type ReportExportFormat = 'csv' | 'json'
export type RqiReportSource = 'memory' | 'seed'

// ================= 上报指标明细 =================

export interface RqiReportIndicatorEntry {
  code: RqiIndicatorCode
  name: string
  numerator: number
  denominator: number
  rate: number
  unit: RqiIndicatorUnit
  target: number
  direction: RqiIndicatorDirection
  status: RqiIndicatorStatus
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
  indicators: RqiReportIndicatorEntry[]
  fileName: string
  contentHash: string
  receiptNo: string | null
  remark: string | null
  rejectReason: string | null
  dateFrom: string
  dateTo: string
  source: RqiReportSource
}

// ================= 输入 / 输出 =================

export interface CreateReportBatchInput {
  period: string
  createdBy: string
}

export interface ListReportBatchFilter {
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
  source: RqiReportSource
}

export interface AcceptReportBatchInput {
  receiptNo: string
  remark?: string
  receiptAt?: string
}

export interface RejectReportBatchInput {
  reason: string
  remark?: string
  receiptAt?: string
}

export interface ReportExportResult {
  format: ReportExportFormat
  content: string
  filename: string
  contentHash?: string
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
  source: RqiReportSource
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
  source: RqiReportSource
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

const BASE = '/rqi-report-center'

// ================= API =================

export const rqiReportCenterApi = {
  createBatch: (input: CreateReportBatchInput) =>
    api.post<RqiReportBatch>(`${BASE}/batches`, input),

  listBatches: (filter: ListReportBatchFilter = {}) =>
    api.get<ReportBatchListResult>(
      `${BASE}/batches${buildQuery({
        status: filter.status,
        period: filter.period,
        page: filter.page,
        pageSize: filter.pageSize,
      })}`,
    ),

  getBatch: (id: string) =>
    api.get<RqiReportBatch>(`${BASE}/batches/${encodeURIComponent(id)}`),

  submitBatch: async (id: string) => {
    const res = await api.post<RqiReportBatch>(`${BASE}/batches/${encodeURIComponent(id)}/submit`)
    await invalidateApiCacheByPrefix(BASE)
    return res
  },

  acceptBatch: async (id: string, input: AcceptReportBatchInput) => {
    const res = await api.post<RqiReportBatch>(`${BASE}/batches/${encodeURIComponent(id)}/accept`, input)
    await invalidateApiCacheByPrefix(BASE)
    return res
  },

  rejectBatch: async (id: string, input: RejectReportBatchInput) => {
    const res = await api.post<RqiReportBatch>(`${BASE}/batches/${encodeURIComponent(id)}/reject`, input)
    await invalidateApiCacheByPrefix(BASE)
    return res
  },

  reopenBatch: async (id: string) => {
    const res = await api.post<RqiReportBatch>(`${BASE}/batches/${encodeURIComponent(id)}/reopen`)
    await invalidateApiCacheByPrefix(BASE)
    return res
  },

  exportBatch: (id: string, format: ReportExportFormat) =>
    api.get<ReportExportResult>(
      `${BASE}/batches/${encodeURIComponent(id)}/export${buildQuery({ format })}`,
    ),

  getHistory: (filter: ListReportBatchFilter = {}) =>
    api.get<ReportHistoryResult>(
      `${BASE}/history${buildQuery({
        status: filter.status,
        period: filter.period,
        page: filter.page,
        pageSize: filter.pageSize,
      })}`,
    ),

  getStats: () => api.get<ReportStatsResult>(`${BASE}/stats`),
}

export default rqiReportCenterApi
