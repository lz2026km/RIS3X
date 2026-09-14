import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { OlapService } from '../olap/olap.service'
import { StatsService, DailyStatsData, WeeklyStatsData, WorkloadRow, QualityData } from '../stats/stats.service'
import { BiService, KpiPayload } from '../bi/bi.service'
import { NotificationsService } from '../../notifications/notifications.service'

// ════════════════════════════════════════════════════════════════════════════
// [G005 v3.0.6.11-99 Wave 5A] 自定义报表模块 (custom-report)
//   - 内存 CRUD + seed (重启恢复内置种子)
//   - GET /custom-reports/fields-catalog 字段目录按 dataSource 分组 (olap/stats/bi)
//   - POST /custom-reports/:id/run 执行: 按 fields 从 olap/stats/bi 派生数据 → 快照缓存
//   - POST /custom-reports/:id/schedule 定时+订阅人 → 联动 notifications/report-generated (Wave 5B)
//   - GET /custom-reports/:id/export 导出 CSV (含 BOM)
// ════════════════════════════════════════════════════════════════════════════

export type ReportStatus = 'idle' | 'running' | 'ready' | 'failed'
export type FieldSource = 'olap' | 'stats' | 'bi'

export interface FieldDef {
  id: string
  name: string
  source: FieldSource
  kind: 'measure' | 'dimension' | 'snapshot'
  unit?: string
  description: string
}

export interface CustomReportDef {
  id: string
  name: string
  category: string
  description: string
  fields: string[]
  period: string
  dataSource: string
  schedule: string | null
  recipients: string[]
  lastRunAt: string | null
  status: ReportStatus
  createdAt: string
  updatedAt: string
  // [v3.0.6.11-100 Wave 4A] 排序/分组设置 (页面向导)
  sortBy?: string | null
  sortOrder?: 'asc' | 'desc' | null
  groupBy?: string | null
}

export interface CreateCustomReportDto {
  name: string
  category?: string
  description?: string
  fields: string[]
  period?: string
  dataSource?: string
  schedule?: string | null
  recipients?: string[]
  sortBy?: string | null
  sortOrder?: 'asc' | 'desc' | null
  groupBy?: string | null
}

export interface ReportRunResult {
  id: string
  reportId: string
  columns: Array<{ key: string; name: string }>
  rows: Record<string, unknown>[]
  generatedAt: string
  source: string
  summary: Record<string, unknown>
}

export interface RunHistoryEntry {
  id: string
  reportId: string
  ranAt: string
  status: 'success' | 'failed'
  rowCount: number
  message: string
}

export interface ScheduleDto {
  schedule: string
  recipients: string[]
}

const PERIODS = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly']
const PERIOD_LABELS: Record<string, string> = { daily: '日', weekly: '周', monthly: '月', quarterly: '季', yearly: '年' }
// 每个周期回看窗口: 生成的行数受 olap granularity 控制 (daily≈30行, weekly≈12行, monthly≈12行 ...)
const PERIOD_WINDOW_DAYS: Record<string, number> = {
  daily: 30,
  weekly: 90,
  monthly: 365,
  quarterly: 730,
  yearly: 1825,
}

const DEFAULT_CATEGORY = '自定义报表'

