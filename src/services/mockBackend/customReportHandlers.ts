// [v3.0.6.11-99 Wave 5A] 自定义报表模块 MSW handlers
// 与后端 backend/src/modules/custom-report 端点一致:
//   GET/POST /custom-reports, GET/PATCH/DELETE /custom-reports/:id
//   POST /custom-reports/:id/run  GET /custom-reports/:id/result  GET /custom-reports/:id/history
//   POST /custom-reports/:id/schedule (联动 pushReportGenerated → 通知中心)
//   GET /custom-reports/fields-catalog  GET /custom-reports/:id/export
import { http, HttpResponse, delay } from 'msw'
import { pushReportGenerated } from './notificationsHandlers'

const API_BASE =
  typeof process !== 'undefined' && process.env.VITEST
    ? 'http://localhost:5173/api/v1'
    : typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin + '/api/v1'
      : 'http://localhost:5173/api/v1'

// ── 字段目录 (对齐 backend custom-report FIELD_CATALOG) ─────────────────────
export const CUSTOM_FIELD_CATALOG: Array<{
  id: string
  name: string
  source: 'olap' | 'stats' | 'bi'
  kind: 'measure' | 'dimension' | 'snapshot'
  unit?: string
  description: string
}> = [
  // olap measures (与 backend olap.service METRICS / MEASURE_SQL_MAP 对齐)
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
  // olap dimensions
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
  // stats 快照字段
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
  // bi 快照字段
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

interface MockReportDef {
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
  status: 'idle' | 'running' | 'ready' | 'failed'
  createdAt: string
  updatedAt: string
}

interface MockRunResult {
  id: string
  reportId: string
  columns: Array<{ key: string; name: string }>
  rows: Record<string, unknown>[]
  generatedAt: string
  source: string
  summary: Record<string, unknown>
}

interface MockRunHistory {
  id: string
  reportId: string
  ranAt: string
  status: 'success' | 'failed'
  rowCount: number
  message: string
}

function isoAgoDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function buildSeed(): MockReportDef[] {
  const now = '2026-08-01T00:00:00.000Z'
  return [
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
      createdAt: now,
      updatedAt: now,
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
      createdAt: now,
      updatedAt: now,
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
      createdAt: now,
      updatedAt: now,
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
      createdAt: now,
      updatedAt: now,
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
      createdAt: now,
      updatedAt: now,
    },
  ]
}

const state: { defs: MockReportDef[]; results: Map<string, MockRunResult>; history: MockRunHistory[] } = {
  defs: buildSeed(),
  results: new Map(),
  history: [],
}

const catalogIndex = new Map(CUSTOM_FIELD_CATALOG.map((f) => [f.id, f]))

function catalogField(id: string) {
  return catalogIndex.get(id)
}

// 确定性 PRNG (mulberry32) — 演示结果可复现
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function stringHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

function isoPeriodBucket(dateStr: string, period: string): string {
  if (period === 'daily') return dateStr
  if (period === 'weekly') {
    const d = new Date(dateStr + 'T00:00:00Z')
    const year = d.getUTCFullYear()
    const start = Date.UTC(year, 0, 1)
    const week = Math.floor((d.getTime() - start) / 86400000 / 7) + 1
    return `${year}-W${String(week).padStart(2, '0')}`
  }
  if (period === 'quarterly') {
    const m = Number(dateStr.slice(5, 7)) || 1
    return `${dateStr.slice(0, 4)}-Q${Math.ceil(m / 3)}`
  }
  if (period === 'yearly') return dateStr.slice(0, 4)
  return dateStr.slice(0, 7)
}

function snapshotValue(fieldId: string): number {
  // 确定性: 基于 fieldId hash + 日期种子
  const seed = stringHash(fieldId) ^ (new Date().getDate() * 7919)
  const rand = mulberry32(seed)
  if (fieldId.includes('rate') || fieldId.includes('utilization') || fieldId.includes('accuracy') || fieldId.includes('compliance') || fieldId.includes('oee') || fieldId.includes('score') || fieldId.includes('sla')) {
    return Math.round((70 + rand() * 28) * 10) / 10
  }
  if (fieldId.includes('bonus')) return Math.round(8000 + rand() * 12000)
  if (fieldId.includes('rvu')) return Math.round(600 + rand() * 900)
  return Math.round(20 + rand() * 280)
}

