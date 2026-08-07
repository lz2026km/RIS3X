// [W4-B] /api/v1/followups MSW handlers — 随访计划 (列表/创建/更新/删除/完成/到期提醒)
import { http, HttpResponse, delay } from 'msw'

// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5191/api/v1')

const API = `${API_BASE}/followups`

export interface MockFollowUpPlan {
  id: string
  patientId: string
  patientName: string
  planDate: string
  intervalDays: number
  nextDate: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE'
  note: string
  reminderEnabled: boolean
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
  { id: 'FU001', patientId: 'P202400001', patientName: '李四', planDate: dayFromNow(-10), intervalDays: 30, nextDate: dayFromNow(20), status: 'IN_PROGRESS', note: '肺癌术后3个月复查，影像学评估', reminderEnabled: true, completedAt: null, createdAt: isoDate(new Date(Date.now() - 86400000 * 30)), updatedAt: isoDate(new Date()) },
  { id: 'FU002', patientId: 'P202400002', patientName: '王五', planDate: dayFromNow(-40), intervalDays: 30, nextDate: dayFromNow(-10), status: 'OVERDUE', note: '肺结节6个月随访，大小稳定', reminderEnabled: true, completedAt: null, createdAt: isoDate(new Date(Date.now() - 86400000 * 60)), updatedAt: isoDate(new Date()) },
  { id: 'FU003', patientId: 'P202400003', patientName: '赵六', planDate: dayFromNow(-5), intervalDays: 60, nextDate: dayFromNow(5), status: 'PENDING', note: '肝癌介入治疗后影像学评估', reminderEnabled: true, completedAt: null, createdAt: isoDate(new Date(Date.now() - 86400000 * 10)), updatedAt: isoDate(new Date()) },
  { id: 'FU004', patientId: 'P202400004', patientName: '钱七', planDate: dayFromNow(-90), intervalDays: 90, nextDate: dayFromNow(0), status: 'PENDING', note: 'CT引导下活检后观察', reminderEnabled: true, completedAt: null, createdAt: isoDate(new Date(Date.now() - 86400000 * 120)), updatedAt: isoDate(new Date()) },
  { id: 'FU005', patientId: 'P202400005', patientName: '孙八', planDate: dayFromNow(-120), intervalDays: 90, nextDate: dayFromNow(-30), status: 'COMPLETED', note: '放疗后疗效评估', reminderEnabled: false, completedAt: dayFromNow(-5), createdAt: isoDate(new Date(Date.now() - 86400000 * 150)), updatedAt: isoDate(new Date()) },
]

const deriveStatus = (p: MockFollowUpPlan): MockFollowUpPlan['status'] => {
  if (p.status === 'COMPLETED') return 'COMPLETED'
  if (p.status === 'OVERDUE') return 'OVERDUE'
  if (new Date(p.nextDate).getTime() < Date.now()) return 'OVERDUE'
  return p.status
}

const withStatus = (p: MockFollowUpPlan): MockFollowUpPlan => ({ ...p, status: deriveStatus(p) })

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min)

export const followupHandlers = [
  // ⚠️ due 必须先于 :id
  http.get(`${API}/due`, async ({ request }) => {
    await delay(delayMs())
    const url = new URL(request.url)
    const days = Math.max(1, Number(url.searchParams.get('days') ?? 7))
    const horizon = new Date(Date.now() + days * 86400000).getTime()
    const items = PLANS
      .map(withStatus)
      .filter((p) => p.status !== 'COMPLETED' && new Date(p.nextDate).getTime() <= horizon)
      .sort((a, b) => a.nextDate.localeCompare(b.nextDate))
    return HttpResponse.json({ success: true, data: { items, total: items.length, days } })
  }),

  http.get(`${API}`, async ({ request }) => {
    await delay(delayMs())
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const date = url.searchParams.get('date')
    const search = url.searchParams.get('search')?.toLowerCase()
    let items = PLANS.map(withStatus)
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

  http.put(`${API}/:id`, async ({ params, request }) => {
    await delay(delayMs())
    const idx = PLANS.findIndex((p) => p.id === params.id)
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'FollowUpPlan not found' } }, { status: 404 })
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

  http.post(`${API}/:id/complete`, async ({ params }) => {
    await delay(delayMs())
    const idx = PLANS.findIndex((p) => p.id === params.id)
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'FollowUpPlan not found' } }, { status: 404 })
    PLANS[idx] = withStatus({ ...PLANS[idx]!, status: 'COMPLETED', completedAt: isoDate(new Date()), updatedAt: isoDate(new Date()) })
    return HttpResponse.json({ success: true, data: PLANS[idx] })
  }),

  http.delete(`${API}/:id`, async ({ params }) => {
    await delay(delayMs())
    const existed = PLANS.some((p) => p.id === params.id)
    PLANS = PLANS.filter((p) => p.id !== params.id)
    return new HttpResponse(null, { status: existed ? 204 : 404 })
  }),
]
