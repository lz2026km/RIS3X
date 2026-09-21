// [v3.0.6.11-106] W3 缺失端点 MSW handlers
// 必须前置注册 (handlers.ts 数组最前), 避免被 /queue/:roomId、/clinical-feedback/meta 等
// 通配/同名路由错配。覆盖:
//   - clinical-feedback: create / respond / resolve / reject
//   - contrast-safety: allergy-test(POST) / injection(POST) / observation(start/list/get/record/discharge)
//                      / extravasation(record/list/stats/handle)
//   - queue: overview / room-status / daily-trend / waiting-stats
//   - notifications: overview / daily-trend
// 数据确定性 (无 Math.random), 与后端 service seed 口径一致。
import { http, HttpResponse, delay } from 'msw'

const API_BASE =
  typeof process !== 'undefined' && process.env.VITEST
    ? 'http://localhost:5173/api/v1'
    : typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin + '/api/v1'
      : 'http://localhost:5173/api/v1'

const nowIso = () => new Date().toISOString()
const round1 = (n: number) => Math.round(n * 10) / 10

// ═══════════════════════════════════════════════════════════════════════════
// 1) 临床反馈闭环 (clinical-feedback)
//    后端: POST /clinical-feedback · POST /:id/respond|resolve|reject
//    (GET 列表 / GET meta 由 rqi105Handlers 提供)
// ═══════════════════════════════════════════════════════════════════════════
type FeedbackStatus = 'SUBMITTED' | 'RESPONDED' | 'RESOLVED' | 'REJECTED'

interface FeedbackRecord {
  id: string
  reportId: string
  patientId: string | null
  patientName?: string
  examId?: string | null
  type: string
  content: string
  submittedBy: string
  department: string
  status: FeedbackStatus
  createdAt: string
  updatedAt: string
  response?: { content: string; responder: string; department?: string; respondedAt: string }
  resolution?: { content?: string; resolver: string; amendId?: string; resolvedAt: string }
  rejectReason?: string
}

const FEEDBACK_TYPES = ['objection', 'supplement', 'correction']

const feedbackStore: FeedbackRecord[] = [
  {
    id: 'cf-seed-1',
    reportId: 'RPT-0001',
    patientId: 'P001',
    patientName: '张伟',
    examId: 'EX-SEED-001',
    type: 'objection',
    content: '结论与临床不符，请复核',
    submittedBy: '王医生',
    department: '急诊科',
    status: 'SUBMITTED',
    createdAt: '2026-09-11T09:00:00.000Z',
    updatedAt: '2026-09-11T09:00:00.000Z',
  },
  {
    id: 'cf-seed-2',
    reportId: 'RPT-0002',
    patientId: 'P002',
    patientName: '李娜',
    type: 'supplement',
    content: '补充既往手术史',
    submittedBy: '李医生',
    department: '外科',
    status: 'RESPONDED',
    createdAt: '2026-09-12T10:00:00.000Z',
    updatedAt: '2026-09-12T10:30:00.000Z',
    response: { content: '已补充', responder: '张医师', department: '放射科', respondedAt: '2026-09-12T10:30:00.000Z' },
  },
]
let feedbackSeq = 0

