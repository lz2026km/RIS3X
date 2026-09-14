/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 2A - 放射影像质控指标国家上报中心服务
 *
 * 闭环: 按周期生成上报批次 (DRAFT) → 提交 (SUBMITTED) → 回执 (ACCEPTED / REJECTED);
 *       REJECTED 可 reopen 回 DRAFT 重报。
 *
 * 孤儿模块模式 (orphan module pattern):
 *   - 不新增任何 DB 表, 不修改 prisma schema;
 *   - 批次以内存 overlay 存储 (Map), 无 DB 亦可启动;
 *   - 无任何内存批次时回退确定性 seed 批次 (同输入恒同输出);
 *   - 上报指标复用 Rqi2024Service (调用其 getIndicators), 不重复实现指标口径。
 *
 * 确定性: 同周期同输入 → 指标数组 / 导出内容 / contentHash (sha256 前 16 位) 完全一致。
 */
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { createHash } from 'crypto'
import {
  DEFAULT_REPORT_PAGE_SIZE,
  ON_TIME_GRACE_DAYS,
  REPORT_BATCH_STATUSES,
  REPORT_TRANSITIONS,
  canTransition,
  type AcceptBatchInput,
  type CreateBatchInput,
  type ListBatchFilter,
  type RejectBatchInput,
  type ReportBatchListResult,
  type ReportBatchStatus,
  type ReportExportFormat,
  type ReportExportResult,
  type ReportHistoryItem,
  type ReportHistoryResult,
  type ReportIndicatorEntry,
  type ReportStatsResult,
  type RqiReportBatch,
} from './rqi-report-center.types'
import { Rqi2024Service } from '../rqi-2024/rqi-2024.service'
import {
  INDICATOR_CODES,
  RQI_STANDARD,
  type IndicatorResult,
  type IndicatorStatus,
} from '../rqi-2024/rqi-2024.types'

// ================= 确定性 seed 定义 =================

interface SeedBatchDef {
  id: string
  period: string
  status: ReportBatchStatus
  createdBy: string
  createdAt: string
  submittedAt: string | null
  receiptAt: string | null
  receiptNo: string | null
  remark: string | null
  rejectReason: string | null
}

/** 2-3 个确定性 seed 批次 (覆盖 ACCEPTED / REJECTED / SUBMITTED, 用于无数据回退) */
const SEED_BATCH_DEFS: SeedBatchDef[] = [
  {
    id: 'rrc-seed-2026-06',
    period: '2026-06',
    status: 'ACCEPTED',
    createdBy: '质控科-王主任',
    createdAt: '2026-07-02T02:00:00.000Z',
    submittedAt: '2026-07-08T02:00:00.000Z',
    receiptAt: '2026-07-10T02:00:00.000Z',
    receiptNo: 'GJ-RQI-2026-06-0001',
    remark: '国家质控中心已接收',
    rejectReason: null,
  },
  {
    id: 'rrc-seed-2026-07',
    period: '2026-07',
    status: 'REJECTED',
    createdBy: '质控科-王主任',
    createdAt: '2026-08-03T02:00:00.000Z',
    submittedAt: '2026-08-20T02:00:00.000Z',
    receiptAt: '2026-08-22T02:00:00.000Z',
    receiptNo: 'GJ-RQI-2026-07-0002',
    remark: '数据口径需复核',
    rejectReason: 'ICME-05 分母与院内增强 CT 登记数不一致, 请核对后重报',
  },
  {
    id: 'rrc-seed-2026-08',
    period: '2026-08',
    status: 'SUBMITTED',
    createdBy: '质控科-李干事',
    createdAt: '2026-09-02T02:00:00.000Z',
    submittedAt: '2026-09-05T02:00:00.000Z',
    receiptAt: null,
    receiptNo: null,
    remark: '已提交国家平台, 待回执',
    rejectReason: null,
  },
]

