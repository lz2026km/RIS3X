/**
 * G005 RIS v3.0.6.11-101 Wave 7A — AiDraftV2Controller 端点规格
 * 覆盖: extract-fields / generate / suggest / drafts 四端点 HTTP 200 + 响应形状
 */
import { Test } from '@nestjs/testing'
import request from 'supertest'
import type { INestApplication } from '@nestjs/common'
import { AiDraftV2Controller } from './ai-draft-v2.controller'
import { AiDraftV2Service } from './ai-draft-v2.service'
import { PrismaService } from '../../prisma/prisma.service'

describe('AiDraftV2Controller (modules/ai-draft-v2) — 端点 200', () => {
  let app: INestApplication

  beforeAll(async () => {
    const prismaMock = {
      report: { findFirst: jest.fn().mockRejectedValue(new Error('no db')) },
      aiReportDraft: { create: jest.fn().mockRejectedValue(new Error('no db')) },
    }
    const moduleRef = await Test.createTestingModule({
      controllers: [AiDraftV2Controller],
      providers: [AiDraftV2Service, { provide: PrismaService, useValue: prismaMock }],
    }).compile()
    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api')
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('POST /api/ai-draft-v2/extract-fields → 200 且返回结构化字段', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ai-draft-v2/extract-fields')
      .send({ findings: '右肺上叶可见大小约18mm×15mm结节影，边缘毛刺，与既往检查相比无明显变化，考虑周围型肺癌可能。', modality: 'CT', bodyPart: '胸部' })
      .expect(200)
    expect(Array.isArray(res.body.fields)).toBe(true)
    expect(res.body.fields.length).toBeGreaterThan(0)
    expect(res.body.categoriesFound).toContain('measurement')
    expect(res.body.modelVersion).toMatch(/v2/)
  })

  it('POST /api/ai-draft-v2/generate → 200 且逐段溯源完整', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ai-draft-v2/generate')
      .send({ patientId: 'P001', examId: 'EXAM-1', modality: 'CT', bodyPart: '胸部', findings: '右肺上叶结节影。', clinicalHistory: '咳嗽' })
      .expect(200)
    expect(res.body.id).toMatch(/^draft-v2-/)
    expect(Array.isArray(res.body.segments)).toBe(true)
    expect(res.body.segments.length).toBeGreaterThanOrEqual(4)
    const seg = res.body.segments[0]
    expect(seg.sources.length).toBeGreaterThan(0)
    expect(seg.sources[0].refId.length).toBeGreaterThan(0)
    expect(res.body.simulated).toBe(true)
  })

  it('POST /api/ai-draft-v2/suggest → 200 且返回建议列表', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/ai-draft-v2/suggest')
      .send({ paragraphs: [{ heading: '影像所见', content: '右肺上叶结节影。' }, { heading: '诊断意见', content: '未见明显异常。' }], modality: 'CT' })
      .expect(200)
    expect(Array.isArray(res.body.suggestions)).toBe(true)
    expect(res.body.suggestions.length).toBeGreaterThan(0)
    expect(typeof res.body.overallScore).toBe('number')
  })

  it('GET /api/ai-draft-v2/drafts → 200 且返回 seed 回退草稿', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/ai-draft-v2/drafts')
      .expect(200)
    expect(Array.isArray(res.body)).toBe(true)
    expect(res.body.length).toBeGreaterThan(0)
  })

  it('POST /api/ai-draft-v2/generate 参数缺失 → 400 (zod 校验)', async () => {
    await request(app.getHttpServer())
      .post('/api/ai-draft-v2/generate')
      .send({ modality: 'CT' })
      .expect(400)
  })
})
