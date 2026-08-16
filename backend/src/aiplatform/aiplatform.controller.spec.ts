/**
 * [G005 v3.0.6.11-101 Wave 1B (G-10)] AiPlatformController 新端点 spec
 * - POST /ai-platform/denoise → 200 (合成回退 / 真实图 + gaussian 核)
 * - GET  /ai-platform/denoise/history → 200
 * - POST /ai-platform/denoise/history/clear → 200
 */
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { AiPlatformController } from './aiplatform.controller'
import { AiPlatformService } from './aiplatform.service'
import { PrismaService } from '../prisma/prisma.service'

describe('AiPlatformController (G-10 新端点)', () => {
  let app: INestApplication
  let svc: AiPlatformService

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [AiPlatformController],
      providers: [
        AiPlatformService,
        { provide: PrismaService, useValue: { auditLog: { create: jest.fn() } } },
      ],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
    svc = moduleRef.get(AiPlatformService)
  })

  afterAll(async () => {
    await app.close()
  })

  afterEach(async () => {
    await svc.clearDenoiseHistory()
  })

  it('POST /ai-platform/denoise (无图) → 200, synthetic 回退, 含噪声估计', async () => {
    const res = await request(app.getHttpServer())
      .post('/ai-platform/denoise')
      .send({ strength: 50, modelId: 'unet' })
      .expect(200)
    expect(res.body.data.source).toBe('synthetic')
    expect(res.body.data.algorithm).toBe('synthetic-phantom')
    expect(res.body.data.noiseEstimate).toBeDefined()
    expect(res.body.data.historyId).toBeDefined()
  })

  it('POST /ai-platform/denoise (kernel=gaussian) → 200, kernel 透传', async () => {
    const res = await request(app.getHttpServer())
      .post('/ai-platform/denoise')
      .send({ strength: 50, kernel: 'gaussian' })
      .expect(200)
    expect(res.body.data.kernel).toBe('gaussian')
    expect(res.body.data.preset).toBeDefined()
  })

  it('GET /ai-platform/denoise/history → 200 且含刚才的记录', async () => {
    await request(app.getHttpServer())
      .post('/ai-platform/denoise')
      .send({ strength: 40, kernel: 'median' })
      .expect(200)
    const res = await request(app.getHttpServer()).get('/ai-platform/denoise/history').expect(200)
    expect(Array.isArray(res.body.data)).toBe(true)
    expect(res.body.data.length).toBeGreaterThanOrEqual(1)
    expect(res.body.data[0]?.kernel).toBe('median')
  })

  it('POST /ai-platform/denoise/history/clear → 200 且清空', async () => {
    await request(app.getHttpServer())
      .post('/ai-platform/denoise')
      .send({ strength: 40 })
      .expect(200)
    const res = await request(app.getHttpServer()).post('/ai-platform/denoise/history/clear').expect(200)
    expect(res.body.data.cleared).toBe(true)
    const h = await request(app.getHttpServer()).get('/ai-platform/denoise/history').expect(200)
    expect(h.body.data.length).toBe(0)
  })

  it('POST /ai-platform/denoise 非法 kernel → 400 (zod)', async () => {
    await request(app.getHttpServer())
      .post('/ai-platform/denoise')
      .send({ kernel: 'not-a-kernel' })
      .expect(400)
  })
})
