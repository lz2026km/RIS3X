/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 6B (critical-escalation) - 控制器端点 spec
 * - 全部端点 200 (孤儿模块, 无 DB)
 * - 委托正确性 (controller → service)
 * - 升级链流转链路 (启动/确认/升级/关闭) 200
 */
import { Test } from '@nestjs/testing'
import { BadRequestException, INestApplication } from '@nestjs/common'
import request from 'supertest'
import { CriticalEscalationController } from './critical-escalation.controller'
import { CriticalEscalationService } from './critical-escalation.service'

const config = {
  levels: [
    { level: 1, name: '一级电话', role: '值班医师', timeoutMinutes: 15, channels: ['电话', '短信'] },
    { level: 2, name: '二级值班', role: '值班主任医师', timeoutMinutes: 10, channels: ['电话', '短信'] },
    { level: 3, name: '三级科主任', role: '科主任', timeoutMinutes: 5, channels: ['电话'] },
  ],
  rules: [{ key: 'auto-timeout', name: '超时自动升级', description: '', enabled: true }],
  statusLabels: { NOTIFYING: '通知中', PENDING_CONFIRM: '待确认', CONFIRMED: '已确认', ESCALATED: '已升级', CLOSED: '已关闭' },
  stepLabels: { NOTIFIED: '已通知', CONFIRMED: '已确认', TIMEOUT: '超时' },
}

const chain = {
  id: 'ESC-1',
  criticalValueId: 'CV-1',
  patientName: '李明',
  modality: 'CT',
  title: '主动脉夹层可能',
  severity: 'critical',
  status: 'NOTIFYING',
  currentLevel: 1,
  startedAt: '2026-08-16T09:00:00.000Z',
  currentLevelStartedAt: '2026-08-16T09:00:00.000Z',
  currentDeadline: '2026-08-16T09:15:00.000Z',
  escalatedCount: 0,
  steps: [{ level: 1, levelName: '一级电话', role: '值班医师', status: 'NOTIFIED', timeoutMinutes: 15, startedAt: '2026-08-16T09:00:00.000Z', deadline: '2026-08-16T09:15:00.000Z', notifiedAt: '2026-08-16T09:00:00.000Z' }],
  history: [{ at: '2026-08-16T09:00:00.000Z', reason: '启动升级链' }],
}

const stats = {
  total: 4,
  byStatus: { NOTIFYING: 1, PENDING_CONFIRM: 0, CONFIRMED: 1, ESCALATED: 1, CLOSED: 1 },
  avgResponseMinutes: 5.5,
  avgEscalationCount: 1.2,
  escalationRate: 50,
  closedRate: 25,
  byLevel: [{ level: 1, levelName: '一级电话', count: 4, confirmed: 2, escalated: 2, avgResponseMinutes: 8 }],
}

