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

// ===== [W10E-3] 扩展端点 DTO (OEE 总览 / 按模态对比 / 30日趋势 / 停机分析) =====

export interface OeeOverviewDto {
  date: string
  avgOee: number
  avgAvailability: number
  avgPerformance: number
  avgQuality: number
  totalDevices: number
  totalModalities: number
  bestDevice: { id: string; name: string; oee: number } | null
  worstDevice: { id: string; name: string; oee: number } | null
  byModality: Array<{ modality: string; devices: number; oee: number }>
  seeded: boolean
}

export interface OeeModalityDto {
  modality: string
  deviceCount: number
  avgOee: number
  avgAvailability: number
  avgPerformance: number
  avgQuality: number
  bestDevice: string
  worstDevice: string
}

export interface OeeDailyTrendPoint {
  date: string
  label: string
  oee: number
  availability: number
  performance: number
  quality: number
  devices: number
  seeded: boolean
}

export interface DowntimeReasonDto {
  reason: string
  reasonZh: string
  durationMinutes: number
  durationHours: number
  percent: number
}

export interface DowntimeAnalysisDto {
  deviceId: string
  deviceName: string
  modality: string
  date: string
  totalDowntimeMinutes: number
  plannedMinutes: number
  unplannedMinutes: number
  reasons: DowntimeReasonDto[]
  seeded: boolean
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

  // ================= [W10E-3] 扩展: OEE 总览 / 按模态对比 / 30日趋势 / 停机分析 =================

  async getOverview(): Promise<OeeOverviewDto> {
    const list = await this.getList()
    const seeded = list.length > 0 && list.every(d => d.source === 'derived')
    const avg = (key: 'oee' | 'availability' | 'performance' | 'quality') =>
      list.length > 0 ? round1(list.reduce((a, d) => a + d[key], 0) / list.length) : 0
    const sorted = [...list].sort((a, b) => b.oee - a.oee)
    const byModality = new Map<string, { modality: string; devices: number; oeeSum: number }>()
    for (const d of list) {
      const m = byModality.get(d.modality) ?? { modality: d.modality, devices: 0, oeeSum: 0 }
      m.devices += 1
      m.oeeSum += d.oee
      byModality.set(d.modality, m)
    }
    const best = sorted[0]
    const worst = sorted.length > 0 ? sorted[sorted.length - 1] : undefined
    return {
      date: this.today(),
      avgOee: avg('oee'),
      avgAvailability: avg('availability'),
      avgPerformance: avg('performance'),
      avgQuality: avg('quality'),
      totalDevices: list.length,
      totalModalities: byModality.size,
      bestDevice: best ? { id: best.id, name: best.name, oee: best.oee } : null,
      worstDevice: worst ? { id: worst.id, name: worst.name, oee: worst.oee } : null,
      byModality: Array.from(byModality.values()).map(m => ({
        modality: m.modality,
        devices: m.devices,
        oee: round1(m.oeeSum / m.devices),
      })),
      seeded,
    }
  }

  async getByModality(): Promise<OeeModalityDto[]> {
    const list = await this.getList()
    const map = new Map<string, {
      modality: string
      oee: number[]
      availability: number[]
      performance: number[]
      quality: number[]
      devices: Array<{ id: string; name: string; oee: number }>
    }>()
    for (const d of list) {
      const m = map.get(d.modality) ?? { modality: d.modality, oee: [], availability: [], performance: [], quality: [], devices: [] }
      m.oee.push(d.oee)
      m.availability.push(d.availability)
      m.performance.push(d.performance)
      m.quality.push(d.quality)
      m.devices.push({ id: d.id, name: d.name, oee: d.oee })
      map.set(d.modality, m)
    }
    const average = (arr: number[]) => (arr.length > 0 ? round1(arr.reduce((a, b) => a + b, 0) / arr.length) : 0)
    return Array.from(map.values())
      .map(m => ({
        modality: m.modality,
        deviceCount: m.oee.length,
        avgOee: average(m.oee),
        avgAvailability: average(m.availability),
        avgPerformance: average(m.performance),
        avgQuality: average(m.quality),
        bestDevice: [...m.devices].sort((a, b) => b.oee - a.oee)[0]?.name ?? '',
        worstDevice: [...m.devices].sort((a, b) => a.oee - b.oee)[0]?.name ?? '',
      }))
      .sort((a, b) => b.avgOee - a.avgOee)
  }

