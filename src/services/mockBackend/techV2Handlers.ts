// [G005 Wave 6B v3.0.6.11-101] /api/v1/tech-v2 MSW handlers
// 对齐后端 tech-v2.module + techV2Api (双检间轮转 + 工作量预测, 孤儿模块 → seeded=true 确定性输出)
// 响应形状: { success: true, data: <T> }
import { http, HttpResponse, delay } from 'msw'
// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1')


const API = `${API_BASE}/tech-v2`

type TechShift = 'DAY' | 'NIGHT' | 'WEEKEND' | 'BACKUP'

interface Technician { id: string; name: string; group: string }
interface Room { id: string; name: string }

const TECHNICIANS: Technician[] = [
  { id: 't-001', name: '刘技师', group: 'CT 组' },
  { id: 't-002', name: '陈技师', group: 'CT 组' },
  { id: 't-003', name: '杨技师', group: 'MR 组' },
  { id: 't-004', name: '周技师', group: 'MR 组' },
  { id: 't-005', name: '吴技师', group: 'DR 组' },
  { id: 't-006', name: '郑技师', group: 'DR 组' },
]

const ROOMS: Room[] = [
  { id: 'room-ct-1', name: 'CT 一室' },
  { id: 'room-ct-2', name: 'CT 二室' },
  { id: 'room-mr-1', name: 'MR 一室' },
  { id: 'room-dr-1', name: 'DR 一室' },
  { id: 'room-dr-2', name: 'DR 二室' },
]

interface RotationRule {
  id: string
  name: string
  shift: TechShift
  roomIds: string[]
  skillMatrix: Record<string, string[]>
  eligibleTechIds: string[]
  maxConsecutiveDays: number
  balanceWeight: number
  enabled: boolean
  description: string
}

const ROTATION_RULES: RotationRule[] = [
  {
    id: 'rr-001', name: 'CT 白班', shift: 'DAY', roomIds: ['room-ct-1', 'room-ct-2'],
    skillMatrix: { 't-001': ['room-ct-1', 'room-ct-2'], 't-002': ['room-ct-1', 'room-ct-2'] },
    eligibleTechIds: ['t-001', 't-002'], maxConsecutiveDays: 3, balanceWeight: 0.6, enabled: true,
    description: 'CT 组白班轮转 (8:00-17:00)',
  },
  {
    id: 'rr-002', name: 'MR 白班', shift: 'DAY', roomIds: ['room-mr-1'],
    skillMatrix: { 't-003': ['room-mr-1'], 't-004': ['room-mr-1'] },
    eligibleTechIds: ['t-003', 't-004'], maxConsecutiveDays: 3, balanceWeight: 0.5, enabled: true,
    description: 'MR 组白班轮转 (8:00-17:00)',
  },
  {
    id: 'rr-003', name: 'DR 白班', shift: 'DAY', roomIds: ['room-dr-1', 'room-dr-2'],
    skillMatrix: { 't-005': ['room-dr-1', 'room-dr-2'], 't-006': ['room-dr-1', 'room-dr-2'] },
    eligibleTechIds: ['t-005', 't-006'], maxConsecutiveDays: 3, balanceWeight: 0.5, enabled: true,
    description: 'DR 组白班轮转 (8:00-17:00)',
  },
  {
    id: 'rr-004', name: '夜班', shift: 'NIGHT', roomIds: ['room-ct-1'],
    skillMatrix: { 't-001': ['room-ct-1'], 't-002': ['room-ct-1'] },
    eligibleTechIds: ['t-001', 't-002', 't-005'], maxConsecutiveDays: 2, balanceWeight: 0.8, enabled: true,
    description: '夜间值班 (17:00-次日8:00)',
  },
  {
    id: 'rr-005', name: '周末班', shift: 'WEEKEND', roomIds: ['room-ct-1', 'room-dr-1'],
    skillMatrix: { 't-001': ['room-ct-1'], 't-002': ['room-ct-1'], 't-005': ['room-dr-1'], 't-006': ['room-dr-1'] },
    eligibleTechIds: ['t-001', 't-002', 't-005', 't-006'], maxConsecutiveDays: 2, balanceWeight: 0.7, enabled: true,
    description: '周末值班 (8:00-17:00)',
  },
]

interface Assignment {
  id: string
  planId: string
  ruleId: string
  date: string
  shift: TechShift
  roomId: string | null
  roomName: string | null
  technicianId: string
  technicianName: string
  accumulatedBefore: number
  predictedLoad: number
  reason: string
}