// ================= 工具 =================

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function sanitize(value: string): string {
  return (value ?? '').replace(/[^\w-]/g, '_')
}

function csvCell(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function statusLabel(status: IndicatorStatus): string {
  return status === 'pass' ? '达标' : status === 'warn' ? '预警' : '不达标'
}

function cloneBatch(batch: RqiReportBatch): RqiReportBatch {
  return { ...batch, indicators: batch.indicators.map((i) => ({ ...i })) }
}

function toHistoryItem(batch: RqiReportBatch): ReportHistoryItem {
  return {
    id: batch.id,
    period: batch.period,
    periodLabel: batch.periodLabel,
    granularity: batch.granularity,
    status: batch.status,
    createdAt: batch.createdAt,
    createdBy: batch.createdBy,
    submittedAt: batch.submittedAt,
    receiptAt: batch.receiptAt,
    receiptNo: batch.receiptNo,
    remark: batch.remark,
    rejectReason: batch.rejectReason,
  }
}

/** 周期合法性: 'month'|'quarter'|'year' | YYYY-MM | YYYY-Qn | YYYY */
function normalizePeriod(period: string): string {
  const value = (period ?? '').trim()
  if (value === 'month' || value === 'quarter' || value === 'year') return value
  if (/^\d{4}-\d{2}$/.test(value)) return value
  if (/^\d{4}-Q[1-4]$/i.test(value)) return value.replace(/q/i, 'Q')
  if (/^\d{4}$/.test(value)) return value
  throw new BadRequestException(`无效上报周期 ${period}: 支持 月/季/年 (month|quarter|year) 或 YYYY-MM | YYYY-Qn | YYYY`)
}

/** 上报截止 = 周期结束日 23:59:59.999 + 宽限期 (天) */
function isOnTime(batch: RqiReportBatch): boolean {
  if (!batch.submittedAt) return false
  const grace = ON_TIME_GRACE_DAYS[batch.granularity] ?? 15
  const deadline = new Date(`${batch.dateTo}T23:59:59.999Z`).getTime() + grace * 86400000
  const submitted = new Date(batch.submittedAt).getTime()
  if (!Number.isFinite(deadline) || !Number.isFinite(submitted)) return false
  return submitted <= deadline
}

function compareBatchDesc(a: RqiReportBatch, b: RqiReportBatch): number {
  const byLabel = b.periodLabel.localeCompare(a.periodLabel)
  if (byLabel !== 0) return byLabel
  return b.createdAt.localeCompare(a.createdAt)
}

// ================= 服务 =================

@Injectable()
export class RqiReportCenterService {
  private readonly logger = new Logger(RqiReportCenterService.name)

  /** 内存 overlay: 上报批次 */
  private readonly batches = new Map<string, RqiReportBatch>()
  private batchSeq = 0
  private seedCache: RqiReportBatch[] | null = null

  constructor(private readonly rqi: Rqi2024Service) {
    this.logger.log('RqiReportCenterService: memory overlay + deterministic seed fallback (orphan mode)')
  }

  // ================= 批次生成 =================

  /**
   * 生成上报批次 (DRAFT): 复用 Rqi2024Service 取该周期 7 指标 → 生成上报数据。
   * 确定性: 同周期同输入 → indicators / fileName / contentHash 完全一致。
   */
  async createBatch(input: CreateBatchInput): Promise<RqiReportBatch> {
    const createdBy = (input.createdBy ?? '').trim()
    if (!createdBy) throw new BadRequestException('createdBy 不能为空')
    const period = normalizePeriod(input.period)
    this.batchSeq += 1
    const batch = await this.buildBatchData(period, createdBy, `rrc-${this.batchSeq}`, new Date().toISOString(), 'memory')
    this.batches.set(batch.id, batch)
    return cloneBatch(batch)
  }

  // ================= 查询 =================

  /** 批次列表: 周期倒序 + 状态/周期筛选 + 分页 (空库 seed 回退) */
  async listBatches(filter: ListBatchFilter = {}): Promise<ReportBatchListResult> {
    const { source, base } = await this.resolveBase()
    const matched = base
      .filter((b) => !filter.status || b.status === filter.status)
      .filter((b) => !filter.period || b.period === filter.period || b.periodLabel === filter.period)
      .sort(compareBatchDesc)
    const page = Math.max(1, Math.floor(filter.page ?? 1))
    const pageSize = Math.min(200, Math.max(1, Math.floor(filter.pageSize ?? DEFAULT_REPORT_PAGE_SIZE)))
    const start = (page - 1) * pageSize
    return {
      items: matched.slice(start, start + pageSize).map(cloneBatch),
      total: matched.length,
      page,
      pageSize,
      source,
    }
  }

  /** 批次详情 (含 7 指标明细); 不存在 → 404 */
  async getBatch(id: string): Promise<RqiReportBatch> {
    const inMemory = this.batches.get(id)
    if (inMemory) return cloneBatch(inMemory)
    const seeded = (await this.buildSeed()).find((b) => b.id === id)
    if (!seeded) throw new NotFoundException({ ok: false, code: 'REPORT_BATCH_NOT_FOUND', message: `上报批次 ${id} 不存在` })
    return cloneBatch(seeded)
  }

  /** 上报历史: 批次 + 状态 + 回执, 周期倒序 + 分页 */
  async getHistory(filter: ListBatchFilter = {}): Promise<ReportHistoryResult> {
    const listed = await this.listBatches(filter)
    return {
      items: listed.items.map(toHistoryItem),
      total: listed.total,
      page: listed.page,
      pageSize: listed.pageSize,
      source: listed.source,
    }
  }

  /** 上报统计: 批次数 / 各状态数 / 最近上报 / 按时上报率 */
  async getStats(): Promise<ReportStatsResult> {
    const { source, base } = await this.resolveBase()
    const byStatus: Record<ReportBatchStatus, number> = { DRAFT: 0, SUBMITTED: 0, ACCEPTED: 0, REJECTED: 0 }
    for (const b of base) byStatus[b.status] += 1

    const submitted = base.filter((b) => Boolean(b.submittedAt)).sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))
    const onTime = submitted.filter((b) => isOnTime(b))
    const latest = submitted[0] ? toHistoryItem(submitted[0]) : null

    return {
      total: base.length,
      draftCount: byStatus.DRAFT,
      submittedCount: byStatus.SUBMITTED,
      acceptedCount: byStatus.ACCEPTED,
      rejectedCount: byStatus.REJECTED,
      byStatus,
      reportableCount: submitted.length,
      onTimeCount: onTime.length,
      onTimeRate: submitted.length > 0 ? round1((onTime.length / submitted.length) * 100) : 0,
      latest,
      source,
    }
  }

  // ================= 状态机 =================

  /** DRAFT → SUBMITTED */
  async submitBatch(id: string): Promise<RqiReportBatch> {
    const batch = await this.findBatchEntity(id)
    this.assertTransition(batch, 'SUBMITTED', id)
    if (batch.status === 'DRAFT') {
      batch.status = 'SUBMITTED'
      batch.submittedAt = new Date().toISOString()
      batch.receiptAt = null
      batch.receiptNo = null
    }
    this.batches.set(batch.id, batch)
    return cloneBatch(batch)
  }

  /** SUBMITTED → ACCEPTED (写入回执号) */
  async acceptBatch(id: string, input: AcceptBatchInput): Promise<RqiReportBatch> {
    const receiptNo = (input.receiptNo ?? '').trim()
    if (!receiptNo) throw new BadRequestException('receiptNo 不能为空')
    const batch = await this.findBatchEntity(id)
    this.assertTransition(batch, 'ACCEPTED', id)
    if (batch.status === 'SUBMITTED') {
      batch.status = 'ACCEPTED'
      batch.receiptAt = input.receiptAt ?? new Date().toISOString()
      batch.receiptNo = receiptNo
      if (input.remark !== undefined) batch.remark = input.remark
      batch.rejectReason = null
    }
    this.batches.set(batch.id, batch)
    return cloneBatch(batch)
  }

  /** SUBMITTED → REJECTED (写入驳回原因) */
  async rejectBatch(id: string, input: RejectBatchInput): Promise<RqiReportBatch> {
    const reason = (input.reason ?? '').trim()
    if (!reason) throw new BadRequestException('reason 不能为空')
    const batch = await this.findBatchEntity(id)
    this.assertTransition(batch, 'REJECTED', id)
    if (batch.status === 'SUBMITTED') {
      batch.status = 'REJECTED'
      batch.receiptAt = input.receiptAt ?? new Date().toISOString()
      batch.rejectReason = reason
      batch.remark = input.remark ?? batch.remark ?? reason
    }
    this.batches.set(batch.id, batch)
    return cloneBatch(batch)
  }

  /** REJECTED → DRAFT (可重报: 清空回执并回到草稿) */
  async reopenBatch(id: string): Promise<RqiReportBatch> {
    const batch = await this.findBatchEntity(id)
    this.assertTransition(batch, 'DRAFT', id)
    if (batch.status === 'REJECTED') {
      batch.status = 'DRAFT'
      batch.submittedAt = null
      batch.receiptAt = null
      batch.receiptNo = null
      batch.rejectReason = null
    }
    this.batches.set(batch.id, batch)
    return cloneBatch(batch)
  }

  // ================= 导出 =================

  /** 导出批次上报内容: CSV (含 BOM) / JSON, 均携带 contentHash */
  async exportBatch(id: string, format: ReportExportFormat): Promise<ReportExportResult> {
    const batch = await this.getBatch(id)
    const fmt: ReportExportFormat = format === 'json' ? 'json' : 'csv'
    const suffix = sanitize(batch.periodLabel)
    if (fmt === 'json') {
      return {
        format: fmt,
        content: JSON.stringify(
          {
            standard: RQI_STANDARD,
            period: batch.periodLabel,
            batchId: batch.id,
            status: batch.status,
            contentHash: batch.contentHash,
            indicators: batch.indicators,
          },
          null,
          2,
        ),
        filename: `rqi-report-center-${suffix}.json`,
        contentHash: batch.contentHash,
      }
    }
    const header = ['指标编码', '指标名称', '分子', '分母', '比率', '单位', '目标', '达标状态']
    const lines = [`# period=${batch.periodLabel},status=${batch.status},contentHash=${batch.contentHash}`, header.join(',')]
    for (const i of batch.indicators) {
      lines.push([i.code, csvCell(i.name), i.numerator, i.denominator, i.rate, i.unit, i.target, statusLabel(i.status)].join(','))
    }
    return {
      format: fmt,
      content: `\ufeff${lines.join('\n')}`,
      filename: `rqi-report-center-${suffix}.csv`,
      contentHash: batch.contentHash,
    }
  }

  // ================= 内部 =================

  /** 内存优先; 为空时回退 seed */
  private async resolveBase(): Promise<{ source: 'memory' | 'seed'; base: RqiReportBatch[] }> {
    const stored = [...this.batches.values()]
    if (stored.length > 0) return { source: 'memory', base: stored }
    return { source: 'seed', base: await this.buildSeed() }
  }

  /** 取实体用于变更 (seed 命中时落入内存 overlay 后返回, 保证状态变更持久) */
  private async findBatchEntity(id: string): Promise<RqiReportBatch> {
    const inMemory = this.batches.get(id)
    if (inMemory) return inMemory
    const seeded = (await this.buildSeed()).find((b) => b.id === id)
    if (!seeded) throw new NotFoundException({ ok: false, code: 'REPORT_BATCH_NOT_FOUND', message: `上报批次 ${id} 不存在` })
    const copy = cloneBatch(seeded)
    this.batches.set(copy.id, copy)
    return copy
  }

  private assertTransition(batch: RqiReportBatch, to: ReportBatchStatus, id: string): void {
    if (batch.status === to) return
    if (!canTransition(batch.status, to)) {
      const allowed = REPORT_TRANSITIONS[batch.status] ?? []
      throw new BadRequestException(
        `INVALID_TRANSITION: 上报批次 ${id} ${batch.status} → ${to} 不允许 (合法流转: ${batch.status} → ${allowed.length > 0 ? allowed.join('/') : '无'})`,
      )
    }
  }

  /** 调用 Rqi2024Service 计算 7 指标并组装确定性上报数据 */
  private async buildBatchData(
    period: string,
    createdBy: string,
    id: string,
    createdAt: string,
    source: 'memory' | 'seed',
  ): Promise<RqiReportBatch> {
    const result = await this.rqi.getIndicators({ period })
    const indicators: ReportIndicatorEntry[] = result.indicators.map(toEntry)
    const contentHash = computeContentHash(result.period, indicators)
    return {
      id,
      period,
      periodLabel: result.period,
      granularity: result.granularity,
      status: 'DRAFT',
      createdAt,
      createdBy,
      submittedAt: null,
      receiptAt: null,
      indicators,
      fileName: `rqi-report-center-${sanitize(result.period)}-${contentHash.slice(0, 8)}.json`,
      contentHash,
      receiptNo: null,
      remark: null,
      rejectReason: null,
      dateFrom: result.dateFrom,
      dateTo: result.dateTo,
      source,
    }
  }

  /** 确定性 seed: 3 个批次 (ACCEPTED / REJECTED / SUBMITTED), 指标由 Rqi2024Service 派生 */
  private async buildSeed(): Promise<RqiReportBatch[]> {
    if (this.seedCache) return this.seedCache
    const batches: RqiReportBatch[] = []
    for (const def of SEED_BATCH_DEFS) {
      const built = await this.buildBatchData(def.period, def.createdBy, def.id, def.createdAt, 'seed')
      batches.push({
        ...built,
        status: def.status,
        submittedAt: def.submittedAt,
        receiptAt: def.receiptAt,
        receiptNo: def.receiptNo,
        remark: def.remark,
        rejectReason: def.rejectReason,
      })
    }
    this.seedCache = batches
    return batches
  }
}

