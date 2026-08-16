// [G005 v3.0.6.11-101 Wave 6A F8] ReportSignV2Controller spec (supertest 200)
// 水印 preview/verify + 签名申请/审批/驳回/撤销 状态流转
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { ReportSignV2Controller } from './report-sign-v2.controller'
import { ReportWatermarkService } from './report-watermark.service'
import { ReportSignService } from './report-sign.service'
import { PrismaService } from '../../prisma/prisma.service'

describe('ReportSignV2Controller (F8 端点 200)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReportSignV2Controller],
      providers: [ReportWatermarkService, ReportSignService, { provide: PrismaService, useValue: {} }],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /report-sign-v2/watermark/config → 200', async () => {
    const res = await request(app.getHttpServer()).get('/report-sign-v2/watermark/config').expect(200)
    expect(res.body.data.version).toBe(2)
  })

  it('POST /report-sign-v2/watermark/preview → 200 确定性 + 防篡改码', async () => {
    const body = { reportId: 'RPT-2001', text: '双肺纹理清晰, 未见明显异常。', config: { text: { content: '预览水印', position: 'tile', rotation: -30, opacity: 0.12, spacing: 160, fontSize: 16 } } }
    const res = await request(app.getHttpServer()).post('/report-sign-v2/watermark/preview').send(body).expect(200)
    expect(res.body.tamperCode).toMatch(/^[0-9a-f]{16}$/)
    expect(res.body.contentHash).toMatch(/^[0-9a-f]{64}$/)
    const again = await request(app.getHttpServer()).post('/report-sign-v2/watermark/preview').send(body).expect(200)
    expect(again.body.tamperCode).toBe(res.body.tamperCode)
  })

  it('POST /report-sign-v2/watermark/verify → 200: 篡改检测', async () => {
    const preview = await request(app.getHttpServer())
      .post('/report-sign-v2/watermark/preview')
      .send({ reportId: 'RPT-2001', text: '原始内容' })
    const ok = await request(app.getHttpServer())
      .post('/report-sign-v2/watermark/verify')
      .send({ reportId: 'RPT-2001', text: '原始内容', config: preview.body.config, contentHash: preview.body.contentHash, tamperCode: preview.body.tamperCode })
      .expect(200)
    expect(ok.body.valid).toBe(true)
    const bad = await request(app.getHttpServer())
      .post('/report-sign-v2/watermark/verify')
      .send({ reportId: 'RPT-2001', text: '被篡改的内容', config: preview.body.config, contentHash: preview.body.contentHash, tamperCode: preview.body.tamperCode })
      .expect(200)
    expect(bad.body.valid).toBe(false)
  })

  it('GET /report-sign-v2/signs → 200, seed 记录含哈希', async () => {
    const res = await request(app.getHttpServer()).get('/report-sign-v2/signs').expect(200)
    expect(res.body.data.length).toBeGreaterThanOrEqual(3)
    expect(res.body.data[0].reportHash).toMatch(/^[0-9a-f]{16}$/)
  })

  it('POST /report-sign-v2/signs → 201 → approve → 200: 完整签署流', async () => {
    const created = await request(app.getHttpServer())
      .post('/report-sign-v2/signs')
      .send({ reportId: 'RPT-2002', reportTitle: '胸部 CT', kind: 'co-signer', signerId: 'u-001', applicantId: 'u-002', reason: '双签名', reportText: '右肺上叶见 5mm 结节影。' })
      .expect(201)
    expect(created.body.status).toBe('pending')
    const approved = await request(app.getHttpServer())
      .post(`/report-sign-v2/signs/${created.body.id}/approve`)
      .send({ note: '同意' })
      .expect(200)
    expect(approved.body.status).toBe('approved')
    expect(approved.body.signedByName).toBe('张主任')
    expect(approved.body.records.map((r: { action: string }) => r.action)).toEqual(expect.arrayContaining(['approve', 'sign']))
    const detail = await request(app.getHttpServer()).get(`/report-sign-v2/signs/${created.body.id}`).expect(200)
    expect(detail.body.signedAt).toBeTruthy()
  })

  it('POST /report-sign-v2/signs/:id/reject → 200 (驳回流)', async () => {
    const created = await request(app.getHttpServer())
      .post('/report-sign-v2/signs')
      .send({ reportId: 'RPT-2003', kind: 'reviewer', signerId: 'u-004' })
      .expect(201)
    const rejected = await request(app.getHttpServer())
      .post(`/report-sign-v2/signs/${created.body.id}/reject`)
      .send({ reason: '所见与结论不一致' })
      .expect(200)
    expect(rejected.body.status).toBe('rejected')
    expect(rejected.body.rejectReason).toBe('所见与结论不一致')
    // 已驳回不可再审批 → 400
    await request(app.getHttpServer()).post(`/report-sign-v2/signs/${created.body.id}/approve`).send({}).expect(400)
  })

  it('POST /report-sign-v2/signs/:id/cancel → 200 (撤销流)', async () => {
    const created = await request(app.getHttpServer())
      .post('/report-sign-v2/signs')
      .send({ reportId: 'RPT-2004', kind: 'doctor', signerId: 'u-002' })
      .expect(201)
    const cancelled = await request(app.getHttpServer()).post(`/report-sign-v2/signs/${created.body.id}/cancel`).send({ reason: '撤销' }).expect(200)
    expect(cancelled.body.status).toBe('cancelled')
  })

  it('GET /report-sign-v2/signs/stats + 按 reportId 过滤 → 200', async () => {
    const stats = await request(app.getHttpServer()).get('/report-sign-v2/signs/stats').expect(200)
    expect(stats.body.data.pending).toBeGreaterThanOrEqual(1)
    const filtered = await request(app.getHttpServer()).get('/report-sign-v2/signs?reportId=RPT-1001').expect(200)
    expect(filtered.body.data.every((s: { reportId: string }) => s.reportId === 'RPT-1001')).toBe(true)
  })
})