const feedbackHandlers = [
  http.post(`${API_BASE}/clinical-feedback`, async ({ request }) => {
    await delay(120)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const type = String(body.type ?? '')
    if (!body.reportId || !FEEDBACK_TYPES.includes(type) || !body.content || !body.submittedBy || !body.department) {
      return HttpResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'reportId/type/content/submittedBy/department 为必填' } },
        { status: 400 },
      )
    }
    feedbackSeq += 1
    const ts = nowIso()
    const record: FeedbackRecord = {
      id: `cf-${feedbackSeq}`,
      reportId: String(body.reportId),
      patientId: body.patientId ? String(body.patientId) : null,
      patientName: body.patientName ? String(body.patientName) : undefined,
      examId: body.examId ? String(body.examId) : null,
      type,
      content: String(body.content),
      submittedBy: String(body.submittedBy),
      department: String(body.department),
      status: 'SUBMITTED',
      createdAt: ts,
      updatedAt: ts,
    }
    feedbackStore.unshift(record)
    return HttpResponse.json({ success: true, data: record })
  }),

  http.post(`${API_BASE}/clinical-feedback/:id/respond`, async ({ params, request }) => {
    await delay(120)
    const record = feedbackStore.find((f) => f.id === String(params.id))
    if (!record) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '反馈不存在' } }, { status: 404 })
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    if (record.status !== 'SUBMITTED') {
      return HttpResponse.json({ success: false, error: { code: 'INVALID_TRANSITION', message: `${record.status} → RESPONDED 不允许` } }, { status: 400 })
    }
    if (!body.content || !body.responder) {
      return HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'content/responder 为必填' } }, { status: 400 })
    }
    record.status = 'RESPONDED'
    record.updatedAt = nowIso()
    record.response = {
      content: String(body.content),
      responder: String(body.responder),
      department: body.department ? String(body.department) : undefined,
      respondedAt: record.updatedAt,
    }
    return HttpResponse.json({ success: true, data: record })
  }),

  http.post(`${API_BASE}/clinical-feedback/:id/resolve`, async ({ params, request }) => {
    await delay(120)
    const record = feedbackStore.find((f) => f.id === String(params.id))
    if (!record) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '反馈不存在' } }, { status: 404 })
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    if (!['SUBMITTED', 'RESPONDED'].includes(record.status)) {
      return HttpResponse.json({ success: false, error: { code: 'INVALID_TRANSITION', message: `${record.status} → RESOLVED 不允许` } }, { status: 400 })
    }
    if (!body.resolver) {
      return HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'resolver 为必填' } }, { status: 400 })
    }
    record.status = 'RESOLVED'
    record.updatedAt = nowIso()
    record.resolution = {
      content: body.content ? String(body.content) : undefined,
      resolver: String(body.resolver),
      amendId: body.amendId ? String(body.amendId) : undefined,
      resolvedAt: record.updatedAt,
    }
    return HttpResponse.json({ success: true, data: record })
  }),

  http.post(`${API_BASE}/clinical-feedback/:id/reject`, async ({ params, request }) => {
    await delay(120)
    const record = feedbackStore.find((f) => f.id === String(params.id))
    if (!record) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '反馈不存在' } }, { status: 404 })
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    if (!['SUBMITTED', 'RESPONDED'].includes(record.status)) {
      return HttpResponse.json({ success: false, error: { code: 'INVALID_TRANSITION', message: `${record.status} → REJECTED 不允许` } }, { status: 400 })
    }
    if (!body.reason || !body.resolver) {
      return HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'reason/resolver 为必填' } }, { status: 400 })
    }
    record.status = 'REJECTED'
    record.updatedAt = nowIso()
    record.rejectReason = String(body.reason)
    // 对齐后端 ClinicalFeedback: 驳回原因以 resolution 落库 (content=原因)
    record.resolution = { content: String(body.reason), resolver: String(body.resolver), resolvedAt: record.updatedAt }
    return HttpResponse.json({ success: true, data: record })
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 2) 对比剂安全闭环 (contrast-safety) — 过敏试验 / 增强注射 / 注射后留观 / 外渗
// ═══════════════════════════════════════════════════════════════════════════
type ContrastAllergyResult = 'negative' | 'positive' | 'unknown'

interface AllergyTestRecord {
  id: string
  patientId: string
  contrastType: string
  result: ContrastAllergyResult
  testedAt: string
  testedBy: string
  notes?: string
  createdAt: string
}

const allergyTests = new Map<string, AllergyTestRecord>()
let allergySeq = 0

interface ObservationRecordEntry {
  at: string
  symptoms: string
  action: string
  recordedBy: string
  reactionId?: string
}

interface ObservationRecord {
  id: string
  patientId: string
  examId?: string
  contrastType?: string
  injectionId?: string
  startedAt: string
  durationMinutes: number
  endsAt: string
  status: 'observing' | 'discharged'
  operator?: string
  records: ObservationRecordEntry[]
  doctorRelease: boolean
  dischargedAt?: string
  dischargedBy?: string
  dischargeNotes?: string
  createdAt: string
  updatedAt: string
}

const DEFAULT_OBSERVATION_MINUTES = 30
const observations = new Map<string, ObservationRecord>()
let observationSeq = 0
let injectionSeq = 0

function toObservationDto(o: ObservationRecord) {
  const now = Date.now()
  const started = new Date(o.startedAt).getTime()
  const ends = new Date(o.endsAt).getTime()
  const elapsedSeconds = Math.max(0, Math.floor((now - started) / 1000))
  const remainingSeconds = o.status === 'discharged' ? 0 : Math.max(0, Math.ceil((ends - now) / 1000))
  const elapsedMinutes = round1(elapsedSeconds / 60)
  const progressPercent = o.durationMinutes > 0 ? Math.min(100, round1(((elapsedSeconds / 60) / o.durationMinutes) * 100)) : 100
  return {
    ...o,
    records: o.records.map((r) => ({ ...r })),
    elapsedSeconds,
    elapsedMinutes,
    remainingSeconds,
    progressPercent,
    canDischarge: o.status === 'discharged' || elapsedSeconds >= o.durationMinutes * 60,
  }
}

