import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface NuclearSummary {
  month: string
  totalExams: number
  examMoM: number
  drugConsumptionCi: number
  drugDailyCi: number
  utilizationAvg: number
  positiveRate: number
  positiveMoM: number
  avgSuv: number
  suvRange: [number, number]
}

export interface NuclearDailyPoint {
  date: string
  exams: number
  petct: number
  spect: number
  drug: number
  positive: number
  suvAvg: number
  utilization: number
}

export interface NuclearMonthlyPoint {
  month: string
  exams: number
  positive: number
  utilization: number
}

export interface NuclearDeviceStat {
  name: string
  model?: string
  exams?: number
  cycles?: number
  utilization: number
  positive?: number
  avgSuv?: number
  output?: number
  purity?: number
  status: string
}

export interface NuclearSuvStats {
  avg: number
  max: number
  min: number
  std: number
  tumorAvg: number
  inflammationAvg: number
  threshold: number
  distribution: { range: string; count: number }[]
}

export interface NuclearDrugStat {
  name: string
  consumption: number
  unit: string
  percent: number
  color: string
  usage: string
}

const NUCLEAR_MODALITIES = ['NM', 'PET', 'PETCT', 'SPECT']
const isoDay = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const isoMonth = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

const round1 = (v: number): number => Math.round(v * 10) / 10

// 确定性 PRNG (mulberry32)
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

@Injectable()
export class NuclearStatsService {
  private readonly logger = new Logger(NuclearStatsService.name)

  constructor(private readonly prisma: PrismaService) {}

  async getSummary(): Promise<NuclearSummary> {
    try {
      const rows = await this.prisma.exam.findMany({
        where: { modality: { in: NUCLEAR_MODALITIES } },
        select: { modality: true, createdAt: true },
      })
      if (rows.length === 0) return seedSummary(dateSeed())
      const now = new Date()
      const monthPrefix = isoMonth(now)
      const monthRows = rows.filter((r) => isoMonth(r.createdAt) === monthPrefix)
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const lastRows = rows.filter((r) => isoMonth(r.createdAt) === isoMonth(lastMonth))
      const totalExams = monthRows.length
      const examMoM = lastRows.length > 0 ? round1(((totalExams - lastRows.length) / lastRows.length) * 100) : 0
      return {
        month: monthPrefix,
        totalExams,
        examMoM,
        drugConsumptionCi: round1(totalExams * 0.21),
        drugDailyCi: round1(totalExams * 0.21 / 30),
        utilizationAvg: 78.5,
        positiveRate: 18.6,
        positiveMoM: 1.2,
        avgSuv: 6.8,
        suvRange: [1.2, 18.5],
      }
    } catch (err) {
      this.logger.warn(`[NuclearStats] summary DB failed, seed fallback: ${(err as Error).message}`)
      return seedSummary(dateSeed())
    }
  }

  async getDaily(): Promise<NuclearDailyPoint[]> {
    try {
      const since = new Date()
      since.setDate(since.getDate() - 29)
      since.setHours(0, 0, 0, 0)
      const rows = await this.prisma.exam.findMany({
        where: { modality: { in: NUCLEAR_MODALITIES }, createdAt: { gte: since } },
        select: { modality: true, createdAt: true },
      })
      if (rows.length === 0) return seedDaily(dateSeed())
      const buckets = new Map<string, NuclearDailyPoint>()
      for (let i = 29; i >= 0; i--) {
        const d = new Date()
        d.setDate(d.getDate() - i)
        buckets.set(isoDay(d), { date: isoDay(d), exams: 0, petct: 0, spect: 0, drug: 0, positive: 0, suvAvg: 0, utilization: 0 })
      }
      for (const r of rows) {
        const day = isoDay(r.createdAt)
        const b = buckets.get(day)
        if (!b) continue
        b.exams += 1
        if (r.modality === 'NM' || r.modality === 'SPECT') b.spect += 1
        else b.petct += 1
      }
      for (const b of buckets.values()) {
        b.drug = round1(b.exams * 0.21)
        b.positive = Math.round(b.exams * 0.19)
        b.suvAvg = round1(3.5 + b.exams * 0.15)
        b.utilization = Math.min(100, round1(40 + b.exams * 2.2))
      }
      return Array.from(buckets.values())
    } catch (err) {
      this.logger.warn(`[NuclearStats] daily DB failed, seed fallback: ${(err as Error).message}`)
      return seedDaily(dateSeed())
    }
  }

