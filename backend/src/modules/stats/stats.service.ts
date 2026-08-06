import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CacheService } from '../../cache/cache.service'

// ============================================================
// G005 RIS v3.0.6.11-73 — stats 端点真实化 (P1)
// 所有端点: 缓存 → Prisma 真实聚合 → 空数据时确定性 seed 回退
// 回退数据不包含 Math.random (确定性, 可复现), 且标注 source: 'seed'
// ============================================================

export type StatsSource = 'database' | 'seed'

export interface StatsEnvelope<T> {
  source: StatsSource
  generatedAt: string
  data: T
}

export interface DailyStatsData {
  examCount: number
  reportCount: number
  criticalCount: number
  cosignCount: number
  avgTAT: number
  defectCount: number
  qcAvgScore: number
  date: string
  byModality: Record<string, number>
}

export interface WeeklyStatsData {
  totalExams: number
  totalReports: number
  totalCritical: number
  daily: { date: string; count: number }[]
  avgExamsPerDay: number
}

export interface WorkloadRow {
  doctorId: string
  doctorName: string
  examCount: number
  reportCount: number
  avgTime: number
  department: string
  score: number
}

export interface QualityData {
  averageScore: number
  totalReports: number
  totalScored: number
  defectRate: number
  gradeDistribution: Record<string, number>
  byDoctor: { doctorName: string; score: number; count: number }[]
  byModality: { modality: string; score: number; count: number }[]
}

export interface ModalityStats {
  total: number
  days: number
  avg: number
}

export interface TrendPoint {
  date: string
  examCount: number
  reportCount: number
  criticalCount: number
  cosignCount: number
}

export interface StatsDashboardData {
  today: { exams: number; reports: number; critical: number }
  week: { exams: number; reports: number }
  month: { exams: number; reports: number }
  totals: { exams: number; patients: number; criticalEvents: number }
  alerts: { openCritical: number; devicesActive: number; doctorsActive: number }
}

const DOCTORS = [
  { id: 'D001', name: '张医生', department: '放射科' },
  { id: 'D002', name: '李医生', department: '放射科' },
  { id: 'D003', name: '王医生', department: '放射科' },
  { id: 'D004', name: '赵医生', department: '放射科' },
  { id: 'D005', name: '陈医生', department: '放射科' },
]

const MODALITIES = ['CT', 'DR', 'MR', 'US', 'MG']

// 确定性 PRNG (mulberry32) — seed 回退数据可复现,便于测试
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

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

function dayStart(date: Date = new Date()): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function daysAgoStart(days: number): Date {
  const d = dayStart()
  d.setDate(d.getDate() - days)
  return d
}

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, (to.getTime() - from.getTime()) / 60000)
}

function avgOf(values: number[]): number {
  if (values.length === 0) return 0
  return round1(values.reduce((s, v) => s + v, 0) / values.length)
}

function countBy<T>(rows: T[], keyFn: (row: T) => string): Record<string, number> {
  const result: Record<string, number> = {}
  for (const row of rows) {
    const key = keyFn(row)
    result[key] = (result[key] ?? 0) + 1
  }
  return result
}

// buckets 按 start 升序; 取 createdAt 落入的最后一个桶 (首个 start > createdAt 的桶的前一个)
function bucketFor<T extends { start: Date }>(
  buckets: readonly T[],
  createdAt: Date,
): T | undefined {
  let match: T | undefined
  for (const b of buckets) {
    if (createdAt.getTime() >= b.start.getTime()) match = b
    else break
  }
  return match
}

// ============ 确定性 seed 回退数据 (无 Math.random) ============

function seedDaily(seed: number): DailyStatsData {
  const rnd = mulberry32(seed)
  const examCount = 15 + Math.floor(rnd() * 18)
  const reportCount = Math.floor(examCount * (0.65 + rnd() * 0.25))
  const byModality: Record<string, number> = {}
  let rest = examCount
  for (const mod of MODALITIES) {
    if (mod === MODALITIES[MODALITIES.length - 1]) {
      byModality[mod] = rest
      break
    }
    const share = Math.max(0, Math.floor((rnd() * examCount) / MODALITIES.length))
    byModality[mod] = share
    rest -= share
  }
  return {
    examCount,
    reportCount,
    criticalCount: Math.floor(rnd() * 3),
    cosignCount: Math.floor(rnd() * 4),
    avgTAT: round1(1.2 + rnd() * 3.5),
    defectCount: Math.floor(rnd() * 3),
    qcAvgScore: 86 + Math.floor(rnd() * 10),
    date: isoDate(new Date()),
    byModality,
  }
}