// seed: 一条已完成留观 (演示列表非空)
const obsSeed: ObservationRecord = {
  id: 'obs-seed-1',
  patientId: 'P-DEMO-001',
  examId: 'E-DEMO-001',
  contrastType: '碘海醇',
  startedAt: '2026-09-10T09:00:00.000Z',
  durationMinutes: 30,
  endsAt: '2026-09-10T09:30:00.000Z',
  status: 'discharged',
  operator: '张技师',
  records: [{ at: '2026-09-10T09:05:00.000Z', symptoms: '无不适', action: '观察', recordedBy: '张技师' }],
  doctorRelease: false,
  dischargedAt: '2026-09-10T09:31:00.000Z',
  dischargedBy: '张技师',
  createdAt: '2026-09-10T09:00:00.000Z',
  updatedAt: '2026-09-10T09:31:00.000Z',
}
observations.set(obsSeed.id, obsSeed)

type ExtravasationSeverity = 'mild' | 'moderate' | 'severe'

interface ExtravasationEvent {
  id: string
  patientId: string
  examId?: string
  severity: ExtravasationSeverity
  site: string
  estimatedVolumeMl: number
  management: string
  recordedBy: string
  occurredAt: string
  status: 'open' | 'resolved'
  handledBy?: string
  handledAt?: string
  followUp?: string
  handleNote?: string
  createdAt: string
  updatedAt: string
}

const SEED_INJECTION_TOTAL = 480
const DEFAULT_EGFR_THRESHOLD = 30

const extravasations: ExtravasationEvent[] = [
  {
    id: 'exv-seed-1',
    patientId: 'P-DEMO-001',
    examId: 'E-DEMO-001',
    severity: 'mild',
    site: '左上肢前臂',
    estimatedVolumeMl: 15,
    management: '停止注射, 抬高患肢, 冷敷',
    recordedBy: '张技师',
    occurredAt: '2026-07-12T09:20:00.000Z',
    status: 'resolved',
    handledBy: '李医生',
    handledAt: '2026-07-12T09:50:00.000Z',
    followUp: '24h 随访肿胀消退, 无张力性水疱',
    createdAt: '2026-07-12T09:20:00.000Z',
    updatedAt: '2026-07-12T09:50:00.000Z',
  },
  {
    id: 'exv-seed-2',
    patientId: 'P-DEMO-002',
    examId: 'E-DEMO-002',
    severity: 'moderate',
    site: '右前臂',
    estimatedVolumeMl: 35,
    management: '停止注射, 硫酸镁湿敷, 抬高患肢',
    recordedBy: '李护士',
    occurredAt: '2026-08-03T14:05:00.000Z',
    status: 'resolved',
    handledBy: '王医生',
    handledAt: '2026-08-03T14:40:00.000Z',
    followUp: '48h 随访肿胀明显消退',
    createdAt: '2026-08-03T14:05:00.000Z',
    updatedAt: '2026-08-03T14:40:00.000Z',
  },
  {
    id: 'exv-seed-3',
    patientId: 'P-DEMO-003',
    examId: 'E-DEMO-003',
    severity: 'severe',
    site: '右肘窝',
    estimatedVolumeMl: 80,
    management: '停止注射, 患肢制动, 请外科会诊',
    recordedBy: '赵技师',
    occurredAt: '2026-09-05T11:15:00.000Z',
    status: 'open',
    createdAt: '2026-09-05T11:15:00.000Z',
    updatedAt: '2026-09-05T11:15:00.000Z',
  },
]
let extravasationSeq = 0

function latestAllergyResult(patientId: string, explicit?: ContrastAllergyResult): ContrastAllergyResult {
  if (explicit) return explicit
  const stored = [...allergyTests.values()]
    .filter((t) => t.patientId === patientId)
    .sort((a, b) => b.testedAt.localeCompare(a.testedAt))
  return stored[0]?.result ?? 'unknown'
}