function runReport(def: MockReportDef): MockRunResult {
  const nowIso = new Date().toISOString()
  const olapFields = def.fields.filter((f) => catalogField(f)?.source === 'olap' && catalogField(f)?.kind === 'measure')
  const snapshotFields = def.fields.filter((f) => catalogField(f) && catalogField(f)!.source !== 'olap')
  const rows: Record<string, unknown>[] = []

  if (olapFields.length > 0) {
    const windowDays = def.period === 'daily' ? 14 : def.period === 'weekly' ? 8 : def.period === 'monthly' ? 6 : 4
    const seedBase = stringHash(def.id)
    const rand = mulberry32(seedBase ^ (Date.now() % 86400000))
    for (let i = 0; i < windowDays; i++) {
      const date = isoAgoDays((def.period === 'daily' ? windowDays - 1 - i : i * (def.period === 'weekly' ? 7 : def.period === 'monthly' ? 30 : 90)))
      const row: Record<string, unknown> = { 周期: isoPeriodBucket(date, def.period) }
      for (const f of olapFields) {
        const cat = catalogField(f)!
        let v: number
        if (cat.id.includes('revenue') || cat.id.includes('cost')) v = Math.round((200 + rand() * 600) * 1250)
        else if (cat.id.includes('rate') || cat.id.includes('score')) v = Math.round((70 + rand() * 28) * 10) / 10
        else v = Math.round(8 + rand() * 42)
        row[cat.name] = v
      }
      rows.push(row)
    }
  }

  if (snapshotFields.length > 0) {
    const snap: Record<string, unknown> = {}
    for (const f of snapshotFields) {
      const cat = catalogField(f)!
      snap[cat.name] = snapshotValue(f)
    }
    if (rows.length > 0) {
      for (const row of rows) Object.assign(row, snap)
    } else {
      rows.push({ 周期: '快照', ...snap })
    }
  }

  const columns = (rows.length > 0 ? Object.keys(rows[0]!) : ['周期']).map((k) => ({ key: k, name: k === '周期' ? '周期' : k }))
  const summary: Record<string, unknown> = { rowCount: rows.length, period: def.period, dataSource: def.dataSource }
  const last = rows[rows.length - 1] ?? {}
  for (const f of def.fields) {
    const cat = catalogField(f)
    if (!cat) continue
    if (last[cat.name] !== undefined) summary[`${cat.name}最新`] = last[cat.name]
  }
  const result: MockRunResult = {
    id: `run-${Date.now()}`,
    reportId: def.id,
    columns,
    rows,
    generatedAt: nowIso,
    source: olapFields.length > 0 ? `olap·msw${snapshotFields.length > 0 ? '+快照' : ''}` : 'snapshot(msw)',
    summary,
  }
  state.results.set(def.id, result)
  state.history.unshift({
    id: result.id,
    reportId: def.id,
    ranAt: nowIso,
    status: 'success',
    rowCount: rows.length,
    message: result.source,
  })
  if (state.history.length > 50) state.history = state.history.slice(0, 50)
  return result
}