function seedWeekly(seed: number): WeeklyStatsData {
  const rnd = mulberry32(seed ^ 0x9e3779b9)
  const daily: { date: string; count: number }[] = []
  let totalExams = 0
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const count = 10 + Math.floor(rnd() * 24)
    daily.push({ date: isoDate(d), count })
    totalExams += count
  }
  return {
    totalExams,
    totalReports: Math.floor(totalExams * 0.72),
    totalCritical: Math.floor(rnd() * 12),
    daily,
    avgExamsPerDay: Math.round(totalExams / 7),
  }
}

function seedWorkload(seed: number): WorkloadRow[] {
  const rnd = mulberry32(seed ^ 0x85ebca6b)
  return DOCTORS.map((doc) => {
    const reportCount = 4 + Math.floor(rnd() * 18)
    return {
      doctorId: doc.id,
      doctorName: doc.name,
      examCount: reportCount + Math.floor(rnd() * 4),
      reportCount,
      avgTime: Math.round(30 + rnd() * 90),
      department: doc.department,
      score: 85 + Math.floor(rnd() * 12),
    }
  }).sort((a, b) => b.reportCount - a.reportCount)
}

function seedQuality(seed: number): QualityData {
  const rnd = mulberry32(seed ^ 0xc2b2ae35)
  const byDoctor = DOCTORS.map((doc) => ({
    doctorName: doc.name,
    score: 86 + Math.floor(rnd() * 12),
    count: 5 + Math.floor(rnd() * 15),
  }))
  const byModality = MODALITIES.map((mod) => ({
    modality: mod,
    score: 87 + Math.floor(rnd() * 10),
    count: 8 + Math.floor(rnd() * 20),
  }))
  return {
    averageScore: round1(avgOf(byDoctor.map((d) => d.score))),
    totalReports: byDoctor.reduce((s, d) => s + d.count, 0),
    totalScored: byDoctor.reduce((s, d) => s + d.count, 0),
    defectRate: round1(3 + rnd() * 5),
    gradeDistribution: { 优秀: 62, 良好: 28, 合格: 8, 不合格: 2 },
    byDoctor,
    byModality,
  }
}

function seedByModality(seed: number): Record<string, ModalityStats> {
  const rnd = mulberry32(seed ^ 0x27d4eb2f)
  const result: Record<string, ModalityStats> = {}
  for (const mod of MODALITIES) {
    const total = 20 + Math.floor(rnd() * 80)
    result[mod] = { total, days: 7, avg: Math.round(total / 7) }
  }
  return result
}

function seedTrend(days: number, seed: number): TrendPoint[] {
  const rnd = mulberry32(seed ^ 0x165667b1)
  const points: TrendPoint[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const examCount = 8 + Math.floor(rnd() * 28)
    points.push({
      date: isoDate(d),
      examCount,
      reportCount: Math.floor(examCount * (0.6 + rnd() * 0.3)),
      criticalCount: Math.floor(rnd() * 4),
      cosignCount: Math.floor(rnd() * 5),
    })
  }
  return points
}

function seedDashboard(seed: number): StatsDashboardData {
  const daily = seedDaily(seed)
  const rnd = mulberry32(seed ^ 0x4d595df4)
  return {
    today: { exams: daily.examCount, reports: daily.reportCount, critical: daily.criticalCount },
    week: {
      exams: Math.round(daily.examCount * 6.4),
      reports: Math.round(daily.reportCount * 6.2),
    },
    month: {
      exams: Math.round(daily.examCount * 26),
      reports: Math.round(daily.reportCount * 25),
    },
    totals: {
      exams: 1280 + Math.floor(rnd() * 400),
      patients: 960 + Math.floor(rnd() * 300),
      criticalEvents: 42 + Math.floor(rnd() * 30),
    },
    alerts: {
      openCritical: Math.floor(rnd() * 8),
      devicesActive: 12,
      doctorsActive: 24,
    },
  }
}

// ============ Service ============

@Injectable()
export class StatsService {
  private readonly logger = new Logger(StatsService.name)

  constructor(
    private readonly cache: CacheService,
    private readonly prisma: PrismaService,
  ) {}