function buildPreInjectionCheck(input: {
  patientId: string
  consentSigned?: boolean
  allergyResult?: ContrastAllergyResult
  egfr?: number
  pregnant?: boolean
  threshold?: number
}) {
  const threshold = input.threshold && input.threshold > 0 ? input.threshold : DEFAULT_EGFR_THRESHOLD
  const allergyResult = latestAllergyResult(input.patientId, input.allergyResult)
  const blockers: string[] = []
  const checks: Array<{ key: string; passed: boolean; detail: string }> = []

  const consentPassed = input.consentSigned === true
  if (!consentPassed) blockers.push('NO_CONSENT')
  checks.push({ key: 'consent', passed: consentPassed, detail: consentPassed ? '知情同意书已签署' : '缺少知情同意书' })

  const allergyPassed = allergyResult !== 'positive'
  if (!allergyPassed) blockers.push('ALLERGY_POSITIVE')
  checks.push({
    key: 'allergy',
    passed: allergyPassed,
    detail: allergyResult === 'positive' ? '过敏试验阳性, 禁用对比剂' : allergyResult === 'unknown' ? '无过敏试验记录, 建议先行试验' : '过敏试验阴性',
  })

  const egfrPassed = input.egfr === undefined || input.egfr >= threshold
  if (!egfrPassed) blockers.push('EGFR_BELOW_THRESHOLD')
  checks.push({
    key: 'egfr',
    passed: egfrPassed,
    detail: input.egfr === undefined ? '未提供 eGFR, 无法评估肾功能' : `eGFR ${input.egfr} mL/min/1.73m² (阈值 ${threshold})`,
  })

  const pregnancyPassed = input.pregnant !== true
  if (!pregnancyPassed) blockers.push('PREGNANCY')
  checks.push({ key: 'pregnancy', passed: pregnancyPassed, detail: pregnancyPassed ? '非妊娠状态' : '妊娠期禁用碘对比剂' })

  return { passed: blockers.length === 0, blockers, checks, threshold, allergyResult, evaluatedAt: nowIso() }
}

