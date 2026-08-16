// [G005 Wave 6C v3.0.6.11-101] /api/v1/tech-overview MSW handlers
// 对齐后端 tech-overview.module + techOverviewApi (预约分布/高峰/履约 + 技师值班大屏, 孤儿模块 → seeded=true)
// 响应形状: { success: true, data: <T> }
import { http, HttpResponse, delay } from 'msw'
// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1')


const API = `${API_BASE}/tech-overview`

const ROOMS = [
  { id: 'room-ct-1', name: 'CT 一室', modality: 'CT', technician: '刘技师' },
  { id: 'room-ct-2', name: 'CT 二室', modality: 'CT', technician: '陈技师' },
  { id: 'room-mr-1', name: 'MR 一室', modality: 'MR', technician: '杨技师' },
  { id: 'room-dr-1', name: 'DR 一室', modality: 'DR', technician: '吴技师' },
  { id: 'room-dr-2', name: 'DR 二室', modality: 'DR', technician: '郑技师' },
]

const TECHNICIANS = [
  { id: 't-001', name: '刘技师', group: 'CT 组' },
  { id: 't-002', name: '陈技师', group: 'CT 组' },
  { id: 't-003', name: '杨技师', group: 'MR 组' },
  { id: 't-004', name: '周技师', group: 'MR 组' },
  { id: 't-005', name: '吴技师', group: 'DR 组' },
  { id: 't-006', name: '郑技师', group: 'DR 组' },
]

const MODALITIES = ['CT', 'MR', 'DR', 'US', 'MG']
const PERIODS = [
  { period: '08:00-10:00', hourRange: '08-10' },
  { period: '10:00-12:00', hourRange: '10-12' },
  { period: '13:00-15:00', hourRange: '13-15' },
  { period: '15:00-17:00', hourRange: '15-17' },
  { period: '17:00-20:00', hourRange: '17-20' },
]

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function hash01(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}

/** 确定性每日预约计数: 2026-08-10 (周一) 起 14 天 */
function dailyCounts(days: number, startDate?: string): Array<{ date: string; weekday: number; count: number; modality: string; period: number }> {
  const start = new Date(`${startDate ?? '2026-08-10'}T00:00:00Z`)
  const out = []
  for (let d = 0; d < days; d++) {
    const date = addDays(start, d)
    const weekday = date.getUTCDay()
    const base = weekday === 0 ? 30 : weekday === 6 ? 42 : 56 + ((d * 5 + weekday * 3) % 12)
    for (let m = 0; m < MODALITIES.length; m++) {
      const perMod = Math.round(base / 5 * (1 + hash01(`${fmtDate(date)}|${MODALITIES[m]}`) * 0.3))
      for (let p = 0; p < PERIODS.length; p++) {
        const perPeriod = Math.round(perMod * (p === 1 ? 0.26 : p === 3 ? 0.2 : p === 4 ? 0.1 : 0.22))
        if (perPeriod > 0) out.push({ date: fmtDate(date), weekday, count: perPeriod, modality: MODALITIES[m]!, period: p })
      }
    }
  }
  return out
}

function distribution(days: number, startDate?: string) {
  const counts = dailyCounts(days, startDate)
  const total = counts.reduce((s, c) => s + c.count, 0)
  const byModalityMap = new Map<string, number>()
  const byPeriodMap = new Map<number, number>()
  const byWeekdayMap = new Map<number, number>()
  const byDeviceMap = new Map<string, number>()
  for (const c of counts) {
    byModalityMap.set(c.modality, (byModalityMap.get(c.modality) ?? 0) + c.count)
    byPeriodMap.set(c.period, (byPeriodMap.get(c.period) ?? 0) + c.count)
    byWeekdayMap.set(c.weekday, (byWeekdayMap.get(c.weekday) ?? 0) + c.count)
    byDeviceMap.set(c.modality, (byDeviceMap.get(c.modality) ?? 0) + c.count)
  }
  const pct = (v: number) => Math.round(v / Math.max(1, total) * 1000) / 10
  return {
    startDate: startDate ?? '2026-08-10',
    days,
    total,
    seeded: true,
    byModality: [...byModalityMap.entries()].sort().map(([key, count]) => ({ key, label: key, count, pct: pct(count) })),
    byPeriod: [...byPeriodMap.entries()].sort((a, b) => a[0] - b[0]).map(([key, count]) => ({ key: PERIODS[key]!.period, label: PERIODS[key]!.hourRange, count, pct: pct(count) })),
    byWeekday: [...byWeekdayMap.entries()].sort((a, b) => a[0] - b[0]).map(([key, count]) => ({ key: String(key), label: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][key]!, count, pct: pct(count) })),
    byDevice: [...byDeviceMap.entries()].sort().map(([key, count]) => ({ key, label: key === 'CT' ? 'CT 设备' : key === 'MR' ? 'MR 设备' : key === 'DR' ? 'DR 设备' : `${key} 设备`, modality: key, count, pct: pct(count) })),
    heatmap: counts.slice(0, 35).map((c) => ({ period: PERIODS[c.period]!.hourRange, weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][c.weekday]!, count: c.count })),
  }
}