  // 通用执行器: 缓存 → 真实 DB 聚合 → 空数据确定性 seed 回退 (source: 'seed')
  private async run<T>(
    cacheKey: string,
    dbFn: () => Promise<T | null>,
    fallback: (seed: number) => T,
  ): Promise<StatsEnvelope<T>> {
    const cached = await this.cache.get<StatsEnvelope<T>>(cacheKey)
    if (cached) return cached
    let result: T | null = null
    try {
      result = await dbFn()
    } catch (err) {
      this.logger.warn(`[Stats] ${cacheKey} DB query failed, fallback to seed: ${(err as Error).message}`)
      result = null
    }
    const body: StatsEnvelope<T> = {
      source: result ? 'database' : 'seed',
      generatedAt: new Date().toISOString(),
      data: result ?? fallback(dateSeed()),
    }
    await this.cache.set(cacheKey, body, 300)
    return body
  }

  // GET /stats/daily — 今日检查/报告/危急值
  async getDaily(): Promise<StatsEnvelope<DailyStatsData>> {
    return this.run<DailyStatsData>('stats:daily', async () => {
      const since = dayStart()
      const [exams, reports, criticals, qualityRows] = await Promise.all([
        this.prisma.exam.findMany({
          where: { createdAt: { gte: since } },
          select: { modality: true },
        }),
        this.prisma.report.findMany({
          where: { createdAt: { gte: since } },
          select: { createdAt: true, signedAt: true, coSignedAt: true, rectificationCount: true },
        }),
        this.prisma.criticalValue.findMany({
          where: { createdAt: { gte: since } },
          select: { id: true },
        }),
        this.prisma.reportQualityScore.findMany({
          where: { report: { createdAt: { gte: since } } },
          select: { totalScore: true },
        }),
      ])
      if (exams.length === 0 && reports.length === 0 && criticals.length === 0) return null
      const durations: number[] = []
      let cosignCount = 0
      let defectCount = 0
      for (const r of reports) {
        if (r.coSignedAt) cosignCount += 1
        if (r.rectificationCount > 0) defectCount += 1
        if (r.signedAt) durations.push(minutesBetween(r.createdAt, r.signedAt))
      }
      return {
        examCount: exams.length,
        reportCount: reports.length,
        criticalCount: criticals.length,
        cosignCount,
        avgTAT: round1(avgOf(durations) / 60),
        defectCount,
        qcAvgScore: avgOf(qualityRows.map((q) => q.totalScore)),
        date: isoDate(new Date()),
        byModality: countBy(exams, (e) => e.modality),
      }
    }, seedDaily)
  }

  // GET /stats/weekly — 近 7 天趋势
  async getWeekly(): Promise<StatsEnvelope<WeeklyStatsData>> {
    return this.run<WeeklyStatsData>('stats:weekly', async () => {
      const since = daysAgoStart(6)
      const [exams, reports, criticals] = await Promise.all([
        this.prisma.exam.findMany({
          where: { createdAt: { gte: since } },
          select: { createdAt: true },
        }),
        this.prisma.report.findMany({
          where: { createdAt: { gte: since } },
          select: { id: true },
        }),
        this.prisma.criticalValue.findMany({
          where: { createdAt: { gte: since } },
          select: { id: true },
        }),
      ])
      if (exams.length === 0) return null
      const buckets: { date: string; start: Date; count: number }[] = []
      for (let i = 6; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        buckets.push({ date: isoDate(d), start: dayStart(d), count: 0 })
      }
      for (const e of exams) {
        const bucket = bucketFor(buckets, e.createdAt)
        if (bucket) bucket.count += 1
      }
      const daily = buckets.map((b) => ({ date: b.date, count: b.count }))
      const totalExams = daily.reduce((s, b) => s + b.count, 0)
      return {
        totalExams,
        totalReports: reports.length,
        totalCritical: criticals.length,
        daily,
        avgExamsPerDay: Math.round(totalExams / 7),
      }
    }, seedWeekly)
  }

