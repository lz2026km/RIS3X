// [v3.0.6.11-99 Wave3B] /api/v1/followups MSW handlers — 随访闭环:
// 状态机 (remind/miss/cancel/in-progress/complete) + 统计 (stats) + 检查联动 (from-exam)
import { http, HttpResponse, delay } from 'msw'

// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5191/api/v1')

const API = `${API_BASE}/followups`

export type MockFollowUpStatus = 'PENDING' | 'REMINDED' | 'IN_PROGRESS' | 'COMPLETED' | 'MISSED' | 'CANCELLED' | 'OVERDUE'

export interface MockFollowUpPlan {
  id: string
  patientId: string
  patientName: string
  reportId?: string
  examId?: string
  templateId?: string
  planDate: string
  intervalDays: number
  nextDate: string
  status: MockFollowUpStatus
  note: string
  reminderEnabled: boolean
  remindedAt?: string | null
  missedAt?: string | null
  cancelledAt?: string | null
  reason?: string
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

const isoDate = (d: Date): string => d.toISOString()

const dayFromNow = (days: number): string => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return isoDate(d)
}

let PLANS: MockFollowUpPlan[] = [
  { id: 'FU001', patientId: 'P202400001', patientName: '李四', planDate: dayFromNow(-10), intervalDays: 30, nextDate: dayFromNow(20), status: 'IN_PROGRESS', note: '肺癌术后3个月复查，影像学评估', reminderEnabled: true, remindedAt: dayFromNow(-3), completedAt: null, createdAt: isoDate(new Date(Date.now() - 86400000 * 30)), updatedAt: isoDate(new Date()) },
  { id: 'FU002', patientId: 'P202400002', patientName: '王五', planDate: dayFromNow(-40), intervalDays: 30, nextDate: dayFromNow(-10), status: 'OVERDUE', note: '肺结节6个月随访，大小稳定', reminderEnabled: true, completedAt: null, createdAt: isoDate(new Date(Date.now() - 86400000 * 60)), updatedAt: isoDate(new Date()) },
  { id: 'FU003', patientId: 'P202400003', patientName: '赵六', planDate: dayFromNow(-5), intervalDays: 60, nextDate: dayFromNow(5), status: 'PENDING', note: '肝癌介入治疗后影像学评估', reminderEnabled: true, completedAt: null, createdAt: isoDate(new Date(Date.now() - 86400000 * 10)), updatedAt: isoDate(new Date()) },
  { id: 'FU004', patientId: 'P202400004', patientName: '钱七', planDate: dayFromNow(-90), intervalDays: 90, nextDate: dayFromNow(0), status: 'REMINDED', note: 'CT引导下活检后观察', reminderEnabled: true, remindedAt: dayFromNow(0), completedAt: null, createdAt: isoDate(new Date(Date.now() - 86400000 * 120)), updatedAt: isoDate(new Date()) },
  { id: 'FU005', patientId: 'P202400005', patientName: '孙八', planDate: dayFromNow(-120), intervalDays: 90, nextDate: dayFromNow(-30), status: 'COMPLETED', note: '放疗后疗效评估', reminderEnabled: false, completedAt: dayFromNow(-5), createdAt: isoDate(new Date(Date.now() - 86400000 * 150)), updatedAt: isoDate(new Date()) },
  { id: 'FU006', patientId: 'P202400006', patientName: '周九', planDate: dayFromNow(-70), intervalDays: 60, nextDate: dayFromNow(-15), status: 'MISSED', note: '术后复查（电话失访）', reminderEnabled: true, missedAt: dayFromNow(-5), reason: '电话无法接通', completedAt: null, createdAt: isoDate(new Date(Date.now() - 86400000 * 100)), updatedAt: isoDate(new Date()) },
  { id: 'FU007', patientId: 'P202400007', patientName: '吴十', planDate: dayFromNow(-50), intervalDays: 45, nextDate: dayFromNow(-5), status: 'CANCELLED', note: '患者转院，随访取消', reminderEnabled: false, cancelledAt: dayFromNow(-3), reason: '患者转院', completedAt: null, createdAt: isoDate(new Date(Date.now() - 86400000 * 80)), updatedAt: isoDate(new Date()) },
]

