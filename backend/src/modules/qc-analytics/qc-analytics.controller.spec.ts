/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 8B (qc-analytics) - 控制器端点 spec (supertest 200)
 * - 全部端点 200 (孤儿模块, 无 DB, POST 经 @HttpCode(200))
 * - 驾驶舱 / 趋势 / 帕累托 / 科室 / 闭环全链路
 * - 非法流转 400
 */
import { Test } from '@nestjs/testing'
import { BadRequestException, INestApplication } from '@nestjs/common'
import request from 'supertest'
import { QcAnalyticsController } from './qc-analytics.controller'
import { QcAnalyticsService } from './qc-analytics.service'

const dashboard = {
  source: 'demo',
  generatedAt: '2026-08-16T09:00:00.000Z',
  totalReports: 136,
  qcReports: 102,
  qcRate: 75,
  totalDefects: 176,
  defectRate: 129.4,
  timelyReports: 108,
  timelyRate: 79.4,
  avgResponseMinutes: 54.7,
  avgScore: 81.3,
  loopOpen: 4,
  loopClosed: 2,
  closureRate: 33.3,
}

const trends = {
  source: 'demo',
  generatedAt: '2026-08-16T09:00:00.000Z',
  period: 'month',
  points: [
    { bucket: '2026-04', label: '2026-04', reports: 42, qcReports: 31, qcRate: 73.8, defects: 55, defectRate: 131, timely: 33, timelyRate: 78.6, avgResponseMinutes: 52, improvement: null },
    { bucket: '2026-05', label: '2026-05', reports: 44, qcReports: 33, qcRate: 75, defects: 58, defectRate: 131.8, timely: 35, timelyRate: 79.5, avgResponseMinutes: 53, improvement: -0.6 },
  ],
}

const pareto = {
  source: 'demo',
  generatedAt: '2026-08-16T09:00:00.000Z',
  totalDefects: 176,
  items: [
    { code: 'terminology', label: '术语不规范', count: 52, cumulativeCount: 52, cumulativePercent: 29.5, isMain: true },
    { code: 'missing_field', label: '必填字段缺失', count: 41, cumulativeCount: 93, cumulativePercent: 52.8, isMain: true },
  ],
}

const departments = {
  source: 'demo',
  generatedAt: '2026-08-16T09:00:00.000Z',
  data: [
    { department: '乳腺影像', reports: 18, defects: 12, defectRate: 66.7, timelyRate: 83.3, avgResponseMinutes: 48, qcRate: 77.8, avgScore: 84 },
    { department: '超声科', reports: 17, defects: 20, defectRate: 117.6, timelyRate: 76.5, avgResponseMinutes: 51, qcRate: 70.6, avgScore: 82 },
  ],
}

const loopDefects = {
  source: 'demo',
  generatedAt: '2026-08-16T09:00:00.000Z',
  data: [
    { id: 'qcd-003', code: 'structure', typeLabel: '结构不完整', reportId: 'RPT-A-0021', department: '超声科', severity: 'medium', source: 'qc-v2', message: '结构不完整', discoveredAt: '2026-07-15T01:00:00.000Z', status: 'open' },
  ],
}

const loopItem = {
  id: 'it-007',
  defectId: 'qcd-003',
  defectCode: 'structure',
  typeLabel: '结构不完整',
  reportId: 'RPT-A-0021',
  department: '超声科',
  severity: 'medium',
  source: 'qc-v2',
  title: '结构不完整整改',
  assignee: 'u-102',
  assigneeName: '王质控员',
  status: 'open',
  createdAt: '2026-08-16T09:00:00.000Z',
  updatedAt: '2026-08-16T09:00:00.000Z',
  recheckRounds: 0,
  history: [{ at: '2026-08-16T09:00:00.000Z', action: 'created', actor: '系统', note: '由缺陷派生' }],
}

const loopStats = {
  source: 'demo',
  generatedAt: '2026-08-16T09:00:00.000Z',
  data: { total: 6, byStatus: { open: 1, rectifying: 1, rechecking: 2, closed: 2 }, closureRate: 33.3, avgDaysToClose: 12.5, avgRecheckRounds: 0.8, openDefects: 4 },
}

