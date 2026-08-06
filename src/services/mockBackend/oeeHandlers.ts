// [G005 W1-1] OEE 看板 MSW handlers: /api/v1/oee/*
// 与后端 backend/src/modules/oee 返回结构一致 (确定性伪随机, 可复现)
import { http, HttpResponse, delay } from 'msw'

const API_BASE =
  typeof process !== 'undefined' && process.env.VITEST
    ? 'http://localhost:5173/api/v1'
    : typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin + '/api/v1'
      : 'http://localhost:5173/api/v1'

const DEVICES = [
  { id: 'CT-01', name: 'GE Revolution CT', model: 'Revolution CT', modality: 'CT' },
  { id: 'MR-01', name: 'Siemens Skyra', model: 'Skyra 3T', modality: 'MR' },
  { id: 'DR-01', name: 'Philips DigitalDiagnost', model: 'DigitalDiagnost 4', modality: 'DR' },
  { id: 'DR-02', name: 'Siemens Ysio', model: 'Ysio Max', modality: 'DR' },
  { id: 'CT-02', name: 'Canon Aquilion', model: 'Aquilion ONE', modality: 'CT' },
  { id: 'MG-01', name: 'Hologic Selenia', model: 'Selenia Dimensions', modality: 'MG' },
  { id: 'DSA-01', name: 'GE Innova', model: 'Innova IGS 5', modality: 'DSA' },
]

function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function seededRand(min: number, max: number, seedInput: string): number {
  const rand = mulberry32(hashString(seedInput))
  return Math.round((rand() * (max - min) + min) * 10) / 10
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function formatDate(offsetDays: number): string {
  return new Date(Date.now() - offsetDays * 86400000).toISOString().slice(0, 10)
}

function derivedPoint(deviceId: string, date: string): { oee: number; availability: number; performance: number; quality: number } {
  const seed = `oee:${deviceId}:${date}`
  const availability = seededRand(70, 99, `${seed}:availability`)
  const performance = seededRand(75, 98, `${seed}:performance`)
  const quality = seededRand(85, 100, `${seed}:quality`)
  const oee = round1((availability * performance * quality) / 10000)
  return { oee, availability, performance, quality }
}

function trendBetween(prev: number, curr: number): 'up' | 'down' | 'stable' {
  if (curr - prev > 0.5) return 'up'
  if (prev - curr > 0.5) return 'down'
  return 'stable'
}

function buildList() {
  const today = formatDate(0)
  return DEVICES.map((d) => {
    const point = derivedPoint(d.id, today)
    const prev = derivedPoint(d.id, formatDate(1)).oee
    return {
      ...d,
      ...point,
      trend: trendBetween(prev, point.oee),
      source: 'derived' as const,
    }
  })
}

function buildTrend(deviceId: string) {
  const rand = mulberry32(hashString(`oee-trend:${deviceId}`))
  return Array.from({ length: 12 }, (_, i) => {
    const date = formatDate(11 - i)
    const availability = round1(rand() * (99 - 75) + 75)
    const performance = round1(rand() * (98 - 70) + 70)
    const quality = round1(rand() * (100 - 85) + 85)
    return {
      date,
      oee: round1((availability * performance * quality) / 10000),
      availability,
      performance,
      quality,
      source: 'derived' as const,
    }
  })
}

export const oeeHandlers = [
  http.get(`${API_BASE}/oee/list`, async () => {
    await delay(80)
    return HttpResponse.json(buildList())
  }),

  http.get(`${API_BASE}/oee/detail/:deviceId`, async ({ params }) => {
    await delay(60)
    const deviceId = params.deviceId as string
    const device = buildList().find((d) => d.id === deviceId)
    if (!device) return HttpResponse.json(null)
    const seed = `oee-detail:${deviceId}:${formatDate(0)}`
    return HttpResponse.json({
      ...device,
      breakdownLoss: seededRand(1, 8, `${seed}:breakdown`),
      setupLoss: seededRand(1, 5, `${seed}:setup`),
      speedLoss: seededRand(1, 6, `${seed}:speed`),
      defectLoss: seededRand(0.5, 3, `${seed}:defect`),
    })
  }),

  http.get(`${API_BASE}/oee/trend/:deviceId`, async ({ params }) => {
    await delay(80)
    const deviceId = params.deviceId as string
    return HttpResponse.json(buildTrend(deviceId))
  }),

  http.get(`${API_BASE}/oee/stats`, async () => {
    await delay(60)
    const list = buildList()
    const oees = list.map((d) => d.oee)
    return HttpResponse.json({
      highest: Math.max(...oees),
      lowest: Math.min(...oees),
      average: round1(oees.reduce((a, b) => a + b, 0) / oees.length),
      totalDevices: list.length,
    })
  }),
]
