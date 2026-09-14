/**
 * G005 RIS v3.0.6.11-104 Wave 3C (临床反馈闭环) - 控制器端点 spec
 *
 * - POST /clinical-feedback                    → 200 (提交)
 * - GET  /clinical-feedback                    → 200 (列表 + 分页)
 * - GET  /clinical-feedback/meta               → 200 (元数据)
 * - GET  /clinical-feedback/:id                → 200 (详情)
 * - POST /clinical-feedback/:id/respond        → 200 (回应)
 * - POST /clinical-feedback/:id/resolve        → 200 (关闭)
 * - POST /clinical-feedback/:id/reject         → 200 (驳回)
 * - POST /clinical-feedback (非法 type)        → 400 (zod)
 * - POST /clinical-feedback/:id/respond (缺 content) → 400 (zod)
 */
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { ClinicalFeedbackController } from './clinical-feedback.controller'
import { ClinicalFeedbackService } from './clinical-feedback.service'

const fixture = {
  id: 'CF-TEST-1',
  reportId: 'RPT-1',
  patientId: 'P-1',
  patientName: '张三',
  examId: 'EX-1',
  type: 'objection',
  content: '报告异议内容',
  submittedBy: '周临床',
  department: '呼吸内科',
  status: 'SUBMITTED',
  createdAt: '2026-09-14T00:00:00.000Z',
  updatedAt: '2026-09-14T00:00:00.000Z',
}

describe('ClinicalFeedbackController (Wave 3C 端点)', () => {
  let app: INestApplication
  const serviceMock = {
    create: jest.fn().mockReturnValue(fixture),
    list: jest.fn().mockReturnValue({ items: [fixture], total: 1, page: 1, pageSize: 20 }),
    getMeta: jest.fn().mockReturnValue({ types: [], statuses: [], transitions: {} }),
    get: jest.fn().mockReturnValue(fixture),
    respond: jest.fn().mockReturnValue({ ...fixture, status: 'RESPONDED', response: { content: '已复核', responder: '王放射', respondedAt: '2026-09-14T01:00:00.000Z' } }),
    resolve: jest.fn().mockReturnValue({ ...fixture, status: 'RESOLVED', resolution: { resolver: '王放射', amendId: 'AMEND-1', resolvedAt: '2026-09-14T02:00:00.000Z' } }),
    reject: jest.fn().mockReturnValue({ ...fixture, status: 'REJECTED' }),
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ClinicalFeedbackController],
      providers: [{ provide: ClinicalFeedbackService, useValue: serviceMock }],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => jest.clearAllMocks())

  it('POST /clinical-feedback → 200 (提交)', async () => {
    const res = await request(app.getHttpServer())
      .post('/clinical-feedback')
      .send({ reportId: 'RPT-1', patientId: 'P-1', type: 'objection', content: '异议', submittedBy: '周临床', department: '呼吸内科' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(serviceMock.create).toHaveBeenCalledWith(expect.objectContaining({ reportId: 'RPT-1', type: 'objection' }))
  })

  it('GET /clinical-feedback → 200 (列表 + 分页)', async () => {
    const res = await request(app.getHttpServer()).get('/clinical-feedback?status=SUBMITTED&page=1&pageSize=10')
    expect(res.status).toBe(200)
    expect(serviceMock.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'SUBMITTED', page: 1, pageSize: 10 }))
    expect(res.body.data.items).toHaveLength(1)
  })

  it('GET /clinical-feedback/meta → 200 (元数据)', async () => {
    const res = await request(app.getHttpServer()).get('/clinical-feedback/meta')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('GET /clinical-feedback/:id → 200 (详情)', async () => {
    const res = await request(app.getHttpServer()).get('/clinical-feedback/CF-TEST-1')
    expect(res.status).toBe(200)
    expect(res.body.data.id).toBe('CF-TEST-1')
  })

  it('POST /clinical-feedback/:id/respond → 200 (回应)', async () => {
    const res = await request(app.getHttpServer()).post('/clinical-feedback/CF-TEST-1/respond').send({ content: '已复核', responder: '王放射' })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('RESPONDED')
  })

  it('POST /clinical-feedback/:id/resolve → 200 (关闭 + amendId)', async () => {
    const res = await request(app.getHttpServer()).post('/clinical-feedback/CF-TEST-1/resolve').send({ resolver: '王放射', amendId: 'AMEND-1' })
    expect(res.status).toBe(200)
    expect(serviceMock.resolve).toHaveBeenCalledWith('CF-TEST-1', { resolver: '王放射', amendId: 'AMEND-1' })
    expect(res.body.data.resolution.amendId).toBe('AMEND-1')
  })

  it('POST /clinical-feedback/:id/reject → 200 (驳回)', async () => {
    const res = await request(app.getHttpServer()).post('/clinical-feedback/CF-TEST-1/reject').send({ reason: '依据充分', resolver: '王放射' })
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('REJECTED')
  })

  it('POST /clinical-feedback (非法 type) → 400 (zod)', async () => {
    const res = await request(app.getHttpServer())
      .post('/clinical-feedback')
      .send({ reportId: 'RPT-1', type: 'bogus', content: 'x', submittedBy: 'a', department: 'b' })
    expect(res.status).toBe(400)
  })

  it('POST /clinical-feedback/CF-TEST-1/respond (缺 content) → 400 (zod)', async () => {
    const res = await request(app.getHttpServer()).post('/clinical-feedback/CF-TEST-1/respond').send({ responder: '王放射' })
    expect(res.status).toBe(400)
  })
})
