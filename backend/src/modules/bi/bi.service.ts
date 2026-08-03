import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CacheService } from '../../cache/cache.service'

export type BiSource = 'database' | 'demo'

export interface TimelinessBucket {
  bucket: string
  count: number
  percent: number
}

export interface KpiPayload {
  examCount: number
  reportCount: number
  completionRate: number
  avgReportMinutes: number
  overtimeRate: number
  pendingReports: number
  criticalSlaRate: number
}

export interface PhysicianRvuRow {
  doctorName: string
  reportCount: number
  rvu: number
  avgMinutes: number
}

export interface OeeDay {
  date: string
  oee: number
  availability: number
  performance: number
  quality: number
}

export interface DeviceOeeRow {
  deviceId: string
  deviceName: string
  modality: string
  avgOee: number
  avgAvailability: number
  avgPerformance: number
  avgQuality: number
  trend: OeeDay[]
}

export interface CriticalSlaBucket {
  bucket: string
  count: number
}

export interface CriticalOverdueRow {
  id: string
  severity: string
  state: string
  createdAt: string
  ackedAt: string | null
  responseMinutes: number
}

export interface TrendPoint {
  date: string
  examCount: number
  reportCount: number
  completionRate: number
  avgReportMinutes: number
  overtimeCount: number
  criticalCount: number
}

interface RvuReportRecord {
  createdAt: Date
  signedAt: Date | null
  state: string
  modality?: string
  doctorName?: string
}

const RVU_BY_MODALITY: Record<string, number> = {
  CT: 3.5,
  MR: 5.0,
  DR: 1.0,
  MG: 2.0,
  DSA: 8.0,
  US: 1.5,
  CR: 1.0,
}

const DEFAULT_RVU = 1.0

// Deterministic PRNG (mulberry32) → 演示数据可复现,便于测试
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

function dateSeed(): number {
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

function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / 60000)
}

function percentOf(part: number, total: number): number {
  return total > 0 ? round1((part / total) * 100) : 0
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const base = sorted[mid] ?? 0
  if (sorted.length % 2 === 1) return round1(base)
  const prev = sorted[mid - 1] ?? base
  return round1((base + prev) / 2)
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return round1(sorted[idx] ?? 0)
}

function rvuFor(modality: string | undefined): number {
  return RVU_BY_MODALITY[modality ?? ''] ?? DEFAULT_RVU
}

interface DemoWindow {
  demoKpi: (dateSeed: number) => KpiPayload
  demoTimeliness: (dateSeed: number) => { total: number; buckets: TimelinessBucket[]; medianMinutes: number; p90Minutes: number }
  demoRvu: (dateSeed: number) => { totalRvu: number; physicians: PhysicianRvuRow[] }
  demoOee: (dateSeed: number, days: number) => { devices: DeviceOeeRow[]; dailyTrend: OeeDay[] }
  demoSla: (dateSeed: number) => { total: number; complianceRate: number; avgResponseMinutes: number; distribution: CriticalSlaBucket[]; overdue: CriticalOverdueRow[] }
  demoTrend: (dateSeed: number, days: number) => TrendPoint[]
}

const DEMO_DOCTORS = ['张明远', '李慧敏', '王建国', '赵雪琴', '陈晓燕', '刘德伟']