// ── 字段目录 (派生自 olap 指标/维度 + stats 端点 + bi 端点) ──────────────────
// olap.measure 与 backend olap.service MEASURE_SQL_MAP / METRICS 对齐
const OLAP_MEASURES: FieldDef[] = [
  { id: 'exam_count', name: '检查量', source: 'olap', kind: 'measure', unit: '例', description: '检查总人次' },
  { id: 'exam_revenue', name: '检查收入', source: 'olap', kind: 'measure', unit: '元', description: '检查总收入金额' },
  { id: 'exam_cost', name: '检查成本', source: 'olap', kind: 'measure', unit: '元', description: '检查总成本' },
  { id: 'avg_exam_time', name: '平均检查时长', source: 'olap', kind: 'measure', unit: 'min', description: '平均每项检查耗时' },
  { id: 'avg_report_time', name: '平均报告时长', source: 'olap', kind: 'measure', unit: 'min', description: '报告创建到审核平均时长' },
  { id: 'report_count', name: '报告量', source: 'olap', kind: 'measure', unit: '份', description: '报告总数' },
  { id: 'report_revision_count', name: '报告修订次数', source: 'olap', kind: 'measure', unit: '次', description: '报告修订总次数' },
  { id: 'quality_score_avg', name: '平均质控评分', source: 'olap', kind: 'measure', unit: '分', description: '质控平均得分' },
  { id: 'quality_excellent_rate', name: '优秀率', source: 'olap', kind: 'measure', unit: '%', description: '质控评分优秀比例' },
  { id: 'quality_pass_rate', name: '合格率', source: 'olap', kind: 'measure', unit: '%', description: '质控评分合格比例' },
  { id: 'critical_count', name: '危急值数量', source: 'olap', kind: 'measure', unit: '例', description: '危急值报告数' },
  { id: 'critical_response_time', name: '危急值响应时长', source: 'olap', kind: 'measure', unit: 'min', description: '危急值平均响应时间' },
  { id: 'critical_notification_rate', name: '危急值通报率', source: 'olap', kind: 'measure', unit: '%', description: '危急值及时通报比例' },
  { id: 'device_usage_rate', name: '设备使用率', source: 'olap', kind: 'measure', unit: '%', description: '设备平均使用率' },
  { id: 'device_daily_exams', name: '设备日均检查量', source: 'olap', kind: 'measure', unit: '例', description: '设备每天平均检查数' },
  { id: 'device_maintenance_count', name: '设备维修次数', source: 'olap', kind: 'measure', unit: '次', description: '设备维修总次数' },
  { id: 'appointment_count', name: '预约量', source: 'olap', kind: 'measure', unit: '例', description: '预约总人次' },
  { id: 'appointment_no_show', name: '爽约量', source: 'olap', kind: 'measure', unit: '例', description: '爽约总人次' },
  { id: 'appointment_no_show_rate', name: '爽约率', source: 'olap', kind: 'measure', unit: '%', description: '爽约比例' },
  { id: 'avg_wait_time', name: '平均候诊时长', source: 'olap', kind: 'measure', unit: 'min', description: '患者平均候诊时间' },
  { id: 'dose_dlp_avg', name: '平均DLP剂量', source: 'olap', kind: 'measure', unit: 'mGy·cm', description: 'CT平均DLP剂量' },
  { id: 'dose_effective_avg', name: '平均有效剂量', source: 'olap', kind: 'measure', unit: 'mSv', description: '平均有效辐射剂量' },
  { id: 'dose_compliance_rate', name: '剂量合规率', source: 'olap', kind: 'measure', unit: '%', description: '辐射剂量达标比例' },
  { id: 'ai_suggestion_count', name: 'AI建议量', source: 'olap', kind: 'measure', unit: '条', description: 'AI辅助诊断建议数' },
  { id: 'ai_acceptance_rate', name: 'AI采纳率', source: 'olap', kind: 'measure', unit: '%', description: 'AI建议被医生采纳比例' },
  { id: 'patient_satisfaction', name: '患者满意度', source: 'olap', kind: 'measure', unit: '分', description: '患者满意度平均分' },
  { id: 'positive_rate', name: '阳性检出率', source: 'olap', kind: 'measure', unit: '%', description: '阳性发现检出比例' },
  { id: 'emergency_ratio', name: '急诊占比', source: 'olap', kind: 'measure', unit: '%', description: '急诊检查占总检查比例' },
  { id: 'inpatient_ratio', name: '住院占比', source: 'olap', kind: 'measure', unit: '%', description: '住院检查占总检查比例' },
  { id: 'report_timely_rate', name: '报告及时率', source: 'olap', kind: 'measure', unit: '%', description: '规定时间内完成报告比例' },
  { id: 'sla_compliance_rate', name: 'SLA达标率', source: 'olap', kind: 'measure', unit: '%', description: '服务级别协议达标比例' },
  { id: 'consultation_count', name: '会诊量', source: 'olap', kind: 'measure', unit: '例', description: '会诊总次数' },
  { id: 'avg_consultation_time', name: '平均会诊时长', source: 'olap', kind: 'measure', unit: 'min', description: '会诊平均耗时' },
  { id: 'contrast_usage_count', name: '造影剂使用量', source: 'olap', kind: 'measure', unit: 'ml', description: '造影剂总用量' },
  { id: 'contrast_reaction_count', name: '造影剂不良反应', source: 'olap', kind: 'measure', unit: '例', description: '不良反应事件数' },
]

