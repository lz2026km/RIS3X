/**
 * G005 RIS v3.0.6.11-104 Wave 3C (知情同意落库绑定) - 控制器端点 spec
 *
 * - POST /consent-education/records                    → 200 (patientId/examId 绑定)
 * - GET  /consent-education/records?patientId=&examId= → 200 (过滤)
 * - POST /consent-education/records/:id/sign           → 200 (签署)
 * - GET  /consent-education/verify?examId=&type=       → 200 (同意校验)
 * - GET  /consent-education/verify (缺 examId)         → 400 (zod)
 * - POST /consent-education/records (非法 status)      → 400 (zod)
 */
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { ConsentEducationController } from './consent-education.controller'
import { ConsentEducationService } from './consent-education.service'

const recordFixture = {
  id: 'C-W3C-1',
  patientId: 'P-1',
  patient: '张三',
  examId: 'EX-1',
  type: 'enhanced',
  procedure: '胸部增强CT',
  signedAt: null,
  status: 'pending',
  witness: null,
  witnessName: null,
  createdAt: '2026-09-14',
}

describe('ConsentEducationController (Wave 3C 端点)', () => {
  let app: INestApplication
  const serviceMock = {
    listConsents: jest.fn().mockReturnValue([recordFixture]),
    getConsent: jest.fn().mockReturnValue(recordFixture),
    createConsent: jest.fn().mockReturnValue(recordFixture),
    updateConsent: jest.fn().mockReturnValue({ ...recordFixture, status: 'refused' }),
    signConsent: jest.fn().mockReturnValue({ ...recordFixture, status: 'signed', signedAt: '2026-09-14T00:00:00Z' }),
    verifyConsent: jest.fn().mockReturnValue({ examId: 'EX-1', type: 'enhanced', signed: true, required: true, status: 'signed', recordId: 'C-W3C-1', checkedAt: '2026-09-14T00:00:00Z' }),
    listMaterials: jest.fn().mockReturnValue([]),
    getMaterial: jest.fn(),
    createMaterial: jest.fn(),
    updateMaterial: jest.fn(),
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ConsentEducationController],
      providers: [{ provide: ConsentEducationService, useValue: serviceMock }],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => jest.clearAllMocks())

  it('POST /consent-education/records → 200 (含 examId/patientId 绑定)', async () => {
    const res = await request(app.getHttpServer())
      .post('/consent-education/records')
      .send({ patient: '张三', patientId: 'P-1', examId: 'EX-1', type: 'enhanced', procedure: '胸部增强CT' })
    expect(res.status).toBe(200)
    expect(serviceMock.createConsent).toHaveBeenCalledWith(expect.objectContaining({ patientId: 'P-1', examId: 'EX-1', type: 'enhanced' }))
  })

  it('GET /consent-education/records?patientId=&examId= → 200 (过滤)', async () => {
    const res = await request(app.getHttpServer()).get('/consent-education/records?patientId=P-1&examId=EX-1')
    expect(res.status).toBe(200)
    expect(serviceMock.listConsents).toHaveBeenCalledWith({ patientId: 'P-1', examId: 'EX-1', status: undefined, type: undefined })
  })

  it('POST /consent-education/records/:id/sign → 200 (签署 + 见证人)', async () => {
    const res = await request(app.getHttpServer()).post('/consent-education/records/C-W3C-1/sign').send({ signer: '李医生', witnessName: '王护士' })
    expect(res.status).toBe(200)
    expect(serviceMock.signConsent).toHaveBeenCalledWith('C-W3C-1', { signer: '李医生', witnessName: '王护士' })
    expect(res.body.status).toBe('signed')
  })

  it('GET /consent-education/verify?examId=&type= → 200 (同意校验)', async () => {
    const res = await request(app.getHttpServer()).get('/consent-education/verify?examId=EX-1&type=enhanced')
    expect(res.status).toBe(200)
    expect(serviceMock.verifyConsent).toHaveBeenCalledWith('EX-1', 'enhanced')
    expect(res.body.signed).toBe(true)
  })

  it('GET /consent-education/verify (缺 examId) → 400 (zod)', async () => {
    const res = await request(app.getHttpServer()).get('/consent-education/verify')
    expect(res.status).toBe(400)
  })

  it('POST /consent-education/records (非法 status 更新) → 400 (zod)', async () => {
    const res = await request(app.getHttpServer()).patch('/consent-education/records/C-W3C-1').send({ status: 'invalid-status' })
    expect(res.status).toBe(400)
  })
})
