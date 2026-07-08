import { Test, TestingModule } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { StatsModule } from '../src/modules/stats/stats.module'

describe('Stats (e2e)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [StatsModule],
    }).compile()

    app = moduleFixture.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /stats/dashboard returns dashboard data', async () => {
    const res = await request(app.getHttpServer()).get('/stats/dashboard')
    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('qualityTrend')
    expect(res.body).toHaveProperty('workload')
    expect(res.body).toHaveProperty('timeliness')
    expect(res.body).toHaveProperty('accuracy')
  })

  it('GET /stats/dashboard qualityTrend has correct structure', async () => {
    const res = await request(app.getHttpServer()).get('/stats/dashboard')
    const trend = res.body.qualityTrend
    expect(Array.isArray(trend)).toBe(true)
    expect(trend.length).toBeGreaterThan(0)
    expect(trend[0]).toHaveProperty('date')
    expect(trend[0]).toHaveProperty('avgScore')
    expect(trend[0]).toHaveProperty('passRate')
  })

  it('GET /stats/dashboard workload has correct structure', async () => {
    const res = await request(app.getHttpServer()).get('/stats/dashboard')
    const wl = res.body.workload
    expect(Array.isArray(wl)).toBe(true)
    expect(wl.length).toBeGreaterThan(0)
    expect(wl[0]).toHaveProperty('doctor')
    expect(wl[0]).toHaveProperty('day')
    expect(wl[0]).toHaveProperty('hour')
    expect(wl[0]).toHaveProperty('count')
  })

  it('GET /stats/dashboard timeliness has correct structure', async () => {
    const res = await request(app.getHttpServer()).get('/stats/dashboard')
    const tl = res.body.timeliness
    expect(Array.isArray(tl)).toBe(true)
    expect(tl.length).toBeGreaterThan(0)
    expect(tl[0]).toHaveProperty('name')
    expect(tl[0]).toHaveProperty('onTime')
    expect(tl[0]).toHaveProperty('late')
  })

  it('GET /stats/dashboard accuracy has correct structure', async () => {
    const res = await request(app.getHttpServer()).get('/stats/dashboard')
    const acc = res.body.accuracy
    expect(acc).toHaveProperty('data')
    expect(acc).toHaveProperty('overallRate')
    expect(acc).toHaveProperty('totalCases')
    expect(Array.isArray(acc.data)).toBe(true)
  })
})
