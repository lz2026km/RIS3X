/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 8B (qc-analytics) - 报告质控闭环与趋势分析服务
 *
 * 跨模块深化: 作为报告 V2 (报告规则引擎 + 质控 V2) 与质控后续工作的桥接。
 *   1. 质控闭环: 缺陷 → 整改任务 → 复查验证 → 关闭 (PDCA 数字化闭环状态机)
 *      缺陷池从 auditLog ('qc-defect'/'defect-library'/'report-rule-violation') 派生 + seed 回退,
 *      整改任务由缺陷派生 (rules-engine 违规 / qc-v2 评分缺陷 / 人工登记三种来源)。
 *   2. 趋势分析: 缺陷率按周/月趋势 (环比改善率)、缺陷类型帕累托、科室排名。
 *   3. 质控驾驶舱: 报告总数/质控率/缺陷率/及时率/平均响应时间聚合指标。
 *
 * 孤儿模块 (无新增 DB 表, DB 不可用自动回退确定性种子, 可无 DB 启动):
 *   所有统计为纯函数 + 确定性 seed, 同输入恒同输出, 便于测试复现。
 */
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { AuditLog } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { currentTenantId } from '../../common/tenant/tenant-utils'
import {
  DEFECT_LABEL,
  DEFECT_TYPE_CODES,
  type DashboardData,
  type DepartmentRankItem,
  type DepartmentRanking,
  type DefectTypeCode,
  type LoopDefect,
  type LoopHistoryEntry,
  type LoopStatus,
  type LoopStats,
  type ParetoData,
  type ParetoItem,
  type QcReportRecord,
  type RectificationItem,
  type TrendPoint,
} from './qc-analytics.types'

// ================= 确定性统计纯函数 =================

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}

/** ISO 周起始日 (周一, UTC, 确定性) */
export function weekStartOf(iso: string): string {
  const d = new Date(iso)
  const day = d.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + diff)
  return d.toISOString().slice(0, 10)
}

interface TrendAggregate {
  reports: number
  qcReports: number
  defects: number
  timely: number
  responseSum: number
  scoreSum: number
  scoreCount: number
}

const emptyAgg = (): TrendAggregate => ({ reports: 0, qcReports: 0, defects: 0, timely: 0, responseSum: 0, scoreSum: 0, scoreCount: 0 })

/** 趋势计算 (确定性): period=month → 'YYYY-MM', week → 周一日期 */
export function buildTrends(records: QcReportRecord[], period: 'week' | 'month'): TrendPoint[] {
  const map = new Map<string, TrendAggregate>()
  for (const r of records) {
    const bucket = period === 'month' ? r.reportedAt.slice(0, 7) : weekStartOf(r.reportedAt)
    const agg = map.get(bucket) ?? emptyAgg()
    agg.reports += 1
    if (r.qcScored) agg.qcReports += 1
    agg.defects += r.defectCodes.length
    if (r.timely) agg.timely += 1
    agg.responseSum += r.responseMinutes
    if (r.score !== undefined) {
      agg.scoreSum += r.score
      agg.scoreCount += 1
    }
    map.set(bucket, agg)
  }
  const keys = [...map.keys()].sort()
  const points: TrendPoint[] = []
  for (let i = 0; i < keys.length; i++) {
    const agg = map.get(keys[i]!)!
    const defectRate = agg.reports > 0 ? round1((agg.defects / agg.reports) * 100) : 0
    const prev = points[i - 1]
    const improvement = prev !== undefined && prev.defectRate > 0 ? round1(((prev.defectRate - defectRate) / prev.defectRate) * 100) : null
    points.push({
      bucket: keys[i]!,
      label: period === 'month' ? keys[i]! : keys[i]!.slice(5),
      reports: agg.reports,
      qcReports: agg.qcReports,
      qcRate: agg.reports > 0 ? round1((agg.qcReports / agg.reports) * 100) : 0,
      defects: agg.defects,
      defectRate,
      timely: agg.timely,
      timelyRate: agg.reports > 0 ? round1((agg.timely / agg.reports) * 100) : 0,
      avgResponseMinutes: agg.reports > 0 ? round1(agg.responseSum / agg.reports) : 0,
      improvement,
    })
  }
  return points
}

