/**
 * [v3.0.6.11-101 Wave 2C] SegmentationV2Controller 端点 spec
 *
 * - POST /segmentation-v2/run          → 200 (分割执行)
 * - GET  /segmentation-v2/segments     → 200 (列表)
 * - GET  /segmentation-v2/segments/:id → 200 (详情)
 * - PATCH /segmentation-v2/segments/:id → 200 (标注)
 * - DELETE /segmentation-v2/segments/:id → 200 (删除)
 * - GET  /segmentation-v2/history      → 200 (历史)
 * - POST /segmentation-v2/segments/:id/measurement → 200 (测量联动)
 * - 非法算法 / 缺 seriesUID → 400 (zod)
 */
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { SegmentationV2Controller } from './segmentation-v2.controller'
import { SegmentationV2Service, type SegmentationV2Segment } from './segmentation-v2.service'

const statsFixture = {
  voxelCount: 128000,
  volumeCm3: 3.136,
  areaCm2: 18.2,
  meanIntensity: 42.5,
  minIntensity: 40,
  maxIntensity: 160,
  boundaryPointCount: 5120,
  bbox: { x: 220, y: 180, z: 4, w: 60, h: 72, d: 20 },
}

const segmentFixture: SegmentationV2Segment = {
  id: 'segv2-test-1',
  seriesUID: '1.2.826.0.1.3680043.10.155.3.0.6.11.CT.S.1',
  algorithm: 'threshold',
  algorithmLabel: '阈值分割',
  thresholdMode: 'otsu',
  params: { thresholdMode: 'otsu' },
  label: '阈值分割',
  color: '#fa8c16',
  organClass: '肝脏',
  source: 'real',
  usedFallback: false,
  stats: statsFixture,
  dims: { width: 512, height: 512, depth: 20 },
  pixelSpacing: [0.7, 0.7],
  sliceThickness: 5,
  rle3d: [{ start: 100, length: 42 }],
  slices: [{ z: 4, width: 512, height: 512, runs: [{ start: 100, length: 42 }] }],
  linkedMeasurement: null,
  createdAt: '2026-08-15T00:00:00.000Z',
}

