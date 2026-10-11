// [v3.0.6.11-60] BI 仪表板 MSW handlers: /api/v1/bi/*
// 与后端 backend/src/modules/bi 返回结构保持一致 (source: 'demo')
// [G005 W5-Expand] KPI / 趋势 / 时效 / 医生工作量 / 模态构成 / 危急值 SLA 全部派生自 store 数据池
//   (不再使用合成随机点; RNG 仅 mulberry32 + 固定 tag 种子, 无模块级 Math.random):
//   - exams      : EXAM_REPORT_PRE (10k) + unified-exams.json (14k) + initialRadiologyExams (200)
//   - reports    : unified-reports.json (9k); 为空时回退 exams 池 (EXAM_REPORT_PRE 即报告记录)
//   - criticalEvents: unifiedCriticalValues (500)
//   - 主数据     : DOCTOR_MASTER (医生花名册/职称/质控分) + EXAM_ITEM_MASTER (模态目录/标准 TAT)
//   KPI 7 项指标各自附带 drillDown.reportIds (真实报告 ID), 新增端点:
//     GET /bi/kpi/drill-down?metric=&limit=   GET /bi/modality-mix
//     GET /bi/trend?days= 支持 7..180 天 (窗口锚定数据池最新检查日, 保证 180 点全有数据)
import { http, HttpResponse, delay } from 'msw'
import { list } from './store'
import { DOCTOR_MASTER, EXAM_ITEM_MASTER, EXAM_ITEM_STATS } from '../../data/master'
import { DOCTOR_WORKLOADS } from '../../data/knowledgeStatsMock'

const API_BASE =
  typeof process !== 'undefined' && process.env.VITEST
    ? 'http://localhost:5173/api/v1'
    : typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin + '/api/v1'
      : 'http://localhost:5173/api/v1'

// ── 确定性随机: mulberry32 + FNV-1a 标签种子 (固定 tag → 固定序列) ──
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