  // GET /stats/workload — 医生工作量 (按 radiologistId 分组)
  async getWorkload(): Promise<StatsEnvelope<WorkloadRow[]>> {
    return this.run<WorkloadRow[]>('stats:workload', async () => {
      const since = daysAgoStart(90)
      const rows = await this.prisma.report.findMany({
        where: { radiologistId: { not: null }, createdAt: { gte: since } },
        select: {
          radiologistId: true,
          createdAt: true,
          signedAt: true,
          qualityScore: true,
          examId: true,
          radiologist: {
            select: { fullName: true, department: true },
          },
        },
      })
      if (rows.length === 0) return null
      interface WorkloadAgg {
        doctorId: string
        doctorName: string
        examCount: number
        reportCount: number
        department: string
        durations: number[]
        scores: number[]
      }
      const byDoctor = new Map<string, WorkloadAgg>()
      for (const r of rows) {
        const id = r.radiologistId!
        const entry = byDoctor.get(id) ?? {
          doctorId: id,
          doctorName: r.radiologist?.fullName ?? '未分配',
          examCount: 0,
          reportCount: 0,
          department: r.radiologist?.department ?? '',
          durations: [] as number[],
          scores: [] as number[],
        }
        entry.reportCount += 1
        entry.examCount += r.examId ? 1 : 0
        if (r.signedAt) entry.durations.push(minutesBetween(r.createdAt, r.signedAt))
        if (r.qualityScore != null) entry.scores.push(r.qualityScore)
        byDoctor.set(id, entry)
      }
      return Array.from(byDoctor.entries()).map(([doctorId, e]) => ({
        doctorId,
        doctorName: e.doctorName,
        examCount: e.examCount,
        reportCount: e.reportCount,
        avgTime: Math.round(avgOf(e.durations)),
        department: e.department,
        score: round1(avgOf(e.scores)),
      })).sort((a, b) => b.reportCount - a.reportCount)
    }, seedWorkload)
  }

  // GET /stats/quality — 质控指标
  async getQuality(): Promise<StatsEnvelope<QualityData>> {
    return this.run<QualityData>('stats:quality', async () => {
      const [scores, reports] = await Promise.all([
        this.prisma.reportQualityScore.findMany({
          select: {
            totalScore: true,
            grade: true,
            report: {
              select: {
                radiologist: { select: { fullName: true } },
                exam: { select: { modality: true } },
              },
            },
          },
        }),
        this.prisma.report.findMany({
          select: { rectificationCount: true },
        }),
      ])
      if (scores.length === 0) return null
      const totalReports = reports.length
      const defectReports = reports.filter((r) => r.rectificationCount > 0).length
      const gradeDistribution = countBy(scores, (s) => s.grade || '未知')
      const byDocMap = new Map<string, { sum: number; count: number }>()
      const byModMap = new Map<string, { sum: number; count: number }>()
      for (const s of scores) {
        const name = s.report?.radiologist?.fullName ?? '未分配'
        const mod = s.report?.exam?.modality ?? '未知'
        byDocMap.set(name, byDocMap.get(name) ?? { sum: 0, count: 0 })
        byDocMap.get(name)!.sum += s.totalScore
        byDocMap.get(name)!.count += 1
        byModMap.set(mod, byModMap.get(mod) ?? { sum: 0, count: 0 })
        byModMap.get(mod)!.sum += s.totalScore
        byModMap.get(mod)!.count += 1
      }
      const byDoctor = Array.from(byDocMap.entries()).map(([doctorName, v]) => ({
        doctorName,
        score: round1(v.sum / v.count),
        count: v.count,
      })).sort((a, b) => b.score - a.score).slice(0, 10)
      const byModality = Array.from(byModMap.entries()).map(([modality, v]) => ({
        modality,
        score: round1(v.sum / v.count),
        count: v.count,
      }))
      return {
        averageScore: round1(scores.reduce((s, q) => s + q.totalScore, 0) / scores.length),
        totalReports,
        totalScored: scores.length,
        defectRate: totalReports > 0 ? round1((defectReports / totalReports) * 100) : 0,
        gradeDistribution,
        byDoctor,
        byModality,
      }
    }, seedQuality)
  }

  // GET /stats/by-modality — 按模态统计
  async getByModality(): Promise<StatsEnvelope<Record<string, ModalityStats>>> {
    return this.run<Record<string, ModalityStats>>('stats:by-modality', async () => {
      const since = daysAgoStart(89)
      const exams = await this.prisma.exam.findMany({
        where: { createdAt: { gte: since } },
        select: { modality: true, createdAt: true },
      })
      if (exams.length === 0) return null
      const days = new Set<string>()
      const byModality: Record<string, { total: number; days: Set<string> }> = {}
      for (const e of exams) {
        const day = isoDate(e.createdAt)
        days.add(day)
        const entry = byModality[e.modality] ?? { total: 0, days: new Set<string>() }
        entry.total += 1
        entry.days.add(day)
        byModality[e.modality] = entry
      }
      const dayCount = days.size
      const result: Record<string, ModalityStats> = {}
      for (const [mod, entry] of Object.entries(byModality)) {
        const daysWith = entry.days.size
        result[mod] = {
          total: entry.total,
          days: daysWith,
          avg: Math.round(entry.total / Math.max(1, dayCount)),
        }
      }
      return result
    }, seedByModality)
  }