  async getDailyTrend(days = 30): Promise<OeeDailyTrendPoint[]> {
    const count = Math.max(1, Math.min(Math.round(days) || 30, 60))
    const start = formatDate(count - 1)
    try {
      const records = await this.prisma.oeeRecord.findMany({
        where: { date: { gte: start } },
        orderBy: { date: 'asc' },
        take: 5000,
      })
      if (records.length > 0) {
        const byDate = new Map<string, { oee: number[]; availability: number[]; performance: number[]; quality: number[]; devices: Set<string> }>()
        for (const r of records) {
          const e = byDate.get(r.date) ?? { oee: [], availability: [], performance: [], quality: [], devices: new Set<string>() }
          e.oee.push(r.oee)
          e.availability.push(r.availability)
          e.performance.push(r.performance)
          e.quality.push(r.quality)
          e.devices.add(r.deviceId)
          byDate.set(r.date, e)
        }
        const avg = (arr: number[]) => (arr.length > 0 ? round1(arr.reduce((a, b) => a + b, 0) / arr.length) : 0)
        return Array.from({ length: count }, (_, i) => {
          const d = formatDate(count - 1 - i)
          const e = byDate.get(d)
          if (!e) return { date: d, label: d.slice(5), oee: 0, availability: 0, performance: 0, quality: 0, devices: 0, seeded: false }
          return {
            date: d,
            label: d.slice(5),
            oee: avg(e.oee),
            availability: avg(e.availability),
            performance: avg(e.performance),
            quality: avg(e.quality),
            devices: e.devices.size,
            seeded: false,
          }
        })
      }
    } catch {
      // DB 不可用 → 确定性趋势 (seed 固定, 可复现)
    }
    return Array.from({ length: count }, (_, i) => {
      const d = formatDate(count - 1 - i)
      const availability = seededRand(72, 96, `oee-trend-all:${d}:availability`)
      const performance = seededRand(76, 97, `oee-trend-all:${d}:performance`)
      const quality = seededRand(86, 100, `oee-trend-all:${d}:quality`)
      return {
        date: d,
        label: d.slice(5),
        oee: round1((availability * performance * quality) / 10000),
        availability,
        performance,
        quality,
        devices: this.devices.length,
        seeded: true,
      }
    })
  }

  async getDowntimeAnalysis(deviceId: string): Promise<DowntimeAnalysisDto | null> {
    const list = await this.getList()
    const device = list.find(d => d.id === deviceId)
    if (!device) return null
    const seed = `oee-downtime:${deviceId}:${this.today()}`
    const totalDowntimeMinutes = Math.round((WORK_MINUTES_PER_DAY * (100 - device.availability)) / 100)
    const definitions: Array<{ reason: string; reasonZh: string }> = [
      { reason: 'breakdown', reasonZh: '设备故障停机' },
      { reason: 'setup', reasonZh: '摆位与换床准备' },
      { reason: 'speed', reasonZh: '扫描速度损失' },
      { reason: 'defect', reasonZh: '图像质量缺陷重拍' },
    ]
    const weights = definitions.map(d => seededRand(1, 6, `${seed}:weight:${d.reason}`))
    const weightSum = weights.reduce((a, b) => a + b, 0)
    let percentSum = 0
    let durationSum = 0
    const reasons: DowntimeReasonDto[] = definitions.map((d, i) => {
      const rounded = Math.round((totalDowntimeMinutes * weights[i]) / weightSum)
      const durationMinutes = i === definitions.length - 1 ? Math.max(0, totalDowntimeMinutes - durationSum) : rounded
      durationSum += durationMinutes
      const percent = totalDowntimeMinutes > 0 ? Math.round((durationMinutes / totalDowntimeMinutes) * 100) : 0
      const adjusted = i === definitions.length - 1 ? Math.max(0, 100 - percentSum) : percent
      percentSum += adjusted
      return {
        reason: d.reason,
        reasonZh: d.reasonZh,
        durationMinutes,
        durationHours: round1(durationMinutes / 60),
        percent: adjusted,
      }
    })
    const plannedMinutes = reasons[1]!.durationMinutes + reasons[2]!.durationMinutes
    return {
      deviceId,
      deviceName: device.name,
      modality: device.modality,
      date: this.today(),
      totalDowntimeMinutes,
      plannedMinutes,
      unplannedMinutes: totalDowntimeMinutes - plannedMinutes,
      reasons,
      seeded: device.source === 'derived',
    }
  }
}
