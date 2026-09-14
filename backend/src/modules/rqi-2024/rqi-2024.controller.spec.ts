/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 1A - 放射影像质控指标 (2024 年版) 控制器端点 spec
 * - 全部端点 200 (孤儿模块, 无 DB, POST/PUT 显式返回 200)
 * - zod 校验失败 → 400 (PUT /config, POST /export)
 * - 委托正确性 (controller → service)
 */
import { Test } from '@nestjs/testing'
import { BadRequestException, INestApplication } from '@nestjs/common'
import request from 'supertest'
import { Rqi2024Controller } from './rqi-2024.controller'
import { Rqi2024Service } from './rqi-2024.service'

const indicatorResult = {
  code: 'RQI-IIA-01',
  name: '放射影像检查图像伪影率',
  numerator: 2,
  denominator: 100,
  rate: 2,
  unit: '%',
  target: 2,
  direction: 'lower',
  status: 'pass',
  period: '2026-08',
  granularity: 'month',
  standard: '国卫办医政函〔2024〕150号 附件4',
  byDimension: [
    { dimension: 'CT', label: 'CT', numerator: 1, denominator: 60, rate: 1.67, status: 'pass' },
    { dimension: 'MRI', label: 'MRI', numerator: 1, denominator: 40, rate: 2.5, status: 'warn' },
  ],
}

const indicatorsResult = {
  source: 'seed',
  period: '2026-08',
  granularity: 'month',
  dateFrom: '2026-08-01',
  dateTo: '2026-08-31',
  standard: indicatorResult.standard,
  count: 1,
  indicators: [indicatorResult],
}

const detailResult = {
  source: 'seed',
  indicator: indicatorResult,
  numeratorIds: ['E-CT1'],
  denominatorIds: ['E-CT1', 'E-CT2'],
  items: [
    { id: 'E-CT1', kind: 'exam', label: 'ACC-1 胸部', inNumerator: true, inDenominator: true, dimension: 'CT', detail: { modality: 'CT' } },
  ],
}

const trendResult = {
  source: 'seed',
  code: 'RQI-IIA-01',
  name: indicatorResult.name,
  months: 12,
  points: [{ month: '2026-08', numerator: 2, denominator: 100, rate: 2, unit: '%', target: 2, status: 'pass' }],
}

const dashboardResult = {
  source: 'seed',
  generatedAt: '2026-08-14T00:00:00.000Z',
  period: '2026-08',
  granularity: 'month',
  standard: indicatorResult.standard,
  total: 7,
  passCount: 5,
  warnCount: 1,
  failCount: 1,
  passRate: 71.4,
  indicators: [indicatorResult],
  mom: [{ code: 'RQI-IIA-01', name: indicatorResult.name, current: 2, previous: 2.2, delta: -0.2, trend: 'down', unit: '%' }],
}

const configResult = {
  source: 'default',
  updatedAt: null,
  standard: indicatorResult.standard,
  items: [{ code: 'RQI-IIA-01', name: indicatorResult.name, target: 2, warnMargin: 1, direction: 'lower', unit: '%' }],
}

const exportResult = { format: 'csv', content: '\ufeff指标编码,指标名称', filename: 'rqi-2024-2026-08.csv' }

