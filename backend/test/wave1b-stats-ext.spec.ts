/**
 * [G005 Wave1B P1] Stats 3 扩展 spec — forecast / utilization / accuracy
 */
import { StatsService } from '../src/modules/stats/stats.service'

function failingCache(): any {
  return {
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(undefined),
  }
}

function failingPrisma(): any {
  return new Proxy(
    {},
    {
      get: () => () => {
        throw new Error('no db (verification stub)')
      },
    },
  )
}

describe('Wave1B Stats extensions', () => {
  it('forecast: 28 天序列 (14 实际 + 14 预测), 预测值 ≥ 0', async () => {
    const svc = new StatsService(failingCache(), failingPrisma())
    const points = await svc.getForecast({})
    expect(points).toHaveLength(28)
    const actuals = points.filter((p) => p.actual !== null)
    const forecasts = points.filter((p) => p.forecast !== null)
    expect(actuals.length).toBe(14)
    expect(forecasts.length).toBe(14)
    expect(forecasts.every((p) => p.forecast! >= 0)).toBe(true)
    expect(forecasts.every((p) => p.upper! >= p.forecast! && p.lower! <= p.forecast!)).toBe(true)
  })

  it('utilization: DB 失败时 seed 回退 (target=85)', async () => {
    const svc = new StatsService(failingCache(), failingPrisma())
    const res = await svc.getUtilization()
    expect(res.target).toBe(85)
    expect(res.current).toBeGreaterThan(0)
    expect(res.current).toBeLessThanOrEqual(100)
  })

  it('utilization: 设备用量聚合派生', async () => {
    const prisma: any = {
      device: {
        findMany: jest.fn().mockResolvedValue([
          { todayUsageMin: 480, state: 'IN_USE' },
          { todayUsageMin: 240, state: 'IDLE' },
          { todayUsageMin: 0, state: 'BROKEN' },
        ]),
      },
    }
    const svc = new StatsService(failingCache(), prisma)
    const res = await svc.getUtilization()
    // 2 台活跃设备, 720/960 分钟
    expect(res.current).toBeCloseTo(75, 1)
  })

  it('accuracy: DB 失败时 seed 回退', async () => {
    const svc = new StatsService(failingCache(), failingPrisma())
    const res = await svc.getAccuracy()
    expect(res.value).toBeGreaterThan(0)
    expect(res.previous).toBeGreaterThan(0)
  })

  it('accuracy: 质控评分合格率派生 (近30天 vs 更早)', async () => {
    const now = Date.now()
    const prisma: any = {
      reportQualityScore: {
        findMany: jest.fn().mockResolvedValue([
          { totalScore: 95, evaluatedAt: new Date(now - 10 * 86400000) },
          { totalScore: 90, evaluatedAt: new Date(now - 5 * 86400000) },
          { totalScore: 40, evaluatedAt: new Date(now - 3 * 86400000) },
          { totalScore: 85, evaluatedAt: new Date(now - 60 * 86400000) },
        ]),
      },
    }
    const svc = new StatsService(failingCache(), prisma)
    const res = await svc.getAccuracy()
    // 当前期 3 条中 2 条合格 = 66.7; 上期 1/1 = 100
    expect(res.value).toBeCloseTo(66.7, 0)
    expect(res.previous).toBe(100)
  })
})