describe('SegmentationV2Controller (Wave 2C 端点)', () => {
  let app: INestApplication
  const serviceMock = {
    run: jest.fn().mockResolvedValue(segmentFixture),
    list: jest.fn().mockResolvedValue([segmentFixture]),
    get: jest.fn().mockResolvedValue(segmentFixture),
    annotate: jest.fn().mockResolvedValue({ ...segmentFixture, label: '右肺上叶结节', color: '#ff4d4f' }),
    remove: jest.fn().mockResolvedValue({ id: 'segv2-test-1', deleted: true }),
    history: jest.fn().mockResolvedValue([{ id: 'segv2-test-1', seriesUID: 'SER', algorithm: 'threshold', label: '阈值分割', organClass: '肝脏', status: 'active', voxelCount: 128000, volumeCm3: 3.136, createdAt: '2026-08-15T00:00:00.000Z' }]),
    linkMeasurement: jest.fn().mockResolvedValue({ ...segmentFixture, linkedMeasurement: { measurementId: 'm-1', lesionId: 'LT99', diameterMm: 18.16, studyId: 'SER', date: '2026-08-15' } }),
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [SegmentationV2Controller],
      providers: [{ provide: SegmentationV2Service, useValue: serviceMock }],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => jest.clearAllMocks())

  it('POST /segmentation-v2/run → 200, 返回分割结果 (mask + 统计)', async () => {
    const res = await request(app.getHttpServer())
      .post('/segmentation-v2/run')
      .send({ seriesUID: 'SER-1', algorithm: 'threshold', params: { thresholdMode: 'otsu' } })
      .expect(200)
    expect(res.body.segId ?? res.body.id).toBe('segv2-test-1')
    expect(res.body.stats.voxelCount).toBe(128000)
    expect(res.body.stats.bbox.w).toBe(60)
    expect(res.body.rle3d.length).toBeGreaterThan(0)
    expect(serviceMock.run).toHaveBeenCalledWith(expect.objectContaining({ seriesUID: 'SER-1', algorithm: 'threshold' }))
  })

  it('POST /segmentation-v2/run 非法算法 → 400 (zod)', async () => {
    await request(app.getHttpServer())
      .post('/segmentation-v2/run')
      .send({ seriesUID: 'SER-1', algorithm: 'magic-wand' })
      .expect(400)
  })

  it('POST /segmentation-v2/run 缺 seriesUID → 400 (zod)', async () => {
    await request(app.getHttpServer())
      .post('/segmentation-v2/run')
      .send({ algorithm: 'threshold' })
      .expect(400)
  })

  it('GET /segmentation-v2/segments?seriesUID= → 200 列表', async () => {
    const res = await request(app.getHttpServer())
      .get('/segmentation-v2/segments')
      .query({ seriesUID: 'SER-1' })
      .expect(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].stats.voxelCount).toBe(128000)
    expect(serviceMock.list).toHaveBeenCalledWith('SER-1')
  })

  it('GET /segmentation-v2/segments/:id → 200 详情', async () => {
    const res = await request(app.getHttpServer())
      .get('/segmentation-v2/segments/segv2-test-1')
      .expect(200)
    expect(res.body.id).toBe('segv2-test-1')
    expect(res.body.slices.length).toBe(1)
    expect(serviceMock.get).toHaveBeenCalledWith('segv2-test-1')
  })

  it('PATCH /segmentation-v2/segments/:id → 200 标注 (标签/颜色/器官分类)', async () => {
    const res = await request(app.getHttpServer())
      .patch('/segmentation-v2/segments/segv2-test-1')
      .send({ label: '右肺上叶结节', color: '#ff4d4f', organClass: '结节' })
      .expect(200)
    expect(res.body.label).toBe('右肺上叶结节')
    expect(res.body.color).toBe('#ff4d4f')
    expect(serviceMock.annotate).toHaveBeenCalledWith('segv2-test-1', expect.objectContaining({ organClass: '结节' }))
  })

  it('PATCH 非法器官分类 → 400', async () => {
    await request(app.getHttpServer())
      .patch('/segmentation-v2/segments/segv2-test-1')
      .send({ organClass: '外星人' })
      .expect(400)
  })

  it('DELETE /segmentation-v2/segments/:id → 200 删除', async () => {
    const res = await request(app.getHttpServer())
      .delete('/segmentation-v2/segments/segv2-test-1')
      .expect(200)
    expect(res.body.deleted).toBe(true)
    expect(serviceMock.remove).toHaveBeenCalledWith('segv2-test-1')
  })

  it('GET /segmentation-v2/history?seriesUID= → 200 历史', async () => {
    const res = await request(app.getHttpServer())
      .get('/segmentation-v2/history')
      .query({ seriesUID: 'SER-1' })
      .expect(200)
    expect(res.body).toHaveLength(1)
    expect(res.body[0].status).toBe('active')
    expect(serviceMock.history).toHaveBeenCalledWith('SER-1')
  })

  it('POST /segmentation-v2/segments/:id/measurement → 200 测量联动', async () => {
    const res = await request(app.getHttpServer())
      .post('/segmentation-v2/segments/segv2-test-1/measurement')
      .send({ lesionId: 'LT99' })
      .expect(200)
    expect(res.body.linkedMeasurement.diameterMm).toBe(18.16)
    expect(res.body.linkedMeasurement.lesionId).toBe('LT99')
    expect(serviceMock.linkMeasurement).toHaveBeenCalledWith('segv2-test-1', { lesionId: 'LT99' })
  })

  it('controller 方法委托 service (直接调用模式)', async () => {
    const ctrl = app.get(SegmentationV2Controller)
    await ctrl.run({ seriesUID: 'SER-1', algorithm: 'threshold', params: { thresholdMode: 'otsu' } })
    await ctrl.list('SER-1')
    expect(serviceMock.run).toHaveBeenCalled()
    expect(serviceMock.list).toHaveBeenCalledWith('SER-1')
  })
})