describe('CriticalEscalationController (Wave 6B 端点 200)', () => {
  let app: INestApplication
  const serviceMock = {
    getConfig: jest.fn().mockReturnValue(config),
    updateConfig: jest.fn().mockReturnValue({ levels: config.levels }),
    startChain: jest.fn().mockResolvedValue(chain),
    listChains: jest.fn().mockReturnValue([chain]),
    getChain: jest.fn().mockReturnValue(chain),
    tick: jest.fn().mockImplementation((id: string) => {
      if (id === 'bad') throw new BadRequestException('bad')
      return { ...chain, status: 'ESCALATED', currentLevel: 2 }
    }),
    acknowledge: jest.fn().mockImplementation((id: string) => (id === 'bad' ? Promise.reject(new BadRequestException('bad')) : Promise.resolve({ ...chain, status: 'CONFIRMED', acknowledgedBy: '值班医师 王浩' }))),
    escalate: jest.fn().mockResolvedValue({ ...chain, status: 'ESCALATED', currentLevel: 2, escalatedCount: 1 }),
    closeChain: jest.fn().mockResolvedValue({ ...chain, status: 'CLOSED', closedAt: '2026-08-16T10:00:00.000Z' }),
    stepsOf: jest.fn().mockReturnValue(chain.steps),
    getStats: jest.fn().mockReturnValue(stats),
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [CriticalEscalationController],
      providers: [{ provide: CriticalEscalationService, useValue: serviceMock }],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => jest.clearAllMocks())

  it('GET /critical-escalation/config → 200 (3 级别配置)', async () => {
    const res = await request(app.getHttpServer()).get('/critical-escalation/config').expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.levels).toHaveLength(3)
    expect(res.body.data.levels[0].name).toBe('一级电话')
  })

  it('PUT /critical-escalation/config → 200 (更新超时时间)', async () => {
    const res = await request(app.getHttpServer())
      .put('/critical-escalation/config')
      .send({ levels: [
        { level: 1, timeoutMinutes: 30 },
        { level: 2, timeoutMinutes: 20 },
        { level: 3, timeoutMinutes: 10 },
      ] })
      .expect(200)
    expect(res.body.data.levels[0].timeoutMinutes).toBe(15)
  })

  it('PUT /critical-escalation/config 级别数 ≠3 → 400', async () => {
    await request(app.getHttpServer())
      .put('/critical-escalation/config')
      .send({ levels: [{ level: 1, timeoutMinutes: 30 }, { level: 2, timeoutMinutes: 20 }] })
      .expect(400)
  })

  it('GET /critical-escalation/chains (status 过滤) → 200', async () => {
    const res = await request(app.getHttpServer()).get('/critical-escalation/chains?status=NOTIFYING').expect(200)
    expect(res.body.data[0].id).toBe('ESC-1')
    expect(serviceMock.listChains).toHaveBeenCalledWith({ status: 'NOTIFYING' })
  })

  it('POST /critical-escalation/chains → 200 (启动升级链: 危急值 → 一级通知)', async () => {
    const res = await request(app.getHttpServer())
      .post('/critical-escalation/chains')
      .send({ criticalValueId: 'CV-1', patientName: '李明', title: '主动脉夹层可能' })
      .expect(200)
    expect(res.body.data.status).toBe('NOTIFYING')
    expect(res.body.data.currentLevel).toBe(1)
    expect(serviceMock.startChain).toHaveBeenCalledWith({ criticalValueId: 'CV-1', patientName: '李明', title: '主动脉夹层可能' })
  })

  it('POST /critical-escalation/chains criticalValueId 缺失 → 400', async () => {
    await request(app.getHttpServer()).post('/critical-escalation/chains').send({ patientName: 'X' }).expect(400)
  })

  it('GET /critical-escalation/chains/:id + /steps → 200 (时间线/倒计时)', async () => {
    const res = await request(app.getHttpServer()).get('/critical-escalation/chains/ESC-1').expect(200)
    expect(res.body.data.currentDeadline).toBe('2026-08-16T09:15:00.000Z')
    const steps = await request(app.getHttpServer()).get('/critical-escalation/chains/ESC-1/steps').expect(200)
    expect(steps.body.data[0].status).toBe('NOTIFIED')
  })

  it('升级链流转: tick(超时自动升级) → acknowledge → escalate → close 全 200', async () => {
    const t = await request(app.getHttpServer()).post('/critical-escalation/chains/ESC-1/tick').expect(200)
    expect(t.body.data.status).toBe('ESCALATED')
    const a = await request(app.getHttpServer()).post('/critical-escalation/chains/ESC-1/acknowledge').send({ confirmedBy: '值班医师 王浩', comment: '已电话确认' }).expect(200)
    expect(a.body.data.status).toBe('CONFIRMED')
    expect(serviceMock.acknowledge).toHaveBeenCalledWith('ESC-1', { confirmedBy: '值班医师 王浩', comment: '已电话确认' })
    const e = await request(app.getHttpServer()).post('/critical-escalation/chains/ESC-1/escalate').send({ reason: '危急程度高' }).expect(200)
    expect(e.body.data.currentLevel).toBe(2)
    const c = await request(app.getHttpServer()).post('/critical-escalation/chains/ESC-1/close').send({ closedBy: '质控组', comment: '闭环' }).expect(200)
    expect(c.body.data.status).toBe('CLOSED')
  })

  it('acknowledge confirmedBy 缺失 → 400', async () => {
    await request(app.getHttpServer()).post('/critical-escalation/chains/ESC-1/acknowledge').send({}).expect(400)
  })

  it('GET /critical-escalation/stats → 200 (响应耗时统计)', async () => {
    const res = await request(app.getHttpServer()).get('/critical-escalation/stats').expect(200)
    expect(res.body.data.byLevel[0].avgResponseMinutes).toBe(8)
    expect(res.body.data.escalationRate).toBe(50)
  })
})