function peaks(days: number, startDate?: string) {
  const counts = dailyCounts(days, startDate)
  const overallAverage = Math.round(counts.reduce((s, c) => s + c.count, 0) / Math.max(1, days))
  const perPeriod = new Map<number, Array<{ date: string; weekday: number; count: number }>>()
  for (const c of counts) {
    const arr = perPeriod.get(c.period) ?? []
    arr.push(c)
    perPeriod.set(c.period, arr)
  }
  const peaksOut = [...perPeriod.entries()].sort((a, b) => a[0] - b[0]).map(([p, list]) => {
    const avgCount = Math.round(list.reduce((s, c) => s + c.count, 0) / list.length)
    const maxItem = list.reduce((a, b) => (b.count > a.count ? b : a), list[0]!)
    const level = avgCount >= overallAverage * 1.15 ? 'HIGH' : avgCount >= overallAverage * 0.9 ? 'MEDIUM' : 'LOW'
    const peakDays = list.filter((c) => c.count >= maxItem.count * 0.8).slice(0, 5).map((c) => ({
      date: c.date,
      weekday: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][c.weekday]!,
      count: c.count,
    }))
    return {
      period: PERIODS[p]!.period,
      hourRange: PERIODS[p]!.hourRange,
      avgCount,
      maxCount: maxItem.count,
      maxDay: maxItem.date,
      level: level as 'HIGH' | 'MEDIUM' | 'LOW',
      peakDays,
    }
  })
  const busiest = peaksOut.reduce((a, b) => (b.avgCount > a.avgCount ? b : a), peaksOut[0]!)
  return {
    startDate: startDate ?? '2026-08-10',
    days,
    seeded: true,
    overallAverage,
    peaks: peaksOut,
    busiestPeriod: busiest.period,
    busiestWeekday: '周一',
    recommendation: `建议将高峰时段 ${busiest.hourRange} 的预约分散至上午/下午低峰, 可提升设备利用率约 8%`,
  }
}

function attendance(days: number, startDate?: string) {
  const counts = dailyCounts(days, startDate)
  const byModalityMap = new Map<string, { total: number; attended: number; noShow: number; cancelled: number; upcoming: number }>()
  const byWeekdayMap = new Map<number, { total: number; attended: number; noShow: number; cancelled: number; upcoming: number }>()
  for (const c of counts) {
    const m = byModalityMap.get(c.modality) ?? { total: 0, attended: 0, noShow: 0, cancelled: 0, upcoming: 0 }
    const w = byWeekdayMap.get(c.weekday) ?? { total: 0, attended: 0, noShow: 0, cancelled: 0, upcoming: 0 }
    const attended = Math.round(c.count * (0.82 + hash01(`${c.date}|${c.modality}|a`) * 0.12))
    const noShow = Math.round(c.count * 0.06)
    const cancelled = Math.round(c.count * 0.05)
    m.total += c.count; m.attended += attended; m.noShow += noShow; m.cancelled += cancelled; m.upcoming += Math.max(0, c.count - attended - noShow - cancelled)
    w.total += c.count; w.attended += attended; w.noShow += noShow; w.cancelled += cancelled; w.upcoming += Math.max(0, c.count - attended - noShow - cancelled)
    byModalityMap.set(c.modality, m)
    byWeekdayMap.set(c.weekday, w)
  }
  const mkItem = (key: string, label: string, agg: { total: number; attended: number; noShow: number; cancelled: number; upcoming: number }) => ({
    key, label, total: agg.total, attended: agg.attended, noShow: agg.noShow, cancelled: agg.cancelled, upcoming: agg.upcoming,
    noShowRate: Math.round(agg.noShow / Math.max(1, agg.total) * 1000) / 10,
  })
  const totalAgg = { total: 0, attended: 0, noShow: 0, cancelled: 0, upcoming: 0 }
  for (const v of byModalityMap.values()) { totalAgg.total += v.total; totalAgg.attended += v.attended; totalAgg.noShow += v.noShow; totalAgg.cancelled += v.cancelled; totalAgg.upcoming += v.upcoming }
  return {
    startDate: startDate ?? '2026-08-10',
    days,
    seeded: true,
    ...totalAgg,
    noShowRate: Math.round(totalAgg.noShow / Math.max(1, totalAgg.total) * 1000) / 10,
    attendanceRate: Math.round(totalAgg.attended / Math.max(1, totalAgg.total) * 1000) / 10,
    byModality: [...byModalityMap.entries()].sort().map(([key, v]) => mkItem(key, key, v)),
    byWeekday: [...byWeekdayMap.entries()].sort((a, b) => a[0] - b[0]).map(([key, v]) => mkItem(String(key), ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][key]!, v)),
  }
}