interface GroupBalance {
  groupId: string
  groupName: string
  technicianIds: string[]
  loads: Array<{ technicianId: string; technicianName: string; load: number }>
  maxMinDiff: number
}

interface WorkloadBalance {
  perTechnician: Array<{
    technicianId: string
    technicianName: string
    baseLoad: number
    planLoad: number
    cumulativeLoad: number
    assignmentCount: number
    nights: number
  }>
  groups: GroupBalance[]
  maxMinDiff: number
  threshold: number
  balanced: boolean
  seeded: boolean
}

interface RotationPlan {
  id: string
  generatedAt: string
  startDate: string
  endDate: string
  days: number
  balanceWeight: number
  assignments: Assignment[]
  skipped: Array<{ date: string; shift: TechShift; roomId: string | null; reason: string }>
  balance: WorkloadBalance
  seeded: boolean
}

interface HistoryPlan {
  id: string
  generatedAt: string
  startDate: string
  endDate: string
  days: number
  assignmentsCount: number
  executedCount: number
  balance: WorkloadBalance
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function technicianOf(id: string): Technician {
  return TECHNICIANS.find((t) => t.id === id) ?? { id, name: id, group: '未知组' }
}

function roomOf(id: string): Room {
  return ROOMS.find((r) => r.id === id) ?? { id, name: id }
}

function buildBalance(assignments: Assignment[]): WorkloadBalance {
  const loads = new Map<string, number>()
  const counts = new Map<string, number>()
  const nights = new Map<string, number>()
  for (const a of assignments) {
    loads.set(a.technicianId, (loads.get(a.technicianId) ?? 0) + a.predictedLoad)
    counts.set(a.technicianId, (counts.get(a.technicianId) ?? 0) + 1)
    if (a.shift === 'NIGHT') nights.set(a.technicianId, (nights.get(a.technicianId) ?? 0) + 1)
  }
  const perTechnician = TECHNICIANS.map((t) => {
    const planLoad = Math.round((loads.get(t.id) ?? 0) * 10) / 10
    return {
      technicianId: t.id,
      technicianName: t.name,
      baseLoad: 6,
      planLoad,
      cumulativeLoad: Math.round((6 + planLoad) * 10) / 10,
      assignmentCount: counts.get(t.id) ?? 0,
      nights: nights.get(t.id) ?? 0,
    }
  })
  const byGroup = new Map<string, { name: string; ids: string[]; loads: Array<{ technicianId: string; technicianName: string; load: number }> }>()
  for (const item of perTechnician) {
    const t = technicianOf(item.technicianId)
    const g = byGroup.get(t.group) ?? { name: t.group, ids: [], loads: [] }
    if (!g.ids.includes(item.technicianId)) g.ids.push(item.technicianId)
    g.loads.push({ technicianId: item.technicianId, technicianName: item.technicianName, load: item.cumulativeLoad })
    byGroup.set(t.group, g)
  }
  const groups: GroupBalance[] = [...byGroup.values()].map((g, i) => ({
    groupId: `grp-${i + 1}`,
    groupName: g.name,
    technicianIds: g.ids,
    loads: g.loads,
    maxMinDiff: Math.round((Math.max(...g.loads.map((l) => l.load), 0) - Math.min(...g.loads.map((l) => l.load), 0)) * 10) / 10,
  }))
  const maxMinDiff = Math.round((Math.max(...perTechnician.map((p) => p.cumulativeLoad)) - Math.min(...perTechnician.map((p) => p.cumulativeLoad))) * 10) / 10
  return {
    perTechnician,
    groups,
    maxMinDiff,
    threshold: 8,
    balanced: maxMinDiff <= 8,
    seeded: true,
  }
}

function generatePlan(startDate: string, days: number, balanceWeight: number): RotationPlan {
  const start = new Date(`${startDate}T00:00:00Z`)
  const assignments: Assignment[] = []
  const skipped: RotationPlan['skipped'] = []
  const perTechDate = new Map<string, Set<string>>()
  let idx = 0
  for (let d = 0; d < days; d++) {
    const date = addDays(start, d)
    const weekday = date.getUTCDay()
    const isWeekend = weekday === 0 || weekday === 6
    const rules: RotationRule[] = []
    for (const rule of ROTATION_RULES) {
      if (isWeekend ? rule.shift === 'WEEKEND' : rule.shift === 'DAY') rules.push(rule)
    }
    if (d % 2 === 1) rules.push(ROTATION_RULES[3]!) // 隔天夜班
    for (const rule of rules) {
      const eligible = rule.eligibleTechIds.filter((tid) => !(perTechDate.get(tid)?.has(fmtDate(date)) ?? false))
      const techId = eligible.length > 0
        ? eligible[Math.floor(((d * 7 + rule.eligibleTechIds.length * 3 + idx) % 1000) / 1000 * eligible.length)]!
        : rule.eligibleTechIds[0]!
      const roomId = rule.roomIds[Math.floor(((d + idx) % 100) / 100 * rule.roomIds.length)] ?? rule.roomIds[0]!
      const tech = technicianOf(techId)
      const room = roomOf(roomId)
      const dateSet = perTechDate.get(techId) ?? new Set<string>()
      dateSet.add(fmtDate(date))
      perTechDate.set(techId, dateSet)
      assignments.push({
        id: `as-${idx + 1}`,
        planId: `plan-${idx + 1}`,
        ruleId: rule.id,
        date: fmtDate(date),
        shift: rule.shift,
        roomId,
        roomName: room.name,
        technicianId: techId,
        technicianName: tech.name,
        accumulatedBefore: Math.max(0, 3 - Math.floor(d / 2)),
        predictedLoad: Math.round((6 + ((d * 7 + idx * 5) % 5) + (rule.shift === 'NIGHT' ? 2 : 0)) * 10) / 10,
        reason: `规则「${rule.name}」轮转 (${WEEKDAYS[weekday]})`,
      })
      idx += 1
    }
  }
  const balance = buildBalance(assignments)
  return {
    id: `plan-${startDate.replace(/-/g, '')}-${days}`,
    generatedAt: '2026-08-16T08:00:00.000Z',
    startDate,
    endDate: fmtDate(addDays(start, days - 1)),
    days,
    balanceWeight,
    assignments,
    skipped,
    balance,
    seeded: true,
  }
}

const EXECUTED = new Set<string>()
const HISTORY_PLANS: HistoryPlan[] = [
  {
    id: 'plan-20260801-14', generatedAt: '2026-07-31T08:00:00.000Z',
    startDate: '2026-08-01', endDate: '2026-08-14', days: 14,
    assignmentsCount: 42, executedCount: 38,
    balance: {
      perTechnician: TECHNICIANS.map((t) => ({ technicianId: t.id, technicianName: t.name, baseLoad: 6, planLoad: 4.2, cumulativeLoad: 10.2, assignmentCount: 7, nights: 2 })),
      groups: [], maxMinDiff: 1.2, threshold: 8, balanced: true, seeded: true,
    },
  },
]

function buildForecast(startDate: string, days: number, technicianId?: string) {
  const start = new Date(`${startDate}T00:00:00Z`)
  const daily = []
  for (let d = 0; d < days; d++) {
    const date = addDays(start, d)
    const weekday = date.getUTCDay()
    const base = weekday === 0 ? 22 : weekday === 6 ? 34 : 42 + ((d * 5 + weekday * 3) % 9)
    const trendFactor = Math.round((1 + (d % 5) * 0.02) * 100) / 100
    const appointments = Math.round(base * trendFactor)
    const periods = [
      { period: '08:00-10:00', hourRange: '08-10', value: Math.round(appointments * 0.22) },
      { period: '10:00-12:00', hourRange: '10-12', value: Math.round(appointments * 0.28) },
      { period: '13:00-15:00', hourRange: '13-15', value: Math.round(appointments * 0.24) },
      { period: '15:00-17:00', hourRange: '15-17', value: Math.round(appointments * 0.18) },
      { period: '17:00-20:00', hourRange: '17-20', value: Math.round(appointments * 0.08) },
    ]
    daily.push({
      date: fmtDate(date),
      weekday: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][weekday]!,
      label: `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      value: appointments,
      lower: Math.round(appointments * 0.85),
      upper: Math.round(appointments * 1.15),
      appointments,
      trendFactor,
      periods,
    })
  }
  const totals = daily.reduce((s, d) => ({ value: s.value + d.value, lower: s.lower + d.lower, upper: s.upper + d.upper }), { value: 0, lower: 0, upper: 0 })
  const perTechnician: Array<{ technicianId: string; technicianName: string; date: string; share: number; value: number }> = []
  const byRoom: Array<{ roomId: string; roomName: string; date: string; value: number }> = []
  for (let d = 0; d < days; d++) {
    const date = fmtDate(addDays(start, d))
    const day = daily[d]!
    for (const t of TECHNICIANS.slice(0, technicianId ? 1 : 3)) {
      perTechnician.push({
        technicianId: t.id,
        technicianName: t.name,
        date,
        share: Math.round(100 / 3 * 10) / 10,
        value: Math.round(day.appointments / 3),
      })
    }
    for (const r of ROOMS.slice(0, 3)) {
      byRoom.push({ roomId: r.id, roomName: r.name, date, value: Math.round(day.appointments / 3) })
    }
  }
  const history = daily.slice(0, 7).map((d, i) => ({
    date: fmtDate(addDays(start, i - 7)),
    weekday: d.weekday,
    value: Math.round(d.value * (0.88 + (i % 3) * 0.05)),
  }))
  return {
    startDate,
    days,
    model: 'deterministic-forecast-v1',
    seeded: true,
    daily,
    totals,
    perTechnician,
    byRoom,
    history,
  }
}

export const techV2Handlers = [
  http.get(`${API}/meta`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: { technicians: TECHNICIANS, rooms: ROOMS } })
  }),

  http.get(`${API}/rotation/rules`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: ROTATION_RULES })
  }),

  http.post(`${API}/rotation/generate`, async ({ request }) => {
    await delay(80)
    const body = (await request.json()) as { startDate?: string; days?: number; balanceWeight?: number }
    const days = Math.max(1, Math.min(31, body?.days ?? 14))
    const plan = generatePlan(body?.startDate ?? '2026-08-17', days, body?.balanceWeight ?? 0.6)
    HISTORY_PLANS.unshift({
      id: plan.id, generatedAt: plan.generatedAt, startDate: plan.startDate, endDate: plan.endDate,
      days: plan.days, assignmentsCount: plan.assignments.length, executedCount: [...EXECUTED].filter((e) => e.startsWith(plan.id)).length,
      balance: plan.balance,
    })
    return HttpResponse.json({ success: true, data: plan })
  }),

  http.get(`${API}/rotation/plan`, async ({ request }) => {
    await delay(40)
    const url = new URL(request.url)
    const startDate = url.searchParams.get('startDate') ?? '2026-08-17'
    const days = Number(url.searchParams.get('days') ?? 14) || 14
    const plan = generatePlan(startDate, Math.max(1, Math.min(31, days)), 0.6)
    return HttpResponse.json({ success: true, data: plan })
  }),

  http.get(`${API}/rotation/history`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: { plans: HISTORY_PLANS, executions: [] } })
  }),

  http.post(`${API}/rotation/assignments/:id/execute`, async ({ params, request }) => {
    await delay(40)
    const body = (await request.json()) as { note?: string } | undefined
    const assignmentId = String(params.id)
    EXECUTED.add(assignmentId)
    return HttpResponse.json({
      success: true,
      data: {
        id: `ex-${assignmentId}`,
        planId: 'plan-demo',
        assignmentId,
        date: '2026-08-17',
        shift: 'DAY' as TechShift,
        technicianId: 't-001',
        technicianName: '刘技师',
        roomId: 'room-ct-1',
        status: 'EXECUTED' as const,
        executedAt: '2026-08-16T08:30:00.000Z',
        note: body?.note ?? null,
      },
    })
  }),

  http.get(`${API}/forecast/technician/:technicianId`, async ({ params, request }) => {
    await delay(40)
    const url = new URL(request.url)
    const technicianId = String(params.technicianId)
    const startDate = url.searchParams.get('startDate') ?? '2026-08-17'
    const days = Math.max(1, Math.min(31, Number(url.searchParams.get('days') ?? 7) || 7))
    const tech = technicianOf(technicianId)
    const base = buildForecast(startDate, days)
    const daily = base.daily.map((d) => ({
      date: d.date,
      weekday: d.weekday,
      label: d.label,
      technicianValue: Math.round(d.appointments / 3),
    }))
    return HttpResponse.json({
      success: true,
      data: {
        technicianId,
        startDate,
        days,
        daily,
        byDate: daily.map((d) => ({
          technicianId,
          technicianName: tech.name,
          date: d.date,
          share: Math.round(100 / 3 * 10) / 10,
          value: d.technicianValue,
        })),
      },
    })
  }),

  http.get(`${API}/forecast`, async ({ request }) => {
    await delay(40)
    const url = new URL(request.url)
    const startDate = url.searchParams.get('startDate') ?? '2026-08-17'
    const days = Math.max(1, Math.min(31, Number(url.searchParams.get('days') ?? 7) || 7))
    return HttpResponse.json({ success: true, data: buildForecast(startDate, days) })
  }),

  http.get(`${API}/workload/balance`, async () => {
    await delay(40)
    const plan = generatePlan('2026-08-17', 7, 0.6)
    return HttpResponse.json({ success: true, data: plan.balance })
  }),
]
