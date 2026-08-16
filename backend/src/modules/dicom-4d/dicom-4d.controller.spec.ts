/**
 * [G005 v3.0.6.11-101 Wave 1B (G-07)] Dicom4dController 新端点 spec
 * - POST /dicom/4d/phase-info → 200
 * - POST /dicom/4d/movie      → 200
 * - 委托正确性 (controller → service)
 */
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { Dicom4dController } from './dicom-4d.controller'
import { Dicom4dService } from './dicom-4d.service'

const phaseInfoFixture = {
  seriesUid: '4d.real.series',
  gatingType: 'cardiac',
  cardiacPhase: 45,
  respiratoryPhase: 0,
  cardiacCycleMs: 800,
  respiratoryCycleMs: 4000,
  frameCount: 20,
  distribution: {
    gatingType: 'cardiac',
    cardiac: Array.from({ length: 20 }, (_, phase) => ({ phase, count: 1 })),
    respiratory: Array.from({ length: 10 }, (_, phase) => ({ phase, count: 0 })),
    totalFrames: 20,
  },
}

const movieFixture = {
  seriesUid: '4d.real.series',
  modality: 'CT',
  studyUid: 'study-4d',
  frameCount: 20,
  gatingType: 'cardiac',
  frameRate: 10,
  cycleMs: 800,
  framesPerPhase: 1,
  interpolatedFrames: 0,
  interpolationMode: 'phase-bin',
  bpm: 75,
  rrIntervals: [800, 810, 790],
  ecgWaveform: [
    { t: 0, rr: 800 },
    { t: 800, rr: 810 },
  ],
  phaseSequence: Array.from({ length: 20 }, (_, i) => i % 20),
}

describe('Dicom4dController (G-07 新端点)', () => {
  let app: INestApplication
  const serviceMock = {
    list: jest.fn().mockResolvedValue([]),
    getFrames: jest.fn().mockResolvedValue([]),
    getPhase: jest.fn().mockResolvedValue(phaseInfoFixture),
    getPhaseInfo: jest.fn().mockResolvedValue(phaseInfoFixture),
    getMovieData: jest.fn().mockResolvedValue(movieFixture),
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [Dicom4dController],
      providers: [{ provide: Dicom4dService, useValue: serviceMock }],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => jest.clearAllMocks())

  it('POST /dicom/4d/phase-info 返回 200 且含相位分布', async () => {
    const res = await request(app.getHttpServer())
      .post('/dicom/4d/phase-info')
      .send({ seriesUid: '4d.real.series' })
      .expect(200)
    expect(res.body.distribution?.cardiac).toHaveLength(20)
    expect(res.body.frameCount).toBe(20)
    expect(serviceMock.getPhaseInfo).toHaveBeenCalledWith('4d.real.series')
  })

  it('POST /dicom/4d/movie 返回 200 且含 RR 间期/插值参数', async () => {
    const res = await request(app.getHttpServer())
      .post('/dicom/4d/movie')
      .send({ seriesUid: '4d.real.series' })
      .expect(200)
    expect(res.body.bpm).toBeGreaterThan(0)
    expect(res.body.rrIntervals.length).toBeGreaterThan(0)
    expect(serviceMock.getMovieData).toHaveBeenCalledWith('4d.real.series')
  })

  it('POST /dicom/4d/phase-info 缺 seriesUid → 400 (zod)', async () => {
    await request(app.getHttpServer()).post('/dicom/4d/phase-info').send({}).expect(400)
  })

  it('POST /dicom/4d/frames 既有端点仍可用 (201 Created)', async () => {
    const res = await request(app.getHttpServer())
      .post('/dicom/4d/frames')
      .send({ seriesUid: '4d.real.series' })
      .expect(201)
    expect(Array.isArray(res.body)).toBe(true)
  })

  it('controller 方法委托 service (直接调用模式)', async () => {
    const ctrl = app.get(Dicom4dController)
    await ctrl.getPhaseInfo({ seriesUid: '4d.real.series' })
    await ctrl.getMovieData({ seriesUid: '4d.real.series' })
    expect(serviceMock.getPhaseInfo).toHaveBeenCalled()
    expect(serviceMock.getMovieData).toHaveBeenCalled()
  })
})