// ================= 纯函数 =================

function toEntry(i: IndicatorResult): ReportIndicatorEntry {
  return {
    code: i.code,
    name: i.name,
    numerator: i.numerator,
    denominator: i.denominator,
    rate: i.rate,
    unit: i.unit,
    target: i.target,
    direction: i.direction,
    status: i.status,
    standard: i.standard,
  }
}

/**
 * contentHash = sha256(规范化 JSON) 前 16 位。仅与周期标签 + 指标数值相关,
 * 不含 id / 时间戳, 故同周期同输入恒同输出 (确定性)。
 */
export function computeContentHash(periodLabel: string, indicators: ReportIndicatorEntry[]): string {
  const canonical = JSON.stringify({
    period: periodLabel,
    standard: RQI_STANDARD,
    indicators: (indicators ?? []).map((i) => ({
      code: i.code,
      numerator: i.numerator,
      denominator: i.denominator,
      rate: i.rate,
      unit: i.unit,
      target: i.target,
      status: i.status,
    })),
  })
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16)
}

/** 暴露国标指标编码顺序 (与 rqi-2024 保持一致), 便于测试断言 */
export const REPORT_INDICATOR_CODES = INDICATOR_CODES

/** 状态枚举导出 (供控制器 zod 使用) */
export const REPORT_STATUS_LIST = REPORT_BATCH_STATUSES

/** 默认页大小 */
export const REPORT_DEFAULT_PAGE_SIZE = DEFAULT_REPORT_PAGE_SIZE

/** 内部: 供测试断言流转表 */
export { REPORT_TRANSITIONS }