const contrastHandlers = [
  // 过敏试验 (POST)
  http.post(`${API_BASE}/contrast/allergy-test`, async ({ request }) => {
    await delay(100)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    if (!body.patientId || !body.contrastType || !body.result || !body.testedBy) {
      return HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'patientId/contrastType/result/testedBy 为必填' } }, { status: 400 })
    }
    allergySeq += 1
    const ts = nowIso()
    const record: AllergyTestRecord = {
      id: `at-${allergySeq}`,
      patientId: String(body.patientId),
      contrastType: String(body.contrastType),
      result: body.result as ContrastAllergyResult,
      testedAt: body.testedAt ? String(body.testedAt) : ts,
      testedBy: String(body.testedBy),
      notes: body.notes ? String(body.notes) : undefined,
      createdAt: ts,
    }
    allergyTests.set(record.id, record)
    return HttpResponse.json(record)
  }),

  // 增强注射 (前置核查门禁)
  http.post(`${API_BASE}/contrast/injection`, async ({ request }) => {
    await delay(120)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const patientId = String(body.patientId ?? '')
    const check = buildPreInjectionCheck({
      patientId,
      consentSigned: body.consentSigned as boolean | undefined,
      allergyResult: body.allergyResult as ContrastAllergyResult | undefined,
      egfr: (body.egfr as number | undefined) ?? (body.eGFR as number | undefined),
      pregnant: body.pregnant as boolean | undefined,
      threshold: body.threshold as number | undefined,
    })
    if (!check.passed) {
      return HttpResponse.json(
        { ok: false, code: 'PRE_INJECTION_CHECK_FAILED', message: '注射前核查未通过, 禁止注射对比剂', blockers: check.blockers, checks: check.checks },
        { status: 400 },
      )
    }
    injectionSeq += 1
    return HttpResponse.json({
      id: `inj-${injectionSeq}`,
      action: 'SEND',
      resource: 'injection-command',
      passed: true,
      blockers: [],
      preCheck: check,
      detail: body,
    })
  }),

  // 注射后留观
  http.post(`${API_BASE}/contrast/observation/start`, async ({ request }) => {
    await delay(100)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    if (!body.patientId) {
      return HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'patientId 为必填' } }, { status: 400 })
    }
    observationSeq += 1
    const now = new Date()
    const durationMinutes = body.durationMinutes && Number(body.durationMinutes) > 0 ? Number(body.durationMinutes) : DEFAULT_OBSERVATION_MINUTES
    const startedAt = body.startedAt ? new Date(String(body.startedAt)) : now
    const endsAt = new Date(startedAt.getTime() + durationMinutes * 60_000)
    const record: ObservationRecord = {
      id: `obs-${observationSeq}`,
      patientId: String(body.patientId),
      examId: body.examId ? String(body.examId) : undefined,
      contrastType: body.contrastType ? String(body.contrastType) : undefined,
      injectionId: body.injectionId ? String(body.injectionId) : undefined,
      startedAt: startedAt.toISOString(),
      durationMinutes,
      endsAt: endsAt.toISOString(),
      status: 'observing',
      operator: body.operator ? String(body.operator) : undefined,
      records: [],
      doctorRelease: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }
    observations.set(record.id, record)
    return HttpResponse.json(toObservationDto(record))
  }),

  http.get(`${API_BASE}/contrast/observation`, async ({ request }) => {
    await delay(80)
    const patientId = new URL(request.url).searchParams.get('patientId')
    const items = [...observations.values()]
      .filter((o) => !patientId || o.patientId === patientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toObservationDto)
    return HttpResponse.json({ items, total: items.length })
  }),

  http.get(`${API_BASE}/contrast/observation/:id`, async ({ params }) => {
    await delay(60)
    const found = observations.get(String(params.id))
    if (!found) return HttpResponse.json({ success: false, error: { code: 'OBSERVATION_NOT_FOUND', message: `留观记录 ${String(params.id)} 不存在` } }, { status: 404 })
    return HttpResponse.json(toObservationDto(found))
  }),

  http.post(`${API_BASE}/contrast/observation/:id/record`, async ({ params, request }) => {
    await delay(80)
    const record = observations.get(String(params.id))
    if (!record) return HttpResponse.json({ success: false, error: { code: 'OBSERVATION_NOT_FOUND', message: `留观记录 ${String(params.id)} 不存在` } }, { status: 404 })
    if (record.status === 'discharged') {
      return HttpResponse.json({ success: false, error: { code: 'OBSERVATION_DISCHARGED', message: '留观已结束, 不可追加记录' } }, { status: 400 })
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    if (!body.symptoms) {
      return HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'symptoms 为必填' } }, { status: 400 })
    }
    record.records.push({
      at: body.at ? String(body.at) : nowIso(),
      symptoms: String(body.symptoms),
      action: body.action ? String(body.action) : '',
      recordedBy: body.recordedBy ? String(body.recordedBy) : (record.operator ?? 'system'),
      reactionId: body.reactionId ? String(body.reactionId) : undefined,
    })
    record.updatedAt = nowIso()
    return HttpResponse.json(toObservationDto(record))
  }),

  http.post(`${API_BASE}/contrast/observation/:id/discharge`, async ({ params, request }) => {
    await delay(80)
    const record = observations.get(String(params.id))
    if (!record) return HttpResponse.json({ success: false, error: { code: 'OBSERVATION_NOT_FOUND', message: `留观记录 ${String(params.id)} 不存在` } }, { status: 404 })
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    if (record.status === 'discharged') return HttpResponse.json(toObservationDto(record))
    const now = Date.now()
    const elapsedSeconds = Math.max(0, Math.floor((now - new Date(record.startedAt).getTime()) / 1000))
    const requiredSeconds = record.durationMinutes * 60
    if (elapsedSeconds < requiredSeconds && body.doctorRelease !== true) {
      return HttpResponse.json(
        { ok: false, code: 'OBSERVATION_DURATION_NOT_MET', message: '留观时长未满, 需医生放行方可离院', requiredSeconds, elapsedSeconds, remainingSeconds: requiredSeconds - elapsedSeconds },
        { status: 400 },
      )
    }
    record.status = 'discharged'
    record.doctorRelease = body.doctorRelease === true
    record.dischargedAt = new Date(now).toISOString()
    record.dischargedBy = body.dischargedBy ? String(body.dischargedBy) : (record.operator ?? 'system')
    record.dischargeNotes = body.notes ? String(body.notes) : undefined
    record.updatedAt = record.dischargedAt
    return HttpResponse.json(toObservationDto(record))
  }),

  // ── 外渗事件 ──
  http.post(`${API_BASE}/contrast/extravasation`, async ({ request }) => {
    await delay(100)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    if (!body.patientId || !body.severity || !body.site || body.estimatedVolumeMl === undefined || !body.management || !body.recordedBy) {
      return HttpResponse.json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'patientId/severity/site/estimatedVolumeMl/management/recordedBy 为必填' } }, { status: 400 })
    }
    extravasationSeq += 1
    const ts = nowIso()
    const record: ExtravasationEvent = {
      id: `exv-${extravasationSeq}`,
      patientId: String(body.patientId),
      examId: body.examId ? String(body.examId) : undefined,
      severity: body.severity as ExtravasationSeverity,
      site: String(body.site),
      estimatedVolumeMl: Number(body.estimatedVolumeMl),
      management: String(body.management),
      recordedBy: String(body.recordedBy),
      occurredAt: body.occurredAt ? String(body.occurredAt) : ts,
      status: 'open',
      createdAt: ts,
      updatedAt: ts,
    }
    extravasations.push(record)
    return HttpResponse.json(record)
  }),

  http.get(`${API_BASE}/contrast/extravasation/stats`, async () => {
    await delay(100)
    const base = [...extravasations]
    const totalInjections = injectionSeq + SEED_INJECTION_TOTAL
    const severityOrder: ExtravasationSeverity[] = ['mild', 'moderate', 'severe']
    const siteMap = new Map<string, number>()
    const monthMap = new Map<string, number>()
    for (const e of base) {
      siteMap.set(e.site, (siteMap.get(e.site) ?? 0) + 1)
      const month = e.occurredAt.slice(0, 7)
      monthMap.set(month, (monthMap.get(month) ?? 0) + 1)
    }
    return HttpResponse.json({
      total: base.length,
      totalInjections,
      incidenceRatePerThousand: totalInjections > 0 ? round1((base.length / totalInjections) * 1000) : 0,
      bySeverity: severityOrder.map((severity) => ({ severity, count: base.filter((e) => e.severity === severity).length })),
      bySite: [...siteMap.entries()].map(([site, count]) => ({ site, count })).sort((a, b) => b.count - a.count),
      byMonth: [...monthMap.entries()].map(([month, count]) => ({ month, count })).sort((a, b) => a.month.localeCompare(b.month)),
      openCount: base.filter((e) => e.status === 'open').length,
      resolvedCount: base.filter((e) => e.status === 'resolved').length,
      source: extravasations.some((e) => !e.id.startsWith('exv-seed-')) ? 'memory' : 'seed',
    })
  }),

  http.get(`${API_BASE}/contrast/extravasation`, async ({ request }) => {
    await delay(90)
    const url = new URL(request.url)
    const patientId = url.searchParams.get('patientId')
    const severity = url.searchParams.get('severity')
    const dateFrom = url.searchParams.get('dateFrom')
    const dateTo = url.searchParams.get('dateTo')
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1)
    const pageSize = Math.min(200, Math.max(1, Number(url.searchParams.get('pageSize') ?? 20) || 20))
    const matched = [...extravasations]
      .filter((e) => !patientId || e.patientId === patientId)
      .filter((e) => !severity || e.severity === severity)
      .filter((e) => !dateFrom || e.occurredAt >= dateFrom)
      .filter((e) => !dateTo || e.occurredAt <= dateTo)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    const start = (page - 1) * pageSize
    return HttpResponse.json({
      items: matched.slice(start, start + pageSize),
      total: matched.length,
      page,
      pageSize,
      source: extravasations.some((e) => !e.id.startsWith('exv-seed-')) ? 'memory' : 'seed',
    })
  }),

  http.post(`${API_BASE}/contrast/extravasation/:id/handle`, async ({ params, request }) => {
    await delay(100)
    const index = extravasations.findIndex((e) => e.id === String(params.id))
    if (index < 0) {
      return HttpResponse.json({ success: false, error: { code: 'EXTRAVASATION_NOT_FOUND', message: `外渗事件 ${String(params.id)} 不存在` } }, { status: 404 })
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const record = extravasations[index]!
    const ts = nowIso()
    if (body.management && String(body.management).trim()) record.management = String(body.management).trim()
    if (body.followUp !== undefined) record.followUp = String(body.followUp)
    if (body.note !== undefined) record.handleNote = String(body.note)
    record.handledBy = body.handledBy && String(body.handledBy).trim() ? String(body.handledBy).trim() : (record.handledBy ?? 'system')
    record.handledAt = ts
    record.status = 'resolved'
    record.updatedAt = ts
    return HttpResponse.json(record)
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 3) 叫号队列扩展端点 (queue: overview / room-status / daily-trend / waiting-stats)
// ═══════════════════════════════════════════════════════════════════════════
interface QueueSeedItem {
  roomId: string
  status: '等待中' | '已呼叫' | '检查中' | '已完成'
  waitMinutes: number
  modality: string
  priority: '普通' | '紧急' | '危重'
  patientType: '急诊' | '住院' | '门诊' | '体检'
  calledCount: number
}

const Q_ITEMS: QueueSeedItem[] = [
  { roomId: 'ROOM-DR1', status: '等待中', waitMinutes: 5, modality: 'DR', priority: '普通', patientType: '住院', calledCount: 0 },
  { roomId: 'ROOM-MR1', status: '等待中', waitMinutes: 12, modality: 'MR', priority: '普通', patientType: '急诊', calledCount: 0 },
  { roomId: 'ROOM-CT1', status: '等待中', waitMinutes: 20, modality: 'CT', priority: '危重', patientType: '门诊', calledCount: 0 },
  { roomId: 'ROOM-DSA1', status: '已呼叫', waitMinutes: 30, modality: 'DSA', priority: '紧急', patientType: '急诊', calledCount: 1 },
  { roomId: 'ROOM-MG1', status: '检查中', waitMinutes: 25, modality: 'MG', priority: '普通', patientType: '体检', calledCount: 1 },
  { roomId: 'ROOM-CT1', status: '等待中', waitMinutes: 40, modality: 'CT', priority: '普通', patientType: '门诊', calledCount: 0 },
]

const Q_ROOMS: Array<{ id: string; name: string; roomNumber: string; modality: string; status: '空闲' | '使用中' | '暂停' | '维护中'; waitCount: number; completedToday: number; currentPatient?: string; currentQueueNum?: string }> = [
  { id: 'ROOM-CT1', name: 'CT室1', roomNumber: 'CT-01', modality: 'CT', status: '使用中', currentPatient: '王芳', currentQueueNum: 'Q002', waitCount: 5, completedToday: 12 },
  { id: 'ROOM-MR1', name: 'MR室1', roomNumber: 'MR-01', modality: 'MR', status: '空闲', waitCount: 3, completedToday: 8 },
  { id: 'ROOM-DR1', name: 'DR室1', roomNumber: 'DR-01', modality: 'DR', status: '空闲', waitCount: 7, completedToday: 15 },
  { id: 'ROOM-DSA1', name: 'DSA室1', roomNumber: 'DSA-01', modality: 'DSA', status: '使用中', currentPatient: '刘洋', currentQueueNum: 'Q004', waitCount: 2, completedToday: 3 },
  { id: 'ROOM-MG1', name: '钼靶室1', roomNumber: 'MG-01', modality: 'MG', status: '空闲', waitCount: 4, completedToday: 6 },
  { id: 'ROOM-CT2', name: 'CT室2', roomNumber: 'CT-02', modality: 'CT', status: '暂停', waitCount: 0, completedToday: 10 },
]

const TIMEOUT_MINUTES = 30

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function groupCount<T extends string>(items: QueueSeedItem[], key: (i: QueueSeedItem) => T): Array<{ name: string; count: number }> {
  const map = new Map<string, number>()
  for (const i of items) {
    const v = key(i)
    map.set(v, (map.get(v) ?? 0) + 1)
  }
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)
}

const queueHandlers = [
  http.get(`${API_BASE}/queue/overview`, async () => {
    await delay(90)
    const waiting = Q_ITEMS.filter((i) => i.status === '等待中')
    const called = Q_ITEMS.filter((i) => i.status === '已呼叫')
    const inService = Q_ITEMS.filter((i) => i.status === '检查中')
    const completed = Q_ITEMS.filter((i) => i.status === '已完成')
    const waitMins = Q_ITEMS.map((i) => i.waitMinutes)
    const totalWaiting = Q_ROOMS.reduce((a, r) => a + r.waitCount, 0)
    return HttpResponse.json({
      date: localDate(new Date()),
      todayCalled: Q_ITEMS.filter((i) => i.calledCount > 0).length,
      todayCompleted: completed.length,
      waitingCount: waiting.length,
      calledCount: called.length,
      inServiceCount: inService.length,
      completedCount: completed.length,
      avgWaitMinutes: waitMins.length ? Math.round(waitMins.reduce((a, b) => a + b, 0) / waitMins.length) : 0,
      maxWaitMinutes: waitMins.length ? Math.max(...waitMins) : 0,
      timeoutCount: waitMins.filter((m) => m > TIMEOUT_MINUTES).length,
      busyRooms: Q_ROOMS.filter((r) => r.status === '使用中').length,
      idleRooms: Q_ROOMS.filter((r) => r.status === '空闲').length,
      totalRooms: Q_ROOMS.length,
      avgQueueLength: Q_ROOMS.length ? Math.round((totalWaiting / Q_ROOMS.length) * 10) / 10 : 0,
      seeded: true,
    })
  }),

  http.get(`${API_BASE}/queue/room-status`, async () => {
    await delay(90)
    const byStatus: Record<string, number> = { 空闲: 0, 使用中: 0, 暂停: 0, 维护中: 0 }
    const byModality = new Map<string, { modality: string; total: number; busy: number; waiting: number; completed: number }>()
    for (const r of Q_ROOMS) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
      const m = byModality.get(r.modality) ?? { modality: r.modality || '未知', total: 0, busy: 0, waiting: 0, completed: 0 }
      m.total += 1
      if (r.status === '使用中') m.busy += 1
      m.waiting += r.waitCount
      m.completed += r.completedToday
      byModality.set(r.modality || '未知', m)
    }
    return HttpResponse.json({
      totalRooms: Q_ROOMS.length,
      byStatus,
      waitingTotal: Q_ROOMS.reduce((a, r) => a + r.waitCount, 0),
      inServiceTotal: Q_ROOMS.filter((r) => r.currentPatient).length,
      busyRate: Q_ROOMS.length ? Math.round(((byStatus['使用中'] ?? 0) / Q_ROOMS.length) * 100) : 0,
      byModality: [...byModality.values()],
      seeded: true,
    })
  }),

  http.get(`${API_BASE}/queue/daily-trend`, async ({ request }) => {
    await delay(90)
    const parsed = Number(new URL(request.url).searchParams.get('days'))
    const count = Math.max(1, Math.min(Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 7, 30))
    const now = new Date()
    const points = Array.from({ length: count }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (count - 1 - i))
      const idx = i
      const called = 48 + ((idx * 7) % 40)
      const completed = Math.round(called * 0.92)
      const timeout = idx % 4
      return {
        date: localDate(d),
        label: `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        called,
        completed,
        timeout,
        seeded: true,
      }
    })
    return HttpResponse.json(points)
  }),

  http.get(`${API_BASE}/queue/waiting-stats`, async () => {
    await delay(90)
    const active = Q_ITEMS.filter((i) => i.status === '等待中' || i.status === '已呼叫')
    const waitMins = active.map((i) => i.waitMinutes)
    const buckets = [
      { range: '<10分钟', test: (m: number) => m < 10 },
      { range: '10-30分钟', test: (m: number) => m >= 10 && m <= 30 },
      { range: '30-60分钟', test: (m: number) => m > 30 && m <= 60 },
      { range: '>60分钟', test: (m: number) => m > 60 },
    ]
    const distribution = buckets.map((b) => {
      const c = active.filter((i) => b.test(i.waitMinutes)).length
      return { range: b.range, count: c, percent: active.length ? Math.round((c / active.length) * 100) : 0 }
    })
    return HttpResponse.json({
      total: Q_ITEMS.length,
      waitingCount: Q_ITEMS.filter((i) => i.status === '等待中').length,
      calledCount: Q_ITEMS.filter((i) => i.status === '已呼叫').length,
      avgWaitMinutes: waitMins.length ? Math.round(waitMins.reduce((a, b) => a + b, 0) / waitMins.length) : 0,
      maxWaitMinutes: waitMins.length ? Math.max(...waitMins) : 0,
      timeoutCount: waitMins.filter((m) => m > TIMEOUT_MINUTES).length,
      distribution,
      byModality: groupCount(active, (i) => i.modality).map(({ name, count }) => ({ modality: name, count })),
      byPriority: groupCount(active, (i) => i.priority).map(({ name, count }) => ({ priority: name, count })),
      byPatientType: groupCount(active, (i) => i.patientType).map(({ name, count }) => ({ patientType: name, count })),
      seeded: true,
    })
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 4) 通知总览 / 趋势 (notifications)
//    后端: GET /notifications/overview · GET /notifications/daily-trend
// ═══════════════════════════════════════════════════════════════════════════
const notificationHandlers = [
  http.get(`${API_BASE}/notifications/overview`, async ({ request }) => {
    await delay(90)
    const userId = new URL(request.url).searchParams.get('userId') ?? '*'
    return HttpResponse.json({
      userId,
      total: 48,
      unread: 6,
      today: 9,
      critical: 2,
      lastWeek: 41,
      lastWeekDeltaPercent: 10.8,
      byType: { CRITICAL: 8, REPORT: 21, TASK: 9, SYSTEM: 6, APPOINTMENT: 4 },
      bySeverity: { INFO: 32, WARN: 11, ERROR: 3, CRITICAL: 2 },
    })
  }),

  http.get(`${API_BASE}/notifications/daily-trend`, async ({ request }) => {
    await delay(90)
    const url = new URL(request.url)
    const parsed = Number(url.searchParams.get('days'))
    const n = Number.isFinite(parsed) && parsed > 0 && parsed <= 365 ? Math.floor(parsed) : 30
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - (n - 1))
    const items = Array.from({ length: n }, (_, idx) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + idx)
      return { date: localDate(d), total: (idx * 4) % 12, unread: (idx * 2) % 6, critical: idx % 3 }
    })
    return HttpResponse.json({ items, total: n })
  }),
]

export const w3MissingHandlers = [
  ...feedbackHandlers,
  ...contrastHandlers,
  ...queueHandlers,
  ...notificationHandlers,
]
