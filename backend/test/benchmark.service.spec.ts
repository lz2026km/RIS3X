import { BenchmarkService } from '../src/modules/benchmark/benchmark.service'

describe('BenchmarkService', () => {
  let svc: BenchmarkService
  let mockCache: any

  beforeEach(() => {
    mockCache = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
    }
    svc = new BenchmarkService(mockCache)
  })

  it('getMetrics returns metric definitions', () => {
    const metrics = svc.getMetrics()
    expect(metrics).toHaveLength(5)
    expect(metrics[0]).toMatchObject({ code: 'exam_count', higherIsBetter: true })
  })

  it('compare returns delta between current and previous', async () => {
    const r = await svc.compare({ metricCode: 'positive_rate', timeRange: { start: '2026-01-01', end: '2026-06-30' }, compareMode: 'yoy' })
    expect(r.metricName).toBe('阳性率')
    expect(r.current).toBeGreaterThanOrEqual(60)
    expect(r.current).toBeLessThanOrEqual(98)
    expect(r.delta).toBe(r.current - r.previous)
    expect(r.deltaPercent).toBeGreaterThanOrEqual(0)
  })

  it('compare falls back to first metric for unknown code', async () => {
    const r = await svc.compare({ metricCode: 'nope', timeRange: { start: 'a', end: 'b' }, compareMode: 'qoq' })
    expect(r.metricName).toBe('检查量')
  })

  it('compare builds dept/site/time breakdowns', async () => {
    const dept = await svc.compare({ metricCode: 'exam_count', timeRange: { start: '2026-01-01', end: '2026-06-30' }, compareMode: 'yoy', dimension: 'dept' })
    expect(dept.breakdown).toHaveLength(5)
    const site = await svc.compare({ metricCode: 'exam_count', timeRange: { start: '2026-01-01', end: '2026-06-30' }, compareMode: 'yoy', dimension: 'site' })
    expect(site.breakdown).toHaveLength(5)
    const time = await svc.compare({ metricCode: 'exam_count', timeRange: { start: '2026-01-01', end: '2026-06-30' }, compareMode: 'yoy', dimension: 'time' })
    expect(time.breakdown).toHaveLength(12)
    expect(time.breakdown![0].label).toBe('2026-01')
  })

  it('crossSite builds value matrix for each site', async () => {
    const r = await svc.crossSite({ metricCodes: ['exam_count', 'positive_rate'], siteIds: ['s1', 's2'], timeRange: { start: 'a', end: 'b' } })
    expect(r).toHaveLength(2)
    expect(r[0].siteName).toBe('本院')
    expect(Object.keys(r[0].values)).toEqual(['exam_count', 'positive_rate'])
  })

  it('stats returns cached value when present', async () => {
    const cached = { totalExams: 100, positiveRate: 50, gradeARate: 90, reportOnTimeRate: 95, criticalClosedRate: 99, totalCases: 200 }
    mockCache.get.mockResolvedValue(cached)
    await expect(svc.stats()).resolves.toEqual(cached)
    expect(mockCache.set).not.toHaveBeenCalled()
  })

  it('stats computes and caches when cache empty', async () => {
    mockCache.get.mockResolvedValue(null)
    const stats = await svc.stats()
    expect(stats.totalExams).toBeGreaterThan(0)
    expect(stats.positiveRate).toBeGreaterThanOrEqual(30)
    expect(mockCache.set).toHaveBeenCalledWith('benchmark:stats', stats, 600)
  })
})