function tagSeed(tag: string): number {
  let h = 2166136261 >>> 0
  for (let i = 0; i < tag.length; i++) {
    h ^= tag.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const rngFor = (tag: string) => mulberry32(tagSeed(tag))

function safeList<T>(key: string): T[] {
  try {
    return list<T>(key as any)
  } catch {
    return []
  }
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function round1(v: number): number {
  if (!Number.isFinite(v)) return 0
  return Math.round(v * 10) / 10
}

function envelope(data: unknown) {
  return { source: 'demo' as const, generatedAt: new Date().toISOString(), data }
}

// ════════════════════════════════════════════════════════════════════
// store 数据池归一 (两种检查/报告形状 + 危急值)
// ════════════════════════════════════════════════════════════════════
const DONE_STATUSES = new Set(['已发布', '已签发', 'published', 'cosigned', 'reviewed'])
const URGENT_FLAGS = new Set(['急诊', '加急', '紧急', '危重', 'STAT', 'URGENT'])
const REPORTING_TITLES = new Set(['主任医师', '副主任医师', '主治医师', '住院医师'])
const RVU_PER_REPORT: Record<string, number> = {
  主任医师: 1.5,
  副主任医师: 1.3,
  主治医师: 1.1,
  住院医师: 0.9,
}
// 常规报告 24h 内完成; 急诊/加急按检查项目标准时限 (上限 4h)
const ROUTINE_TAT_LIMIT_MIN = 1440
const URGENT_TAT_LIMIT_MIN = 240

const isDone = (r: any): boolean => DONE_STATUSES.has(String(r?.status ?? ''))

function toMs(v: unknown): number {
  if (v === null || v === undefined || v === '') return NaN
  const s = String(v)
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00.000Z` : s)
  return Number.isFinite(t) ? t : NaN
}

function dayOf(v: unknown): string | null {
  const ms = toMs(v)
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null
}

function recordDay(r: any, exam: any): string | null {
  return dayOf(r?.examDate) ?? dayOf(r?.examAt) ?? dayOf(exam?.examDate) ?? dayOf(exam?.examAt) ?? dayOf(exam?.createdAt)
}

function normalizeModality(raw: unknown): string {
  const m = String(raw ?? '')
  if (m === '介入') return 'DSA'
  if (m === 'CR') return 'DR'
  if (m === '乳腺钼靶' || m === '钼靶') return 'MG'
  return m
}

function recordReportId(r: any): string {
  return String(r?.reportId ?? r?.id ?? '')
}

const ITEM_BY_CODE = new Map<string, any>(EXAM_ITEM_MASTER.map((e) => [e.code, e] as [string, any]))
const ITEM_BY_NAME = new Map<string, any>(EXAM_ITEM_MASTER.map((e) => [e.name, e] as [string, any]))

function standardTatMinutes(r: any, exam: any, urgent: boolean): number {
  if (!urgent) return ROUTINE_TAT_LIMIT_MIN
  const code = String(r?.examItemCode ?? exam?.examItemCode ?? '')
  const name = String(r?.examItemName ?? r?.examItem ?? exam?.examItemName ?? exam?.examItem ?? '')
  const item = (code && ITEM_BY_CODE.get(code)) || (name && ITEM_BY_NAME.get(name)) || null
  const itemUrgent = Number(item?.reportTATUrgent)
  if (Number.isFinite(itemUrgent) && itemUrgent > 0) return Math.min(itemUrgent, URGENT_TAT_LIMIT_MIN)
  return URGENT_TAT_LIMIT_MIN
}

// ════════════════════════════════════════════════════════════════════
// 派生快照 (一次遍历 store 池, 按池大小缓存 → 各端点复用)
// ════════════════════════════════════════════════════════════════════
interface TatSample {
  reportId: string
  examId: string
  patientId: string
  patientName: string
  modality: string
  examItem: string
  doctorId: string
  day: string | null
  minutes: number
  standard: number
  overtime: boolean
}

interface PhysicianRow {
  doctorId: string
  doctorName: string
  title: string
  subspecialty: string
  reportCount: number
  avgMinutes: number
  rvu: number
  tatSum: number
  tatN: number
  overtimeCount: number
  monthlyReportCount: number
  annualQCScore: number
  defectRate: number
  timelyRate: number
}

interface Snapshot {
  examCount: number
  reportCount: number
  doneCount: number
  pendingCount: number
  completionRate: number
  avgReportMinutes: number
  overtimeRate: number
  criticalSlaRate: number
  anchorDay: string
  samples: TatSample[]
  sampleByReportId: Map<string, TatSample>
  recordIndex: Map<string, any>
  examReportIds: string[]
  reportIds: string[]
  doneReportIds: string[]
  sampleReportIds: string[]
  overtimeReportIds: string[]
  pendingReportIds: string[]
  criticalReportIds: string[]
  buckets: { bucket: string; count: number; percent: number }[]
  medianMinutes: number
  p90Minutes: number
  sla: {
    total: number
    slaMinutes: number
    responded: number
    complianceRate: number
    avgResponseMinutes: number
    distribution: { bucket: string; count: number }[]
    overdue: any[]
  }
  dayExams: Map<string, number>
  dayReports: Map<string, { count: number; done: number; tatSum: number; tatN: number; overtime: number }>
  dayCriticals: Map<string, number>
  modalityMix: { modality: string; examCount: number; percent: number; examItemCount: number }[]
  physicians: PhysicianRow[]
}

const TAT_BUCKETS = ['<30min', '30min-1h', '1h-2h', '2h-4h', '>4h']
// 危急值 SLA 响应时长分桶 (30 分钟 SLA), 与 CriticalSlaBucketDto 对齐
const SLA_BUCKETS = ['<5min', '5-15min', '15-30min', '30-60min', '>60min']

function bucketOf(minutes: number): string {
  if (minutes < 30) return TAT_BUCKETS[0]!
  if (minutes < 60) return TAT_BUCKETS[1]!
  if (minutes < 120) return TAT_BUCKETS[2]!
  if (minutes < 240) return TAT_BUCKETS[3]!
  return TAT_BUCKETS[4]!
}

function slaBucketOf(minutes: number): string {
  if (minutes < 5) return SLA_BUCKETS[0]!
  if (minutes < 15) return SLA_BUCKETS[1]!
  if (minutes < 30) return SLA_BUCKETS[2]!
  if (minutes < 60) return SLA_BUCKETS[3]!
  return SLA_BUCKETS[4]!
}

function buildCriticalSla(criticals: any[]) {
  const slaMinutes = 30
  const counts = new Map<string, number>(SLA_BUCKETS.map((b) => [b, 0] as [string, number]))
  const overdue: any[] = []
  let responded = 0
  let within = 0
  let sum = 0
  for (const c of criticals) {
    const reported = toMs(c?.reportedTime)
    const ack = toMs(c?.acknowledgedTime)
    // 响应时长 = 临床确认 (acknowledgedTime) - 危急值上报; 无确认 → 未响应, 计入超时清单
    let resp: number | null = null
    if (Number.isFinite(reported) && Number.isFinite(ack) && ack >= reported) {
      resp = (ack - reported) / 60000
    }
    if (resp !== null) {
      responded++
      sum += resp
      if (resp <= slaMinutes) within++
      const b = slaBucketOf(resp)
      counts.set(b, (counts.get(b) ?? 0) + 1)
    }
    if (resp === null || resp > slaMinutes) {
      overdue.push({
        id: String(c?.id ?? ''),
        severity: String(c?.severity ?? '警告'),
        state: String(c?.status ?? c?.state ?? ''),
        createdAt: c?.reportedTime ?? null,
        ackedAt: c?.acknowledgedTime ?? null,
        responseMinutes: resp !== null ? Math.round(resp) : 0,
        // 交叉引用: 危急值自带真实 reportId/examId/patientId
        reportId: String(c?.reportId ?? ''),
        examId: String(c?.examId ?? ''),
        patientId: String(c?.patientId ?? ''),
        patientName: String(c?.patientName ?? ''),
      })
    }
  }
  const total = criticals.length
  return {
    total,
    slaMinutes,
    responded,
    complianceRate: total ? round1((within / total) * 100) : 100,
    avgResponseMinutes: responded ? round1(sum / responded) : 0,
    distribution: SLA_BUCKETS.map((b) => ({ bucket: b, count: counts.get(b) ?? 0 })),
    overdue,
  }
}

function computeSnapshot(exams: any[], reports: any[], criticals: any[]): Snapshot {
  const examIndex = new Map<string, any>()
  const recordIndex = new Map<string, any>()
  const reportIdByExamId = new Map<string, string>()
  const dayExams = new Map<string, number>()
  let maxExamDayMs = 0

  for (const e of exams) {
    const id = String(e?.id ?? e?.reportId ?? '')
    const rid = String(e?.reportId ?? '')
    if (id) examIndex.set(id, e)
    if (rid && rid !== id) examIndex.set(rid, e)
    for (const k of [id, rid]) {
      if (k && !recordIndex.has(k)) recordIndex.set(k, e)
    }
    const day = dayOf(e?.examDate) ?? dayOf(e?.examAt) ?? dayOf(e?.createdAt)
    if (day) {
      dayExams.set(day, (dayExams.get(day) ?? 0) + 1)
      const ms = Date.parse(`${day}T00:00:00.000Z`)
      if (Number.isFinite(ms) && ms > maxExamDayMs) maxExamDayMs = ms
    }
  }

  const useReports = reports.length > 0
  const reportPool = useReports ? reports : exams

  for (const r of reportPool) {
    const rid = recordReportId(r)
    const eid = String(r?.examId ?? '')
    if (rid) recordIndex.set(rid, r)
    if (eid && !recordIndex.has(eid)) recordIndex.set(eid, r)
    if (useReports && eid && rid) reportIdByExamId.set(eid, rid)
  }

  const examReportIds: string[] = []
  for (const e of exams) {
    const linked = String(e?.reportId ?? '') || reportIdByExamId.get(String(e?.id ?? '')) || String(e?.id ?? '')
    if (linked) examReportIds.push(linked)
  }

  const reportIds: string[] = []
  const doneReportIds: string[] = []
  const pendingReportIds: string[] = []
  const sampleReportIds: string[] = []
  const overtimeReportIds: string[] = []
  const samples: TatSample[] = []
  const sampleByReportId = new Map<string, TatSample>()
  const dayReports = new Map<string, { count: number; done: number; tatSum: number; tatN: number; overtime: number }>()

  for (const r of reportPool) {
    const exam = useReports ? (examIndex.get(String(r?.examId ?? '')) ?? examIndex.get(String(r?.id ?? ''))) : r
    const rid = recordReportId(r)
    if (rid) reportIds.push(rid)

    const day = recordDay(r, exam)
    const agg = day
      ? (dayReports.get(day) ?? { count: 0, done: 0, tatSum: 0, tatN: 0, overtime: 0 })
      : null
    if (agg && day) {
      agg.count++
      dayReports.set(day, agg)
    }

    const finished = isDone(r) || (!useReports && isDone(exam))
    if (!finished) {
      if (rid) pendingReportIds.push(rid)
      continue
    }
    if (rid) doneReportIds.push(rid)
    if (agg && day) agg.done++

    const start = toMs(r?.reportAt ?? r?.createdAt ?? r?.createdTime ?? exam?.reportAt ?? exam?.examAt)
    const end = toMs(
      r?.signedAt ?? r?.publishedTime ?? r?.approvedTime ?? r?.reviewedAt ?? exam?.signedAt ?? exam?.reviewedAt ?? exam?.publishedTime,
    )
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue

    const minutes = Math.min(Math.round((end - start) / 60000), 7 * 24 * 60)
    const urgent =
      URGENT_FLAGS.has(String(r?.priority ?? '')) ||
      URGENT_FLAGS.has(String(exam?.priority ?? '')) ||
      String(r?.patientType ?? '') === '急诊'
    const standard = standardTatMinutes(r, exam, urgent)
    const overtime = minutes > standard
    const sample: TatSample = {
      reportId: rid,
      examId: String(r?.examId ?? exam?.id ?? ''),
      patientId: String(r?.patientId ?? exam?.patientId ?? ''),
      patientName: String(r?.patientName ?? exam?.patientName ?? ''),
      modality: String(r?.modality ?? exam?.modality ?? ''),
      examItem: String(r?.examItemName ?? r?.examItem ?? exam?.examItemName ?? exam?.examItem ?? ''),
      doctorId: String(r?.reportDoctorId ?? exam?.reportDoctorId ?? ''),
      day,
      minutes,
      standard,
      overtime,
    }
    samples.push(sample)
    if (rid) {
      sampleByReportId.set(rid, sample)
      sampleReportIds.push(rid)
      if (overtime) overtimeReportIds.push(rid)
    }
    if (agg) {
      agg.tatSum += minutes
      agg.tatN++
      if (overtime) agg.overtime++
    }
  }

  const sortedMinutes = samples.map((s) => s.minutes).sort((a, b) => a - b)
  const avg = sortedMinutes.length ? sortedMinutes.reduce((a, b) => a + b, 0) / sortedMinutes.length : 0
  const pct = (p: number) => (sortedMinutes.length ? sortedMinutes[Math.min(sortedMinutes.length - 1, Math.floor(sortedMinutes.length * p))] ?? 0 : 0)

  const bucketCounts = new Map<string, number>(TAT_BUCKETS.map((b) => [b, 0] as [string, number]))
  for (const s of samples) bucketCounts.set(bucketOf(s.minutes), (bucketCounts.get(bucketOf(s.minutes)) ?? 0) + 1)
  const buckets = TAT_BUCKETS.map((b) => {
    const count = bucketCounts.get(b) ?? 0
    return { bucket: b, count, percent: samples.length ? round1((count / samples.length) * 100) : 0 }
  })

  const sla = buildCriticalSla(criticals)
  const criticalReportIds = criticals.map((c) => String(c?.reportId ?? '')).filter(Boolean)

  const dayCriticals = new Map<string, number>()
  for (const c of criticals) {
    const day = dayOf(c?.reportedTime)
    if (day) dayCriticals.set(day, (dayCriticals.get(day) ?? 0) + 1)
  }

  // 模态构成: 目录键来自 EXAM_ITEM_MASTER (8 种), 计数来自 store 检查池
  const catalog = EXAM_ITEM_STATS.byModality as Record<string, number>
  const modalityCounts = new Map<string, number>()
  for (const e of exams) {
    const m = normalizeModality(e?.modality)
    modalityCounts.set(m, (modalityCounts.get(m) ?? 0) + 1)
  }
  const examTotal = exams.length || 1
  const modalityMix = Object.keys(catalog).map((m) => {
    const count = modalityCounts.get(m) ?? 0
    return { modality: m, examCount: count, percent: round1((count / examTotal) * 100), examItemCount: catalog[m] ?? 0 }
  })
  for (const [m, count] of modalityCounts) {
    if (!(m in catalog)) {
      modalityMix.push({ modality: m, examCount: count, percent: round1((count / examTotal) * 100), examItemCount: 0 })
    }
  }

  // 医生工作量: 花名册来自 DOCTOR_MASTER, 计数/TAT 来自 store 报告池, 姓名优先取 store 报告姓名
  const legacyNameById = new Map<string, string>(
    DOCTOR_WORKLOADS.map((d) => [String(d.doctorId), String(d.doctorName)] as [string, string]),
  )
  const aggByDoctor = new Map<string, { count: number; tatSum: number; tatN: number; overtime: number; name: string }>()
  for (const r of reportPool) {
    const id = String(r?.reportDoctorId ?? r?.radiologistId ?? r?.doctorId ?? '')
    if (!id) continue
    const a = aggByDoctor.get(id) ?? { count: 0, tatSum: 0, tatN: 0, overtime: 0, name: '' }
    a.count++
    const s = sampleByReportId.get(recordReportId(r))
    if (s) {
      a.tatSum += s.minutes
      a.tatN++
      if (s.overtime) a.overtime++
    }
    const name = String(r?.reportDoctorName ?? '')
    if (name && !a.name) a.name = name
    aggByDoctor.set(id, a)
  }
  const roster = DOCTOR_MASTER.filter((d) => REPORTING_TITLES.has(String(d.title)))
  const physicians: PhysicianRow[] = roster
    .map((d) => {
      const a = aggByDoctor.get(String(d.id))
      const title = String(d.title)
      const reportCount = a?.count ?? 0
      return {
        doctorId: String(d.id),
        doctorName: a?.name || legacyNameById.get(String(d.id)) || String(d.name),
        title,
        subspecialty: String(d.subspecialty),
        reportCount,
        avgMinutes: a && a.tatN > 0 ? round1(a.tatSum / a.tatN) : 0,
        rvu: round1(reportCount * (RVU_PER_REPORT[title] ?? 1)),
        tatSum: a?.tatSum ?? 0,
        tatN: a?.tatN ?? 0,
        overtimeCount: a?.overtime ?? 0,
        monthlyReportCount: Number(d.monthlyReportCount ?? 0),
        annualQCScore: Number(d.annualQCScore ?? 0),
        defectRate: parseFloat(String(d.defectRate ?? '0')) || 0,
        timelyRate: parseFloat(String(d.timelyRate ?? '0')) || 0,
      }
    })
    .sort((a, b) => b.rvu - a.rvu || a.doctorId.localeCompare(b.doctorId))

  const todayMs = Date.now()
  const anchorMs = Number.isFinite(maxExamDayMs) && maxExamDayMs > 0 ? Math.min(maxExamDayMs, todayMs) : todayMs

  return {
    examCount: exams.length,
    reportCount: reportPool.length,
    doneCount: doneReportIds.length,
    pendingCount: pendingReportIds.length,
    completionRate: reportPool.length ? round1((doneReportIds.length / reportPool.length) * 100) : 0,
    avgReportMinutes: round1(avg),
    overtimeRate: samples.length ? round1((overtimeReportIds.length / samples.length) * 100) : 0,
    criticalSlaRate: sla.complianceRate,
    anchorDay: new Date(anchorMs).toISOString().slice(0, 10),
    samples,
    sampleByReportId,
    recordIndex,
    examReportIds,
    reportIds,
    doneReportIds,
    sampleReportIds,
    overtimeReportIds,
    pendingReportIds,
    criticalReportIds,
    buckets,
    medianMinutes: round1(pct(0.5)),
    p90Minutes: round1(pct(0.9)),
    sla,
    dayExams,
    dayReports,
    dayCriticals,
    modalityMix,
    physicians,
  }
}

let snapshotCache: { key: string; snap: Snapshot } | null = null

function snapshot(): Snapshot {
  const exams = safeList<any>('exams')
  const reports = safeList<any>('reports')
  const criticals = safeList<any>('criticalEvents')
  const key = `${exams.length}|${reports.length}|${criticals.length}`
  if (snapshotCache && snapshotCache.key === key) return snapshotCache.snap
  const snap = computeSnapshot(exams, reports, criticals)
  snapshotCache = { key, snap }
  return snap
}

// ════════════════════════════════════════════════════════════════════
// KPI (7 项全部派生) + 每项指标的 drill-down (真实 reportId)
// ════════════════════════════════════════════════════════════════════
const KPI_METRICS = [
  'examCount',
  'reportCount',
  'completionRate',
  'avgReportMinutes',
  'overtimeRate',
  'pendingReports',
  'criticalSlaRate',
] as const

type KpiMetric = (typeof KPI_METRICS)[number]

function drillIds(metric: string, snap: Snapshot): string[] | null {
  switch (metric) {
    case 'examCount':
      return snap.examReportIds
    case 'reportCount':
      return snap.reportIds
    case 'completionRate':
      return snap.doneReportIds
    case 'avgReportMinutes':
      return snap.sampleReportIds
    case 'overtimeRate':
      return snap.overtimeReportIds
    case 'pendingReports':
      return snap.pendingReportIds
    case 'criticalSlaRate':
      return snap.criticalReportIds
    default:
      return null
  }
}

function drillItem(metric: string, reportId: string, snap: Snapshot) {
  const rec = snap.recordIndex.get(reportId)
  const s = snap.sampleByReportId.get(reportId)
  const value =
    metric === 'avgReportMinutes'
      ? (s?.minutes ?? null)
      : metric === 'overtimeRate'
        ? (s ? round1(((s.minutes - s.standard) / (s.standard || 1)) * 100) : null)
        : null
  return {
    reportId,
    patientId: String(rec?.patientId ?? ''),
    patientName: String(rec?.patientName ?? ''),
    examItem: String(rec?.examItemName ?? rec?.examItem ?? ''),
    modality: String(rec?.modality ?? ''),
    examDay: String(rec?.examDate ?? (rec?.examAt ? String(rec.examAt).slice(0, 10) : '')),
    status: String(rec?.status ?? ''),
    tatMinutes: s?.minutes ?? null,
    standardMinutes: s?.standard ?? null,
    overtime: s?.overtime ?? null,
    value,
  }
}

function buildKpi(snap: Snapshot) {
  const drillDown: Record<string, { total: number; reportIds: string[] }> = {}
  for (const metric of KPI_METRICS) {
    const ids = drillIds(metric, snap) ?? []
    drillDown[metric] = { total: ids.length, reportIds: ids.slice(0, 20) }
  }
  return {
    examCount: snap.examCount,
    reportCount: snap.reportCount,
    completionRate: snap.completionRate,
    avgReportMinutes: snap.avgReportMinutes,
    overtimeRate: snap.overtimeRate,
    pendingReports: snap.pendingCount,
    criticalSlaRate: snap.criticalSlaRate,
    // 扩展字段 (DTO 之外, 不影响既有消费方): 模态构成 + 逐指标下钻
    modalityMix: snap.modalityMix,
    drillDown,
    pool: { exams: snap.examCount, reports: snap.reportCount, criticalEvents: snap.sla.total },
  }
}

function buildTimeliness(snap: Snapshot) {
  return {
    total: snap.samples.length,
    buckets: snap.buckets,
    medianMinutes: snap.medianMinutes,
    p90Minutes: snap.p90Minutes,
  }
}

function buildRvu(snap: Snapshot) {
  const physicians = snap.physicians.map((p) => ({
    doctorId: p.doctorId,
    doctorName: p.doctorName,
    title: p.title,
    subspecialty: p.subspecialty,
    reportCount: p.reportCount,
    rvu: p.rvu,
    avgMinutes: p.avgMinutes,
    overtimeCount: p.overtimeCount,
  }))
  return { totalRvu: round1(physicians.reduce((s, p) => s + p.rvu, 0)), physicians }
}

function buildSla(snap: Snapshot) {
  const { total, slaMinutes, responded, complianceRate, avgResponseMinutes, distribution, overdue } = snap.sla
  return { total, slaMinutes, responded, complianceRate, avgResponseMinutes, distribution, overdue }
}

function buildTrend(snap: Snapshot, days: number) {
  const anchorMs = Date.parse(`${snap.anchorDay}T00:00:00.000Z`)
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(anchorMs - (days - 1 - i) * 86400000).toISOString().slice(0, 10)
    const examCount = snap.dayExams.get(date) ?? 0
    const agg = snap.dayReports.get(date)
    const reportCount = agg?.count ?? 0
    const done = agg?.done ?? 0
    return {
      date,
      examCount,
      reportCount,
      completionRate: reportCount ? round1((done / reportCount) * 100) : 0,
      avgReportMinutes: agg && agg.tatN > 0 ? round1(agg.tatSum / agg.tatN) : 0,
      overtimeCount: agg?.overtime ?? 0,
      criticalCount: snap.dayCriticals.get(date) ?? 0,
    }
  })
}

function qualityCoefficient(score: number): number {
  if (score >= 95) return 1.15
  if (score >= 90) return 1.05
  if (score >= 85) return 1.0
  return 0.9
}

function buildPerformance(snap: Snapshot) {
  const unitPrice = 12
  const byPhysician = snap.physicians.map((p) => {
    const qualityScore = p.annualQCScore || 85
    const accuracyScore = round1(Math.min(100, Math.max(60, 100 - p.defectRate * 10)))
    const coefficient = qualityCoefficient(qualityScore)
    return {
      doctorId: p.doctorId,
      doctorName: p.doctorName,
      title: p.title,
      reportCount: p.reportCount,
      rvu: p.rvu,
      avgTurnaround: p.avgMinutes,
      qualityScore,
      accuracyScore,
      qualityCoefficient: coefficient,
      bonus: Math.round(p.rvu * unitPrice * coefficient * 100) / 100,
    }
  })
  const reportCount = byPhysician.reduce((s, p) => s + p.reportCount, 0)
  const tatWeighted = byPhysician.reduce((s, p) => s + p.avgTurnaround * p.reportCount, 0)
  const n = byPhysician.length || 1
  return {
    totalRvu: round1(byPhysician.reduce((s, p) => s + p.rvu, 0)),
    bonus: Math.round(byPhysician.reduce((s, p) => s + p.bonus, 0) * 100) / 100,
    reportCount,
    avgTurnaround: reportCount > 0 ? round1(tatWeighted / reportCount) : 0,
    qualityScore: round1(byPhysician.reduce((s, p) => s + p.qualityScore, 0) / n),
    accuracyScore: round1(byPhysician.reduce((s, p) => s + p.accuracyScore, 0) / n),
    byPhysician,
    rules: {
      rvuUnitPrice: unitPrice,
      qualityCoefficients: { '>=95': 1.15, '>=90': 1.05, '>=85': 1.0, '<85': 0.9 },
    },
  }
}

// ── 设备 OEE (设备侧无 store 池, 保留演示序列; 仅随机源改为固定 tag 种子) ──
function buildOee(days: number) {
  const rand = rngFor('bi-device-oee')
  const devices = [
    { deviceId: 'CT-01', name: 'GE Revolution CT', modality: 'CT' },
    { deviceId: 'MR-01', name: 'Siemens Skyra', modality: 'MR' },
    { deviceId: 'DR-01', name: 'Philips DigitalDiagnost', modality: 'DR' },
    { deviceId: 'CT-02', name: 'Canon Aquilion', modality: 'CT' },
    { deviceId: 'MG-01', name: 'Hologic Selenia', modality: 'MG' },
  ]
  const daily = new Map<string, { date: string; sumOee: number; sumAv: number; sumPerf: number; sumQ: number; count: number }>()
  const rows = devices.map((dev) => {
    const base = 78 + rand() * 15
    const trend = Array.from({ length: days }, (_, i) => {
      const availability = round1(base + (rand() - 0.5) * 8)
      const performance = round1(base + 4 + (rand() - 0.5) * 8)
      const quality = round1(92 + (rand() - 0.5) * 8)
      const oee = round1((availability * performance * quality) / 10000)
      const date = isoDaysAgo(days - 1 - i)
      const entry = daily.get(date) ?? { date, sumOee: 0, sumAv: 0, sumPerf: 0, sumQ: 0, count: 0 }
      entry.sumOee += oee
      entry.sumAv += availability
      entry.sumPerf += performance
      entry.sumQ += quality
      entry.count += 1
      daily.set(date, entry)
      return { date, oee, availability, performance, quality }
    })
    const avg = (key: 'oee' | 'availability' | 'performance' | 'quality') =>
      round1(trend.reduce((s, t) => s + t[key], 0) / trend.length)
    return {
      deviceId: dev.deviceId,
      deviceName: dev.name,
      modality: dev.modality,
      avgOee: avg('oee'),
      avgAvailability: avg('availability'),
      avgPerformance: avg('performance'),
      avgQuality: avg('quality'),
      trend,
    }
  })
  const dailyTrend = Array.from(daily.values())
    .map((e) => ({
      date: e.date,
      oee: round1(e.sumOee / e.count),
      availability: round1(e.sumAv / e.count),
      performance: round1(e.sumPerf / e.count),
      quality: round1(e.sumQ / e.count),
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1))
  return { devices: rows, dailyTrend }
}

// ── [v3.0.6.11-99 Wave 5B-A] 大屏模板库 (内存 CRUD, 与后端结构一致) ──────
const WALL_SEEDS = [
  { id: 'wall-overview', name: '科室总览', layout: 'overview', config: { blocks: ['kpi', 'top10', 'critical'], autoRotateMs: 15000 }, active: true },
  { id: 'wall-equipment', name: '设备监控', layout: 'equipment', config: { blocks: ['occupancy', 'oee'], autoRotateMs: 10000 }, active: false },
  { id: 'wall-quality', name: '质控看板', layout: 'quality', config: { blocks: ['quality', 'sla'], autoRotateMs: 15000 }, active: false },
  { id: 'wall-finance', name: '财务绩效', layout: 'finance', config: { blocks: ['revenue', 'bonus'], autoRotateMs: 12000 }, active: false },
  { id: 'wall-mixed', name: '综合大屏', layout: 'mixed', config: { blocks: ['kpi', 'occupancy', 'quality', 'top10'], autoRotateMs: 15000 }, active: false },
]

const wallState: { items: Array<Record<string, unknown> & { id: string; name: string; layout: string }> } = {
  items: WALL_SEEDS.map((t) => ({
    ...t,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  })),
}

function wallEnvelope() {
  return { source: 'database' as const, data: wallState.items.map((t) => ({ ...t })) }
}

export const biHandlers = [
  http.get(`${API_BASE}/bi/kpi`, async () => {
    await delay(60)
    return HttpResponse.json(envelope(buildKpi(snapshot())))
  }),

  http.get(`${API_BASE}/bi/report-timeliness`, async () => {
    await delay(60)
    return HttpResponse.json(envelope(buildTimeliness(snapshot())))
  }),

  // [G005 W5-Expand] KPI 下钻: 每个指标返回真实 reportId 列表 + 明细
  http.get(`${API_BASE}/bi/kpi/drill-down`, async ({ request }) => {
    await delay(60)
    const url = new URL(request.url)
    const metric = url.searchParams.get('metric') ?? 'examCount'
    const rawLimit = parseInt(url.searchParams.get('limit') ?? '50', 10)
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 50
    const snap = snapshot()
    const ids = drillIds(metric, snap)
    if (!ids) {
      return HttpResponse.json(
        { message: `未知 KPI 指标: ${metric}`, supportedMetrics: [...KPI_METRICS] },
        { status: 400 },
      )
    }
    return HttpResponse.json(
      envelope({
        metric: metric as KpiMetric,
        total: ids.length,
        limit,
        reportIds: ids.slice(0, limit),
        items: ids.slice(0, limit).map((id) => drillItem(metric, id, snap)),
      }),
    )
  }),

  // [G005 W5-Expand] 模态构成: 目录键取自 EXAM_ITEM_MASTER, 计数取自 store 检查池
  http.get(`${API_BASE}/bi/modality-mix`, async () => {
    await delay(60)
    const snap = snapshot()
    return HttpResponse.json(
      envelope({ totalExams: snap.examCount, mix: snap.modalityMix }),
    )
  }),

  http.get(`${API_BASE}/bi/physician-rvu`, async () => {
    await delay(80)
    return HttpResponse.json(envelope(buildRvu(snapshot())))
  }),

  http.get(`${API_BASE}/bi/device-oee`, async ({ request }) => {
    await delay(80)
    const url = new URL(request.url)
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '14', 10), 7), 90)
    return HttpResponse.json(envelope(buildOee(days)))
  }),

  http.get(`${API_BASE}/bi/critical-sla`, async () => {
    await delay(80)
    return HttpResponse.json(envelope(buildSla(snapshot())))
  }),

  // [G005 W5-Expand] TAT 趋势: 7..180 天 (窗口锚定数据池最新检查日, 180 点全部有数据)
  http.get(`${API_BASE}/bi/trend`, async ({ request }) => {
    await delay(100)
    const url = new URL(request.url)
    const raw = parseInt(url.searchParams.get('days') ?? '', 10)
    const days = Number.isFinite(raw) ? Math.min(Math.max(raw, 7), 180) : 180
    return HttpResponse.json(envelope(buildTrend(snapshot(), days)))
  }),

  // [v3.0.6.11-99 Wave 5B-B] 医生绩效 (质量分来自 DOCTOR_MASTER.annualQCScore/defectRate)
  http.get(`${API_BASE}/bi/physician-performance`, async () => {
    await delay(80)
    return HttpResponse.json(envelope(buildPerformance(snapshot())))
  }),

  // [v3.0.6.11-99 Wave 5B-A] 大屏模板库 CRUD
  http.get(`${API_BASE}/bi/wall-templates`, async () => {
    await delay(60)
    return HttpResponse.json(wallEnvelope())
  }),

  http.get(`${API_BASE}/bi/wall-templates/:id`, async ({ params }) => {
    await delay(50)
    const item = wallState.items.find((t) => t.id === params.id)
    if (!item) return HttpResponse.json({ message: `模板不存在: ${params.id}` }, { status: 404 })
    return HttpResponse.json({ ...item })
  }),

  http.post(`${API_BASE}/bi/wall-templates`, async ({ request }) => {
    await delay(80)
    const body = (await request.json()) as { name?: string; layout?: string; config?: Record<string, unknown>; active?: boolean }
    const now = new Date().toISOString()
    const item = {
      id: `wall-${Date.now()}`,
      name: String(body.name ?? '未命名模板'),
      layout: String(body.layout ?? 'overview'),
      config: body.config ?? {},
      active: Boolean(body.active),
      createdAt: now,
      updatedAt: now,
    }
    wallState.items.unshift(item)
    return HttpResponse.json({ ...item }, { status: 201 })
  }),

  http.patch(`${API_BASE}/bi/wall-templates/:id`, async ({ params, request }) => {
    await delay(70)
    const item = wallState.items.find((t) => t.id === params.id)
    if (!item) return HttpResponse.json({ message: `模板不存在: ${params.id}` }, { status: 404 })
    const body = (await request.json()) as Record<string, unknown>
    for (const key of ['name', 'layout', 'config', 'active']) {
      if (body[key] !== undefined) item[key] = body[key]
    }
    item.updatedAt = new Date().toISOString()
    return HttpResponse.json({ ...item })
  }),

  http.delete(`${API_BASE}/bi/wall-templates/:id`, async ({ params }) => {
    await delay(60)
    const before = wallState.items.length
    wallState.items = wallState.items.filter((t) => t.id !== params.id)
    return HttpResponse.json({ id: params.id, deleted: wallState.items.length < before })
  }),
]
