/**
 * [G005 W9-QC] 2024 国标 40 指标计算引擎 spec
 */
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { QualityIndicatorsService } from './quality-indicators.service'
import { QualityIndicatorsController } from './quality-indicators.controller'
import { aggregateCategories, buildQiSeedDataset, computeQiIndicators, resolveQiWindow } from './quality-indicators.engine'
import { QUALITY_INDICATORS } from './quality-indicators.data'

describe('QualityIndicators 计算引擎', () => {
  it('seed 数据集覆盖报告/检查/危急值/设备', () => {
    const ds = buildQiSeedDataset()
    expect(ds.reports.length).toBeGreaterThan(200)
    expect(ds.exams.length).toBeGreaterThan(200)
    expect(ds.criticals.length).toBeGreaterThan(0)
    expect(ds.devices.length).toBe(4)
  })

  it('计算 40 条指标: 分类计数完整 + 部分可计算', () => {
    const ds = buildQiSeedDataset()
    const w = resolveQiWindow(ds, '2026-08')
    const indicators = computeQiIndicators(ds, QUALITY_INDICATORS, w)
    expect(indicators).toHaveLength(40)
    const computable = indicators.filter((i) => i.computable)
    expect(computable.length).toBeGreaterThanOrEqual(15)
    const agg = aggregateCategories(indicators)
    expect(agg).toHaveLength(3)
    expect(agg.reduce((a, c) => a + c.total, 0)).toBe(40)
  })

  it('可计算指标分母 > 0 且比率有效', () => {
    const ds = buildQiSeedDataset()
    const w = resolveQiWindow(ds, '2026-08')
    const indicators = computeQiIndicators(ds, QUALITY_INDICATORS, w)
    for (const i of indicators.filter((x) => x.computable)) {
      expect(Number.isFinite(i.rate)).toBe(true)
      expect(i.denominator).toBeGreaterThan(0)
    }
  })

  it('计算确定性: 同输入同输出', () => {
    const ds = buildQiSeedDataset()
    const w = resolveQiWindow(ds, '2026-08')
    const a = computeQiIndicators(ds, QUALITY_INDICATORS, w)
    const b = computeQiIndicators(ds, QUALITY_INDICATORS, w)
    expect(a.map((i) => i.rate)).toEqual(b.map((i) => i.rate))
  })
})

describe('QualityIndicatorsService compute/dashboard (无 DB seed)', () => {
  let service: QualityIndicatorsService

  beforeEach(() => {
    service = new QualityIndicatorsService()
  })

  it('compute 返回 40 指标快照并持久化', async () => {
    const res = await service.compute('2026-08')
    expect(res.source).toBe('seed')
    expect(res.snapshot.indicators).toHaveLength(40)
    expect(res.snapshot.persisted).toBe(true)
    expect(service.listSnapshots().length).toBe(1)
  })

  it('dashboard 聚合通过率与分类', async () => {
    const dash = await service.computeDashboard('2026-08')
    expect(dash.total).toBe(40)
    expect(dash.byCategory).toHaveLength(3)
    expect(dash.passRate).toBeGreaterThanOrEqual(0)
    expect(dash.computableCount).toBeGreaterThan(0)
  })
})

describe('QualityIndicatorsController compute 端点', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [QualityIndicatorsController],
      providers: [QualityIndicatorsService],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /quality-indicators/compute → 200 40 指标', async () => {
    const res = await request(app.getHttpServer()).get('/quality-indicators/compute').expect(200)
    expect(res.body.indicators).toHaveLength(40)
    expect(res.body.indicatorCount).toBe(40)
  })

  it('GET /quality-indicators/dashboard → 200 聚合', async () => {
    const res = await request(app.getHttpServer()).get('/quality-indicators/dashboard').expect(200)
    expect(res.body.data.byCategory).toHaveLength(3)
  })

  it('GET /quality-indicators/snapshots → 200', async () => {
    await request(app.getHttpServer()).get('/quality-indicators/compute').expect(200)
    const res = await request(app.getHttpServer()).get('/quality-indicators/snapshots').expect(200)
    expect(res.body.data.length).toBeGreaterThan(0)
  })
})