const OLAP_DIMENSIONS: FieldDef[] = [
  { id: 'date', name: '日期', source: 'olap', kind: 'dimension', description: '检查日期' },
  { id: 'modality', name: '检查类型', source: 'olap', kind: 'dimension', description: '设备模态 (CT/MR/DR/MG/DSA)' },
  { id: 'device', name: '设备', source: 'olap', kind: 'dimension', description: '检查设备名称' },
  { id: 'doctor', name: '医生', source: 'olap', kind: 'dimension', description: '报告医生/审核医生' },
  { id: 'department', name: '科室', source: 'olap', kind: 'dimension', description: '申请科室/检查科室' },
  { id: 'body_part', name: '检查部位', source: 'olap', kind: 'dimension', description: '检查身体部位' },
  { id: 'age_group', name: '年龄分组', source: 'olap', kind: 'dimension', description: '患者年龄段' },
  { id: 'gender', name: '性别', source: 'olap', kind: 'dimension', description: '患者性别' },
  { id: 'patient_type', name: '患者类型', source: 'olap', kind: 'dimension', description: '门诊/住院/急诊/体检' },
  { id: 'report_state', name: '报告状态', source: 'olap', kind: 'dimension', description: '报告当前状态' },
]

const STATS_FIELDS: FieldDef[] = [
  { id: 'stats_daily_exams', name: '今日检查量', source: 'stats', kind: 'snapshot', unit: '例', description: 'stats/daily examCount' },
  { id: 'stats_daily_reports', name: '今日报告量', source: 'stats', kind: 'snapshot', unit: '份', description: 'stats/daily reportCount' },
  { id: 'stats_daily_critical', name: '今日危急值', source: 'stats', kind: 'snapshot', unit: '例', description: 'stats/daily criticalCount' },
  { id: 'stats_weekly_exams', name: '近7天检查量', source: 'stats', kind: 'snapshot', unit: '例', description: 'stats/weekly totalExams' },
  { id: 'stats_workload_total', name: '医生工作量合计', source: 'stats', kind: 'snapshot', unit: '例', description: 'stats/workload examCount 汇总' },
  { id: 'stats_quality_avg', name: '质控均分', source: 'stats', kind: 'snapshot', unit: '分', description: 'stats/quality averageScore' },
  { id: 'stats_quality_defect_rate', name: '质控缺陷率', source: 'stats', kind: 'snapshot', unit: '%', description: 'stats/quality defectRate' },
  { id: 'stats_utilization', name: '设备利用率', source: 'stats', kind: 'snapshot', unit: '%', description: 'stats/utilization current' },
  { id: 'stats_accuracy', name: '报告准确率', source: 'stats', kind: 'snapshot', unit: '%', description: 'stats/accuracy value' },
  { id: 'stats_top_device', name: 'TOP设备检查量', source: 'stats', kind: 'snapshot', unit: '例', description: 'stats/top-devices 首台检查量' },
]

const BI_FIELDS: FieldDef[] = [
  { id: 'bi_exam_count', name: 'BI检查量', source: 'bi', kind: 'snapshot', unit: '例', description: 'bi/kpi examCount' },
  { id: 'bi_completion_rate', name: '报告完成率', source: 'bi', kind: 'snapshot', unit: '%', description: 'bi/kpi completionRate' },
  { id: 'bi_avg_report_minutes', name: '平均报告时长', source: 'bi', kind: 'snapshot', unit: 'min', description: 'bi/kpi avgReportMinutes' },
  { id: 'bi_critical_sla', name: '危急值SLA达标率', source: 'bi', kind: 'snapshot', unit: '%', description: 'bi/kpi criticalSlaRate' },
  { id: 'bi_rvu_total', name: '医生RVU合计', source: 'bi', kind: 'snapshot', unit: 'RVU', description: 'bi/physician-rvu totalRvu' },
  { id: 'bi_timeliness_median', name: '报告时效中位数', source: 'bi', kind: 'snapshot', unit: 'min', description: 'bi/report-timeliness medianMinutes' },
  { id: 'bi_sla_compliance', name: '危急值合规率', source: 'bi', kind: 'snapshot', unit: '%', description: 'bi/critical-sla complianceRate' },
  { id: 'bi_bonus_total', name: '绩效奖金合计', source: 'bi', kind: 'snapshot', unit: '元', description: 'bi/physician-performance totalBonus' },
  { id: 'bi_device_oee_avg', name: '设备OEE均值', source: 'bi', kind: 'snapshot', unit: '%', description: 'bi/device-oee 首台 avgOee' },
]

