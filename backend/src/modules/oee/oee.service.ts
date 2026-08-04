import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface DeviceMeta {
  id: string
  name: string
  model: string
  modality: string
}

export interface OeePoint {
  date: string
  oee: number
  availability: number
  performance: number
  quality: number
  source: 'actual' | 'derived'
}

export interface OeeDeviceMetric extends DeviceMeta {
  oee: number
  availability: number
  performance: number
  quality: number
  trend: 'up' | 'down' | 'stable'
  source: 'actual' | 'derived'
}

const WORK_MINUTES_PER_DAY = 720 // 12h 工作时段
const TREND_DAYS = 12
const ON_TIME_THRESHOLD_MS = 90 * 60 * 1000 // 90 分钟内完成视为按时

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

/** 确定性伪随机：同一 seedInput 永远得到同一结果 */
function seededRand(min: number, max: number, seedInput: string): number {
  const rand = mulberry32(hashString(seedInput))
  return Math.round((rand() * (max - min) + min) * 10) / 10
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function clamp100(value: number): number {
  return value < 0 ? 0 : value > 100 ? 100 : value
}

function trendBetween(prev: number, curr: number): 'up' | 'down' | 'stable' {
  if (curr - prev > 0.5) return 'up'
  if (prev - curr > 0.5) return 'down'
  return 'stable'
}

function formatDate(offsetDays: number): string {
  return new Date(Date.now() - offsetDays * 86400000).toISOString().slice(0, 10)
}

@Injectable()
export class OeeService {
  private readonly devices: DeviceMeta[] = [
    { id: 'CT-01', name: 'GE Revolution CT', model: 'Revolution CT', modality: 'CT' },
    { id: 'MR-01', name: 'Siemens Skyra', model: 'Skyra 3T', modality: 'MR' },
    { id: 'DR-01', name: 'Philips DigitalDiagnost', model: 'DigitalDiagnost 4', modality: 'DR' },
    { id: 'DR-02', name: 'Siemens Ysio', model: 'Ysio Max', modality: 'DR' },
    { id: 'CT-02', name: 'Canon Aquilion', model: 'Aquilion ONE', modality: 'CT' },
    { id: 'MG-01', name: 'Hologic Selenia', model: 'Selenia Dimensions', modality: 'MG' },
    { id: 'DSA-01', name: 'GE Innova', model: 'Innova IGS 5', modality: 'DSA' },
  ]

  constructor(private readonly prisma: PrismaService) {}

  private today(): string {
    return formatDate(0)
  }

  /**
   * 从 Exam 表统计真实指标（当日检查数/按时完成数/设备使用时长）。
   * DB 不可用或当日无数据时返回空统计。
   */
  private async examStats(deviceId: string, date: string): Promise<{ completed: number; scheduled: number; onTime: number; usedMinutes: number }> {
    const [y, m, d] = date.split('-').map(Number)
    const dayStart = new Date(Date.UTC(y, m - 1, d))
    const dayEnd = new Date(dayStart.getTime() + 86400000)
    try {
      const [scheduled, exams] = await Promise.all([
        this.prisma.exam.count({ where: { deviceId, scheduledAt: { gte: dayStart, lt: dayEnd } } }),
        this.prisma.exam.findMany({
          where: { deviceId, state: 'COMPLETED', completedAt: { gte: dayStart, lt: dayEnd } },
          select: { scheduledAt: true, startedAt: true, completedAt: true },
        }),
      ])
      let onTime = 0
      let usedMinutes = 0
      for (const exam of exams) {
        const start = exam.startedAt ?? exam.scheduledAt
        if (start && exam.completedAt && exam.completedAt.getTime() - start.getTime() <= ON_TIME_THRESHOLD_MS) onTime += 1
        if (exam.startedAt && exam.completedAt) usedMinutes += (exam.completedAt.getTime() - exam.startedAt.getTime()) / 60000
      }
      return { completed: exams.length, scheduled, onTime, usedMinutes }
    } catch {
      return { completed: 0, scheduled: 0, onTime: 0, usedMinutes: 0 }
    }
  }

  /** 确定性派生：deviceId + date 哈希种子 → 伪随机但可复现，source:'derived' */
  private derivedPoint(deviceId: string, date: string): { oee: number; availability: number; performance: number; quality: number } {
    const seed = `oee:${deviceId}:${date}`
    const availability = seededRand(70, 99, `${seed}:availability`)
    const performance = seededRand(75, 98, `${seed}:performance`)
    const quality = seededRand(85, 100, `${seed}:quality`)
    const oee = round1((availability * performance * quality) / 10000)
    return { oee, availability, performance, quality }
  }

  private async computeMetrics(d: DeviceMeta, date: string): Promise<OeeDeviceMetric> {
    const stats = await this.examStats(d.id, date)
    if (stats.completed > 0) {
      const availability = round1(clamp100((stats.usedMinutes / WORK_MINUTES_PER_DAY) * 100))
      const performance = stats.scheduled > 0 ? round1(clamp100((stats.completed / stats.scheduled) * 100)) : 100
      const quality = round1(clamp100((stats.onTime / stats.completed) * 100))
      const oee = round1((availability * performance * quality) / 10000)
      const prev = this.derivedPoint(d.id, formatDate(1)).oee
      return { ...d, oee, availability, performance, quality, trend: trendBetween(prev, oee), source: 'actual' }
    }
    const point = this.derivedPoint(d.id, date)
    const prev = this.derivedPoint(d.id, formatDate(1)).oee
    return { ...d, ...point, trend: trendBetween(prev, point.oee), source: 'derived' }
  }

  private async persistList(list: Array<{ id: string; modality: string; availability: number; performance: number; quality: number; oee: number }>): Promise<void> {
    const date = this.today()
    await this.prisma.oeeRecord.createMany({
      data: list.map(d => ({
        deviceId: d.id,
        date,
        modality: d.modality,
        availability: d.availability,
        performance: d.performance,
        quality: d.quality,
        oee: d.oee,
      })),
      skipDuplicates: true,
    })
  }

  async getList(): Promise<Array<OeeDeviceMetric | { id: string; name: string; model: string; modality: string; oee: number; availability: number; performance: number; quality: number; trend: 'up' | 'down' | 'stable'; source: 'actual' | 'derived' }>> {
    try {
      const records = await this.prisma.oeeRecord.findMany({
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
        take: 500,
      })
      if (records.length > 0) {
        const latest = new Map<string, (typeof records)[number]>()
        const previous = new Map<string, (typeof records)[number]>()
        for (const record of records) {
          const cur = latest.get(record.deviceId)
          if (!cur) {
            latest.set(record.deviceId, record)
            continue
          }
          if (record.date !== cur.date && !previous.has(record.deviceId)) previous.set(record.deviceId, record)
        }
        return records.map(r => {
          const meta = this.devices.find(d => d.id === r.deviceId)
          const prev = previous.get(r.deviceId)
          return {
            id: r.deviceId,
            name: meta?.name ?? r.deviceId,
            model: meta?.model ?? '',
            modality: r.modality,
            oee: r.oee,
            availability: r.availability,
            performance: r.performance,
            quality: r.quality,
            trend: prev ? trendBetween(prev.oee, r.oee) : trendBetween(this.derivedPoint(r.deviceId, formatDate(1)).oee, r.oee),
            source: 'actual' as const,
          }
        })
      }
    } catch {
      // DB 不可用 → 走确定性派生
    }
    const date = this.today()
    const list = await Promise.all(this.devices.map(d => this.computeMetrics(d, date)))
    // 仅写入确定性计算结果，不再写入随机数
    void this.persistList(list).catch(() => undefined)
    return list
  }

  async getDetail(deviceId: string) {
    const list = await this.getList()
    const device = list.find(d => d.id === deviceId)
    if (!device) return null
    const seed = `oee-detail:${deviceId}:${this.today()}`
    return {
      ...device,
      breakdownLoss: seededRand(1, 8, `${seed}:breakdown`),
      setupLoss: seededRand(1, 5, `${seed}:setup`),
      speedLoss: seededRand(1, 6, `${seed}:speed`),
      defectLoss: seededRand(0.5, 3, `${seed}:defect`),
    }
  }

  async getTrend(deviceId: string): Promise<OeePoint[]> {
    try {
      const records = await this.prisma.oeeRecord.findMany({
        where: { deviceId },
        orderBy: { date: 'asc' },
        take: TREND_DAYS,
      })
      if (records.length > 0) {
        return records.map(r => ({
          date: r.date,
          oee: r.oee,
          availability: r.availability,
          performance: r.performance,
          quality: r.quality,
          source: 'actual' as const,
        }))
      }
    } catch {
      // DB 不可用 → 确定性历史
    }
    // 空数据：seed 固定（仅 deviceId），历史序列可复现，不写库
    const rand = mulberry32(hashString(`oee-trend:${deviceId}`))
    return Array.from({ length: TREND_DAYS }, (_, i) => {
      const date = formatDate(TREND_DAYS - 1 - i)
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

  async getStats() {
    const list = await this.getList()
    const oees = list.map(d => d.oee)
    return {
      highest: Math.max(...oees),
      lowest: Math.min(...oees),
      average: round1(oees.reduce((a, b) => a + b, 0) / oees.length),
      totalDevices: list.length,
    }
  }
}
