/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 2A - 国家上报中心控制器端点 spec
 * 覆盖:
 *   1. 端点 200 (孤儿模块, 无 DB, seed 回退)
 *   2. zod 校验失败 → 400 (缺 createdBy / 非法 period / 非法 format / 非法 status / 缺 receiptNo)
 *   3. 状态机非法流转 → 400; 批次不存在 → 404
 *   4. CSV/JSON 导出; 历史 / 统计
 */
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { Rqi2024Service } from '../rqi-2024/rqi-2024.service'
import { RqiReportCenterController } from './rqi-report-center.controller'
import { RqiReportCenterService } from './rqi-report-center.service'

describe('RqiReportCenterController (Wave 2A 端点 200/400/404)', () => {
  let app: INestApplication
  let createdId = ''

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [RqiReportCenterController],
      providers: [RqiReportCenterService, Rqi2024Service],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  // ---- seed 回退 (在写入内存批次之前断言) ----

  it('GET /rqi-report-center/batches → 200 (seed 回退 3 个批次)', async () => {
    const res = await request(app.getHttpServer()).get('/rqi-report-center/batches').expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.source).toBe('seed')
    expect(res.body.data.total).toBe(3)
    expect(res.body.data.items).toHaveLength(3)
  })

  it('GET /rqi-report-center/history → 200 (含回执)', async () => {
    const res = await request(app.getHttpServer()).get('/rqi-report-center/history').expect(200)
    expect(res.body.data.source).toBe('seed')
    expect(res.body.data.total).toBe(3)
    const accepted = res.body.data.items.find((h: { status: string }) => h.status === 'ACCEPTED')
    expect(accepted.receiptNo).toBeTruthy()
  })

  it('GET /rqi-report-center/stats → 200 (按时上报率)', async () => {
    const res = await request(app.getHttpServer()).get('/rqi-report-center/stats').expect(200)
    expect(res.body.data.total).toBe(3)
    expect(res.body.data.onTimeRate).toBe(66.7)
    expect(res.body.data.latest).not.toBeNull()
  })

  it('GET /rqi-report-center/batches/:id → 200 (seed 详情 7 指标)', async () => {
    const res = await request(app.getHttpServer()).get('/rqi-report-center/batches/rrc-seed-2026-06').expect(200)
    expect(res.body.data.indicators).toHaveLength(7)
    expect(res.body.data.contentHash).toMatch(/^[0-9a-f]{16}$/)
  })

  it('GET /rqi-report-center/batches/:id 不存在 → 404', async () => {
    await request(app.getHttpServer()).get('/rqi-report-center/batches/rrc-nope').expect(404)
  })

  // ---- 生成 / 提交 / 回执 ----

  it('POST /rqi-report-center/batches → 200 (DRAFT + 7 指标)', async () => {
    const res = await request(app.getHttpServer())
      .post('/rqi-report-center/batches')
      .send({ period: '2026-08', createdBy: '质控科-张医师' })
      .expect(200)
    expect(res.body.data.status).toBe('DRAFT')
    expect(res.body.data.indicators).toHaveLength(7)
    createdId = res.body.data.id
    expect(createdId).toBeTruthy()
  })

  it('POST /rqi-report-center/batches 缺 createdBy → 400 (zod)', async () => {
    await request(app.getHttpServer()).post('/rqi-report-center/batches').send({ period: '2026-08' }).expect(400)
  })

  it('POST /rqi-report-center/batches 非法 period → 400', async () => {
    await request(app.getHttpServer())
      .post('/rqi-report-center/batches')
      .send({ period: 'not-a-period', createdBy: 'tester' })
      .expect(400)
  })

  it('POST /rqi-report-center/batches/:id/submit → 200 (SUBMITTED)', async () => {
    const res = await request(app.getHttpServer()).post(`/rqi-report-center/batches/${createdId}/submit`).expect(200)
    expect(res.body.data.status).toBe('SUBMITTED')
    expect(res.body.data.submittedAt).toBeTruthy()
  })

  it('POST /rqi-report-center/batches/:id/accept → 200 (ACCEPTED + 回执号)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/rqi-report-center/batches/${createdId}/accept`)
      .send({ receiptNo: 'GJ-2026-08-8888', remark: '国家平台已接收' })
      .expect(200)
    expect(res.body.data.status).toBe('ACCEPTED')
    expect(res.body.data.receiptNo).toBe('GJ-2026-08-8888')
  })

  it('POST /rqi-report-center/batches/:id/accept 缺 receiptNo → 400 (zod)', async () => {
    await request(app.getHttpServer()).post(`/rqi-report-center/batches/${createdId}/accept`).send({}).expect(400)
  })

  it('POST /rqi-report-center/batches/:id/submit 已 ACCEPTED → 400 (非法流转)', async () => {
    await request(app.getHttpServer()).post(`/rqi-report-center/batches/${createdId}/submit`).expect(400)
  })

  it('驳回 → 重报闭环: reject → REJECTED, reopen → DRAFT', async () => {
    const created = await request(app.getHttpServer())
      .post('/rqi-report-center/batches')
      .send({ period: '2026-07', createdBy: 'tester' })
      .expect(200)
    const id = created.body.data.id as string

    await request(app.getHttpServer()).post(`/rqi-report-center/batches/${id}/submit`).expect(200)
    const rejected = await request(app.getHttpServer())
      .post(`/rqi-report-center/batches/${id}/reject`)
      .send({ reason: 'ICME-05 分母口径需复核' })
      .expect(200)
    expect(rejected.body.data.status).toBe('REJECTED')
    expect(rejected.body.data.rejectReason).toContain('ICME-05')

    const reopened = await request(app.getHttpServer()).post(`/rqi-report-center/batches/${id}/reopen`).expect(200)
    expect(reopened.body.data.status).toBe('DRAFT')
  })

  it('POST /rqi-report-center/batches/:id/reject 缺 reason → 400 (zod)', async () => {
    const created = await request(app.getHttpServer())
      .post('/rqi-report-center/batches')
      .send({ period: '2026-06', createdBy: 'tester' })
      .expect(200)
    await request(app.getHttpServer())
      .post(`/rqi-report-center/batches/${created.body.data.id}/reject`)
      .send({})
      .expect(400)
  })

  // ---- 导出 / 列表 ----

  it('GET /rqi-report-center/batches/:id/export?format=csv → 200 (含 BOM)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/rqi-report-center/batches/${createdId}/export?format=csv`)
      .expect(200)
    expect(res.body.data.format).toBe('csv')
    expect(res.body.data.content.startsWith('\ufeff')).toBe(true)
    expect(res.body.data.content).toContain('RQI-IIA-01')
    expect(res.body.data.filename).toMatch(/\.csv$/)
  })

  it('GET /rqi-report-center/batches/:id/export?format=json → 200 (7 指标)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/rqi-report-center/batches/${createdId}/export?format=json`)
      .expect(200)
    expect(res.body.data.format).toBe('json')
    const parsed = JSON.parse(res.body.data.content) as { indicators: unknown[] }
    expect(parsed.indicators).toHaveLength(7)
  })

  it('GET /rqi-report-center/batches/:id/export?format=xml → 400 (zod)', async () => {
    await request(app.getHttpServer()).get(`/rqi-report-center/batches/${createdId}/export?format=xml`).expect(400)
  })

  it('GET /rqi-report-center/batches?status=&page=&pageSize= → 200 (过滤 + 分页)', async () => {
    const res = await request(app.getHttpServer())
      .get('/rqi-report-center/batches?status=DRAFT&page=1&pageSize=10')
      .expect(200)
    expect(res.body.data.source).toBe('memory')
    expect(res.body.data.page).toBe(1)
    expect(res.body.data.pageSize).toBe(10)
    res.body.data.items.forEach((b: { status: string }) => expect(b.status).toBe('DRAFT'))
  })

  it('GET /rqi-report-center/batches?status=BOGUS → 400 (zod)', async () => {
    await request(app.getHttpServer()).get('/rqi-report-center/batches?status=BOGUS').expect(400)
  })
})
