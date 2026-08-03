// [v3.0.6.11-60] BI 仪表板 MSW handlers: /api/v1/bi/*
// 与后端 backend/src/modules/bi 返回结构保持一致 (source: 'demo')
import { http, HttpResponse, delay } from 'msw'

const API_BASE =
  typeof process !== 'undefined' && process.env.VITEST
    ? 'http://localhost:5173/api/v1'
    : typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin + '/api/v1'
      : 'http://localhost:5173/api/v1'

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

function seedFor(): number {
  const now = new Date()
  return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate()
}

function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

function envelope(data: unknown) {
  return { source: 'demo' as const, generatedAt: new Date().toISOString(), data }
}

const DEMO_DOCTORS = ['张明远', '李慧敏', '王建国', '赵雪琴', '陈晓燕', '刘德伟']

function buildKpi() {
  const rand = mulberry32(seedFor())
  const examCount = 280 + Math.floor(rand() * 90)
  const reportCount = Math.floor(examCount * (0.86 + rand() * 0.1))
  const pendingReports = Math.floor(examCount * (0.05 + rand() * 0.05))
  return {
    examCount,
    reportCount,
    completionRate: round1((reportCount / examCount) * 100),
    avgReportMinutes: round1(32 + rand() * 22),
    overtimeRate: round1(2.5 + rand() * 6),
    pendingReports,
    criticalSlaRate: round1(90 + rand() * 9),
  }
}

function buildTimeliness() {
  const rand = mulberry32(seedFor() ^ 0x1a2b)
  const buckets = [
    { bucket: '<30min', count: Math.floor(rand() * 120) + 60 },
    { bucket: '30min-1h', count: Math.floor(rand() * 90) + 40 },
    { bucket: '1h-2h', count: Math.floor(rand() * 60) + 25 },
    { bucket: '2h-4h', count: Math.floor(rand() * 30) + 10 },
    { bucket: '>4h', count: Math.floor(rand() * 15) + 3 },
  ]
  const total = buckets.reduce((s, b) => s + b.count, 0)
  return {
    total,
    buckets: buckets.map((b) => ({ ...b, percent: round1((b.count / total) * 100) })),
    medianMinutes: round1(28 + rand() * 25),
    p90Minutes: round1(85 + rand() * 60),
  }
}

function buildRvu() {
  const rand = mulberry32(seedFor() ^ 0x2c3d)
  const physicians = DEMO_DOCTORS.map((name) => {
    const reportCount = Math.floor(rand() * 35) + 15
    return {
      doctorName: name,
      reportCount,
      rvu: round1(reportCount * (2 + rand() * 3)),
      avgMinutes: round1(25 + rand() * 30),
    }
  }).sort((a, b) => b.rvu - a.rvu)
  return { totalRvu: round1(physicians.reduce((s, p) => s + p.rvu, 0)), physicians }
}

function buildOee(days: number) {
  const rand = mulberry32(seedFor() ^ 0x3e4f)
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

function buildSla() {
  const rand = mulberry32(seedFor() ^ 0x50a1)
  const distribution = [
    { bucket: '<5min', count: Math.floor(rand() * 8) + 3 },
    { bucket: '5-15min', count: Math.floor(rand() * 8) + 5 },
    { bucket: '15-30min', count: Math.floor(rand() * 6) + 2 },
    { bucket: '30-60min', count: Math.floor(rand() * 4) + 1 },
    { bucket: '>60min', count: Math.floor(rand() * 3) },
  ]
  const total = distribution.reduce((s, b) => s + b.count, 0)
  const within = distribution[0]!.count + distribution[1]!.count + distribution[2]!.count
  const overdue = Array.from({ length: distribution[3]!.count + distribution[4]!.count }, (_, i) => ({
    id: `CV-2026-${String(1000 + i)}`,
    severity: (['HIGH', 'URGENT', 'CRITICAL'] as const)[i % 3] ?? 'HIGH',
    state: 'NOTIFIED',
    createdAt: isoDaysAgo(i),
    ackedAt: null,
    responseMinutes: 35 + Math.floor(rand() * 120),
  }))
  return {
    total,
    slaMinutes: 30,
    complianceRate: round1((within / total) * 100),
    avgResponseMinutes: round1(9 + rand() * 18),
    distribution,
    overdue,
  }
}

function buildTrend(days: number) {
  const rand = mulberry32(seedFor() ^ 0x61b2)
  return Array.from({ length: days }, (_, i) => {
    const date = isoDaysAgo(days - 1 - i)
    const examCount = 260 + Math.floor(rand() * 100)
    const reportCount = Math.floor(examCount * (0.85 + rand() * 0.12))
    const signed = Math.floor(reportCount * (0.9 + rand() * 0.09))
    return {
      date,
      examCount,
      reportCount,
      completionRate: round1((signed / reportCount) * 100),
      avgReportMinutes: round1(30 + rand() * 25),
      overtimeCount: Math.floor(reportCount * (0.03 + rand() * 0.05)),
      criticalCount: Math.floor(rand() * 5),
    }
  })
}

export const biHandlers = [
  http.get(`${API_BASE}/bi/kpi`, async () => {
    await delay(60)
    return HttpResponse.json(envelope(buildKpi()))
  }),

  http.get(`${API_BASE}/bi/report-timeliness`, async () => {
    await delay(60)
    return HttpResponse.json(envelope(buildTimeliness()))
  }),

  http.get(`${API_BASE}/bi/physician-rvu`, async () => {
    await delay(80)
    return HttpResponse.json(envelope(buildRvu()))
  }),

  http.get(`${API_BASE}/bi/device-oee`, async ({ request }) => {
    await delay(80)
    const url = new URL(request.url)
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '14', 10), 7), 90)
    return HttpResponse.json(envelope(buildOee(days)))
  }),

  http.get(`${API_BASE}/bi/critical-sla`, async () => {
    await delay(80)
    return HttpResponse.json(envelope(buildSla()))
  }),

  http.get(`${API_BASE}/bi/trend`, async ({ request }) => {
    await delay(100)
    const url = new URL(request.url)
    const days = Math.min(Math.max(parseInt(url.searchParams.get('days') || '30', 10), 7), 90)
    return HttpResponse.json(envelope(buildTrend(days)))
  }),
]
