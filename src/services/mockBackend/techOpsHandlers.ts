// [G005 Wave 6B v3.0.6.11-101] /api/v1/tech-ops MSW handlers
// 对齐后端 tech-ops.module + techOpsApi (设备利用率 / 急诊插队 / 排班优化, 孤儿模块 → seeded=true)
// 响应形状: { success: true, data: <T> }
import { http, HttpResponse, delay } from 'msw'
// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1')


const API = `${API_BASE}/tech-ops`

interface Device { id: string; name: string; modality: string; technician: string; spare: boolean }
interface OptimizeExam { id: string; patientName: string; examItem: string; modality: string; durationMin: number; priority: 'ROUTINE' | 'URGENT' | 'STAT'; arrivalMin: number }
interface OptimizeDevice { id: string; name: string; modality: string; availableFrom: number; technician: string }

const DEVICES: Device[] = [
  { id: 'dev-ct-1', name: 'CT 一室 (16排)', modality: 'CT', technician: '刘技师', spare: false },
  { id: 'dev-ct-2', name: 'CT 二室 (64排)', modality: 'CT', technician: '陈技师', spare: true },
  { id: 'dev-mr-1', name: 'MR 一室 (3T)', modality: 'MR', technician: '杨技师', spare: false },
  { id: 'dev-dr-1', name: 'DR 一室', modality: 'DR', technician: '吴技师', spare: false },
  { id: 'dev-dr-2', name: 'DR 二室', modality: 'DR', technician: '郑技师', spare: true },
]

const MODALITIES = ['CT', 'MR', 'DR', 'US', 'MG']

const PATIENT_POOL = ['张建国', '李秀英', '王德发', '赵丽华', '陈志强', '刘桂芳', '孙立军', '周美玲']