/** 帕累托 (确定性): 按缺陷类型计数降序, 平局按 code 升序; 累计占比 ≤ 80% 为主要问题 */
export function buildPareto(records: QcReportRecord[]): ParetoItem[] {
  const counts = new Map<DefectTypeCode, number>()
  for (const r of records) {
    for (const code of r.defectCodes) counts.set(code, (counts.get(code) ?? 0) + 1)
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  const sorted: Array<[DefectTypeCode, number]> = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  let cumulative = 0
  return sorted.map(([code, count]) => {
    cumulative += count
    const cumulativePercent = total > 0 ? round1((cumulative / total) * 100) : 0
    return {
      code,
      label: DEFECT_LABEL[code],
      count,
      cumulativeCount: cumulative,
      cumulativePercent,
      isMain: cumulativePercent <= 80,
    }
  })
}

interface DeptAggregate {
  reports: number
  defects: number
  timely: number
  qcReports: number
  responseSum: number
  scoreSum: number
  scoreCount: number
}

/** 科室排名 (确定性): 缺陷率升序 (最好在前), 平局按科室名 */
export function buildDepartmentRanking(records: QcReportRecord[]): DepartmentRankItem[] {
  const map = new Map<string, DeptAggregate>()
  for (const r of records) {
    const agg = map.get(r.department) ?? { reports: 0, defects: 0, timely: 0, qcReports: 0, responseSum: 0, scoreSum: 0, scoreCount: 0 }
    agg.reports += 1
    agg.defects += r.defectCodes.length
    if (r.timely) agg.timely += 1
    if (r.qcScored) agg.qcReports += 1
    agg.responseSum += r.responseMinutes
    if (r.score !== undefined) {
      agg.scoreSum += r.score
      agg.scoreCount += 1
    }
    map.set(r.department, agg)
  }
  const items: DepartmentRankItem[] = []
  for (const [department, agg] of map) {
    items.push({
      department,
      reports: agg.reports,
      defects: agg.defects,
      defectRate: agg.reports > 0 ? round1((agg.defects / agg.reports) * 100) : 0,
      timelyRate: agg.reports > 0 ? round1((agg.timely / agg.reports) * 100) : 0,
      avgResponseMinutes: agg.reports > 0 ? round1(agg.responseSum / agg.reports) : 0,
      qcRate: agg.reports > 0 ? round1((agg.qcReports / agg.reports) * 100) : 0,
      avgScore: agg.scoreCount > 0 ? round1(agg.scoreSum / agg.scoreCount) : 0,
    })
  }
  items.sort((a, b) => a.defectRate - b.defectRate || a.department.localeCompare(b.department))
  return items
}

/** 驾驶舱聚合 (确定性): 报告/质控/缺陷/及时率 + 平均响应时间 + 闭环指标 */
export function buildDashboardData(records: QcReportRecord[], items: RectificationItem[]): Omit<DashboardData, 'source' | 'generatedAt'> {
  const totalReports = records.length
  const qcReports = records.filter((r) => r.qcScored).length
  const totalDefects = records.reduce((a, r) => a + r.defectCodes.length, 0)
  const timelyReports = records.filter((r) => r.timely).length
  const avgResponseMinutes = totalReports > 0 ? round1(records.reduce((a, r) => a + r.responseMinutes, 0) / totalReports) : 0
  const scored = records.filter((r) => r.score !== undefined)
  const avgScore = scored.length > 0 ? round1(scored.reduce((a, r) => a + (r.score ?? 0), 0) / scored.length) : 0
  const loopClosed = items.filter((i) => i.status === 'closed').length
  return {
    totalReports,
    qcReports,
    qcRate: totalReports > 0 ? round1((qcReports / totalReports) * 100) : 0,
    totalDefects,
    defectRate: totalReports > 0 ? round1((totalDefects / totalReports) * 100) : 0,
    timelyReports,
    timelyRate: totalReports > 0 ? round1((timelyReports / totalReports) * 100) : 0,
    avgResponseMinutes,
    avgScore,
    loopOpen: items.length - loopClosed,
    loopClosed,
    closureRate: items.length > 0 ? round1((loopClosed / items.length) * 100) : 0,
  }
}

// ================= 闭环状态机 =================

export const LOOP_TRANSITIONS: Record<LoopStatus, LoopStatus[]> = {
  open: ['rectifying', 'closed'],
  rectifying: ['rechecking'],
  rechecking: ['rectifying', 'closed'],
  closed: [],
}

/** 非法流转拒绝: 不在转移表内的目标状态一律抛 BadRequestException */
export function assertLoopTransition(from: LoopStatus, to: LoopStatus): void {
  if (!LOOP_TRANSITIONS[from]?.includes(to)) {
    throw new BadRequestException(`非法状态流转: ${from} → ${to}`)
  }
}

// ================= 确定性种子 =================

const DEPARTMENTS = ['放射科一区', '放射科二区', '介入科', '核医学科', '超声科', '急诊影像', '神经影像', '乳腺影像']
const MODALITIES = ['CT', 'MR', 'DR', 'MG', 'US', 'XA']
const MONTH_SPANS: Array<[string, number, number]> = [
  ['2026-04', 1, 30],
  ['2026-05', 1, 31],
  ['2026-06', 1, 30],
  ['2026-07', 1, 31],
  ['2026-08', 1, 14],
]

/** 确定性样本生成: 固定日期/科室/缺陷模式, 无随机数 */
export function buildSeedRecords(): QcReportRecord[] {
  const records: QcReportRecord[] = []
  let seq = 0
  for (const [month, start, end] of MONTH_SPANS) {
    for (let day = start; day <= end; day++) {
      const perDay = 1 + ((day * 3) % 2)
      for (let i = 0; i < perDay; i++) {
        seq += 1
        const dayStr = `${month}-${String(day).padStart(2, '0')}`
        const defectCodes: DefectTypeCode[] = []
        const defectCount = (day * 5 + i * 13) % 4
        for (let k = 0; k < defectCount; k++) {
          const code = DEFECT_TYPE_CODES[(day * 3 + i * 7 + k * 5) % DEFECT_TYPE_CODES.length]!
          if (!defectCodes.includes(code)) defectCodes.push(code)
        }
        const qcScored = (day + i) % 4 !== 0
        records.push({
          id: `rec-${String(seq).padStart(4, '0')}`,
          reportId: `RPT-A-${String(seq).padStart(4, '0')}`,
          department: DEPARTMENTS[(day * 7 + i * 3) % DEPARTMENTS.length]!,
          modality: MODALITIES[(day + i) % MODALITIES.length]!,
          reportedAt: new Date(`${dayStr}T0${(day % 9) + 1}:00:00Z`).toISOString(),
          defectCodes,
          qcScored,
          score: qcScored ? 62 + ((day * 7 + i * 11) % 37) : undefined,
          responseMinutes: 15 + ((day * 13 + i * 5) % 80),
          timely: (day * 11 + i * 7) % 10 < 8,
        })
      }
    }
  }
  return records
}

function iso(day: string, hour = 8): string {
  return new Date(`${day}T${String(hour).padStart(2, '0')}:00:00Z`).toISOString()
}

const SEED_LOOP_DEFECTS: Array<Omit<LoopDefect, 'status' | 'itemId'>> = [
  { id: 'qcd-001', code: 'terminology', typeLabel: '术语不规范', reportId: 'RPT-A-0001', department: '放射科一区', severity: 'medium', source: 'rules-engine', message: '诊断结论存在"考虑/可能"类模糊表述 3 处', discoveredAt: iso('2026-07-06', 2) },
  { id: 'qcd-002', code: 'missing_field', typeLabel: '必填字段缺失', reportId: 'RPT-A-0012', department: '介入科', severity: 'high', source: 'rules-engine', message: 'CTA 报告缺少对比剂剂量字段', discoveredAt: iso('2026-07-10', 3) },
  { id: 'qcd-003', code: 'structure', typeLabel: '结构不完整', reportId: 'RPT-A-0021', department: '超声科', severity: 'medium', source: 'qc-v2', message: '影像所见与诊断结论结构不完整 (completeness 维度扣分)', discoveredAt: iso('2026-07-15', 1) },
  { id: 'qcd-004', code: 'critical', typeLabel: '危急提示缺失', reportId: 'RPT-A-0030', department: '急诊影像', severity: 'high', source: 'qc-v2', message: '危急值报告缺少紧急提示措辞', discoveredAt: iso('2026-07-18', 6) },
  { id: 'qcd-005', code: 'duplicate', typeLabel: '重复表述', reportId: 'RPT-A-0035', department: '放射科二区', severity: 'low', source: 'rules-engine', message: '结论段落重复描述所见 2 处', discoveredAt: iso('2026-07-22', 2) },
  { id: 'qcd-006', code: 'numeric_reasonability', typeLabel: '数值不合理', reportId: 'RPT-A-0040', department: '神经影像', severity: 'medium', source: 'rules-engine', message: '病灶尺寸数值超出模态合理范围', discoveredAt: iso('2026-07-25', 4) },
  { id: 'qcd-007', code: 'unit', typeLabel: '单位缺失', reportId: 'RPT-A-0044', department: '核医学科', severity: 'low', source: 'rules-engine', message: 'SUV 值缺少单位说明', discoveredAt: iso('2026-07-29', 1) },
  { id: 'qcd-008', code: 'length_range', typeLabel: '长度异常', reportId: 'RPT-A-0048', department: '乳腺影像', severity: 'medium', source: 'qc-v2', message: '报告语句过长, 可读性维度扣分', discoveredAt: iso('2026-08-03', 2) },
  { id: 'qcd-009', code: 'terminology', typeLabel: '术语不规范', reportId: 'RPT-A-0055', department: '放射科二区', severity: 'medium', source: 'rules-engine', message: '使用非规范缩写 2 处', discoveredAt: iso('2026-08-07', 3) },
  { id: 'qcd-010', code: 'missing_field', typeLabel: '必填字段缺失', reportId: 'RPT-A-0060', department: '放射科一区', severity: 'high', source: 'qc-v2', message: '增强报告缺少随访建议字段', discoveredAt: iso('2026-08-11', 1) },
]

const SEED_LOOP_ITEMS: RectificationItem[] = [
  {
    id: 'it-001', defectId: 'qcd-001', defectCode: 'terminology', typeLabel: '术语不规范',
    reportId: 'RPT-A-0001', department: '放射科一区', severity: 'medium', source: 'rules-engine',
    title: '术语规范整改: 消除"考虑/可能"模糊表述', assignee: 'u-102', assigneeName: '王质控员',
    status: 'closed', createdAt: iso('2026-07-08'), updatedAt: iso('2026-07-20'), closedAt: iso('2026-07-20'),
    fixNote: '已更新结论表述并复核模板术语库', recheckResult: 'pass', recheckNote: '复查通过, 模糊表述清零', recheckRounds: 1,
    history: [
      { at: iso('2026-07-08'), action: 'created', actor: '系统', note: '由缺陷 qcd-001 派生整改任务' },
      { at: iso('2026-07-09'), action: 'started', actor: '质控组长', note: '开始整改' },
      { at: iso('2026-07-16'), action: 'fixed', actor: '王质控员', note: '已更新结论表述' },
      { at: iso('2026-07-18'), action: 'rechecked', actor: '张质控', note: '复查验证通过' },
      { at: iso('2026-07-20'), action: 'closed', actor: '张质控', note: '整改闭环' },
    ],
  },
  {
    id: 'it-002', defectId: 'qcd-004', defectCode: 'critical', typeLabel: '危急提示缺失',
    reportId: 'RPT-A-0030', department: '急诊影像', severity: 'high', source: 'qc-v2',
    title: '危急值报告紧急提示措辞整改', assignee: 'u-103', assigneeName: '李质控员',
    status: 'rechecking', createdAt: iso('2026-07-20'), updatedAt: iso('2026-08-10'),
    fixNote: '模板增加危急提示语, 已覆盖 3 例在途报告', recheckRounds: 1,
    history: [
      { at: iso('2026-07-20'), action: 'created', actor: '系统', note: '由缺陷 qcd-004 派生整改任务' },
      { at: iso('2026-07-22'), action: 'started', actor: '质控组长', note: '开始整改' },
      { at: iso('2026-08-05'), action: 'fixed', actor: '李质控员', note: '已提交整改说明' },
      { at: iso('2026-08-10'), action: 'rechecked', actor: '张质控', note: '进入复查验证' },
    ],
  },
  {
    id: 'it-003', defectId: 'qcd-002', defectCode: 'missing_field', typeLabel: '必填字段缺失',
    reportId: 'RPT-A-0012', department: '介入科', severity: 'high', source: 'rules-engine',
    title: 'CTA 对比剂剂量必填字段整改', assignee: 'u-104', assigneeName: '赵质控员',
    status: 'rectifying', createdAt: iso('2026-07-12'), updatedAt: iso('2026-08-12'),
    recheckRounds: 0,
    history: [
      { at: iso('2026-07-12'), action: 'created', actor: '系统', note: '由缺陷 qcd-002 派生整改任务' },
      { at: iso('2026-07-15'), action: 'started', actor: '质控组长', note: '开始整改' },
      { at: iso('2026-08-12'), action: 'started', actor: '质控组长', note: '补充字段模板已上线' },
    ],
  },
  {
    id: 'it-004', defectId: 'qcd-006', defectCode: 'numeric_reasonability', typeLabel: '数值不合理',
    reportId: 'RPT-A-0040', department: '神经影像', severity: 'medium', source: 'rules-engine',
    title: '病灶尺寸数值合理性整改', assignee: 'u-102', assigneeName: '王质控员',
    status: 'rechecking', createdAt: iso('2026-07-27'), updatedAt: iso('2026-08-13'),
    fixNote: '数值校验规则已加入规则引擎', recheckResult: 'fail', recheckNote: '复查未通过: 历史报告未全部回刷', recheckRounds: 1,
    history: [
      { at: iso('2026-07-27'), action: 'created', actor: '系统', note: '由缺陷 qcd-006 派生整改任务' },
      { at: iso('2026-07-29'), action: 'started', actor: '质控组长', note: '开始整改' },
      { at: iso('2026-08-08'), action: 'fixed', actor: '王质控员', note: '提交数值校验规则' },
      { at: iso('2026-08-10'), action: 'rechecked', actor: '张质控', note: '复查退回: 历史报告未全部回刷' },
      { at: iso('2026-08-12'), action: 'fixed', actor: '王质控员', note: '重新提交整改说明' },
      { at: iso('2026-08-13'), action: 'rechecked', actor: '张质控', note: '进入复查验证' },
    ],
  },
  {
    id: 'it-005', defectId: 'qcd-008', defectCode: 'length_range', typeLabel: '长度异常',
    reportId: 'RPT-A-0048', department: '乳腺影像', severity: 'medium', source: 'qc-v2',
    title: '报告语句长度整改', assignee: 'u-105', assigneeName: '孙质控员',
    status: 'open', createdAt: iso('2026-08-05'), updatedAt: iso('2026-08-05'),
    recheckRounds: 0,
    history: [{ at: iso('2026-08-05'), action: 'created', actor: '系统', note: '由缺陷 qcd-008 派生整改任务' }],
  },
  {
    id: 'it-006', defectId: 'qcd-010', defectCode: 'missing_field', typeLabel: '必填字段缺失',
    reportId: 'RPT-A-0060', department: '放射科一区', severity: 'high', source: 'qc-v2',
    title: '增强报告随访建议字段整改', assignee: 'u-102', assigneeName: '王质控员',
    status: 'closed', createdAt: iso('2026-08-06'), updatedAt: iso('2026-08-13'), closedAt: iso('2026-08-13'),
    fixNote: '模板增加随访建议必填项', recheckResult: 'pass', recheckNote: '复查通过', recheckRounds: 1,
    history: [
      { at: iso('2026-08-06'), action: 'created', actor: '系统', note: '由缺陷 qcd-010 派生整改任务' },
      { at: iso('2026-08-07'), action: 'started', actor: '质控组长', note: '开始整改' },
      { at: iso('2026-08-11'), action: 'fixed', actor: '王质控员', note: '提交模板更新' },
      { at: iso('2026-08-12'), action: 'rechecked', actor: '张质控', note: '复查验证通过' },
      { at: iso('2026-08-13'), action: 'closed', actor: '张质控', note: '整改闭环' },
    ],
  },
]

// ================= 服务 =================

@Injectable()
export class QcAnalyticsService {
  private readonly logger = new Logger(QcAnalyticsService.name)
  private records: QcReportRecord[] = []
  private defects: LoopDefect[] = []
  private items: RectificationItem[] = []
  private itemSeq = 0

  constructor(private readonly prisma: PrismaService) {
    this.seed()
  }

  private seed(): void {
    this.records = buildSeedRecords()
    this.defects = SEED_LOOP_DEFECTS.map((d) => ({ ...d, status: 'open' as LoopStatus }))
    this.items = SEED_LOOP_ITEMS.map((it) => ({ ...it, history: it.history.map((h) => ({ ...h })) }))
    this.itemSeq = SEED_LOOP_ITEMS.length
    for (const item of this.items) {
      const defect = this.defects.find((d) => d.id === item.defectId)
      if (defect) {
        defect.status = item.status
        defect.itemId = item.id
      }
    }
  }

  private nextItemId(): string {
    this.itemSeq += 1
    return `it-${this.itemSeq}`
  }

  private cloneItem(it: RectificationItem): RectificationItem {
    return { ...it, history: it.history.map((h) => ({ ...h })) }
  }

  private findItem(id: string): RectificationItem {
    const item = this.items.find((i) => i.id === id)
    if (!item) throw new NotFoundException(`整改任务 ${id} 不存在`)
    return item
  }

  private pushHistory(item: RectificationItem, action: string, actor: string, note: string): void {
    item.history.push({ at: new Date().toISOString(), action, actor, note })
  }

  /** auditLog 记录 (DB 不可用时静默跳过) */
  private async recordAudit(action: string, resourceId: string, detail: unknown): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: { action, resource: 'qc-analytics', resourceId, detail: detail as never, tenantId: currentTenantId() },
      })
    } catch (err) {
      this.logger.debug(`[QcAnalytics] audit skipped: ${(err as Error).message}`)
    }
  }

  /** 报告样本: auditLog ('report-qc-v2'/'report-rule-violation') 派生 + seed 回退 (桥接报告 V2) */
  private async loadRecords(): Promise<{ source: 'database' | 'demo'; records: QcReportRecord[] }> {
    try {
      const rows = await this.prisma.auditLog.findMany({
        where: { resource: { in: ['report-qc-v2', 'report-rule-violation'] } },
        orderBy: { createdAt: 'asc' },
        take: 500,
      })
      if (rows.length > 0) {
        return { source: 'database', records: rows.map((r, i) => this.recordFromAuditRow(r, i)) }
      }
    } catch (err) {
      this.logger.debug(`[QcAnalytics] derive records failed, seed fallback: ${(err as Error).message}`)
    }
    return { source: 'demo', records: this.records }
  }

  private recordFromAuditRow(row: AuditLog, index: number): QcReportRecord {
    const detail = (row.detail ?? {}) as Record<string, unknown>
    const isQcV2 = row.resource === 'report-qc-v2'
    const defectCodes: DefectTypeCode[] = []
    if (isQcV2) {
      const grade = String(detail.grade ?? 'C')
      if (grade === 'D') defectCodes.push('missing_field', 'structure', 'critical')
      else if (grade === 'C') defectCodes.push('terminology', 'structure')
      else if (grade === 'B') defectCodes.push('unit', 'length_range')
    } else {
      const severities = Array.isArray(detail.severities) ? (detail.severities as string[]) : []
      for (const s of severities.slice(0, 3)) {
        const code = s === 'error' ? 'missing_field' : s === 'warning' ? 'terminology' : 'duplicate'
        if (!defectCodes.includes(code)) defectCodes.push(code)
      }
      if (Number(detail.score ?? 100) < 100 && !defectCodes.includes('numeric_reasonability')) defectCodes.push('numeric_reasonability')
    }
    const responseMinutes = Number(detail.responseMinutes ?? 45)
    return {
      id: row.resourceId ?? row.id ?? `derived-${index}`,
      reportId: String(detail.reportId ?? row.resourceId ?? row.id ?? `RPT-D-${index}`),
      department: String(detail.department ?? '放射科'),
      modality: String(detail.modality ?? 'CT'),
      reportedAt: row.createdAt.toISOString(),
      defectCodes: defectCodes.length > 0 ? defectCodes : ['unit'],
      qcScored: isQcV2,
      score: isQcV2 ? Number(detail.totalScore ?? 0) : Number(detail.score ?? 100),
      responseMinutes,
      timely: responseMinutes <= 60,
    }
  }

  /** 缺陷池: auditLog 真实缺陷 + seed 回退 (与 qc-pdca 同口径) */
  private async deriveDefects(): Promise<LoopDefect[]> {
    try {
      const rows = await this.prisma.auditLog.findMany({
        where: { resource: { in: ['qc-defect', 'defect-library', 'report-rule-violation'] } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
      if (rows.length === 0) return this.defects.map((d) => ({ ...d }))
      return rows.map((r, i) => {
        const detail = (r.detail ?? {}) as Record<string, unknown>
        const rawCode = String(detail.code ?? detail.defectType ?? '')
        const code = (DEFECT_TYPE_CODES as string[]).includes(rawCode) ? (rawCode as DefectTypeCode) : DEFECT_TYPE_CODES[i % DEFECT_TYPE_CODES.length]!
        return {
          id: r.resourceId ?? r.id,
          code,
          typeLabel: DEFECT_LABEL[code],
          reportId: String(detail.reportId ?? r.resourceId ?? ''),
          department: String(detail.department ?? '放射科'),
          severity: (['high', 'medium', 'low'].includes(String(detail.severity)) ? String(detail.severity) : 'medium') as 'high' | 'medium' | 'low',
          source: (detail.source === 'qc-v2' ? 'qc-v2' : detail.source === 'manual' ? 'manual' : 'rules-engine') as 'rules-engine' | 'qc-v2' | 'manual',
          message: String(detail.message ?? detail.description ?? '未分类缺陷'),
          discoveredAt: r.createdAt.toISOString(),
          status: 'open',
        }
      })
    } catch (err) {
      this.logger.warn(`[QcAnalytics] deriveDefects failed, fallback to seed: ${(err as Error).message}`)
      return this.defects.map((d) => ({ ...d }))
    }
  }

  // ================= 质控驾驶舱 =================

  async getDashboard(): Promise<DashboardData> {
    const { source, records } = await this.loadRecords()
    const base = buildDashboardData(records, this.items)
    return { source, generatedAt: new Date().toISOString(), ...base }
  }

  // ================= 趋势分析 =================

  async getTrends(period: 'week' | 'month' = 'month'): Promise<{ source: 'database' | 'demo'; generatedAt: string; period: 'week' | 'month'; points: TrendPoint[] }> {
    const { source, records } = await this.loadRecords()
    return { source, generatedAt: new Date().toISOString(), period, points: buildTrends(records, period) }
  }

  async getPareto(): Promise<ParetoData> {
    const { source, records } = await this.loadRecords()
    const items = buildPareto(records)
    return { source, generatedAt: new Date().toISOString(), totalDefects: items.reduce((a, i) => a + i.count, 0), items }
  }

  async getDepartments(): Promise<DepartmentRanking> {
    const { source, records } = await this.loadRecords()
    return { source, generatedAt: new Date().toISOString(), data: buildDepartmentRanking(records) }
  }

  // ================= 质控闭环 =================

  /** 缺陷列表 (带派生状态: 有整改任务 → 跟随任务状态) */
  async listLoopDefects(status?: string): Promise<{ source: 'database' | 'demo'; generatedAt: string; data: LoopDefect[] }> {
    const defects = await this.deriveDefects()
    const source = defects.length === this.defects.length ? 'demo' : 'database'
    let data = defects.map((d) => {
      const item = this.items.find((it) => it.defectId === d.id)
      return { ...d, status: item ? item.status : 'open', itemId: item?.id }
    })
    if (status) data = data.filter((d) => d.status === status)
    return { source, generatedAt: new Date().toISOString(), data }
  }

  /** 整改任务列表 */
  async listLoopItems(status?: string): Promise<{ source: 'database' | 'demo'; generatedAt: string; data: RectificationItem[] }> {
    let data = this.items.map((i) => this.cloneItem(i))
    if (status) data = data.filter((i) => i.status === status)
    return { source: 'demo', generatedAt: new Date().toISOString(), data }
  }

  async getLoopItem(id: string): Promise<RectificationItem> {
    return this.cloneItem(this.findItem(id))
  }

  /** 由缺陷派生整改任务 (缺陷 → 整改任务) */
  async createLoopItem(body: { defectId: string; assignee?: string; assigneeName?: string; title?: string }): Promise<RectificationItem> {
    if (!body.defectId?.trim()) throw new BadRequestException('defectId 不能为空')
    const defects = await this.deriveDefects()
    const defect = defects.find((d) => d.id === body.defectId)
    if (!defect) throw new NotFoundException(`缺陷 ${body.defectId} 不存在`)
    if (this.items.some((it) => it.defectId === body.defectId && it.status !== 'closed')) {
      throw new BadRequestException('该缺陷已有进行中的整改任务')
    }
    const now = new Date().toISOString()
    const item: RectificationItem = {
      id: this.nextItemId(),
      defectId: defect.id,
      defectCode: defect.code,
      typeLabel: defect.typeLabel,
      reportId: defect.reportId,
      department: defect.department,
      severity: defect.severity,
      source: defect.source,
      title: body.title?.trim() || `${defect.typeLabel}整改 (${defect.reportId})`,
      assignee: body.assignee?.trim() ?? 'u-102',
      assigneeName: body.assigneeName?.trim() ?? '王质控员',
      status: 'open',
      createdAt: now,
      updatedAt: now,
      recheckRounds: 0,
      history: [{ at: now, action: 'created', actor: '系统', note: `由缺陷 ${defect.id} 派生整改任务` }],
    }
    this.items.unshift(item)
    await this.recordAudit('QC_LOOP_CREATE', item.id, { defectId: defect.id, reportId: defect.reportId })
    return this.cloneItem(item)
  }

  /** 开始整改: open → rectifying */
  async startFix(id: string, body: { actor?: string; note?: string } = {}): Promise<RectificationItem> {
    const item = this.findItem(id)
    assertLoopTransition(item.status, 'rectifying')
    item.status = 'rectifying'
    item.updatedAt = new Date().toISOString()
    this.pushHistory(item, 'started', body.actor?.trim() || '当前用户', body.note?.trim() || '开始整改')
    await this.recordAudit('QC_LOOP_START', item.id, {})
    return this.cloneItem(item)
  }

  /** 提交整改: rectifying → rechecking */
  async submitFix(id: string, body: { note?: string; actor?: string } = {}): Promise<RectificationItem> {
    const item = this.findItem(id)
    assertLoopTransition(item.status, 'rechecking')
    item.status = 'rechecking'
    item.fixNote = body.note?.trim() || item.fixNote || '已提交整改说明'
    item.updatedAt = new Date().toISOString()
    this.pushHistory(item, 'fixed', body.actor?.trim() || '当前用户', item.fixNote)
    await this.recordAudit('QC_LOOP_FIX', item.id, {})
    return this.cloneItem(item)
  }

  /** 复查验证: 仅 rechecking 可复查; pass → closed / fail → rectifying */
  async recheckItem(id: string, body: { result: 'pass' | 'fail'; reviewer: string; note?: string }): Promise<RectificationItem> {
    if (!body.reviewer?.trim()) throw new BadRequestException('reviewer 不能为空')
    const item = this.findItem(id)
    if (item.status !== 'rechecking') throw new BadRequestException(`当前状态 ${item.status} 不可复查验证, 仅 rechecking 可复查`)
    const target: LoopStatus = body.result === 'pass' ? 'closed' : 'rectifying'
    item.status = target
    item.recheckRounds += 1
    item.recheckResult = body.result
    item.recheckNote = body.note?.trim() || (body.result === 'pass' ? '复查验证通过' : '复查退回, 需继续整改')
    item.updatedAt = new Date().toISOString()
    if (body.result === 'pass') {
      item.closedAt = item.closedAt ?? new Date().toISOString()
      this.pushHistory(item, 'rechecked', body.reviewer.trim(), '复查验证通过')
      this.pushHistory(item, 'closed', body.reviewer.trim(), '整改闭环')
    } else {
      this.pushHistory(item, 'rechecked', body.reviewer.trim(), `复查退回: ${item.recheckNote}`)
    }
    await this.recordAudit('QC_LOOP_RECHECK', item.id, { result: body.result })
    return this.cloneItem(item)
  }

  /** 关闭整改: open|rectifying|rechecking → closed (已关闭拒绝) */
  async closeLoopItem(id: string, body: { note?: string } = {}): Promise<RectificationItem> {
    const item = this.findItem(id)
    assertLoopTransition(item.status, 'closed')
    item.status = 'closed'
    item.closedAt = new Date().toISOString()
    item.updatedAt = item.closedAt
    this.pushHistory(item, 'closed', '当前用户', body.note?.trim() || '整改任务关闭')
    await this.recordAudit('QC_LOOP_CLOSE', item.id, {})
    return this.cloneItem(item)
  }

  /** 闭环统计: 关闭率 / 平均闭环天数 / 平均复查轮次 */
  getLoopStats(): { source: 'database' | 'demo'; generatedAt: string; data: LoopStats } {
    const byStatus: Record<LoopStatus, number> = { open: 0, rectifying: 0, rechecking: 0, closed: 0 }
    let closedDaysSum = 0
    let closedCount = 0
    let roundsSum = 0
    for (const item of this.items) {
      byStatus[item.status] += 1
      if (item.status === 'closed') {
        const start = new Date(item.createdAt).getTime()
        const end = new Date(item.closedAt ?? item.updatedAt).getTime()
        if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
          closedDaysSum += (end - start) / 86400000
          closedCount += 1
        }
      }
      roundsSum += item.recheckRounds
    }
    return {
      source: 'demo',
      generatedAt: new Date().toISOString(),
      data: {
        total: this.items.length,
        byStatus,
        closureRate: this.items.length > 0 ? round1((byStatus.closed / this.items.length) * 100) : 0,
        avgDaysToClose: closedCount > 0 ? round1(closedDaysSum / closedCount) : 0,
        avgRecheckRounds: this.items.length > 0 ? round1(roundsSum / this.items.length) : 0,
        openDefects: byStatus.open + byStatus.rectifying + byStatus.rechecking,
      },
    }
  }
}