describe('Rqi2024Controller (Wave 1A 端点 200 + zod 400)', () => {
  let app: INestApplication
  const serviceMock = {
    getIndicators: jest.fn().mockResolvedValue(indicatorsResult),
    getDetail: jest.fn().mockImplementation((code: string) => {
      if (code.toUpperCase() === 'RQI-IIA-01') return Promise.resolve(detailResult)
      return Promise.reject(new BadRequestException(`未知指标编码 ${code}`))
    }),
    getTrend: jest.fn().mockImplementation((code: string) => {
      if (!code) return Promise.reject(new BadRequestException('code 不能为空'))
      return Promise.resolve({ ...trendResult, code })
    }),
    getDashboard: jest.fn().mockResolvedValue(dashboardResult),
    getConfig: jest.fn().mockReturnValue(configResult),
    updateConfig: jest.fn().mockImplementation((items: unknown[]) => ({ ...configResult, source: 'override', updatedAt: '2026-08-14T00:00:00.000Z', items })),
    export: jest.fn().mockResolvedValue(exportResult),
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [Rqi2024Controller],
      providers: [{ provide: Rqi2024Service, useValue: serviceMock }],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => jest.clearAllMocks())

  it('GET /rqi-2024/indicators → 200 (7 指标汇总)', async () => {
    const res = await request(app.getHttpServer()).get('/rqi-2024/indicators?period=month').expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.indicators[0].code).toBe('RQI-IIA-01')
    expect(serviceMock.getIndicators).toHaveBeenCalledWith({ period: 'month', dateFrom: undefined, dateTo: undefined })
  })

  it('GET /rqi-2024/detail/:code → 200 (分子分母明细)', async () => {
    const res = await request(app.getHttpServer()).get('/rqi-2024/detail/RQI-IIA-01').expect(200)
    expect(res.body.data.indicator.code).toBe('RQI-IIA-01')
    expect(res.body.data.numeratorIds).toContain('E-CT1')
    expect(res.body.data.items[0].inDenominator).toBe(true)
  })

  it('GET /rqi-2024/detail/:code 未知编码 → 400', async () => {
    await request(app.getHttpServer()).get('/rqi-2024/detail/RQI-UNKNOWN').expect(400)
  })

  it('GET /rqi-2024/trend?code= → 200 (月度趋势)', async () => {
    const res = await request(app.getHttpServer()).get('/rqi-2024/trend?code=RQI-IIA-01&months=6').expect(200)
    expect(res.body.data.points[0].month).toBe('2026-08')
    expect(serviceMock.getTrend).toHaveBeenCalledWith('RQI-IIA-01', 6)
  })

  it('GET /rqi-2024/trend 缺 code → 400', async () => {
    await request(app.getHttpServer()).get('/rqi-2024/trend').expect(400)
  })

  it('GET /rqi-2024/dashboard → 200 (达标数/率/环比)', async () => {
    const res = await request(app.getHttpServer()).get('/rqi-2024/dashboard').expect(200)
    expect(res.body.data.passCount).toBe(5)
    expect(res.body.data.mom).toHaveLength(1)
  })

  it('GET /rqi-2024/config → 200', async () => {
    const res = await request(app.getHttpServer()).get('/rqi-2024/config').expect(200)
    expect(res.body.data.items).toHaveLength(1)
    expect(res.body.data.source).toBe('default')
  })

  it('PUT /rqi-2024/config → 200 (更新目标值)', async () => {
    const res = await request(app.getHttpServer())
      .put('/rqi-2024/config')
      .send({ items: [{ code: 'RQI-RWS-03', target: 99, warnMargin: 2 }] })
      .expect(200)
    expect(res.body.data.source).toBe('override')
    expect(serviceMock.updateConfig).toHaveBeenCalledWith([{ code: 'RQI-RWS-03', target: 99, warnMargin: 2 }])
  })

  it('PUT /rqi-2024/config items 为空 → 400 (zod)', async () => {
    await request(app.getHttpServer()).put('/rqi-2024/config').send({ items: [] }).expect(400)
  })

  it('PUT /rqi-2024/config 缺少 target → 400 (zod)', async () => {
    await request(app.getHttpServer()).put('/rqi-2024/config').send({ items: [{ code: 'RQI-IIA-01' }] }).expect(400)
  })

  it('POST /rqi-2024/export → 200 (CSV)', async () => {
    const res = await request(app.getHttpServer()).post('/rqi-2024/export').send({ format: 'csv' }).expect(200)
    expect(res.body.data.format).toBe('csv')
    expect(res.body.data.filename).toContain('.csv')
    expect(serviceMock.export).toHaveBeenCalledWith({ format: 'csv' })
  })

  it('POST /rqi-2024/export format 非法 → 400 (zod)', async () => {
    await request(app.getHttpServer()).post('/rqi-2024/export').send({ format: 'xml' }).expect(400)
  })
})