function hash01(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildUtilization(days: number, granularity: 'day' | 'hour') {
  const start = new Date('2026-08-10T00:00:00Z')
  const series: Array<{ date: string; label: string; weekday: string; rate: number; occupiedHours: number; exams: number; points: Array<{ hour: number; hourLabel: string; rate: number }> }> = []
  for (let d = 0; d < days; d++) {
    const date = addDays(start, d)
    const weekday = date.getUTCDay()
    const baseRate = weekday === 0 ? 52 : weekday === 6 ? 61 : 68 + ((d * 7 + weekday * 5) % 14)
    const points: Array<{ hour: number; hourLabel: string; rate: number }> = []
    const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
    for (const h of hours) {
      const hourRate = Math.max(20, Math.min(98, baseRate + ((h % 4 === 0 ? 8 : h % 3 === 0 ? -6 : 2) + (d % 2) * 3)))
      points.push({ hour: h, hourLabel: `${String(h).padStart(2, '0')}:00`, rate: hourRate })
    }
    series.push({
      date: fmtDate(date),
      label: `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      weekday: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][weekday]!,
      rate: baseRate,
      occupiedHours: Math.round(10 * baseRate / 100),
      exams: Math.round(baseRate * 0.62),
      points: granularity === 'hour' ? points : [],
    })
  }
  const rates = series.map((s) => s.rate)
  const meanRate = Math.round(rates.reduce((a, b) => a + b, 0) / Math.max(1, rates.length))
  const peak = Math.max(...rates)
  const trough = Math.min(...rates)
  const peakDate = series.find((s) => s.rate === peak)!
  const troughDate = series.find((s) => s.rate === trough)!
  const devices: Array<{
    deviceId: string; name: string; modality: string; technician: string
    meanRate: number; peakRate: number; troughRate: number; totalExams: number; busyDays: number; avgSessionMin: number
    trend: Array<{ date: string; rate: number }>; hours: Array<{ hour: number; hourLabel: string; rate: number }>
  }> = DEVICES.map((dev, i) => {
    const drift = ((i * 7) % 9) - 4
    const trend = series.map((s) => ({ date: s.date, rate: Math.max(15, Math.min(100, s.rate + drift + (i % 2) * 6)) }))
    const tr = trend.map((t) => t.rate)
    return {
      deviceId: dev.id,
      name: dev.name,
      modality: dev.modality,
      technician: dev.technician,
      meanRate: Math.round(tr.reduce((a, b) => a + b, 0) / tr.length),
      peakRate: Math.max(...tr),
      troughRate: Math.min(...tr),
      totalExams: tr.length * Math.round(6 + hash01(dev.id) * 4),
      busyDays: Math.round(tr.length * 0.7),
      avgSessionMin: dev.modality === 'MR' ? 32 : dev.modality === 'CT' ? 18 : 9,
      trend,
      hours: series[series.length - 1]!.points,
    }
  })
  const stats = {
    meanRate,
    peakRate: peak,
    peakDate: peakDate.date,
    peakHour: 10,
    peakHourLabel: '10:00',
    troughRate: trough,
    troughDate: troughDate.date,
    troughHour: 8,
    troughHourLabel: '08:00',
    totalExams: series.reduce((s, d) => s + d.exams, 0),
    avgDailyExams: Math.round(series.reduce((s, d) => s + d.exams, 0) / Math.max(1, series.length)),
  }
  return { days, granularity, seeded: true, series, stats, devices }
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function buildSuggest(modality?: string, deviceId?: string, durationMin?: number) {
  const targets = DEVICES.filter((d) => (!modality || d.modality === modality) && (!deviceId || d.id === deviceId))
  if (targets.length === 0) return []
  return targets.map((dev, i) => {
    const startMin = 480 + ((hash01(`${dev.id}|start`) > 0.5 ? 1 : 0) * 30 + i * 60)
    const dur = durationMin ?? (dev.modality === 'MR' ? 35 : 20)
    const endMin = startMin + dur
    return {
      id: `em-${i + 1}`,
      strategy: (['INSERT_NOW', 'NEXT_FREE', 'SPARE_DEVICE'] as const)[i % 3],
      strategyLabel: ['立即插入', '下一空闲', '备用设备'][i % 3]!,
      deviceId: dev.id,
      deviceName: dev.name,
      modality: dev.modality,
      technician: dev.technician,
      startMin,
      startAt: '2026-08-16T' + `${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(startMin % 60).padStart(2, '0')}:00.000Z`,
      endMin,
      endAt: '2026-08-16T' + `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}:00.000Z`,
      startInMin: 10 + i * 35,
      waitMin: 0,
      conflictCount: i % 2,
      conflicts: i % 2 === 1
        ? [{ examId: `ex-c-${i}`, patientName: PATIENT_POOL[(i + 2) % PATIENT_POOL.length]!, examItem: '腹部增强 CT', type: 'ONGOING' as const, startMin: startMin - 30, endMin: startMin + 30, overlapMin: 20, action: 'DEFER' as const }]
        : [],
      feasibility: (i % 2 === 1 ? 'CONFLICT' : 'OK') as 'OK' | 'CONFLICT',
      note: dev.spare ? '备用设备可用, 冲突可忽略' : '常规设备, 需协商排队',
    }
  })
}

const EMERGENCY_RECORDS: Array<{
  id: string; patientName: string; examItem: string; modality: string; priority: string
  deviceId: string; deviceName: string; technician: string; startMin: number; startAt: string; endMin: number; endAt: string
  status: 'INSERTED'; conflictCount: number; adjustments: Array<{ examId: string; patientName: string; examItem: string; originalStartMin: number; suggestedStartMin: number; suggestedDeviceId: string; suggestedDeviceName: string; action: string }>
  reason: string | null; createdAt: string
}> = [
  {
    id: 'em-rec-001', patientName: '孙立军', examItem: '头部外伤 CT', modality: 'CT', priority: 'STAT',
    deviceId: 'dev-ct-1', deviceName: 'CT 一室 (16排)', technician: '刘技师',
    startMin: 495, startAt: '2026-08-16T08:15:00.000Z', endMin: 510, endAt: '2026-08-16T08:30:00.000Z',
    status: 'INSERTED', conflictCount: 1,
    adjustments: [{ examId: 'ex-104', patientName: '张建国', examItem: '胸部 CT 平扫', originalStartMin: 495, suggestedStartMin: 525, suggestedDeviceId: 'dev-ct-2', suggestedDeviceName: 'CT 二室 (64排)', action: 'MOVE_DEVICE' }],
    reason: '急诊抢救通道', createdAt: '2026-08-16T08:10:00.000Z',
  },
]

const DEMO_EXAMS: OptimizeExam[] = [
  { id: 'ex-101', patientName: '张建国', examItem: '胸部 CT 平扫', modality: 'CT', durationMin: 15, priority: 'ROUTINE', arrivalMin: 480 },
  { id: 'ex-102', patientName: '李秀英', examItem: '头颅 MRI 平扫', modality: 'MR', durationMin: 35, priority: 'ROUTINE', arrivalMin: 500 },
  { id: 'ex-103', patientName: '王德发', examItem: '腹部增强 CT', modality: 'CT', durationMin: 25, priority: 'URGENT', arrivalMin: 520 },
  { id: 'ex-104', patientName: '赵丽华', examItem: '胸部 DR 正位', modality: 'DR', durationMin: 8, priority: 'ROUTINE', arrivalMin: 535 },
  { id: 'ex-105', patientName: '陈志强', examItem: '膝关节 MRI', modality: 'MR', durationMin: 30, priority: 'ROUTINE', arrivalMin: 545 },
]

const DEMO_DEVICES: OptimizeDevice[] = [
  { id: 'dev-ct-1', name: 'CT 一室 (16排)', modality: 'CT', availableFrom: 480, technician: '刘技师' },
  { id: 'dev-ct-2', name: 'CT 二室 (64排)', modality: 'CT', availableFrom: 600, technician: '陈技师' },
  { id: 'dev-mr-1', name: 'MR 一室 (3T)', modality: 'MR', availableFrom: 480, technician: '杨技师' },
  { id: 'dev-dr-1', name: 'DR 一室', modality: 'DR', availableFrom: 480, technician: '吴技师' },
]

let emergencyRecords = [...EMERGENCY_RECORDS]
let recSeq = 100

function optimize(exams: OptimizeExam[], devices: OptimizeDevice[]) {
  const sorted = [...exams].sort((a, b) => {
    const w = { STAT: 0, URGENT: 1, ROUTINE: 2 } as const
    return (w[a.priority] ?? 3) - (w[b.priority] ?? 3) || a.arrivalMin - b.arrivalMin
  })
  const availability = new Map(devices.map((d) => [d.id, d.availableFrom]))
  const assignments: Array<{
    examId: string; patientName: string; examItem: string; modality: string; priority: string
    durationMin: number; arrivalMin: number; deviceId: string; deviceName: string; technician: string
    startMin: number; startAt: string; endMin: number; endAt: string; waitMin: number
  }> = []
  const unassigned: OptimizeExam[] = []
  for (const exam of sorted) {
    const candidates = devices.filter((d) => d.modality === exam.modality)
    if (candidates.length === 0) { unassigned.push(exam); continue }
    let best: OptimizeDevice | null = null
    let bestStart = Infinity
    for (const d of candidates) {
      const start = Math.max(availability.get(d.id) ?? 0, exam.arrivalMin)
      if (start < bestStart) { bestStart = start; best = d }
    }
    if (!best) { unassigned.push(exam); continue }
    availability.set(best.id, bestStart + exam.durationMin)
    assignments.push({
      examId: exam.id, patientName: exam.patientName, examItem: exam.examItem, modality: exam.modality,
      priority: exam.priority, durationMin: exam.durationMin, arrivalMin: exam.arrivalMin,
      deviceId: best.id, deviceName: best.name, technician: best.technician,
      startMin: bestStart,
      startAt: '2026-08-16T' + `${String(Math.floor(bestStart / 60)).padStart(2, '0')}:${String(bestStart % 60).padStart(2, '0')}:00.000Z`,
      endMin: bestStart + exam.durationMin,
      endAt: '2026-08-16T' + `${String(Math.floor((bestStart + exam.durationMin) / 60)).padStart(2, '0')}:${String((bestStart + exam.durationMin) % 60).padStart(2, '0')}:00.000Z`,
      waitMin: Math.max(0, bestStart - exam.arrivalMin),
    })
  }
  const totalWaitBefore = sorted.reduce((s, e) => s + Math.max(0, 30 - e.arrivalMin % 30), 0)
  const totalWaitAfter = assignments.reduce((s, a) => s + a.waitMin, 0)
  const improvementPct = totalWaitBefore > 0 ? Math.round((1 - totalWaitAfter / totalWaitBefore) * 100) : 0
  return {
    generatedAt: '2026-08-16T08:30:00.000Z',
    seeded: true,
    exams: sorted,
    devices,
    assignments,
    unassigned,
    totalWaitBefore,
    totalWaitAfter,
    improvementPct,
    better: totalWaitAfter < totalWaitBefore,
  }
}

export const techOpsHandlers = [
  http.get(`${API}/utilization`, async ({ request }) => {
    await delay(50)
    const url = new URL(request.url)
    const days = Math.max(1, Math.min(31, Number(url.searchParams.get('days') ?? 7) || 7))
    const granularity = (url.searchParams.get('granularity') === 'hour' ? 'hour' : 'day') as 'day' | 'hour'
    return HttpResponse.json({ success: true, data: buildUtilization(days, granularity) })
  }),

  http.get(`${API}/meta`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: { devices: DEVICES, date: '2026-08-16', nowMin: 510, modalities: MODALITIES } })
  }),

  http.get(`${API}/emergency/suggest`, async ({ request }) => {
    await delay(50)
    const url = new URL(request.url)
    const modality = url.searchParams.get('modality') ?? undefined
    const deviceId = url.searchParams.get('deviceId') ?? undefined
    const durationMin = Number(url.searchParams.get('durationMin') ?? 0) || undefined
    return HttpResponse.json({ success: true, data: buildSuggest(modality, deviceId, durationMin) })
  }),

  http.post(`${API}/emergency/insert`, async ({ request }) => {
    await delay(60)
    const body = (await request.json()) as {
      patientName?: string; examItem?: string; modality?: string; deviceId?: string
      durationMin?: number; startMin?: number; priority?: string; force?: boolean; reason?: string
    }
    const dev = DEVICES.find((d) => d.id === body?.deviceId) ?? DEVICES[0]!
    const startMin = body?.startMin ?? 510
    const endMin = startMin + (body?.durationMin ?? 20)
    const record = {
      id: `em-rec-${recSeq++}`,
      patientName: body?.patientName ?? '急诊患者',
      examItem: body?.examItem ?? '急诊检查',
      modality: body?.modality ?? dev.modality,
      priority: body?.priority ?? 'URGENT',
      deviceId: dev.id,
      deviceName: dev.name,
      technician: dev.technician,
      startMin,
      startAt: '2026-08-16T' + `${String(Math.floor(startMin / 60)).padStart(2, '0')}:${String(startMin % 60).padStart(2, '0')}:00.000Z`,
      endMin,
      endAt: '2026-08-16T' + `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}:00.000Z`,
      status: 'INSERTED' as const,
      conflictCount: 0,
      adjustments: [],
      reason: body?.reason ?? null,
      createdAt: '2026-08-16T08:32:00.000Z',
    }
    emergencyRecords.unshift(record)
    return HttpResponse.json({ success: true, data: { success: true, record, conflicts: [], adjustments: [], message: '急诊检查已插入' } })
  }),

  http.get(`${API}/emergency/records`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: emergencyRecords })
  }),

  http.post(`${API}/optimize`, async ({ request }) => {
    await delay(80)
    const body = (await request.json()) as { exams?: OptimizeExam[]; devices?: OptimizeDevice[] }
    const exams = body?.exams ?? DEMO_EXAMS
    const devices = body?.devices ?? DEMO_DEVICES
    return HttpResponse.json({ success: true, data: optimize(exams, devices) })
  }),

  http.get(`${API}/optimize/demo`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: { exams: DEMO_EXAMS, devices: DEMO_DEVICES } })
  }),
]
