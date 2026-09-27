/**
 * [G005 W9-QC] 统一量表 spec: 配置/评分/等级/一票否决/确定性
 */
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { QualityRubricService } from './quality-rubric.service'
import { QualityRubricController } from './quality-rubric.controller'
import type { RubricSubmission } from './quality-rubric.types'

const GOOD: RubricSubmission = {
  reportId: 'RPT-TEST-1',
  modality: 'CT',
  findings: '双肺纹理清晰，右肺上叶见一结节影，大小约 12mm×10mm，密度均匀，边界清楚，可见轻度强化。既往吸烟史，临床化验无异常。',
  impression: '1. 右肺上叶结节，考虑良性可能性大。 2. 纵隔未见肿大淋巴结。',
  diagnosis: '右肺上叶结节',
  recommendation: '建议 3 个月后复查胸部 CT，随诊观察。',
  structuredFieldsComplete: 0.95,
  signed: true,
  criticalMarked: true,
  priority: 'stat',
  leftRightOk: true,
  onTimeRate: 96,
  submitAt: '2026-08-10T08:00:00.000Z',
  reviewStartedAt: '2026-08-10T07:50:00.000Z',
  signedAt: '2026-08-10T08:20:00.000Z',
  hasReviewerSignature: true,
  criticalNotified: true,
  criticalAcked: true,
  priorityQueue: true,
}

describe('QualityRubricService (统一量表)', () => {
  let service: QualityRubricService

  beforeEach(() => {
    service = new QualityRubricService()
  })

  it('默认量表: 3 维度 / 15 子项, 权重>0', () => {
    const rubric = service.getRubric()
    expect(rubric.dimensions).toHaveLength(3)
    const subItems = rubric.dimensions.reduce((a, d) => a + d.subItems.length, 0)
    expect(subItems).toBe(15)
    const stats = service.getStats()
    expect(stats.ruleCount).toBeGreaterThan(20)
    expect(stats.standard).toContain('2024')
  })

  it('高分提交 → A 级 / publishable / bonusEligible', () => {
    const result = service.evaluateSubmission(GOOD)
    expect(result.totalScore).toBeGreaterThanOrEqual(90)
    expect(result.grade).toBe('A')
    expect(result.publishable).toBe(true)
    expect(result.bonusEligible).toBe(true)
    expect(result.dimensions).toHaveLength(3)
    expect(result.dimensions[0]!.subItems).toHaveLength(5)
  })

  it('低分提交 (缺所见/印象/签名/危急值) → D 级 / 不可发布', () => {
    const bad: RubricSubmission = {
      reportId: 'RPT-TEST-2',
      findings: '未见异常',
      impression: '正常',
      diagnosis: '',
      recommendation: '',
      structuredFieldsComplete: 0.2,
      signed: false,
      criticalMarked: false,
      priority: 'routine',
      leftRightOk: false,
      onTimeRate: 60,
      submitAt: '2026-08-10T08:00:00.000Z',
      reviewStartedAt: '2026-08-10T07:00:00.000Z',
      signedAt: '2026-08-11T08:00:00.000Z',
      hasReviewerSignature: false,
      criticalNotified: false,
      criticalAcked: false,
      priorityQueue: false,
    }
    const result = service.evaluateSubmission(bad)
    expect(result.totalScore).toBeLessThan(60)
    expect(result.grade).toBe('D')
    expect(result.publishable).toBe(false)
  })

  it('一票否决: 命中 hardFailPatterns → passed=false', () => {
    const hardFail = service.evaluateSubmission({ ...GOOD, findings: '患者姓名不符，XXX 待补充' })
    expect(hardFail.hardFailTriggered.length).toBeGreaterThan(0)
    expect(hardFail.passed).toBe(false)
    expect(hardFail.publishable).toBe(false)
  })

  it('评分确定性: 同输入同输出', () => {
    const a = service.evaluateSubmission(GOOD)
    const b = service.evaluateSubmission(GOOD)
    expect(a.totalScore).toBe(b.totalScore)
    expect(a.grade).toBe(b.grade)
  })

  it('更新量表: 维度权重生效并递增版本; 非法输入 400', () => {
    const before = service.getRubric().version
    const updated = service.updateRubric({ passThreshold: 70, updatedBy: 'tester' })
    expect(updated.passThreshold).toBe(70)
    expect(updated.version).toBe(before + 1)
    expect(() => service.updateRubric({ dimensions: [] })).toThrow()
  })

  it('reportId 无 Prisma 时回退确定性 seed 提交', async () => {
    const result = await service.evaluate({ reportId: 'RPT-SEED-9' })
    expect(result.reportId).toBe('RPT-SEED-9')
    expect(result.totalScore).toBeGreaterThan(0)
  })
})

describe('QualityRubricController (端点)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [QualityRubricController],
      providers: [QualityRubricService],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /quality/rubric → 200 量表', async () => {
    const res = await request(app.getHttpServer()).get('/quality/rubric').expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.dimensions).toHaveLength(3)
  })

  it('POST /quality/rubric/evaluate → 200 加权总分+分项+等级', async () => {
    const res = await request(app.getHttpServer()).post('/quality/rubric/evaluate').send({ submission: GOOD }).expect(200)
    expect(res.body.data.totalScore).toBeGreaterThanOrEqual(90)
    expect(res.body.data.dimensions).toHaveLength(3)
    expect(res.body.data.grade).toBe('A')
  })

  it('GET /quality/rubric/grade-bands → 200 4 等级', async () => {
    const res = await request(app.getHttpServer()).get('/quality/rubric/grade-bands').expect(200)
    expect(res.body.data).toHaveLength(4)
  })

  it('PUT /quality/rubric → 200 更新', async () => {
    const res = await request(app.getHttpServer()).put('/quality/rubric').send({ passThreshold: 65 }).expect(200)
    expect(res.body.data.passThreshold).toBe(65)
  })
})
