import { Injectable, Logger } from '@nestjs/common'
import { CacheService } from '../../cache/cache.service'

export interface MetricDef {
  code: string
  name: string
  unit: string
  higherIsBetter: boolean
}

export interface CompareRequest {
  metricCode: string
  timeRange: { start: string; end: string }
  compareMode: 'yoy' | 'qoq'
  dimension?: 'dept' | 'site' | 'time'
  dimensionValues?: string[]
}

export interface CompareResult {
  metricName: string
  current: number
  previous: number
  delta: number
  deltaPercent: number
  breakdown?: { label: string; current: number; previous: number }[]
}

export interface CrossSiteRequest {
  metricCodes: string[]
  siteIds: string[]
  timeRange: { start: string; end: string }
}

export interface CrossSiteResult {
  siteId: string
  siteName: string
  values: Record<string, number>
}

export interface StatsSummary {
  totalExams: number
  positiveRate: number
  gradeARate: number
  reportOnTimeRate: number
  criticalClosedRate: number
  totalCases: number
}

const METRICS: MetricDef[] = [
  { code: 'exam_count', name: '检查量', unit: '例', higherIsBetter: true },
  { code: 'positive_rate', name: '阳性率', unit: '%', higherIsBetter: false },
  { code: 'grade_a_rate', name: '甲级片率', unit: '%', higherIsBetter: true },
  { code: 'report_ontime_rate', name: '报告及时率', unit: '%', higherIsBetter: true },
  { code: 'critical_closed_rate', name: '危急值闭环率', unit: '%', higherIsBetter: true },
]

const SITES = ['本院', '东院区', '西院区', '南院区', '北院区']
const DEPTS = ['放射科', 'CT室', 'MR室', '超声科', '核医学科']

function rand(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100
}

@Injectable()
export class BenchmarkService {
  private readonly logger = new Logger(BenchmarkService.name)
  constructor(private readonly cache: CacheService) {}

  getMetrics(): MetricDef[] {
    return METRICS
  }

  async compare(req: CompareRequest): Promise<CompareResult> {
    const metric = METRICS.find((m) => m.code === req.metricCode) ?? METRICS[0]!
    const current = rand(60, 98)
    const previous = rand(50, current)
    const delta = current - previous
    const deltaPercent = previous > 0 ? Math.round((delta / previous) * 10000) / 100 : 0

    const result: CompareResult = {
      metricName: metric.name,
      current,
      previous,
      delta,
      deltaPercent,
    }

    if (req.dimension === 'dept') {
      result.breakdown = DEPTS.map((d) => ({
        label: d,
        current: rand(55, 99),
        previous: rand(50, 95),
      }))
    } else if (req.dimension === 'site') {
      result.breakdown = SITES.map((s) => ({
        label: s,
        current: rand(55, 99),
        previous: rand(50, 95),
      }))
    } else if (req.dimension === 'time') {
      const months = 12
      result.breakdown = Array.from({ length: months }, (_, i) => {
        const d = new Date(req.timeRange.start)
        d.setMonth(d.getMonth() + i)
        return {
          label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
          current: rand(55, 99),
          previous: rand(50, 95),
        }
      })
    }

    return result
  }

  async crossSite(req: CrossSiteRequest): Promise<CrossSiteResult[]> {
    return req.siteIds.map((siteId, i) => ({
      siteId,
      siteName: SITES[i] ?? `院区${siteId}`,
      values: Object.fromEntries(
        req.metricCodes.map((code) => [code, rand(50, 100)]),
      ),
    }))
  }

  async stats(): Promise<StatsSummary> {
    const cached = await this.cache.get<StatsSummary>('benchmark:stats')
    if (cached) return cached
    const data: StatsSummary = {
      totalExams: Math.round(Math.random() * 5000 + 3000),
      positiveRate: rand(30, 60),
      gradeARate: rand(85, 98),
      reportOnTimeRate: rand(88, 99),
      criticalClosedRate: rand(90, 100),
      totalCases: Math.round(Math.random() * 8000 + 2000),
    }
    await this.cache.set('benchmark:stats', data, 600)
    return data
  }
}
