/**
 * G005 放射RIS系统 - AI 融合工作站控制器 spec
 */
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { AiFusionWorkspaceController } from './ai-fusion-workspace.controller'
import { AiFusionWorkspaceService } from './ai-fusion-workspace.service'

describe('AiFusionWorkspaceController (孤儿模块端点)', () => {
  let app: INestApplication
  const fixture = { id: 'FS-001', patient: '张伟', modalities: 'CT+PET', fusionScore: 0.88, findings: 3, aiAlerts: 1, status: 'complete', date: '2026-09-21' }
  const insight = { id: 'AI-001', type: 'lesion', finding: '右肺上叶结节', confidence: 0.91, modality: 'CT', source: 'lung-cad', actionable: true }
  const serviceMock = {
    getWorkspace: jest.fn().mockReturnValue({ success: true, data: { studies: [fixture], aiInsights: [insight] } }),
    listStudies: jest.fn().mockReturnValue({ success: true, data: [fixture] }),
    listInsights: jest.fn().mockReturnValue({ success: true, data: [insight] }),
    runFusion: jest.fn().mockReturnValue({ success: true, data: { ...fixture, fusionScore: 0.93 } }),
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AiFusionWorkspaceController],
      providers: [{ provide: AiFusionWorkspaceService, useValue: serviceMock }],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => jest.clearAllMocks())

  it('GET /ai/fusion-workspace → 200', async () => {
    const res = await request(app.getHttpServer()).get('/ai/fusion-workspace')
    expect(res.status).toBe(200)
    expect(res.body.data.studies).toHaveLength(1)
    expect(res.body.data.aiInsights).toHaveLength(1)
  })

  it('GET /ai/fusion-workspace?modality=CT → 200', async () => {
    const res = await request(app.getHttpServer()).get('/ai/fusion-workspace?modality=CT')
    expect(res.status).toBe(200)
    expect(serviceMock.getWorkspace).toHaveBeenCalledWith('CT')
  })

  it('GET /ai/fusion-workspace/studies → 200', async () => {
    const res = await request(app.getHttpServer()).get('/ai/fusion-workspace/studies')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })

  it('GET /ai/fusion-workspace/insights → 200', async () => {
    const res = await request(app.getHttpServer()).get('/ai/fusion-workspace/insights')
    expect(res.status).toBe(200)
    expect(res.body.data[0].type).toBe('lesion')
  })

  it('POST /ai/fusion-workspace/run → 201', async () => {
    const res = await request(app.getHttpServer()).post('/ai/fusion-workspace/run').send({ studyId: 'FS-001' })
    expect(res.status).toBe(201)
    expect(serviceMock.runFusion).toHaveBeenCalledWith('FS-001')
  })
})