const TERMINAL = new Set(['COMPLETED', 'MISSED', 'CANCELLED'])

// [v3.0.6.11-99 Wave3B] 模板 apply/检查联动生成的新计划注入列表 (跨 handler 文件共享)
export function pushFollowUpPlans(plans: MockFollowUpPlan[]) {
  PLANS = [...plans, ...PLANS]
}

const deriveStatus = (p: MockFollowUpPlan): MockFollowUpPlan['status'] => {
  if (TERMINAL.has(p.status)) return p.status
  if (p.status === 'OVERDUE') return 'OVERDUE'
  if (new Date(p.nextDate).getTime() < Date.now()) return 'OVERDUE'
  return p.status
}

const withStatus = (p: MockFollowUpPlan): MockFollowUpPlan => ({ ...p, status: deriveStatus(p) })

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min)

const notFound = (id: string) =>
  HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `FollowUpPlan ${id} not found` } }, { status: 404 })

const findIdx = (id: unknown): number => {
  const idx = PLANS.findIndex((p) => p.id === id)
  return idx
}

export const followupHandlers = [
  // ⚠️ due/stats/from-exam 必须先于 :id
  http.get(`${API}/due`, async ({ request }) => {
    await delay(delayMs())
    const url = new URL(request.url)
    const days = Math.max(1, Number(url.searchParams.get('days') ?? 7))
    const horizon = new Date(Date.now() + days * 86400000).getTime()
    const items = PLANS
      .map(withStatus)
      .filter((p) => !TERMINAL.has(p.status) && new Date(p.nextDate).getTime() <= horizon)
      .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
    return HttpResponse.json({ success: true, data: { items, total: items.length, days } })
  }),

  // [v3.0.6.11-99 Wave3B] 统计: 完成率/失访率/异常率/按类别/按时段
  http.get(`${API}/stats`, async () => {
    await delay(delayMs())
    const rows = PLANS.map(withStatus)
    const total = rows.length
    const countBy = (s: string) => rows.filter((p) => p.status === s).length
    const completed = countBy('COMPLETED')
    const missed = countBy('MISSED')
    const cancelled = countBy('CANCELLED')
    const overdue = countBy('OVERDUE')
    const byCategory: Record<string, number> = { '病种': 3, '检查类型': 2, '未分类': rows.length - 5 }
    if (byCategory['未分类']! <= 0) delete byCategory['未分类']
    const byMonthMap: Record<string, { total: number; completed: number; missed: number }> = {}
    for (const p of rows) {
      const m = p.planDate.slice(0, 7)
      byMonthMap[m] = byMonthMap[m] ?? { total: 0, completed: 0, missed: 0 }
      byMonthMap[m]!.total += 1
      if (p.status === 'COMPLETED') byMonthMap[m]!.completed += 1
      if (p.status === 'MISSED') byMonthMap[m]!.missed += 1
    }
    return HttpResponse.json({
      success: true,
      data: {
        total,
        completed,
        missed,
        cancelled,
        overdue,
        inProgress: countBy('IN_PROGRESS'),
        reminded: countBy('REMINDED'),
        pending: countBy('PENDING'),
        completionRate: Math.round((completed / Math.max(1, total - cancelled)) * 1000) / 10,
        missRate: Math.round((missed / Math.max(1, total)) * 1000) / 10,
        abnormalRate: Math.round((overdue / Math.max(1, total)) * 1000) / 10,
        byCategory: Object.entries(byCategory).map(([category, count]) => ({ category, count })),
        byMonth: Object.entries(byMonthMap).map(([month, v]) => ({ month, ...v })).sort((a, b) => a.month.localeCompare(b.month)),
      },
    })
  }),

  http.get(`${API}`, async ({ request }) => {
    await delay(delayMs())
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const date = url.searchParams.get('date')
    const search = url.searchParams.get('search')?.toLowerCase()
    // [v3.0.6.11-96 Wave3B G-30 P2] 患者门户按当前患者过滤 (SelfServicePortal 随访管理 Tab)
    const patientId = url.searchParams.get('patientId')
    let items = PLANS.map(withStatus)
    if (patientId) items = items.filter((p) => p.patientId === patientId)
    if (status) items = items.filter((p) => p.status === status)
    if (date) items = items.filter((p) => p.planDate.slice(0, 10) === date)
    if (search) items = items.filter((p) => p.patientName.toLowerCase().includes(search) || p.patientId.toLowerCase().includes(search))
    items.sort((a, b) => a.nextDate.localeCompare(b.nextDate))
    return HttpResponse.json({ success: true, data: { items, total: items.length } })
  }),

  http.post(`${API}`, async ({ request }) => {
    await delay(delayMs())
    const body = (await request.json()) as Partial<MockFollowUpPlan>
    const planDate = body.planDate ?? isoDate(new Date())
    const intervalDays = body.intervalDays ?? 30
    const next = new Date(new Date(planDate).getTime() + intervalDays * 86400000)
    const plan: MockFollowUpPlan = {
      id: `FU-${Date.now()}`,
      patientId: body.patientId ?? '',
      patientName: body.patientName ?? '',
      reportId: body.reportId || undefined,
      examId: body.examId || undefined,
      templateId: body.templateId || undefined,
      planDate,
      intervalDays,
      nextDate: isoDate(next),
      status: body.status ?? 'PENDING',
      note: body.note ?? '',
      reminderEnabled: body.reminderEnabled ?? true,
      completedAt: null,
      createdAt: isoDate(new Date()),
      updatedAt: isoDate(new Date()),
    }
    PLANS = [plan, ...PLANS]
    return HttpResponse.json({ success: true, data: plan }, { status: 201 })
  }),

  // [v3.0.6.11-99 Wave3B] 检查联动: 检查 → 随访计划 (可选模板批量)
  http.post(`${API}/from-exam`, async ({ request }) => {
    await delay(delayMs())
    const body = (await request.json()) as { examId?: string; templateId?: string; note?: string }
    if (!body.examId) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'examId 必填' } }, { status: 400 })
    }
    const templateId = body.templateId
    const intervals = templateId === 'tpl-onc-ct' ? [30, 90, 180] : templateId === 'tpl-contrast' ? [7, 30] : [30]
    const base = new Date()
    const created = intervals.map((days, i) => {
      const planDate = base
      const next = new Date(planDate.getTime() + days * 86400000)
      return {
        id: `FU-EXAM-${Date.now()}-${i}`,
        patientId: `P-${body.examId}`,
        patientName: `检查联动患者${body.examId}`,
        examId: body.examId,
        templateId,
        planDate: isoDate(planDate),
        intervalDays: days,
        nextDate: isoDate(next),
        status: 'PENDING' as MockFollowUpStatus,
        note: body.note ?? `来源检查: ${body.examId} 完成联动`,
        reminderEnabled: true,
        completedAt: null,
        createdAt: isoDate(new Date()),
        updatedAt: isoDate(new Date()),
      } as MockFollowUpPlan
    })
    PLANS = [...created, ...PLANS]
    return HttpResponse.json({ success: true, data: { items: created, total: created.length } }, { status: 201 })
  }),

  http.put(`${API}/:id`, async ({ params, request }) => {
    await delay(delayMs())
    const idx = findIdx(params.id)
    if (idx < 0) return notFound(String(params.id))
    const body = (await request.json()) as Partial<MockFollowUpPlan>
    const merged = { ...PLANS[idx]!, ...body, id: PLANS[idx]!.id, updatedAt: isoDate(new Date()) }
    if (body.planDate || body.intervalDays) {
      const planDate = merged.planDate
      const intervalDays = merged.intervalDays
      merged.nextDate = isoDate(new Date(new Date(planDate).getTime() + intervalDays * 86400000))
    }
    PLANS[idx] = withStatus(merged)
    return HttpResponse.json({ success: true, data: PLANS[idx] })
  }),

  // [v3.0.6.11-99 Wave3B] 状态机: remind/miss/cancel/in-progress
  http.post(`${API}/:id/remind`, async ({ params }) => {
    await delay(delayMs())
    const idx = findIdx(params.id)
    if (idx < 0) return notFound(String(params.id))
    const cur = PLANS[idx]!
    if (TERMINAL.has(cur.status)) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '计划已处于终态, 不可提醒' } }, { status: 400 })
    }
    PLANS[idx] = withStatus({ ...cur, status: 'REMINDED', remindedAt: isoDate(new Date()), updatedAt: isoDate(new Date()) })
    return HttpResponse.json({ success: true, data: PLANS[idx] })
  }),

  http.post(`${API}/:id/miss`, async ({ params, request }) => {
    await delay(delayMs())
    const idx = findIdx(params.id)
    if (idx < 0) return notFound(String(params.id))
    const cur = PLANS[idx]!
    if (TERMINAL.has(cur.status)) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '计划已处于终态, 不可标记失访' } }, { status: 400 })
    }
    const body = (await request.json()) as { reason?: string }
    if (!body.reason?.trim()) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '请填写失访原因' } }, { status: 400 })
    }
    PLANS[idx] = withStatus({ ...cur, status: 'MISSED', missedAt: isoDate(new Date()), reason: body.reason.trim(), updatedAt: isoDate(new Date()) })
    return HttpResponse.json({ success: true, data: PLANS[idx] })
  }),

  http.post(`${API}/:id/cancel`, async ({ params, request }) => {
    await delay(delayMs())
    const idx = findIdx(params.id)
    if (idx < 0) return notFound(String(params.id))
    const cur = PLANS[idx]!
    if (TERMINAL.has(cur.status)) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '计划已处于终态, 不可取消' } }, { status: 400 })
    }
    const body = (await request.json()) as { reason?: string }
    if (!body.reason?.trim()) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '请填写取消原因' } }, { status: 400 })
    }
    PLANS[idx] = withStatus({ ...cur, status: 'CANCELLED', cancelledAt: isoDate(new Date()), reason: body.reason.trim(), updatedAt: isoDate(new Date()) })
    return HttpResponse.json({ success: true, data: PLANS[idx] })
  }),

  http.post(`${API}/:id/in-progress`, async ({ params }) => {
    await delay(delayMs())
    const idx = findIdx(params.id)
    if (idx < 0) return notFound(String(params.id))
    const cur = PLANS[idx]!
    if (TERMINAL.has(cur.status)) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '计划已处于终态, 不可开始' } }, { status: 400 })
    }
    PLANS[idx] = withStatus({ ...cur, status: 'IN_PROGRESS', updatedAt: isoDate(new Date()) })
    return HttpResponse.json({ success: true, data: PLANS[idx] })
  }),

  http.post(`${API}/:id/complete`, async ({ params }) => {
    await delay(delayMs())
    const idx = findIdx(params.id)
    if (idx < 0) return notFound(String(params.id))
    const cur = PLANS[idx]!
    if (TERMINAL.has(cur.status)) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '计划已处于终态, 不可完成' } }, { status: 400 })
    }
    PLANS[idx] = withStatus({ ...cur, status: 'COMPLETED', completedAt: isoDate(new Date()), updatedAt: isoDate(new Date()) })
    return HttpResponse.json({ success: true, data: PLANS[idx] })
  }),

  http.delete(`${API}/:id`, async ({ params }) => {
    await delay(delayMs())
    const existed = PLANS.some((p) => p.id === params.id)
    PLANS = PLANS.filter((p) => p.id !== params.id)
    return new HttpResponse(null, { status: existed ? 204 : 404 })
  }),
]