const FIELD_CATALOG: FieldDef[] = [...OLAP_MEASURES, ...OLAP_DIMENSIONS, ...STATS_FIELDS, ...BI_FIELDS]

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function num(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// 从统计/BI 信封里取 data (兼容 { source, data } / 裸对象两种形状)
function unwrap<T>(v: { source?: string; data: T } | T | unknown): T {
  if (v && typeof v === 'object' && 'data' in v) {
    const data = (v as { data?: unknown }).data
    if (data !== null && data !== undefined && typeof data === 'object') return data as T
  }
  return v as T
}

const SEED_DEFS: CustomReportDef[] = [
  {
    id: 'cr-weekly-exam',
    name: '科室检查周报',
    category: '日常统计',
    description: '按周汇总检查量/收入/阳性率, 每周一 08:00 自动生成并推送订阅通知',
    fields: ['exam_count', 'report_count', 'exam_revenue', 'positive_rate'],
    period: 'weekly',
    dataSource: 'olap',
    schedule: 'weekly: 周一 08:00',
    recipients: ['current'],
    lastRunAt: null,
    status: 'idle',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'cr-monthly-quality',
    name: '月度质控报告',
    category: '报告质量',
    description: '质控评分/优秀率/合格率/及时率月度趋势',
    fields: ['quality_score_avg', 'quality_excellent_rate', 'quality_pass_rate', 'report_timely_rate'],
    period: 'monthly',
    dataSource: 'olap',
    schedule: null,
    recipients: [],
    lastRunAt: null,
    status: 'idle',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'cr-device-daily',
    name: '设备运营快报',
    category: '设备管理',
    description: '设备使用率 + 日均检查量 + 统计利用率 + BI OEE 混合快报',
    fields: ['device_usage_rate', 'device_daily_exams', 'stats_utilization', 'bi_device_oee_avg'],
    period: 'daily',
    dataSource: 'mixed',
    schedule: null,
    recipients: [],
    lastRunAt: null,
    status: 'idle',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'cr-performance-month',
    name: '医生绩效月报',
    category: '绩效分析',
    description: 'BI KPI + RVU + 奖金合计月度汇总',
    fields: ['bi_exam_count', 'bi_completion_rate', 'bi_rvu_total', 'bi_bonus_total'],
    period: 'monthly',
    dataSource: 'bi',
    schedule: null,
    recipients: [],
    lastRunAt: null,
    status: 'idle',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'cr-critical-sla',
    name: '危急值SLA周报',
    category: '危急值',
    description: '危急值数量/响应时长 + BI SLA 合规率周报',
    fields: ['critical_count', 'critical_response_time', 'bi_critical_sla', 'bi_sla_compliance'],
    period: 'weekly',
    dataSource: 'mixed',
    schedule: null,
    recipients: [],
    lastRunAt: null,
    status: 'idle',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  },
  // [G005 Wave 10A] 扩充至 8 个报表定义: 日工作量 / 周收入 / 月度质控 / 危急值 SLA 等
  {
    id: 'cr-daily-workload',
    name: '日工作量日报',
    category: '日常统计',
    description: '按日统计检查量/报告量/技师工作量/设备利用率, 当日 20:00 自动生成',
    fields: ['exam_count', 'report_count', 'stats_workload_total', 'device_usage_rate', 'stats_utilization'],
    period: 'daily',
    dataSource: 'mixed',
    schedule: 'daily: 20:00',
    recipients: ['current'],
    lastRunAt: null,
    status: 'idle',
    createdAt: '2026-08-02T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
  },
  {
    id: 'cr-weekly-revenue',
    name: '周收入汇总',
    category: '财务管理',
    description: '按周汇总检查收入/报告费用/医保占比/自费占比',
    fields: ['exam_revenue', 'bi_exam_count', 'positive_rate', 'report_count'],
    period: 'weekly',
    dataSource: 'mixed',
    schedule: 'weekly: 周日 18:00',
    recipients: ['current', 'admin'],
    lastRunAt: null,
    status: 'idle',
    createdAt: '2026-08-02T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
  },
  {
    id: 'cr-monthly-utilization',
    name: '月度设备利用率',
    category: '设备管理',
    description: '月度设备使用率/单台检查量/OEE/故障停机时长分析',
    fields: ['device_usage_rate', 'device_daily_exams', 'bi_device_oee_avg', 'stats_utilization'],
    period: 'monthly',
    dataSource: 'mixed',
    schedule: null,
    recipients: ['admin'],
    lastRunAt: null,
    status: 'idle',
    createdAt: '2026-08-02T00:00:00.000Z',
    updatedAt: '2026-08-02T00:00:00.000Z',
  },
]

@Injectable()
export class CustomReportService {
  private readonly logger = new Logger(CustomReportService.name)
  private defs: CustomReportDef[] = SEED_DEFS.map((d) => ({ ...d, fields: [...d.fields], recipients: [...d.recipients] }))
  private results = new Map<string, ReportRunResult>()
  private history: RunHistoryEntry[] = []
  // [v3.0.6.11-104] 单调递增序号, 避免同一毫秒创建的 ID 冲突
  private seq = 0

  constructor(
    private readonly olap: OlapService,
    private readonly stats: StatsService,
    private readonly bi: BiService,
    private readonly notifications: NotificationsService,
  ) {}

  // ── CRUD ──────────────────────────────────────────────────────────────────
  list(): CustomReportDef[] {
    return [...this.defs]
  }

  get(id: string): CustomReportDef {
    return this.requireDef(id)
  }

  getFieldsCatalog(): FieldDef[] {
    return FIELD_CATALOG.map((f) => ({ ...f }))
  }

  create(dto: CreateCustomReportDto): CustomReportDef {
    this.validateDef(dto)
    const now = new Date().toISOString()
    const def: CustomReportDef = {
      id: `cr-${Date.now()}-${++this.seq}`,
      name: dto.name.trim(),
      category: dto.category?.trim() || DEFAULT_CATEGORY,
      description: dto.description?.trim() ?? '',
      fields: [...dto.fields],
      period: dto.period && PERIODS.includes(dto.period) ? dto.period : 'monthly',
      dataSource: dto.dataSource?.trim() || 'olap',
      schedule: dto.schedule ?? null,
      recipients: Array.isArray(dto.recipients) ? [...dto.recipients] : [],
      lastRunAt: null,
      status: 'idle',
      sortBy: dto.sortBy ?? null,
      sortOrder: dto.sortOrder ?? null,
      groupBy: dto.groupBy ?? null,
      createdAt: now,
      updatedAt: now,
    }
    this.defs.unshift(def)
    return def
  }

  update(id: string, dto: Partial<CreateCustomReportDto>): CustomReportDef {
    const def = this.requireDef(id)
    if (dto.name != null) {
      if (!dto.name.trim()) throw new BadRequestException('报表名称不能为空')
      def.name = dto.name.trim()
    }
    if (dto.category != null && dto.category.trim()) def.category = dto.category.trim()
    if (dto.description != null) def.description = dto.description.trim()
    if (dto.fields != null) {
      if (!Array.isArray(dto.fields) || dto.fields.length === 0) throw new BadRequestException('至少选择一个字段')
      this.assertKnownFields(dto.fields)
      def.fields = [...dto.fields]
    }
    if (dto.period != null) {
      if (!PERIODS.includes(dto.period)) throw new BadRequestException(`周期(period)必须为 ${PERIODS.join('/')}`)
      def.period = dto.period
    }
    if (dto.dataSource != null && dto.dataSource.trim()) def.dataSource = dto.dataSource.trim()
    if (dto.schedule !== undefined) def.schedule = dto.schedule
    if (dto.recipients != null) def.recipients = [...dto.recipients]
    if (dto.sortBy !== undefined) def.sortBy = dto.sortBy
    if (dto.sortOrder !== undefined) def.sortOrder = dto.sortOrder
    if (dto.groupBy !== undefined) def.groupBy = dto.groupBy
    def.updatedAt = new Date().toISOString()
    return def
  }

  remove(id: string): { id: string; deleted: boolean } {
    const before = this.defs.length
    this.defs = this.defs.filter((d) => d.id !== id)
    this.results.delete(id)
    this.history = this.history.filter((h) => h.reportId !== id)
    return { id, deleted: this.defs.length < before }
  }

  // ── 执行 ──────────────────────────────────────────────────────────────────
  async run(id: string): Promise<ReportRunResult> {
    const def = this.requireDef(id)
    def.status = 'running'
    def.lastRunAt = new Date().toISOString()
    const runId = `run-${Date.now()}-${++this.seq}`
    try {
      const { rows, source } = await this.collectRows(def)
      this.applySort(def, rows)
      const columns = this.buildColumns(def, rows)
      const summary = this.buildSummary(def, rows)
      const result: ReportRunResult = {
        id: runId,
        reportId: id,
        columns,
        rows,
        generatedAt: new Date().toISOString(),
        source,
        summary,
      }
      this.results.set(id, result)
      this.pushHistory({ id: runId, reportId: id, ranAt: new Date().toISOString(), status: 'success', rowCount: rows.length, message: source })
      def.status = 'ready'
      // [Wave 5A/5B 联动] 已设置定时+订阅人的报表, 生成后自动推送「报表已生成」通知
      if (def.schedule && def.recipients.length > 0) {
        await this.pushGenerated(def, rows.length, source)
      }
      return result
    } catch (err) {
      def.status = 'failed'
      const msg = (err as Error).message
      this.pushHistory({ id: runId, reportId: id, ranAt: new Date().toISOString(), status: 'failed', rowCount: 0, message: msg })
      this.logger.error(`[CustomReport] run ${id} failed: ${msg}`)
      throw err
    }
  }

  getResult(id: string): ReportRunResult {
    const result = this.results.get(id)
    if (!result) throw new NotFoundException(`报表 ${id} 尚未执行, 请先运行`)
    return result
  }

  getHistory(reportId?: string): RunHistoryEntry[] {
    const list = reportId ? this.history.filter((h) => h.reportId === reportId) : [...this.history]
    return list.sort((a, b) => (a.ranAt < b.ranAt ? 1 : -1))
  }

  // ── 定时 + 推送联动 ────────────────────────────────────────────────────────
  async setSchedule(id: string, dto: ScheduleDto): Promise<{ def: CustomReportDef; notified: { count: number } }> {
    const def = this.requireDef(id)
    if (!dto.schedule?.trim()) throw new BadRequestException('定时规则(schedule)不能为空')
    if (!Array.isArray(dto.recipients) || dto.recipients.length === 0) throw new BadRequestException('至少选择一位订阅人(recipients)')
    def.schedule = dto.schedule.trim()
    def.recipients = [...dto.recipients]
    def.updatedAt = new Date().toISOString()
    const summary = `定时: ${def.schedule} · 周期: ${PERIOD_LABELS[def.period] ?? def.period} · 字段: ${def.fields.map((f) => this.catalogField(f)?.name ?? f).join('、')}`
    const notified = await this.notifications.reportGenerated({
      reportId: def.id,
      reportName: def.name,
      recipients: def.recipients,
      summary,
      link: '/data-report-center',
    })
    return { def, notified: { count: Number(notified?.count ?? 1) } }
  }

  // ── 导出 ──────────────────────────────────────────────────────────────────
  exportCsv(id: string): string {
    const result = this.getResult(id)
    const esc = (v: unknown): string => {
      const s = String(v ?? '')
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const header = result.columns.map((c) => c.name)
    const lines = [header.map(esc).join(',')]
    for (const row of result.rows) {
      lines.push(result.columns.map((c) => esc(row[c.key])).join(','))
    }
    return '\uFEFF' + lines.join('\r\n')
  }

  // ── internal ──────────────────────────────────────────────────────────────
  private requireDef(id: string): CustomReportDef {
    const def = this.defs.find((d) => d.id === id)
    if (!def) throw new NotFoundException(`自定义报表不存在: ${id}`)
    return def
  }

  private validateDef(dto: CreateCustomReportDto): void {
    if (!dto?.name?.trim()) throw new BadRequestException('报表名称必填')
    if (!Array.isArray(dto.fields) || dto.fields.length === 0) throw new BadRequestException('至少选择一个字段')
    this.assertKnownFields(dto.fields)
  }

  private assertKnownFields(fields: string[]): void {
    const known = new Set(FIELD_CATALOG.map((f) => f.id))
    const unknown = fields.filter((f) => !known.has(f))
    if (unknown.length > 0) throw new BadRequestException(`未知字段: ${unknown.join(', ')} (请从 fields-catalog 选择)`)
  }

  private catalogField(id: string): FieldDef | undefined {
    return FIELD_CATALOG.find((f) => f.id === id)
  }

  private async collectRows(def: CustomReportDef): Promise<{ rows: Record<string, unknown>[]; source: string }> {
    const rows: Record<string, unknown>[] = []
    let source = def.dataSource

    const olapMeasures = def.fields.filter((f) => this.catalogField(f)?.source === 'olap' && this.catalogField(f)?.kind === 'measure')
    if (olapMeasures.length > 0) {
      const windowDays = PERIOD_WINDOW_DAYS[def.period] ?? 30
      const start = isoDaysAgo(windowDays)
      const res = await this.olap.executeQuery({
        dimensions: ['date'],
        measures: olapMeasures,
        filters: [{ dimension: 'date', operator: 'between', value: [start, new Date().toISOString().slice(0, 10)] }],
        granularity: def.period,
        orderBy: [{ dimension: 'date', direction: 'asc' }],
        limit: 200,
      })
      const src = (res as unknown as Record<string, unknown>)?.source
      source = `olap${typeof src === 'string' && src ? `·${src}` : ''}`
      for (const raw of res.rows ?? []) {
        const row: Record<string, unknown> = { 周期: String(raw['date'] ?? '') }
        for (const f of olapMeasures) {
          const cat = this.catalogField(f)!
          row[cat.name] = this.roundNum(num(raw[f]), f)
        }
        rows.push(row)
      }
    }

    const snapshotFields = def.fields.filter((f) => {
      const c = this.catalogField(f)
      return c && c.source !== 'olap'
    })
    if (snapshotFields.length > 0) {
      const snap: Record<string, unknown> = {}
      for (const f of snapshotFields) {
        const cat = this.catalogField(f)!
        snap[cat.name] = await this.snapshotFieldValue(cat)
      }
      if (rows.length > 0) {
        for (const row of rows) Object.assign(row, snap)
        source = `${source}+快照`
      } else {
        rows.push({ 周期: '快照', ...snap })
        source = `snapshot(${def.dataSource})`
      }
    }
    return { rows, source }
  }

  private roundNum(v: number, fieldId: string): number {
    if (Number.isInteger(v)) return v
    const rateLike = /rate|_rate|satisfaction|score|oee|utilization|compliance|accuracy/.test(fieldId)
    return rateLike ? Math.round(v * 10) / 10 : Math.round(v * 100) / 100
  }

  private buildColumns(def: CustomReportDef, rows: Record<string, unknown>[]): Array<{ key: string; name: string }> {
    const keys = rows.length > 0 ? Object.keys(rows[0]!) : ['周期', ...def.fields.map((f) => this.catalogField(f)?.name ?? f)]
    return keys.map((k) => ({ key: k, name: k === '周期' ? '周期' : k }))
  }

  // [v3.0.6.11-100 Wave 4A] 按 sortBy 字段排序 (数值优先, 否则字典序; 仅当设置了 sortBy)
  private applySort(def: CustomReportDef, rows: Record<string, unknown>[]): void {
    const sortField = def.sortBy ? this.catalogField(def.sortBy) : undefined
    if (!sortField || rows.length < 2) return
    const key = sortField.name
    const dir = def.sortOrder === 'desc' ? -1 : 1
    rows.sort((a, b) => {
      const va = a[key]
      const vb = b[key]
      const na = typeof va === 'number' ? va : Number(va)
      const nb = typeof vb === 'number' ? vb : Number(vb)
      if (Number.isFinite(na) && Number.isFinite(nb)) return (na - nb) * dir
      return String(va ?? '').localeCompare(String(vb ?? ''), 'zh-CN') * dir
    })
  }

  private buildSummary(def: CustomReportDef, rows: Record<string, unknown>[]): Record<string, unknown> {
    const fields = def.fields.map((f) => this.catalogField(f)).filter((f): f is FieldDef => !!f)
    const last = rows[rows.length - 1] ?? {}
    const summary: Record<string, unknown> = {
      rowCount: rows.length,
      period: def.period,
      dataSource: def.dataSource,
    }
    for (const f of fields) {
      if (rows.length > 0) {
        const values = rows.map((r) => num(r[f.name])).filter((v) => Number.isFinite(v))
        if (values.length > 0) {
          summary[`${f.name}合计`] = Math.round(values.reduce((s, v) => s + v, 0) * 100) / 100
        }
      }
      if (last[f.name] !== undefined) summary[`${f.name}最新`] = last[f.name]
    }
    return summary
  }

  private async pushGenerated(def: CustomReportDef, rowCount: number, source: string): Promise<void> {
    const fields = def.fields.map((f) => this.catalogField(f)?.name ?? f)
    await this.notifications.reportGenerated({
      reportId: def.id,
      reportName: def.name,
      recipients: def.recipients,
      summary: `已生成 ${rowCount} 行 · 数据源: ${source} · 字段: ${fields.join('、')}`,
      link: '/data-report-center',
    })
  }

  private pushHistory(entry: RunHistoryEntry): void {
    this.history.unshift(entry)
    if (this.history.length > 50) this.history = this.history.slice(0, 50)
  }

  // stats/bi 快照字段取值 (service 层真实派生, 失败回退 0 并打 warn)
  private async snapshotFieldValue(cat: FieldDef): Promise<number> {
    try {
      switch (cat.id) {
        case 'stats_daily_exams': return num(unwrap<DailyStatsData>(await this.stats.getDaily()).examCount)
        case 'stats_daily_reports': return num(unwrap<DailyStatsData>(await this.stats.getDaily()).reportCount)
        case 'stats_daily_critical': return num(unwrap<DailyStatsData>(await this.stats.getDaily()).criticalCount)
        case 'stats_weekly_exams': return num(unwrap<WeeklyStatsData>(await this.stats.getWeekly()).totalExams)
        case 'stats_workload_total': {
          const rows = unwrap<WorkloadRow[]>(await this.stats.getWorkload())
          return Array.isArray(rows) ? Math.round(rows.reduce((s, r) => s + num(r?.examCount), 0)) : 0
        }
        case 'stats_quality_avg': return num(unwrap<QualityData>(await this.stats.getQuality()).averageScore)
        case 'stats_quality_defect_rate': return num(unwrap<QualityData>(await this.stats.getQuality()).defectRate)
        case 'stats_utilization': return num((await this.stats.getUtilization())?.current)
        case 'stats_accuracy': return num((await this.stats.getAccuracy())?.value)
        case 'stats_top_device': {
          const rows = await this.stats.getTopDevices(1)
          return Array.isArray(rows) ? num(rows[0]?.count) : 0
        }
        case 'bi_exam_count': return num(unwrap<KpiPayload>(await this.bi.getKpi()).examCount)
        case 'bi_completion_rate': return num(unwrap<KpiPayload>(await this.bi.getKpi()).completionRate)
        case 'bi_avg_report_minutes': return num(unwrap<KpiPayload>(await this.bi.getKpi()).avgReportMinutes)
        case 'bi_critical_sla': return num(unwrap<KpiPayload>(await this.bi.getKpi()).criticalSlaRate)
        case 'bi_rvu_total': return num(unwrap<{ totalRvu: number }>(await this.bi.getPhysicianRvu()).totalRvu)
        case 'bi_timeliness_median': return num(unwrap<{ medianMinutes: number }>(await this.bi.getReportTimeliness()).medianMinutes)
        case 'bi_sla_compliance': return num(unwrap<{ complianceRate: number }>(await this.bi.getCriticalSla()).complianceRate)
        case 'bi_bonus_total': return num(unwrap<{ totalBonus: number }>(await this.bi.getPhysicianPerformance()).totalBonus)
        case 'bi_device_oee_avg': {
          const data = unwrap<{ devices?: Array<{ avgOee?: number }> }>(await this.bi.getDeviceOee(14))
          return num(Array.isArray(data?.devices) ? data.devices[0]?.avgOee : 0)
        }
        default:
          return 0
      }
    } catch (err) {
      this.logger.warn(`[CustomReport] snapshot ${cat.id} failed: ${(err as Error).message}`)
      return 0
    }
  }
}
