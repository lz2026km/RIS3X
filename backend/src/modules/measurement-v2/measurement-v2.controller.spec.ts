/**
 * G005 RIS v3.0.6.11-101 Wave 3B (影像测量 V2 + 标注 V2) - 控制器端点 spec
 *
 * - GET    /measurement-v2/types                        → 200
 * - POST   /measurement-v2/compute                      → 200 (确定性计算)
 * - GET    /measurement-v2/measurements?studyUid=       → 200
 * - POST   /measurement-v2/measurements                 → 200
 * - PUT    /measurement-v2/measurements/:id             → 200
 * - DELETE /measurement-v2/measurements/:id             → 200
 * - GET    /measurement-v2/measurements/:id/versions    → 200
 * - POST   /measurement-v2/measurements/:id/rollback    → 200
 * - POST   /measurement-v2/measurements/:id/link-annotation → 200
 * - GET    /measurement-v2/annotations?studyUid=        → 200
 * - POST   /measurement-v2/annotations                  → 200
 * - PUT    /measurement-v2/annotations/:id              → 200
 * - DELETE /measurement-v2/annotations/:id              → 200
 * - GET    /measurement-v2/annotations/:id/versions     → 200
 * - POST   /measurement-v2/annotations/:id/rollback     → 200
 * - POST   /measurement-v2/coordinates/convert          → 200
 * - 非法 type / 缺 studyUid → 400 (zod)
 */
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { MeasurementV2Controller } from './measurement-v2.controller'
import { MeasurementV2Service } from './measurement-v2.service'

const measurementFixture = {
  id: 'mv2-test-1',
  studyUid: '1.2.826.0.1.3680043.10.155.3.0.6.11.CT.1',
  seriesUid: 'SER-1',
  type: 'line',
  points: [{ x: 0, y: 0 }, { x: 3, y: 4 }],
  worldPoints: [{ x: 0, y: 0 }, { x: 3, y: 4 }],
  value: 5,
  unit: 'mm',
  label: '直线 5 mm',
  color: '#22c55e',
  visible: true,
  formula: '√(dx²+dy²)×spacing',
  deterministic: true,
  createdBy: 'viewer-user',
  createdAt: '2026-08-16T00:00:00.000Z',
  updatedAt: '2026-08-16T00:00:00.000Z',
  version: 1,
  versions: [],
  annotationId: null,
}

const annotationFixture = {
  id: 'av2-test-1',
  studyUid: '1.2.826.0.1.3680043.10.155.3.0.6.11.CT.1',
  seriesUid: 'SER-1',
  type: 'arrow',
  pixelPoints: [{ x: 100, y: 100 }, { x: 150, y: 150 }],
  worldPoints: [{ x: 68, y: 68 }, { x: 102, y: 102 }],
  text: '病灶',
  color: '#ff4d4f',
  fontSize: 16,
  visible: true,
  locked: false,
  measurementId: null,
  createdBy: 'viewer-user',
  createdAt: '2026-08-16T00:00:00.000Z',
  updatedAt: '2026-08-16T00:00:00.000Z',
  version: 1,
  versions: [],
}

const versionFixture = { version: 1, value: 5, unit: 'mm', points: [{ x: 0, y: 0 }, { x: 3, y: 4 }], worldPoints: [], label: '直线', color: '#22c55e', note: '创建', createdAt: '2026-08-16T00:00:00.000Z' }

