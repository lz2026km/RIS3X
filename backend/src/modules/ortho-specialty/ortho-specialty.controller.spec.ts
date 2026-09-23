/**
 * G005 放射RIS系统 - 骨科影像分析 (ortho-specialty) 控制器 spec
 */
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { OrthoSpecialtyController } from './ortho-specialty.controller'
import { OrthoSpecialtyService } from './ortho-specialty.service'

const fixture = { id: 'OX001', name: '张伟', age: 65, gender: 'M', joint: 'knee', modality: 'XR', klGrade: 'III', oaScore: 7.5, fracture: false, date: '2026-07-15' }

describe('OrthoSpecialtyController (孤儿模块端点)', () => {
  let app: INestApplication
  const serviceMock = {
    listStudies: jest.fn().mockReturnValue({ success: true, data: [fixture] }),
    createStudy: jest.fn().mockReturnValue({ success: true, data: { ...fixture, id: 'OX006' } }),
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OrthoSpecialtyController],
      providers: [{ provide: OrthoSpecialtyService, useValue: serviceMock }],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => jest.clearAllMocks())

  it('GET /ortho-specialty/studies → 200', async () => {
    const res = await request(app.getHttpServer()).get('/ortho-specialty/studies')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
  })

  it('POST /ortho-specialty/studies → 201', async () => {
    const res = await request(app.getHttpServer()).post('/ortho-specialty/studies').send({ name: '新患者', joint: 'knee' })
    expect(res.status).toBe(201)
    expect(serviceMock.createStudy).toHaveBeenCalledWith(expect.objectContaining({ name: '新患者' }))
  })
})
