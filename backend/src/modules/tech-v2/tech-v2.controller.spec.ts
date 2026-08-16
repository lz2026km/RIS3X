/**
 * G005 RIS v3.0.6.11-101 Wave 4A (tech-v2 技师工作站 V2) - 控制器端点 spec
 * - 全部端点 200 (孤儿模块, 无 DB)
 * - 委托正确性 (controller → service)
 * - zod 校验 400
 */
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { TechV2Controller } from './tech-v2.controller'
import { TechV2Service } from './tech-v2.service'

describe('TechV2Controller (Wave 4A 端点 200)', () => {
  let app: INestApplication
  const serviceMock = {
    getTechnicians: jest.fn().mockReturnValue([{ id: 'T-001', name: '刘洋', group: 'CT 组' }]),
    getRooms: jest.fn().mockReturnValue([{ id: 'R-CT1', name: 'CT-1 检查室' }]),
    getRotationRules: jest.fn().mockReturnValue([{ id: 'RULE-CT-DAY', name: 'CT 双检间白班轮转' }]),
    generatePlan: jest.fn().mockReturnValue({
      id: 'ROT-ABC',
      startDate: '2026-08-17',
      endDate: '2026-08-23',
      days: 7,
      balanceWeight: 0.6,
      assignments: [{ id: 'ASG-1', date: '2026-08-17', shift: 'DAY', roomId: 'R-CT1', technicianId: 'T-001', predictedLoad: 48 }],
      skipped: [],
      balance: { balanced: true, maxMinDiff: 4, threshold: 60 },
      seeded: true,
    }),
    getRotationPlan: jest.fn().mockReturnValue({ id: 'ROT-ABC', startDate: '2026-08-17', days: 7, assignments: [], skipped: [], balance: {} }),
    getRotationHistory: jest.fn().mockReturnValue({ plans: [], executions: [] }),
    executeAssignment: jest.fn().mockReturnValue({ id: 'EX-1', status: 'EXECUTED', assignmentId: 'ASG-1' }),
    forecast: jest.fn().mockReturnValue({
      startDate: '2026-08-17',
      days: 7,
      model: 'wma',
      daily: [{ date: '2026-08-17', value: 120, lower: 100, upper: 140, periods: [] }],
      totals: { value: 840, lower: 700, upper: 980 },
      perTechnician: [],
      byRoom: [],
    }),
    getWorkloadBalance: jest.fn().mockReturnValue({ perTechnician: [], groups: [], balanced: true, threshold: 8, maxMinDiff: 0 }),
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [TechV2Controller],
      providers: [{ provide: TechV2Service, useValue: serviceMock }],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => jest.clearAllMocks())

  it('GET /tech-v2/rotation/rules → 200', async () => {
    const res = await request(app.getHttpServer()).get('/tech-v2/rotation/rules').expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data[0].id).toBe('RULE-CT-DAY')
  })

  it('POST /tech-v2/rotation/generate → 200 (确定性计划)', async () => {
    const res = await request(app.getHttpServer())
      .post('/tech-v2/rotation/generate')
      .send({ startDate: '2026-08-17', days: 7, balanceWeight: 0.6 })
      .expect(200)
    expect(res.body.data.id).toBe('ROT-ABC')
    expect(res.body.data.assignments[0].roomId).toBe('R-CT1')
    expect(serviceMock.generatePlan).toHaveBeenCalledWith({ startDate: '2026-08-17', days: 7, balanceWeight: 0.6 })
  })

  it('POST /tech-v2/rotation/generate 非法日期 → 400', async () => {
    await request(app.getHttpServer()).post('/tech-v2/rotation/generate').send({ startDate: 'bad-date' }).expect(400)
  })

  it('GET /tech-v2/rotation/plan → 200', async () => {
    const res = await request(app.getHttpServer()).get('/tech-v2/rotation/plan?startDate=2026-08-17&days=7').expect(200)
    expect(res.body.data.id).toBe('ROT-ABC')
    expect(serviceMock.getRotationPlan).toHaveBeenCalledWith({ startDate: '2026-08-17', days: '7' })
  })

  it('GET /tech-v2/rotation/history → 200', async () => {
    const res = await request(app.getHttpServer()).get('/tech-v2/rotation/history').expect(200)
    expect(res.body.data.plans).toEqual([])
  })

  it('POST /tech-v2/rotation/assignments/:id/execute → 200 (执行记录)', async () => {
    const res = await request(app.getHttpServer())
      .post('/tech-v2/rotation/assignments/ASG-1/execute')
      .send({ note: '晨间执行' })
      .expect(200)
    expect(res.body.data.status).toBe('EXECUTED')
    expect(serviceMock.executeAssignment).toHaveBeenCalledWith('ASG-1', { note: '晨间执行' })
  })

  it('GET /tech-v2/forecast → 200 (7 天预测 + 置信区间)', async () => {
    const res = await request(app.getHttpServer()).get('/tech-v2/forecast?days=7').expect(200)
    expect(res.body.data.daily).toHaveLength(1)
    expect(res.body.data.daily[0].upper).toBe(140)
  })

  it('GET /tech-v2/forecast days 越界 → 400', async () => {
    await request(app.getHttpServer()).get('/tech-v2/forecast?days=99').expect(400)
  })

  it('GET /tech-v2/forecast/technician/:id → 200 (技师级别预测)', async () => {
    const res = await request(app.getHttpServer()).get('/tech-v2/forecast/technician/T-001?days=7').expect(200)
    expect(res.body.data.technicianId).toBe('T-001')
  })

  it('GET /tech-v2/workload/balance → 200 (均衡指标)', async () => {
    const res = await request(app.getHttpServer()).get('/tech-v2/workload/balance').expect(200)
    expect(res.body.data.balanced).toBe(true)
  })

  it('GET /tech-v2/meta → 200 (技师名册 + 检查室)', async () => {
    const res = await request(app.getHttpServer()).get('/tech-v2/meta').expect(200)
    expect(res.body.data.technicians[0].id).toBe('T-001')
    expect(res.body.data.rooms[0].id).toBe('R-CT1')
  })
})