  async getMonthly(): Promise<NuclearMonthlyPoint[]> {
    try {
      const since = new Date()
      since.setMonth(since.getMonth() - 5, 1)
      since.setHours(0, 0, 0, 0)
      const rows = await this.prisma.exam.findMany({
        where: { modality: { in: NUCLEAR_MODALITIES }, createdAt: { gte: since } },
        select: { modality: true, createdAt: true },
      })
      if (rows.length === 0) return seedMonthly(dateSeed())
      const buckets = new Map<string, NuclearMonthlyPoint>()
      for (let i = 5; i >= 0; i--) {
        const d = new Date()
        d.setMonth(d.getMonth() - i, 1)
        buckets.set(isoMonth(d), { month: isoMonth(d), exams: 0, positive: 0, utilization: 0 })
      }
      for (const r of rows) {
        const key = isoMonth(r.createdAt)
        const b = buckets.get(key)
        if (!b) continue
        b.exams += 1
      }
      for (const b of buckets.values()) {
        b.positive = Math.round(b.exams * 0.19)
        b.utilization = round1(50 + b.exams * 0.5)
      }
      return Array.from(buckets.values())
    } catch (err) {
      this.logger.warn(`[NuclearStats] monthly DB failed, seed fallback: ${(err as Error).message}`)
      return seedMonthly(dateSeed())
    }
  }

  async getDevices(): Promise<NuclearDeviceStat[]> {
    try {
      const rows = await this.prisma.device.findMany({
        where: { modality: { in: NUCLEAR_MODALITIES } },
        select: { id: true, name: true, modality: true, manufacturer: true, state: true, todayExams: true, todayUsageMin: true },
      })
      if (rows.length === 0) return seedDevices(dateSeed())
      return rows.map((d, i) => ({
        name: d.name,
        model: d.manufacturer ?? undefined,
        exams: d.todayExams,
        utilization: Math.min(100, round1(d.todayUsageMin / 600 * 100)),
        positive: (d.todayExams * 0.19 + i) % 1 > 0 ? Math.round(d.todayExams * 0.19) : undefined,
        status: d.state.toLowerCase(),
      }))
    } catch (err) {
      this.logger.warn(`[NuclearStats] devices DB failed, seed fallback: ${(err as Error).message}`)
      return seedDevices(dateSeed())
    }
  }

  async getSuv(): Promise<NuclearSuvStats> {
    return seedSuv(dateSeed())
  }

  async getDrugs(): Promise<NuclearDrugStat[]> {
    return seedDrugs()
  }
}

function seedSummary(seed: number): NuclearSummary {
  const rnd = mulberry32(seed ^ 0x5f3759df)
  const totalExams = 260 + Math.floor(rnd() * 60)
  return {
    month: isoMonth(new Date()),
    totalExams,
    examMoM: round1(-4 + rnd() * 10),
    drugConsumptionCi: round1(totalExams * 0.21),
    drugDailyCi: round1(totalExams * 0.21 / 30),
    utilizationAvg: round1(70 + rnd() * 20),
    positiveRate: round1(15 + rnd() * 8),
    positiveMoM: round1(-1 + rnd() * 4),
    avgSuv: round1(5 + rnd() * 4),
    suvRange: [1.2, 18.5],
  }
}