function dashboardOverview() {
  const onDuty = TECHNICIANS.slice(0, 5)
  const rooms = ROOMS.map((r, i) => {
    const state = (['IN_USE', 'IDLE', 'IN_USE', 'MAINTENANCE', 'IDLE'] as const)[i % 5]
    const inUse = state === 'IN_USE'
    return {
      roomId: r.id,
      roomName: r.name,
      modality: r.modality,
      technician: r.technician,
      state,
      currentExam: inUse ? { patientName: ['张建国', '李秀英', '王德发'][i % 3]!, examItem: `${r.modality} 检查`, startedAt: '2026-08-16T08:20:00.000Z', progressPct: 35 + i * 15 } : null,
      queueCount: i % 2,
      todayExams: 14 + i * 6,
    }
  })
  return {
    date: '2026-08-16',
    generatedAt: '2026-08-16T08:35:00.000Z',
    seeded: true,
    onDutyCount: onDuty.length,
    offDutyCount: TECHNICIANS.length - onDuty.length,
    technicianTotal: TECHNICIANS.length,
    roomCount: ROOMS.length,
    inUseRooms: rooms.filter((r) => r.state === 'IN_USE').length,
    idleRooms: rooms.filter((r) => r.state === 'IDLE').length,
    inProgressCount: 4,
    waitingCount: 6,
    pendingEmergencyCount: 1,
    duty: onDuty.map((t, i) => ({ technicianId: t.id, name: t.name, group: t.group, shift: i % 3 === 0 ? 'NIGHT' : 'DAY', shiftLabel: i % 3 === 0 ? '夜班' : '白班' })),
    rooms,
  }
}

function roomStream() {
  const rooms = dashboardOverview().rooms
  const events = ROOMS.map((r, i) => ({
    id: `ev-${i + 1}`,
    roomId: r.id,
    roomName: r.name,
    modality: r.modality,
    type: (['EXAM_START', 'EXAM_END', 'PATIENT_IN', 'STATE_CHANGE', 'MAINTENANCE', 'EMERGENCY', 'PATIENT_OUT'] as const)[i % 7],
    patientName: ['张建国', '李秀英', null, '王德发', null, '急诊患者', '赵丽华'][i] as string | null,
    examItem: [r.modality + ' 检查', null, null, r.modality + ' 检查', null, '急诊 CT', null][i] as string | null,
    technician: r.technician,
    timestamp: '2026-08-16T08:' + String(20 + i * 3).padStart(2, '0') + ':00.000Z',
    note: '',
  }))
  return { generatedAt: '2026-08-16T08:35:00.000Z', seeded: true, rooms, events }
}

export const techOverviewHandlers = [
  http.get(`${API}/meta`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: { rooms: ROOMS, technicians: TECHNICIANS, modalities: MODALITIES, date: '2026-08-16', periods: PERIODS } })
  }),

  http.get(`${API}/appointments/distribution`, async ({ request }) => {
    await delay(50)
    const url = new URL(request.url)
    const days = Math.max(1, Math.min(31, Number(url.searchParams.get('days') ?? 7) || 7))
    const startDate = url.searchParams.get('startDate') ?? undefined
    return HttpResponse.json({ success: true, data: distribution(days, startDate) })
  }),

  http.get(`${API}/appointments/peaks`, async ({ request }) => {
    await delay(50)
    const url = new URL(request.url)
    const days = Math.max(1, Math.min(31, Number(url.searchParams.get('days') ?? 7) || 7))
    const startDate = url.searchParams.get('startDate') ?? undefined
    return HttpResponse.json({ success: true, data: peaks(days, startDate) })
  }),

  http.get(`${API}/appointments/attendance`, async ({ request }) => {
    await delay(50)
    const url = new URL(request.url)
    const days = Math.max(1, Math.min(31, Number(url.searchParams.get('days') ?? 7) || 7))
    const startDate = url.searchParams.get('startDate') ?? undefined
    return HttpResponse.json({ success: true, data: attendance(days, startDate) })
  }),

  http.get(`${API}/dashboard/overview`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: dashboardOverview() })
  }),

  http.get(`${API}/dashboard/rooms`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: roomStream() })
  }),
]