  // GET /stats/trend?days=30 — N 天趋势
  async getTrend(days: number): Promise<StatsEnvelope<TrendPoint[]>> {
    const clamped = Math.min(Math.max(Math.floor(days) || 30, 1), 90)
    return this.run<TrendPoint[]>(`stats:trend:${clamped}`, async () => {
      const since = daysAgoStart(clamped - 1)
      const [exams, reports, criticals] = await Promise.all([
        this.prisma.exam.findMany({
          where: { createdAt: { gte: since } },
          select: { createdAt: true },
        }),
        this.prisma.report.findMany({
          where: { createdAt: { gte: since } },
          select: { createdAt: true, coSignedAt: true },
        }),
        this.prisma.criticalValue.findMany({
          where: { createdAt: { gte: since } },
          select: { createdAt: true },
        }),
      ])
      if (exams.length === 0 && reports.length === 0) return null
      const buckets: { date: string; start: Date; exam: number; report: number; critical: number; cosign: number }[] = []
      for (let i = clamped - 1; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        buckets.push({ date: isoDate(d), start: dayStart(d), exam: 0, report: 0, critical: 0, cosign: 0 })
      }
      for (const e of exams) {
        const b = bucketFor(buckets, e.createdAt)
        if (b) b.exam += 1
      }
      for (const r of reports) {
        const b = bucketFor(buckets, r.createdAt)
        if (b) {
          b.report += 1
          if (r.coSignedAt) b.cosign += 1
        }
      }
      for (const c of criticals) {
        const b = bucketFor(buckets, c.createdAt)
        if (b) b.critical += 1
      }
      return buckets.map((b) => ({
        date: b.date,
        examCount: b.exam,
        reportCount: b.report,
        criticalCount: b.critical,
        cosignCount: b.cosign,
      }))
    }, (seed) => seedTrend(clamped, seed))
  }

  // GET /stats/dashboard — 全局汇总 (真实聚合, 无 Math.random)
  async getDashboardData(): Promise<StatsEnvelope<StatsDashboardData>> {
    return this.run<StatsDashboardData>('stats:dashboard', async () => {
      const [today, weekStart, monthStart, totals, alerts] = await Promise.all([
        Promise.all([
          this.prisma.exam.count({ where: { createdAt: { gte: dayStart() } } }),
          this.prisma.report.count({ where: { createdAt: { gte: dayStart() } } }),
          this.prisma.criticalValue.count({ where: { createdAt: { gte: dayStart() } } }),
        ]),
        Promise.all([
          this.prisma.exam.count({ where: { createdAt: { gte: daysAgoStart(6) } } }),
          this.prisma.report.count({ where: { createdAt: { gte: daysAgoStart(6) } } }),
        ]),
        Promise.all([
          this.prisma.exam.count({ where: { createdAt: { gte: daysAgoStart(29) } } }),
          this.prisma.report.count({ where: { createdAt: { gte: daysAgoStart(29) } } }),
        ]),
        Promise.all([
          this.prisma.exam.count(),
          this.prisma.patient.count(),
          this.prisma.criticalValue.count(),
        ]),
        Promise.all([
          this.prisma.criticalValue.count({ where: { state: { not: 'CLOSED_LOOP' } } }),
          this.prisma.device.count({ where: { state: { in: ['IDLE', 'IN_USE'] } } }),
          this.prisma.user.count({ where: { active: true, role: { in: ['DOCTOR', 'DIRECTOR'] } } }),
        ]),
      ])
      const hasData = today[0] > 0 || today[1] > 0 || totals[0] > 0
      if (!hasData) return null
      return {
        today: { exams: today[0], reports: today[1], critical: today[2] },
        week: { exams: weekStart[0], reports: weekStart[1] },
        month: { exams: monthStart[0], reports: monthStart[1] },
        totals: { exams: totals[0], patients: totals[1], criticalEvents: totals[2] },
        alerts: { openCritical: alerts[0], devicesActive: alerts[1], doctorsActive: alerts[2] },
      }
    }, seedDashboard)
  }
}