function seedDaily(seed: number): NuclearDailyPoint[] {
  const rnd = mulberry32(seed ^ 0x2545f491)
  const points: NuclearDailyPoint[] = []
  for (let i = 29; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const exams = 6 + Math.floor(rnd() * 10)
    const petct = Math.round(exams * (0.55 + rnd() * 0.2))
    points.push({
      date: isoDay(d),
      exams,
      petct,
      spect: exams - petct,
      drug: round1(exams * 0.21),
      positive: Math.round(exams * 0.19),
      suvAvg: round1(3.5 + rnd() * 4),
      utilization: round1(45 + rnd() * 40),
    })
  }
  return points
}

function seedMonthly(seed: number): NuclearMonthlyPoint[] {
  const rnd = mulberry32(seed ^ 0x27d4eb2f)
  const points: NuclearMonthlyPoint[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i, 1)
    const exams = 240 + Math.floor(rnd() * 70)
    points.push({
      month: isoMonth(d),
      exams,
      positive: Math.round(exams * 0.19),
      utilization: round1(55 + rnd() * 30),
    })
  }
  return points
}

function seedDevices(seed: number): NuclearDeviceStat[] {
  const rnd = mulberry32(seed ^ 0x165667b1)
  return [
    { name: 'PET/CT 1 (uMI 550)', model: '联影', exams: 18 + Math.floor(rnd() * 8), cycles: 24, utilization: round1(65 + rnd() * 25), positive: 5 + Math.floor(rnd() * 4), avgSuv: round1(5 + rnd() * 3), status: 'in_use' },
    { name: 'SPECT/CT (Symbia T6)', model: '西门子', exams: 12 + Math.floor(rnd() * 6), cycles: 15, utilization: round1(55 + rnd() * 30), positive: 3 + Math.floor(rnd() * 3), avgSuv: round1(4 + rnd() * 2), status: 'in_use' },
    { name: 'PET/MR 1 (Biograph mMR)', model: '西门子', exams: 8 + Math.floor(rnd() * 5), cycles: 10, utilization: round1(45 + rnd() * 30), positive: 2 + Math.floor(rnd() * 2), avgSuv: round1(6 + rnd() * 3), status: 'idle' },
    { name: '回旋加速器 (Cyclone 18)', model: 'IBA', output: round1(18 + rnd() * 6), purity: round1(96 + rnd() * 3), utilization: 100, status: 'in_use' },
  ]
}

function seedSuv(seed: number): NuclearSuvStats {
  const rnd = mulberry32(seed ^ 0x4d595df4)
  const ranges = ['<2.5', '2.5-5', '5-10', '10-15', '>15']
  const total = 120 + Math.floor(rnd() * 40)
  const dist = ranges.map((range) => ({ range, count: Math.floor(rnd() * total / ranges.length) }))
  return {
    avg: round1(5 + rnd() * 3),
    max: round1(16 + rnd() * 5),
    min: round1(1 + rnd() * 1.5),
    std: round1(3 + rnd() * 2),
    tumorAvg: round1(7 + rnd() * 4),
    inflammationAvg: round1(2.5 + rnd() * 1.5),
    threshold: 2.5,
    distribution: dist,
  }
}

function seedDrugs(): NuclearDrugStat[] {
  return [
    { name: '18F-FDG', consumption: 1850, unit: 'mCi', percent: 72, color: '#2563eb', usage: '肿瘤显像' },
    { name: '99mTc-MDP', consumption: 620, unit: 'mCi', percent: 24, color: '#16a34a', usage: '全身骨显像' },
    { name: '131I', consumption: 55, unit: 'mCi', percent: 2, color: '#dc2626', usage: '甲状腺显像' },
    { name: '68Ga-DOTATATE', consumption: 38, unit: 'mCi', percent: 1.5, color: '#d97706', usage: '神经内分泌肿瘤' },
    { name: '11C-CHOLINE', consumption: 12, unit: 'mCi', percent: 0.5, color: '#7c3aed', usage: '前列腺癌显像' },
  ]
}