// ── handlers (静态路由注册在 :id 之前, 避免被 id 捕获) ───────────────────────
export const customReportHandlers = [
  http.get(`${API_BASE}/custom-reports`, async () => {
    await delay(80)
    return HttpResponse.json(state.defs.map((d) => ({ ...d, fields: [...d.fields], recipients: [...d.recipients] })))
  }),

  http.get(`${API_BASE}/custom-reports/fields-catalog`, async () => {
    await delay(60)
    return HttpResponse.json(CUSTOM_FIELD_CATALOG.map((f) => ({ ...f })))
  }),

  http.post(`${API_BASE}/custom-reports`, async ({ request }) => {
    await delay(100)
    const body = (await request.json()) as Partial<MockReportDef>
    if (!body?.name?.trim() || !Array.isArray(body.fields) || body.fields.length === 0) {
      return HttpResponse.json({ success: false, error: { code: 'VALIDATION', message: '名称必填, 且至少选择一个字段' } }, { status: 400 })
    }
    const now = new Date().toISOString()
    const def: MockReportDef = {
      id: `cr-${Date.now()}`,
      name: body.name.trim(),
      category: body.category?.trim() || '自定义报表',
      description: body.description?.trim() ?? '',
      fields: [...body.fields],
      period: body.period || 'monthly',
      dataSource: body.dataSource || 'olap',
      schedule: body.schedule ?? null,
      recipients: Array.isArray(body.recipients) ? [...body.recipients] : [],
      lastRunAt: null,
      status: 'idle',
      createdAt: now,
      updatedAt: now,
    }
    state.defs.unshift(def)
    return HttpResponse.json(def, { status: 201 })
  }),

  http.get(`${API_BASE}/custom-reports/:id`, async ({ params }) => {
    await delay(60)
    const def = state.defs.find((d) => d.id === params.id)
    if (!def) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `自定义报表不存在: ${params.id}` } }, { status: 404 })
    return HttpResponse.json({ ...def, fields: [...def.fields], recipients: [...def.recipients] })
  }),

  http.patch(`${API_BASE}/custom-reports/:id`, async ({ params, request }) => {
    await delay(80)
    const def = state.defs.find((d) => d.id === params.id)
    if (!def) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `自定义报表不存在: ${params.id}` } }, { status: 404 })
    const body = (await request.json()) as Partial<MockReportDef>
    if (body.name != null) {
      if (!body.name.trim()) return HttpResponse.json({ success: false, error: { code: 'VALIDATION', message: '报表名称不能为空' } }, { status: 400 })
      def.name = body.name.trim()
    }
    if (body.category != null && body.category.trim()) def.category = body.category.trim()
    if (body.description != null) def.description = body.description.trim()
    if (body.fields != null) {
      if (!Array.isArray(body.fields) || body.fields.length === 0) return HttpResponse.json({ success: false, error: { code: 'VALIDATION', message: '至少选择一个字段' } }, { status: 400 })
      def.fields = [...body.fields]
    }
    if (body.period != null) def.period = body.period
    if (body.dataSource != null && body.dataSource.trim()) def.dataSource = body.dataSource.trim()
    if (body.schedule !== undefined) def.schedule = body.schedule
    if (body.recipients != null) def.recipients = [...body.recipients]
    def.updatedAt = new Date().toISOString()
    return HttpResponse.json(def)
  }),

  http.delete(`${API_BASE}/custom-reports/:id`, async ({ params }) => {
    await delay(60)
    const before = state.defs.length
    state.defs = state.defs.filter((d) => d.id !== params.id)
    state.results.delete(String(params.id))
    state.history = state.history.filter((h) => h.reportId !== params.id)
    return HttpResponse.json({ id: params.id, deleted: state.defs.length < before })
  }),

  http.post(`${API_BASE}/custom-reports/:id/run`, async ({ params }) => {
    await delay(350)
    const def = state.defs.find((d) => d.id === params.id)
    if (!def) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `自定义报表不存在: ${params.id}` } }, { status: 404 })
    def.status = 'running'
    def.lastRunAt = new Date().toISOString()
    const result = runReport(def)
    def.status = 'ready'
    // [Wave 5A/5B 联动] 已设置定时+订阅人的报表运行后自动推送
    if (def.schedule && def.recipients.length > 0) {
      pushReportGenerated({
        reportId: def.id,
        reportName: def.name,
        recipients: def.recipients,
        summary: `已生成 ${result.rows.length} 行 · 数据源: ${result.source} · 字段: ${def.fields.map((f) => catalogField(f)?.name ?? f).join('、')}`,
        link: '/data-report-center',
      })
    }
    return HttpResponse.json(result)
  }),

  http.get(`${API_BASE}/custom-reports/:id/result`, async ({ params }) => {
    await delay(60)
    const result = state.results.get(String(params.id))
    if (!result) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `报表 ${params.id} 尚未执行, 请先运行` } }, { status: 404 })
    return HttpResponse.json(result)
  }),

  http.get(`${API_BASE}/custom-reports/:id/history`, async ({ params }) => {
    await delay(60)
    const list = state.history.filter((h) => h.reportId === params.id)
    return HttpResponse.json(list)
  }),

  http.post(`${API_BASE}/custom-reports/:id/schedule`, async ({ params, request }) => {
    await delay(120)
    const def = state.defs.find((d) => d.id === params.id)
    if (!def) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `自定义报表不存在: ${params.id}` } }, { status: 404 })
    const body = (await request.json()) as { schedule?: string; recipients?: string[] }
    if (!body?.schedule?.trim() || !Array.isArray(body.recipients) || body.recipients.length === 0) {
      return HttpResponse.json({ success: false, error: { code: 'VALIDATION', message: '定时规则与订阅人必填' } }, { status: 400 })
    }
    def.schedule = body.schedule.trim()
    def.recipients = [...body.recipients]
    def.updatedAt = new Date().toISOString()
    const summary = `定时: ${def.schedule} · 字段: ${def.fields.map((f) => catalogField(f)?.name ?? f).join('、')}`
    const notified = pushReportGenerated({
      reportId: def.id,
      reportName: def.name,
      recipients: def.recipients,
      summary,
      link: '/data-report-center',
    })
    return HttpResponse.json({ def, notified: { count: notified.count } })
  }),

  http.get(`${API_BASE}/custom-reports/:id/export`, async ({ params }) => {
    await delay(80)
    const result = state.results.get(String(params.id))
    if (!result) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `报表 ${params.id} 尚未执行, 请先运行` } }, { status: 404 })
    const esc = (v: unknown): string => {
      const s = String(v ?? '')
      return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = [result.columns.map((c) => esc(c.name)).join(',')]
    for (const row of result.rows) {
      lines.push(result.columns.map((c) => esc(row[c.key])).join(','))
    }
    const csv = '\uFEFF' + lines.join('\r\n')
    return new HttpResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="custom-report-${params.id}.csv"`,
      },
    })
  }),
]