function buildDemo(): DemoWindow {
  const demoKpi = (seed: number): KpiPayload => {
    const rand = mulberry32(seed)
    const examCount = 280 + Math.floor(rand() * 90)
    const reportCount = Math.floor(examCount * (0.86 + rand() * 0.1))
    const pendingReports = Math.floor(examCount * (0.05 + rand() * 0.05))
    const avgReportMinutes = round1(32 + rand() * 22)
    const overtimeRate = round1(2.5 + rand() * 6)
    return {
      examCount,
      reportCount,
      completionRate: percentOf(reportCount, examCount),
      avgReportMinutes,
      overtimeRate,
      pendingReports,
      criticalSlaRate: round1(90 + rand() * 9),
    }
  }

  const demoTimeliness = (seed: number) => {
    const rand = mulberry32(seed ^ 0x1a2b)
    const buckets: TimelinessBucket[] = [
      { bucket: '<30min', count: Math.floor(rand() * 120) + 60, percent: 0 },
      { bucket: '30min-1h', count: Math.floor(rand() * 90) + 40, percent: 0 },
      { bucket: '1h-2h', count: Math.floor(rand() * 60) + 25, percent: 0 },
      { bucket: '2h-4h', count: Math.floor(rand() * 30) + 10, percent: 0 },
      { bucket: '>4h', count: Math.floor(rand() * 15) + 3, percent: 0 },
    ]
    const total = buckets.reduce((s, b) => s + b.count, 0)
    for (const b of buckets) b.percent = percentOf(b.count, total)
    return { total, buckets, medianMinutes: round1(28 + rand() * 25), p90Minutes: round1(85 + rand() * 60) }
  }

  const demoRvu = (seed: number) => {
    const rand = mulberry32(seed ^ 0x2c3d)
    const physicians: PhysicianRvuRow[] = DEMO_DOCTORS.map((name, i) => {
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

  const demoOee = (seed: number, days: number) => {
    const rand = mulberry32(seed ^ 0x3e4f)
    const devices = [
      { deviceId: 'CT-01', name: 'GE Revolution CT', modality: 'CT' },
      { deviceId: 'MR-01', name: 'Siemens Skyra', modality: 'MR' },
      { deviceId: 'DR-01', name: 'Philips DigitalDiagnost', modality: 'DR' },
      { deviceId: 'CT-02', name: 'Canon Aquilion', modality: 'CT' },
      { deviceId: 'MG-01', name: 'Hologic Selenia', modality: 'MG' },
    ]
    const daily = new Map<string, { date: string; sumOee: number; sumAvailability: number; sumPerformance: number; sumQuality: number; count: number }>()
    const deviceRows: DeviceOeeRow[] = devices.map((dev) => {
      const base = 78 + rand() * 15
      const trend: OeeDay[] = Array.from({ length: days }, (_, i) => {
        const availability = round1(base + (rand() - 0.5) * 8)
        const performance = round1(base + 4 + (rand() - 0.5) * 8)
        const quality = round1(92 + (rand() - 0.5) * 8)
        const oee = round1((availability * performance * quality) / 10000)
        const date = isoDaysAgo(days - 1 - i)
        const entry = daily.get(date) ?? { date, sumOee: 0, sumAvailability: 0, sumPerformance: 0, sumQuality: 0, count: 0 }
        entry.sumOee += oee
        entry.sumAvailability += availability
        entry.sumPerformance += performance
        entry.sumQuality += quality
        entry.count += 1
        daily.set(date, entry)
        return { date, oee, availability, performance, quality }
      })
      const avg = (key: keyof OeeDay) => round1(trend.reduce((s, t) => s + (t[key] as number), 0) / trend.length)
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
    const dailyTrend: OeeDay[] = Array.from(daily.values())
      .map((e) => ({
        date: e.date,
        oee: round1(e.sumOee / e.count),
        availability: round1(e.sumAvailability / e.count),
        performance: round1(e.sumPerformance / e.count),
        quality: round1(e.sumQuality / e.count),
      }))
      .sort((a, b) => (a.date < b.date ? -1 : 1))
    return { devices: deviceRows, dailyTrend }
  }

  const demoSla = (seed: number) => {
    const rand = mulberry32(seed ^ 0x50a1)
    const buckets: CriticalSlaBucket[] = [
      { bucket: '<5min', count: Math.floor(rand() * 8) + 3 },
      { bucket: '5-15min', count: Math.floor(rand() * 8) + 5 },
      { bucket: '15-30min', count: Math.floor(rand() * 6) + 2 },
      { bucket: '30-60min', count: Math.floor(rand() * 4) + 1 },
      { bucket: '>60min', count: Math.floor(rand() * 3) },
    ]
    const total = buckets.reduce((s, b) => s + b.count, 0)
    const within = buckets[0]!.count + buckets[1]!.count + buckets[2]!.count
    const overdue: CriticalOverdueRow[] = Array.from({ length: buckets[3]!.count + buckets[4]!.count }, (_, i) => ({
      id: `DEMO-CV-${String(i + 1).padStart(3, '0')}`,
      severity: (['HIGH', 'URGENT', 'CRITICAL'] as const)[i % 3] ?? 'HIGH',
      state: 'NOTIFIED',
      createdAt: isoDaysAgo(i),
      ackedAt: null,
      responseMinutes: 35 + Math.floor(rand() * 120),
    }))
    return {
      total,
      complianceRate: percentOf(within, total),
      avgResponseMinutes: round1(9 + rand() * 18),
      distribution: buckets,
      overdue,
    }
  }

  const demoTrend = (seed: number, days: number): TrendPoint[] => {
    const rand = mulberry32(seed ^ 0x61b2)
    return Array.from({ length: days }, (_, i) => {
      const date = isoDaysAgo(days - 1 - i)
      const examCount = 260 + Math.floor(rand() * 100)
      const reportCount = Math.floor(examCount * (0.85 + rand() * 0.12))
      const signed = Math.floor(reportCount * (0.9 + rand() * 0.09))
      return {
        date,
        examCount,
        reportCount,
        completionRate: percentOf(signed, reportCount),
        avgReportMinutes: round1(30 + rand() * 25),
        overtimeCount: Math.floor(reportCount * (0.03 + rand() * 0.05)),
        criticalCount: Math.floor(rand() * 5),
      }
    })
  }

  return { demoKpi, demoTimeliness, demoRvu, demoOee, demoSla, demoTrend }
}

@Injectable()
export class BiService {
  private readonly logger = new Logger(BiService.name)
  private readonly demo = buildDemo()

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  // 通用执行器: 缓存 → 真实 DB 聚合 → 失败/空数据回退演示数据(source: 'demo')
  private async run<T>(
    cacheKey: string,
    ttl: number,
    fallback: () => T,
    dbFn: () => Promise<T | null>,
  ): Promise<{ source: BiSource; generatedAt: string; data: T }> {
    const cached = await this.cache.get<{ source: BiSource; generatedAt: string; data: T }>(cacheKey)
    if (cached) return cached
    let result: T | null = null
    try {
      result = await dbFn()
    } catch (err) {
      this.logger.warn(`[BI] ${cacheKey} DB query failed, fallback to demo: ${(err as Error).message}`)
      result = null
    }
    const payload = result ?? fallback()
    const body = { source: (result ? 'database' : 'demo') as BiSource, generatedAt: new Date().toISOString(), data: payload }
    await this.cache.set(cacheKey, body, ttl)
    return body
  }

  async getKpi() {
    const seed = dateSeed()
    return this.run<KpiPayload>('bi:kpi', 30, () => this.demo.demoKpi(seed), async () => {
      const dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      const [examCount, reportCount, reports, criticals] = await Promise.all([
        this.prisma.exam.count({ where: { createdAt: { gte: dayStart } } }),
        this.prisma.report.count({ where: { createdAt: { gte: dayStart } } }),
        this.prisma.report.findMany({
          where: { createdAt: { gte: dayStart } },
          select: { createdAt: true, signedAt: true, state: true },
        }),
        this.prisma.criticalValue.findMany({
          where: { createdAt: { gte: dayStart } },
          select: { createdAt: true, ackedAt: true },
        }),
      ])
      if (examCount === 0 && reportCount === 0) return null
      const now = Date.now()
      const durations: number[] = []
      let overtime = 0
      let signed = 0
      for (const r of reports) {
        if (r.signedAt) {
          signed += 1
          const dur = minutesBetween(r.createdAt, r.signedAt)
          durations.push(dur)
          if (dur > 1440) overtime += 1
        } else if (now - r.createdAt.getTime() > 1440 * 60000) {
          overtime += 1
        }
      }
      const totalCritical = criticals.length
      const ackedWithinSla = criticals.filter((c) => c.ackedAt && minutesBetween(c.createdAt, c.ackedAt) <= 30).length
      return {
        examCount,
        reportCount,
        completionRate: percentOf(signed, reportCount),
        avgReportMinutes: median(durations),
        overtimeRate: percentOf(overtime, reportCount),
        pendingReports: reportCount - signed,
        criticalSlaRate: totalCritical > 0 ? percentOf(ackedWithinSla, totalCritical) : 100,
      }
    })
  }

  async getReportTimeliness() {
    const seed = dateSeed()
    return this.run('bi:report-timeliness', 60, () => this.demo.demoTimeliness(seed), async () => {
      const since = new Date()
      since.setDate(since.getDate() - 30)
      const reports = await this.prisma.report.findMany({
        where: { signedAt: { gte: since } },
        select: { createdAt: true, signedAt: true },
      })
      if (reports.length === 0) return null
      const durations = reports
        .filter((r) => r.signedAt)
        .map((r) => minutesBetween(r.createdAt, r.signedAt!))
      const buckets: TimelinessBucket[] = [
        { bucket: '<30min', count: 0, percent: 0 },
        { bucket: '30min-1h', count: 0, percent: 0 },
        { bucket: '1h-2h', count: 0, percent: 0 },
        { bucket: '2h-4h', count: 0, percent: 0 },
        { bucket: '>4h', count: 0, percent: 0 },
      ]
      for (const d of durations) {
        if (d < 30) buckets[0]!.count += 1
        else if (d < 60) buckets[1]!.count += 1
        else if (d < 120) buckets[2]!.count += 1
        else if (d < 240) buckets[3]!.count += 1
        else buckets[4]!.count += 1
      }
      for (const b of buckets) b.percent = percentOf(b.count, durations.length)
      return {
        total: durations.length,
        buckets,
        medianMinutes: median(durations),
        p90Minutes: percentile(durations, 90),
      }
    })
  }

  async getPhysicianRvu() {
    const seed = dateSeed()
    return this.run('bi:physician-rvu', 60, () => this.demo.demoRvu(seed), async () => {
      const since = new Date()
      since.setDate(since.getDate() - 30)
      const rows = await this.prisma.report.findMany({
        where: { radiologistId: { not: null }, createdAt: { gte: since } },
        select: {
          createdAt: true,
          signedAt: true,
          radiologist: { select: { fullName: true } },
          exam: { select: { modality: true } },
        },
      })
      const records: RvuReportRecord[] = rows.map((r) => ({
        createdAt: r.createdAt,
        signedAt: r.signedAt,
        state: 'SIGNED',
        modality: r.exam?.modality,
        doctorName: r.radiologist?.fullName,
      }))
      if (records.length === 0) return null
      const byDoctor = new Map<string, { count: number; rvu: number; durations: number[] }>()
      for (const r of records) {
        const name = r.doctorName ?? '未分配'
        const entry = byDoctor.get(name) ?? { count: 0, rvu: 0, durations: [] }
        entry.count += 1
        entry.rvu += rvuFor(r.modality)
        if (r.signedAt) entry.durations.push(minutesBetween(r.createdAt, r.signedAt))
        byDoctor.set(name, entry)
      }
      const physicians: PhysicianRvuRow[] = Array.from(byDoctor.entries()).map(([doctorName, e]) => ({
        doctorName,
        reportCount: e.count,
        rvu: round1(e.rvu),
        avgMinutes: median(e.durations),
      }))
      physicians.sort((a, b) => b.rvu - a.rvu)
      return { totalRvu: round1(physicians.reduce((s, p) => s + p.rvu, 0)), physicians }
    })
  }

  async getDeviceOee(days: number) {
    const seed = dateSeed()
    const normalizedDays = Math.min(Math.max(days, 7), 90)
    const cacheKey = `bi:device-oee:${normalizedDays}`
    return this.run(cacheKey, 60, () => this.demo.demoOee(seed, normalizedDays), async () => {
      const cutoff = isoDaysAgo(normalizedDays - 1)
      const records = await this.prisma.oeeRecord.findMany({
        where: { date: { gte: cutoff } },
        orderBy: { date: 'asc' },
      })
      if (records.length === 0) return null
      const devices = await this.prisma.device.findMany({ select: { id: true, name: true } })
      const nameById = new Map(devices.map((d) => [d.id, d.name]))
      const byDevice = new Map<string, DeviceOeeRow>()
      const daily = new Map<string, OeeDay>()
      for (const r of records) {
        const row = byDevice.get(r.deviceId) ?? {
          deviceId: r.deviceId,
          deviceName: nameById.get(r.deviceId) ?? r.deviceId,
          modality: r.modality,
          avgOee: 0,
          avgAvailability: 0,
          avgPerformance: 0,
          avgQuality: 0,
          trend: [],
        }
        row.trend.push({ date: r.date, oee: r.oee, availability: r.availability, performance: r.performance, quality: r.quality })
        byDevice.set(r.deviceId, row)
        const day = daily.get(r.date) ?? { date: r.date, oee: 0, availability: 0, performance: 0, quality: 0 }
        daily.set(r.date, day)
      }
      const avgKeyOf: Record<'oee' | 'availability' | 'performance' | 'quality', 'avgOee' | 'avgAvailability' | 'avgPerformance' | 'avgQuality'> = {
        oee: 'avgOee',
        availability: 'avgAvailability',
        performance: 'avgPerformance',
        quality: 'avgQuality',
      }
      const avgOf = (key: 'oee' | 'availability' | 'performance' | 'quality') => {
        for (const row of byDevice.values()) {
          const trend = row.trend
          if (trend.length > 0) row[avgKeyOf[key]] = round1(trend.reduce((s, t) => s + t[key], 0) / trend.length)
        }
      }
      avgOf('oee')
      avgOf('availability')
      avgOf('performance')
      avgOf('quality')
      const dailyTrend: OeeDay[] = Array.from(daily.entries())
        .map(([date, agg]) => {
          const recordsForDate = records.filter((r) => r.date === date)
          const sum = (key: 'oee' | 'availability' | 'performance' | 'quality') =>
            round1(recordsForDate.reduce((s, r) => s + r[key], 0) / recordsForDate.length)
          return { date, oee: sum('oee'), availability: sum('availability'), performance: sum('performance'), quality: sum('quality') }
        })
        .sort((a, b) => (a.date < b.date ? -1 : 1))
      return {
        devices: Array.from(byDevice.values()).sort((a, b) => b.avgOee - a.avgOee),
        dailyTrend,
      }
    })
  }

  async getCriticalSla() {
    const seed = dateSeed()
    return this.run('bi:critical-sla', 60, () => this.demo.demoSla(seed), async () => {
      const since = new Date()
      since.setDate(since.getDate() - 30)
      const records = await this.prisma.criticalValue.findMany({
        where: { createdAt: { gte: since } },
        select: { id: true, severity: true, state: true, createdAt: true, ackedAt: true },
      })
      if (records.length === 0) return null
      const SLA_MINUTES = 30
      const buckets: CriticalSlaBucket[] = [
        { bucket: '<5min', count: 0 },
        { bucket: '5-15min', count: 0 },
        { bucket: '15-30min', count: 0 },
        { bucket: '30-60min', count: 0 },
        { bucket: '>60min', count: 0 },
      ]
      let ackedCount = 0
      let withinSla = 0
      let responseTotal = 0
      const overdue: CriticalOverdueRow[] = []
      for (const r of records) {
        const ackedAt = r.ackedAt
        if (ackedAt) {
          ackedCount += 1
          const resp = minutesBetween(r.createdAt, ackedAt)
          responseTotal += resp
          if (resp <= SLA_MINUTES) withinSla += 1
          if (resp < 5) buckets[0]!.count += 1
          else if (resp < 15) buckets[1]!.count += 1
          else if (resp < 30) buckets[2]!.count += 1
          else if (resp < 60) buckets[3]!.count += 1
          else buckets[4]!.count += 1
          if (resp > SLA_MINUTES) {
            overdue.push({ id: r.id, severity: r.severity, state: r.state, createdAt: r.createdAt.toISOString(), ackedAt: ackedAt.toISOString(), responseMinutes: round1(resp) })
          }
        } else {
          buckets[4]!.count += 1
          overdue.push({ id: r.id, severity: r.severity, state: r.state, createdAt: r.createdAt.toISOString(), ackedAt: null, responseMinutes: round1(minutesBetween(r.createdAt, new Date())) })
        }
      }
      overdue.sort((a, b) => b.responseMinutes - a.responseMinutes)
      return {
        total: records.length,
        slaMinutes: SLA_MINUTES,
        complianceRate: percentOf(withinSla, records.length),
        avgResponseMinutes: ackedCount > 0 ? round1(responseTotal / ackedCount) : 0,
        distribution: buckets,
        overdue: overdue.slice(0, 20),
      }
    })
  }

  async getTrend(days: number) {
    const seed = dateSeed()
    const normalizedDays = Math.min(Math.max(days, 7), 90)
    const cacheKey = `bi:trend:${normalizedDays}`
    return this.run<TrendPoint[]>(cacheKey, 60, () => this.demo.demoTrend(seed, normalizedDays), async () => {
      const since = new Date()
      since.setHours(0, 0, 0, 0)
      since.setDate(since.getDate() - (normalizedDays - 1))
      const dayKey = (d: Date) => d.toISOString().slice(0, 10)
      const [exams, reports, criticals] = await Promise.all([
        this.prisma.exam.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
        this.prisma.report.findMany({
          where: { createdAt: { gte: since } },
          select: { createdAt: true, signedAt: true, state: true },
        }),
        this.prisma.criticalValue.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      ])
      if (exams.length === 0 && reports.length === 0 && criticals.length === 0) return null
      const examByDay = new Map<string, number>()
      for (const e of exams) {
        const k = dayKey(e.createdAt)
        examByDay.set(k, (examByDay.get(k) ?? 0) + 1)
      }
      const criticalByDay = new Map<string, number>()
      for (const c of criticals) {
        const k = dayKey(c.createdAt)
        criticalByDay.set(k, (criticalByDay.get(k) ?? 0) + 1)
      }
      const reportByDay = new Map<string, { count: number; signed: number; overtime: number; durations: number[] }>()
      for (const r of reports) {
        const k = dayKey(r.createdAt)
        const entry = reportByDay.get(k) ?? { count: 0, signed: 0, overtime: 0, durations: [] }
        entry.count += 1
        if (r.signedAt) {
          entry.signed += 1
          const dur = minutesBetween(r.createdAt, r.signedAt)
          entry.durations.push(dur)
          if (dur > 1440) entry.overtime += 1
        }
        reportByDay.set(k, entry)
      }
      const points: TrendPoint[] = Array.from({ length: normalizedDays }, (_, i) => {
        const date = isoDaysAgo(normalizedDays - 1 - i)
        const examCount = examByDay.get(date) ?? 0
        const rep = reportByDay.get(date)
        return {
          date,
          examCount,
          reportCount: rep?.count ?? 0,
          completionRate: percentOf(rep?.signed ?? 0, rep?.count ?? 0),
          avgReportMinutes: median(rep?.durations ?? []),
          overtimeCount: rep?.overtime ?? 0,
          criticalCount: criticalByDay.get(date) ?? 0,
        }
      })
      return points
    })
  }
}