describe('QcAnalyticsController (Wave 8B 端点 200)', () => {
  let app: INestApplication
  const serviceMock = {
    getDashboard: jest.fn().mockResolvedValue(dashboard),
    getTrends: jest.fn().mockResolvedValue(trends),
    getPareto: jest.fn().mockResolvedValue(pareto),
    getDepartments: jest.fn().mockResolvedValue(departments),
    listLoopDefects: jest.fn().mockResolvedValue(loopDefects),
    listLoopItems: jest.fn().mockResolvedValue({ source: 'demo', generatedAt: '2026-08-16T09:00:00.000Z', data: [loopItem] }),
    getLoopItem: jest.fn().mockResolvedValue(loopItem),
    createLoopItem: jest.fn().mockResolvedValue(loopItem),
    startFix: jest.fn().mockResolvedValue({ ...loopItem, status: 'rectifying' }),
    submitFix: jest.fn().mockResolvedValue({ ...loopItem, status: 'rechecking', fixNote: '已提交整改说明' }),
    recheckItem: jest.fn().mockImplementation((id: string) =>
      id === 'bad' ? Promise.reject(new BadRequestException('当前状态 open 不可复查验证')) : Promise.resolve({ ...loopItem, status: 'closed', closedAt: '2026-08-16T10:00:00.000Z' }),
    ),
    closeLoopItem: jest.fn().mockResolvedValue({ ...loopItem, status: 'closed' }),
    getLoopStats: jest.fn().mockReturnValue(loopStats),
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [QcAnalyticsController],
      providers: [{ provide: QcAnalyticsService, useValue: serviceMock }],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => jest.clearAllMocks())

  it('GET /qc-analytics/dashboard → 200 (驾驶舱聚合)', async () => {
    const res = await request(app.getHttpServer()).get('/qc-analytics/dashboard').expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.totalReports).toBe(136)
    expect(res.body.data.defectRate).toBeGreaterThan(0)
    expect(res.body.data.timelyRate).toBeLessThanOrEqual(100)
    expect(serviceMock.getDashboard).toHaveBeenCalled()
  })

  it('GET /qc-analytics/trends → 200, period 默认 month; ?period=week 传 week', async () => {
    const res = await request(app.getHttpServer()).get('/qc-analytics/trends').expect(200)
    expect(res.body.data.period).toBe('month')
    expect(res.body.data.points[0].improvement).toBeNull()
    await request(app.getHttpServer()).get('/qc-analytics/trends?period=week').expect(200)
    expect(serviceMock.getTrends).toHaveBeenLastCalledWith('week')
  })

  it('GET /qc-analytics/pareto → 200 (帕累托降序)', async () => {
    const res = await request(app.getHttpServer()).get('/qc-analytics/pareto').expect(200)
    expect(res.body.data.items[0].code).toBe('terminology')
    expect(res.body.data.items[0].isMain).toBe(true)
  })

  it('GET /qc-analytics/departments → 200 (科室排名)', async () => {
    const res = await request(app.getHttpServer()).get('/qc-analytics/departments').expect(200)
    expect(res.body.data.data[0].department).toBe('乳腺影像')
    expect(res.body.data.data[0].defectRate).toBeLessThan(res.body.data.data[1].defectRate)
  })

  it('GET /qc-analytics/loop/defects → 200 (status 过滤)', async () => {
    const res = await request(app.getHttpServer()).get('/qc-analytics/loop/defects?status=open').expect(200)
    expect(res.body.data.data[0].status).toBe('open')
    expect(serviceMock.listLoopDefects).toHaveBeenCalledWith('open')
  })

  it('POST /qc-analytics/loop/items → 200 (缺陷派生整改任务)', async () => {
    const res = await request(app.getHttpServer()).post('/qc-analytics/loop/items').send({ defectId: 'qcd-003' }).expect(200)
    expect(res.body.data.status).toBe('open')
    expect(serviceMock.createLoopItem).toHaveBeenCalledWith({ defectId: 'qcd-003' })
  })

  it('POST /qc-analytics/loop/items 缺 defectId → 400', async () => {
    await request(app.getHttpServer()).post('/qc-analytics/loop/items').send({}).expect(400)
  })

  it('GET /qc-analytics/loop/items (status 过滤) + /loop/items/:id → 200', async () => {
    const list = await request(app.getHttpServer()).get('/qc-analytics/loop/items?status=open').expect(200)
    expect(list.body.data.data[0].history.length).toBeGreaterThan(0)
    const detail = await request(app.getHttpServer()).get('/qc-analytics/loop/items/it-007').expect(200)
    expect(detail.body.data.id).toBe('it-007')
  })

  it('闭环流转: start → fix → recheck → close 全 200', async () => {
    const s = await request(app.getHttpServer()).post('/qc-analytics/loop/items/it-007/start').send({}).expect(200)
    expect(s.body.data.status).toBe('rectifying')
    const f = await request(app.getHttpServer()).post('/qc-analytics/loop/items/it-007/fix').send({ note: '模板已更新' }).expect(200)
    expect(f.body.data.status).toBe('rechecking')
    const r = await request(app.getHttpServer()).post('/qc-analytics/loop/items/it-007/recheck').send({ result: 'pass', reviewer: '张质控', note: '复查通过' }).expect(200)
    expect(r.body.data.status).toBe('closed')
    const c = await request(app.getHttpServer()).post('/qc-analytics/loop/items/it-007/close').send({ note: '闭环' }).expect(200)
    expect(c.body.data.status).toBe('closed')
    expect(serviceMock.recheckItem).toHaveBeenCalledWith('it-007', expect.objectContaining({ result: 'pass', reviewer: '张质控' }))
  })

  it('recheck 非法 result → 400; 非法流转 → 400', async () => {
    await request(app.getHttpServer()).post('/qc-analytics/loop/items/it-007/recheck').send({ result: 'maybe', reviewer: '张质控' }).expect(400)
    await request(app.getHttpServer()).post('/qc-analytics/loop/items/bad/recheck').send({ result: 'pass', reviewer: '张质控' }).expect(400)
  })

  it('GET /qc-analytics/loop/stats → 200 (闭环统计)', async () => {
    const res = await request(app.getHttpServer()).get('/qc-analytics/loop/stats').expect(200)
    expect(res.body.data.data.closureRate).toBe(33.3)
    expect(res.body.data.data.avgDaysToClose).toBeGreaterThan(0)
  })
})
