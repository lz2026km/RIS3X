/**
 * [G005 v3.0.6.11-101 Wave 2A (imaging-compare)] 会话 CRUD + 同步状态 + 差异指标 spec
 * - POST /imaging-compare/sessions → 200 (创建 2-4 序列分组会话)
 * - GET /imaging-compare/sessions → 200 (列表, 含 seed)
 * - GET /imaging-compare/sessions/:id → 200 (详情)
 * - DELETE /imaging-compare/sessions/:id → 200
 * - GET/PATCH /imaging-compare/sessions/:id/sync → 200 (会话级同步开关)
 * - POST /imaging-compare/sessions/:id/difference → 200 (差异指标)
 */
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { ImagingCompareController } from './imaging-compare.controller'
import { ImagingCompareService } from './imaging-compare.service'
import { PrismaService } from '../../prisma/prisma.service'

const prismaMock = {
  patient: { findMany: jest.fn().mockResolvedValue([]) },
  exam: { findMany: jest.fn().mockResolvedValue([]) },
  dicomInstance: { findMany: jest.fn().mockResolvedValue([]) },
}

describe('ImagingCompareController (会话 CRUD 200)', () => {
  let app: INestApplication

  const seriesGroups = [
    { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202601010001.1', label: '基线', modality: 'CT' },
    { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202602100002.1', label: '随访 1', modality: 'CT' },
    { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.202603200003.1', label: '随访 2', modality: 'CT' },
  ]

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ImagingCompareController],
      providers: [
        ImagingCompareService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('POST /imaging-compare/sessions 创建会话 → 200, 2-4 序列分组校验', async () => {
    const res = await request(app.getHttpServer())
      .post('/imaging-compare/sessions')
      .send({ patientId: 'P100001', name: '胸部 CT 随访', seriesGroups })
      .expect(201)
    expect(res.body.id).toMatch(/^cmp-/)
    expect(res.body.seriesGroups).toHaveLength(3)
    expect(res.body.sync).toEqual({ panZoom: true, wwwl: true, frame: true })
    expect(['multi-timepoint', 'multi-series', 'multi-modality']).toContain(res.body.groupType)
  })

  it('POST 序列分组少于 2 个 → 400 (zod)', async () => {
    await request(app.getHttpServer())
      .post('/imaging-compare/sessions')
      .send({ patientId: 'P100001', seriesGroups: [seriesGroups[0]] })
      .expect(400)
  })

  it('POST 序列分组重复 → 400', async () => {
    await request(app.getHttpServer())
      .post('/imaging-compare/sessions')
      .send({
        patientId: 'P100001',
        seriesGroups: [seriesGroups[0], seriesGroups[0]],
      })
      .expect(400)
  })

  it('GET /imaging-compare/sessions 列表 → 200 且含 seed 会话', async () => {
    const res = await request(app.getHttpServer())
      .get('/imaging-compare/sessions')
      .expect(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThanOrEqual(3)
    expect(res.body.some((s: { id: string }) => s.id === 'cmp-seed-001')).toBe(true)
  })

  it('GET /imaging-compare/sessions?patientId= 过滤 → 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/imaging-compare/sessions?patientId=P100001')
      .expect(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.every((s: { patientId: string }) => s.patientId === 'P100001')).toBe(true)
  })

  it('GET /imaging-compare/sessions/:id 详情 → 200; 不存在 → 404', async () => {
    const res = await request(app.getHttpServer())
      .get('/imaging-compare/sessions/cmp-seed-002')
      .expect(200)
    expect(res.body.name).toBe('PET-CT 多模态并排')
    await request(app.getHttpServer()).get('/imaging-compare/sessions/not-exist').expect(404)
  })

  it('DELETE /imaging-compare/sessions/:id → 200 (内存会话)', async () => {
    const created = await request(app.getHttpServer())
      .post('/imaging-compare/sessions')
      .send({ patientId: 'P100002', name: '待删除', seriesGroups: seriesGroups.slice(0, 2) })
      .expect(201)
    await request(app.getHttpServer())
      .delete(`/imaging-compare/sessions/${created.body.id}`)
      .expect(200)
    await request(app.getHttpServer()).get(`/imaging-compare/sessions/${created.body.id}`).expect(404)
  })

  it('GET /imaging-compare/sessions/:id/sync → 200 (会话级同步开关)', async () => {
    const res = await request(app.getHttpServer())
      .get('/imaging-compare/sessions/cmp-seed-001/sync')
      .expect(200)
    expect(res.body.sessionId).toBe('cmp-seed-001')
    expect(res.body.sync).toHaveProperty('panZoom')
    expect(res.body.sync).toHaveProperty('wwwl')
    expect(res.body.sync).toHaveProperty('frame')
  })

  it('PATCH /imaging-compare/sessions/:id/sync → 200, 部分更新合并', async () => {
    const res = await request(app.getHttpServer())
      .patch('/imaging-compare/sessions/cmp-seed-001/sync')
      .send({ wwwl: false, frame: true })
      .expect(200)
    expect(res.body.sync.wwwl).toBe(false)
    expect(res.body.sync.panZoom).toBe(true)
    expect(res.body.sync.frame).toBe(true)
  })

  it('PATCH sync 空 body → 400 (zod refine)', async () => {
    await request(app.getHttpServer())
      .patch('/imaging-compare/sessions/cmp-seed-001/sync')
      .send({})
      .expect(400)
  })

  it('POST /imaging-compare/sessions/:id/difference → 200 差异指标完整', async () => {
    const res = await request(app.getHttpServer())
      .post('/imaging-compare/sessions/cmp-seed-001/difference')
      .send({
        seriesA: '1.2.826.0.1.3680043.8.498.202601010001.1',
        seriesB: '1.2.826.0.1.3680043.8.498.202603200003.1',
        sliceIndex: 32,
      })
      .expect(201)
    expect(res.body.meanA).toBeGreaterThan(0)
    expect(typeof res.body.varianceDiff).toBe('number')
    expect(res.body.histogramDiff).toBeGreaterThanOrEqual(0)
    expect(res.body.histogramDiff).toBeLessThanOrEqual(1)
    expect(res.body.hotRegionRatio).toBeGreaterThanOrEqual(0)
    expect(res.body.hotRegionRatio).toBeLessThanOrEqual(1)
    expect(res.body.histogram).toHaveLength(64)
    expect(res.body.pixelCount).toBe(128 * 128)
  })

  it('POST difference 序列不在会话中 → 400', async () => {
    await request(app.getHttpServer())
      .post('/imaging-compare/sessions/cmp-seed-001/difference')
      .send({ seriesA: 'other.series', seriesB: 'another.series' })
      .expect(400)
  })
})
