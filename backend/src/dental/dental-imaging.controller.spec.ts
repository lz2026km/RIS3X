/**
 * G005 放射RIS系统 - 口腔影像后处理 (dental-imaging) 控制器端点 spec
 * 覆盖 13 个前端 dentalApi 调用但此前后端缺失的端点。
 */
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { DentalImagingController } from './dental-imaging.controller'
import { DentalImagingService } from './dental-imaging.service'

const seg = { id: 'seg-1', type: 'tooth', label: '自动分割结果', volume: 100, color: '#52c41a' }

describe('DentalImagingController (后端缺失端点补齐)', () => {
  let app: INestApplication
  const svcMock = {
    getDicomPaths: jest.fn().mockReturnValue({ success: true, data: { series: [{ path: '/pacs/dental/1/series/1', modality: 'CBCT', instanceCount: 320 }] } }),
    getSegments: jest.fn().mockReturnValue({ success: true, data: { segments: [seg] } }),
    triggerSegment: jest.fn().mockReturnValue({ success: true, data: seg }),
    getMpr: jest.fn().mockReturnValue({ success: true, data: { axes: ['axial', 'sagittal', 'coronal'], sliceCount: 100, resolution: '512x512' } }),
    get3dModel: jest.fn().mockReturnValue({ success: true, data: { modelUrl: '/m.stl', format: 'OBJ', triangleCount: 50000 } }),
    getNerveCanal: jest.fn().mockReturnValue({ success: true, data: { lowerAlveolarNerve: { diameter: 3.2, safeDistance: 8.5 } } }),
    getBoneDensity: jest.fn().mockReturnValue({ success: true, data: { regions: [] } }),
    getCbctMeasure: jest.fn().mockReturnValue({ success: true, data: { measurements: [] } }),
    compareScan: jest.fn().mockReturnValue({ success: true, data: { differences: { volume: 0.12 } } }),
    alignScan: jest.fn().mockReturnValue({ success: true, data: { aligned: true, targetScanId: 'S2' } }),
    getMillingStatus: jest.fn().mockReturnValue({ success: true, data: { id: 'CAD-1', status: 'in-progress', progress: 65 } }),
    listAbutments: jest.fn().mockReturnValue({ success: true, data: [] }),
    priceCheck: jest.fn().mockReturnValue({ success: true, data: [{ modelId: 'M1', brand: 'Straub', price: 1980 }] }),
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [DentalImagingController],
      providers: [{ provide: DentalImagingService, useValue: svcMock }],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => jest.clearAllMocks())

  it('GET /dental/studies/:id/dicom-paths → 200', async () => {
    const res = await request(app.getHttpServer()).get('/dental/studies/ST1/dicom-paths')
    expect(res.status).toBe(200)
    expect(res.body.data.series).toHaveLength(1)
  })

  it('GET /dental/studies/:id/segments → 200', async () => {
    const res = await request(app.getHttpServer()).get('/dental/studies/ST1/segments')
    expect(res.status).toBe(200)
    expect(res.body.data.segments).toHaveLength(1)
  })

  it('POST /dental/studies/:id/segment → 201', async () => {
    const res = await request(app.getHttpServer()).post('/dental/studies/ST1/segment').send({ model: 'tooth' })
    expect(res.status).toBe(201)
    expect(svcMock.triggerSegment).toHaveBeenCalledWith('ST1', { model: 'tooth' })
  })

  it('GET /dental/studies/:id/mpr → 200', async () => {
    const res = await request(app.getHttpServer()).get('/dental/studies/ST1/mpr')
    expect(res.status).toBe(200)
    expect(res.body.data.axes).toContain('axial')
  })

  it('GET /dental/studies/:id/3d-model → 200', async () => {
    const res = await request(app.getHttpServer()).get('/dental/studies/ST1/3d-model')
    expect(res.status).toBe(200)
    expect(res.body.data.modelUrl).toBeTruthy()
  })

  it('GET /dental/cbct/:id/nerve-canal → 200', async () => {
    const res = await request(app.getHttpServer()).get('/dental/cbct/CB1/nerve-canal')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('GET /dental/cbct/:id/bone-density → 200', async () => {
    const res = await request(app.getHttpServer()).get('/dental/cbct/CB1/bone-density')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('GET /dental/cbct/:id/measure → 200', async () => {
    const res = await request(app.getHttpServer()).get('/dental/cbct/CB1/measure')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('GET /dental/scan/:id/compare → 200', async () => {
    const res = await request(app.getHttpServer()).get('/dental/scan/S1/compare')
    expect(res.status).toBe(200)
    expect(res.body.data.differences).toBeTruthy()
  })

  it('POST /dental/scan/:id/align → 200', async () => {
    const res = await request(app.getHttpServer()).post('/dental/scan/S1/align').send({ targetScanId: 'S2' })
    expect(res.status).toBe(200)
    expect(res.body.data.aligned).toBe(true)
    expect(svcMock.alignScan).toHaveBeenCalledWith('S1', { targetScanId: 'S2' })
  })

  it('GET /dental/cad/milling-status/:id → 200', async () => {
    const res = await request(app.getHttpServer()).get('/dental/cad/milling-status/CAD-1')
    expect(res.status).toBe(200)
    expect(res.body.data.status).toBe('in-progress')
  })

  it('GET /dental/implant/abutments → 200', async () => {
    const res = await request(app.getHttpServer()).get('/dental/implant/abutments?brand=Straumann')
    expect(res.status).toBe(200)
    expect(svcMock.listAbutments).toHaveBeenCalledWith('Straumann')
  })

  it('GET /dental/implant/inventory/price-check → 200', async () => {
    const res = await request(app.getHttpServer()).get('/dental/implant/inventory/price-check?brand=Straumann&models=M1')
    expect(res.status).toBe(200)
    expect(svcMock.priceCheck).toHaveBeenCalledWith('Straumann', 'M1')
  })
})