describe('MeasurementV2Controller (Wave 3B 端点)', () => {
  let app: INestApplication
  const serviceMock = {
    listTypes: jest.fn().mockReturnValue([{ type: 'line', label: '直线长度', unit: 'mm', minPoints: 2, fixedPoints: 2, deterministic: true, formula: '√(dx²+dy²)×spacing', precision: 2 }]),
    seedStudyUids: jest.fn().mockReturnValue(['UID-1']),
    compute: jest.fn().mockReturnValue({ type: 'line', value: 5, unit: 'mm', formula: '√(dx²+dy²)×spacing', deterministic: true, precision: 2 }),
    convertCoordinates: jest.fn().mockReturnValue({ points: [{ x: 3, y: 4 }], pixelSpacing: [1, 1], direction: 'pixelToWorld' }),
    listMeasurements: jest.fn().mockResolvedValue([measurementFixture]),
    createMeasurement: jest.fn().mockResolvedValue(measurementFixture),
    updateMeasurement: jest.fn().mockResolvedValue({ ...measurementFixture, label: '更新后', version: 2 }),
    removeMeasurement: jest.fn().mockResolvedValue({ deleted: true, id: 'mv2-test-1' }),
    getMeasurementVersions: jest.fn().mockReturnValue([versionFixture]),
    rollbackMeasurement: jest.fn().mockResolvedValue(measurementFixture),
    linkAnnotation: jest.fn().mockResolvedValue({ measurement: measurementFixture, annotation: annotationFixture }),
    listAnnotations: jest.fn().mockResolvedValue([annotationFixture]),
    createAnnotation: jest.fn().mockResolvedValue(annotationFixture),
    updateAnnotation: jest.fn().mockResolvedValue({ ...annotationFixture, text: '更新标注', version: 2 }),
    removeAnnotation: jest.fn().mockResolvedValue({ deleted: true, id: 'av2-test-1' }),
    getAnnotationVersions: jest.fn().mockReturnValue([versionFixture]),
    rollbackAnnotation: jest.fn().mockResolvedValue(annotationFixture),
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [MeasurementV2Controller],
      providers: [{ provide: MeasurementV2Service, useValue: serviceMock }],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => jest.clearAllMocks())

  it('GET /measurement-v2/types → 200 (类型元数据)', async () => {
    const res = await request(app.getHttpServer()).get('/measurement-v2/types')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data[0].deterministic).toBe(true)
  })

  it('POST /measurement-v2/compute → 200 (3-4-5 直线)', async () => {
    const res = await request(app.getHttpServer())
      .post('/measurement-v2/compute')
      .send({ type: 'line', points: [{ x: 0, y: 0 }, { x: 3, y: 4 }], pixelSpacing: [1, 1] })
    expect(res.status).toBe(200)
    expect(serviceMock.compute).toHaveBeenCalledWith({ type: 'line', points: [{ x: 0, y: 0 }, { x: 3, y: 4 }], pixelSpacing: [1, 1] })
  })

  it('POST /measurement-v2/measurements → 200 (创建测量)', async () => {
    const res = await request(app.getHttpServer())
      .post('/measurement-v2/measurements')
      .send({ studyUid: 'UID-1', type: 'line', points: [{ x: 0, y: 0 }, { x: 3, y: 4 }] })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('GET /measurement-v2/measurements?studyUid= → 200 (列表)', async () => {
    const res = await request(app.getHttpServer()).get('/measurement-v2/measurements?studyUid=UID-1')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })

  it('GET /measurement-v2/measurements (缺 studyUid) → 400', async () => {
    const res = await request(app.getHttpServer()).get('/measurement-v2/measurements')
    expect(res.status).toBe(400)
  })

  it('PUT /measurement-v2/measurements/:id → 200 (更新)', async () => {
    const res = await request(app.getHttpServer()).put('/measurement-v2/measurements/mv2-test-1').send({ label: '更新后' })
    expect(res.status).toBe(200)
    expect(res.body.data.version).toBe(2)
  })

  it('DELETE /measurement-v2/measurements/:id → 200', async () => {
    const res = await request(app.getHttpServer()).delete('/measurement-v2/measurements/mv2-test-1')
    expect(res.status).toBe(200)
    expect(res.body.data.deleted).toBe(true)
  })

  it('GET /measurement-v2/measurements/:id/versions → 200 (历史版本)', async () => {
    const res = await request(app.getHttpServer()).get('/measurement-v2/measurements/mv2-test-1/versions')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })

  it('POST /measurement-v2/measurements/:id/rollback → 200 (回滚)', async () => {
    const res = await request(app.getHttpServer()).post('/measurement-v2/measurements/mv2-test-1/rollback').send({ version: 1 })
    expect(res.status).toBe(200)
    expect(serviceMock.rollbackMeasurement).toHaveBeenCalledWith('mv2-test-1', 1)
  })

  it('POST /measurement-v2/measurements/:id/link-annotation → 200 (测量↔标注关联)', async () => {
    const res = await request(app.getHttpServer()).post('/measurement-v2/measurements/mv2-test-1/link-annotation').send({ annotationId: 'av2-test-1' })
    expect(res.status).toBe(200)
    expect(res.body.data.annotation.measurementId).toBeNull()
  })

  it('GET /measurement-v2/annotations?studyUid= → 200 (标注列表)', async () => {
    const res = await request(app.getHttpServer()).get('/measurement-v2/annotations?studyUid=UID-1')
    expect(res.status).toBe(200)
    expect(res.body.data[0].worldPoints[0]).toEqual({ x: 68, y: 68 })
  })

  it('POST /measurement-v2/annotations → 200 (创建标注, 坐标序列化)', async () => {
    const res = await request(app.getHttpServer())
      .post('/measurement-v2/annotations')
      .send({ studyUid: 'UID-1', type: 'arrow', pixelPoints: [{ x: 100, y: 100 }, { x: 150, y: 150 }], pixelSpacing: [0.68, 0.68] })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('PUT /measurement-v2/annotations/:id → 200 (更新标注)', async () => {
    const res = await request(app.getHttpServer()).put('/measurement-v2/annotations/av2-test-1').send({ text: '更新标注' })
    expect(res.status).toBe(200)
    expect(res.body.data.version).toBe(2)
  })

  it('DELETE /measurement-v2/annotations/:id → 200', async () => {
    const res = await request(app.getHttpServer()).delete('/measurement-v2/annotations/av2-test-1')
    expect(res.status).toBe(200)
    expect(res.body.data.deleted).toBe(true)
  })

  it('GET /measurement-v2/annotations/:id/versions → 200', async () => {
    const res = await request(app.getHttpServer()).get('/measurement-v2/annotations/av2-test-1/versions')
    expect(res.status).toBe(200)
  })

  it('POST /measurement-v2/annotations/:id/rollback → 200', async () => {
    const res = await request(app.getHttpServer()).post('/measurement-v2/annotations/av2-test-1/rollback').send({ version: 1 })
    expect(res.status).toBe(200)
    expect(serviceMock.rollbackAnnotation).toHaveBeenCalledWith('av2-test-1', 1)
  })

  it('POST /measurement-v2/coordinates/convert → 200 (像素→世界)', async () => {
    const res = await request(app.getHttpServer())
      .post('/measurement-v2/coordinates/convert')
      .send({ points: [{ x: 100, y: 200 }], pixelSpacing: [1, 1], direction: 'pixelToWorld' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('POST /measurement-v2/compute (非法 type) → 400 (zod)', async () => {
    const res = await request(app.getHttpServer())
      .post('/measurement-v2/compute')
      .send({ type: 'circleArea', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })
    expect(res.status).toBe(400)
  })

  it('POST /measurement-v2/annotations (缺 pixelPoints) → 400 (zod)', async () => {
    const res = await request(app.getHttpServer()).post('/measurement-v2/annotations').send({ studyUid: 'UID-1', type: 'text' })
    expect(res.status).toBe(400)
  })
})
