import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { StatsModule } from '../src/modules/stats/stats.module'
import { CacheService } from '../src/cache/cache.service'
import { PrismaService } from '../src/prisma/prisma.service'

// 空 DB mock → 触发确定性 seed 回退 (source: 'seed'), 无需真实数据库
const emptyPrisma = {
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  exam: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
  report: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
  criticalValue: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
  reportQualityScore: { findMany: jest.fn().mockResolvedValue([]) },
  patient: { count: jest.fn().mockResolvedValue(0) },
  device: { count: jest.fn().mockResolvedValue(0) },
  user: { count: jest.fn().mockResolvedValue(0) },
} as never

describe('Stats (e2e) — v3.0.6.11-73 真实聚合 + seed 回退', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [StatsModule],
    })
      .overrideProvider(CACHE_MANAGER)
      .useValue({ get: jest.fn().mockResolvedValue(null), set: jest.fn(), reset: jest.fn() })
      .overrideProvider(CacheService)
      .useValue({ get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined), reset: jest.fn().mockResolvedValue(undefined) })
      .overrideProvider(PrismaService)
      .useValue(emptyPrisma)
      .compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /stats/dashboard 返回 source+真实汇总结构 (无 Math.random)', async () => {
    const res = await request(app.getHttpServer()).get('/stats/dashboard')
    expect(res.status).toBe(200)
    expect(res.body.source).toBe('seed')
    expect(res.body.generatedAt).toBeDefined()
    expect(res.body.data).toHaveProperty('today')
    expect(res.body.data.today).toHaveProperty('exams')
    expect(res.body.data.today).toHaveProperty('reports')
    expect(res.body.data).toHaveProperty('totals')
    expect(res.body.data.totals).toHaveProperty('exams')
    expect(res.body.data).toHaveProperty('alerts')
    expect(res.body.data.alerts).toHaveProperty('openCritical')
    // 确定性: 两次请求结果一致
    const again = await request(app.getHttpServer()).get('/stats/dashboard')
    expect(again.body.data).toEqual(res.body.data)
  })

  it('GET /stats/daily 返回今日 KPI (seed 回退标注 source)', async () => {
    const res = await request(app.getHttpServer()).get('/stats/daily')
    expect(res.status).toBe(200)
    expect(res.body.source).toBe('seed')
    expect(res.body.data.examCount).toBeGreaterThan(0)
    expect(typeof res.body.data.reportCount).toBe('number')
    expect(typeof res.body.data.criticalCount).toBe('number')
    expect(res.body.data.byModality).toBeDefined()
  })

  it('GET /stats/weekly 返回近 7 天趋势', async () => {
    const res = await request(app.getHttpServer()).get('/stats/weekly')
    expect(res.status).toBe(200)
    expect(res.body.source).toBe('seed')
    expect(res.body.data.daily).toHaveLength(7)
    expect(res.body.data.totalExams).toBeGreaterThan(0)
  })

  it('GET /stats/workload 返回医生工作量数组', async () => {
    const res = await request(app.getHttpServer()).get('/stats/workload')
    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThan(0)
    expect(res.body.data[0]).toHaveProperty('doctorId')
    expect(res.body.data[0]).toHaveProperty('doctorName')
    expect(res.body.data[0]).toHaveProperty('reportCount')
  })

  it('GET /stats/quality 返回质控指标', async () => {
    const res = await request(app.getHttpServer()).get('/stats/quality')
    expect(res.status).toBe(200)
    expect(res.body.source).toBe('seed')
    expect(res.body.data.averageScore).toBeGreaterThan(0)
    expect(Array.isArray(res.body.data.byDoctor)).toBe(true)
    expect(Array.isArray(res.body.data.byModality)).toBe(true)
    expect(res.body.data.gradeDistribution).toBeDefined()
  })

  it('GET /stats/by-modality 返回按模态聚合对象', async () => {
    const res = await request(app.getHttpServer()).get('/stats/by-modality')
    expect(res.status).toBe(200)
    expect(res.body.source).toBe('seed')
    expect(res.body.data.CT).toBeDefined()
    expect(res.body.data.CT.total).toBeGreaterThan(0)
  })

  it('GET /stats/trend?days=30 返回 30 天趋势数组', async () => {
    const res = await request(app.getHttpServer()).get('/stats/trend?days=30')
    expect(res.status).toBe(200)
    expect(res.body.source).toBe('seed')
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data).toHaveLength(30)
    expect(res.body.data[0]).toHaveProperty('date')
    expect(res.body.data[0]).toHaveProperty('examCount')
    expect(res.body.data[0]).toHaveProperty('reportCount')
  })

  it('GET /stats/trend?days=999 将 days 限制在 90', async () => {
    const res = await request(app.getHttpServer()).get('/stats/trend?days=999')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(90)
  })
})
