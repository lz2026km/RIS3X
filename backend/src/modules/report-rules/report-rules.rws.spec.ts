// [G005 v3.0.6.11-105 Wave 1C] 国标报告书写规范 (RQI-RWS-03) spec
// 覆盖: 规则库 7 条 / 5 类明显错误命中 / 合规报告零命中 / 签名缺失 / 结论不符 / 规范率 / 端点 200
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { ReportRulesService } from './report-rules.service'
import { ReportRulesController } from './report-rules.controller'
import { PrismaService } from '../../prisma/prisma.service'
import type { RwsReportInput } from './report-rules.types'

// 合规报告: 签名/患者信息/部位/单位齐全, 结论由所见支持, 无模板残留
const COMPLIANT: RwsReportInput = {
  reportId: 'RWS-OK-001',
  examType: 'CT',
  bodyPart: '胸部',
  patientName: '张三',
  patientId: 'P-0001',
  clinicalHistory: '咳嗽',
  findings: '双侧胸廓对称。右肺上叶见一直径约 5mm 磨玻璃结节影, 边缘清晰。左肺下叶见少许纤维条索影。',
  diagnosis: '右肺上叶磨玻璃结节。',
  impression: '右肺上叶磨玻璃结节。',
  conclusion: '右肺上叶磨玻璃结节, 良性炎性病变, 建议 3-6 个月后复查 CT。',
  recommendations: '建议 3-6 个月后复查胸部 CT。',
  signedBy: '李医生',
}

// 不合规报告: 命中全部 7 条规则 (①签名 + ②结论不符 + ③5 类明显错误)
const ALL_VIOLATIONS: RwsReportInput = {
  reportId: 'RWS-BAD-001',
  examType: 'CT',
  bodyPart: '胸部',
  patientName: '张三',
  orderPatientName: '李四',
  clinicalHistory: '胆囊切除术后',
  findings: '胆囊形态正常。肝内见小结节, 大小约 5。',
  impression: '未见明显异常, 请补充 {{结论}}。',
}

describe('ReportRulesService 国标书写规范 (Wave 1C)', () => {
  let service: ReportRulesService

  beforeEach(() => {
    service = new ReportRulesService()
  })

  it('规则库 7 条: ①签名 1 + ②结论 1 + ③明显错误 5, 全部 error', () => {
    const { data, ruleCount, standard, target } = service.getNationalRwsRules()
    expect(ruleCount).toBe(7)
    expect(data).toHaveLength(7)
    expect(target).toBe(98)
    expect(standard).toContain('RQI-RWS-03')
    expect(data.every((r) => r.severity === 'error')).toBe(true)
    const codes = data.map((r) => r.code)
    expect(codes).toEqual([
      'RWS-SIGN-MISSING',
      'RWS-CONCLUSION-MISMATCH',
      'RWS-ORGAN-ABSENT',
      'RWS-POSITION-ERROR',
      'RWS-UNIT-DATA-ERROR',
      'RWS-TEMPLATE-RESIDUE',
      'RWS-PATIENT-MISMATCH',
    ])
    expect(data.filter((r) => r.condition === 'obvious_error')).toHaveLength(5)
  })

  it('合规报告: 零命中, compliant=true, rate=100', () => {
    const result = service.evaluateRws(COMPLIANT)
    expect(result.failures).toEqual([])
    expect(result.compliant).toBe(true)
    expect(result.rate).toBe(100)
    expect(result.rateExplanation).toContain('书写规范率')
  })

  it('①签名缺失: 无签名报告命中 RWS-SIGN-MISSING', () => {
    const result = service.evaluateRws({ ...COMPLIANT, signedBy: undefined, radiologistSignature: undefined, hasRadiologistSignature: undefined })
    expect(result.compliant).toBe(false)
    expect(result.failures.map((f) => f.code)).toContain('RWS-SIGN-MISSING')
  })

  it('②结论不符: 所见含结节但结论报正常 → RWS-CONCLUSION-MISMATCH', () => {
    const result = service.evaluateRws({ ...COMPLIANT, impression: '未见明显异常。', conclusion: '' })
    expect(result.failures.map((f) => f.code)).toContain('RWS-CONCLUSION-MISMATCH')
  })

  it('③-1 脏器缺如: 胆囊切除术后却报胆囊正常 → RWS-ORGAN-ABSENT', () => {
    const result = service.evaluateRws({
      ...COMPLIANT,
      clinicalHistory: '胆囊切除术后',
      findings: '胆囊形态正常, 肝内未见异常。',
      conclusion: '胆囊正常。',
      impression: '胆囊正常。',
    })
    expect(result.failures.map((f) => f.code)).toContain('RWS-ORGAN-ABSENT')
  })

  it('③-2 部位错误: 申请胸部却描述腹部 → RWS-POSITION-ERROR', () => {
    const result = service.evaluateRws({
      ...COMPLIANT,
      bodyPart: '胸部',
      findings: '肝内见小结节, 大小约 5mm。',
      diagnosis: '肝内小结节。',
      conclusion: '肝内小结节。',
      impression: '肝内小结节。',
      recommendations: '',
    })
    expect(result.failures.map((f) => f.code)).toContain('RWS-POSITION-ERROR')
  })

  it('③-3 单位/数据错误: 测量无单位 → RWS-UNIT-DATA-ERROR', () => {
    const result = service.evaluateRws({ ...COMPLIANT, findings: '右肺上叶见结节, 大小约 5。' })
    expect(result.failures.map((f) => f.code)).toContain('RWS-UNIT-DATA-ERROR')
  })

  it('③-4 模板残留: {{ / xx / 待补充 → RWS-TEMPLATE-RESIDUE', () => {
    for (const residue of ['{{结论}}', 'xx', '待补充', '示例模板']) {
      const result = service.evaluateRws({ ...COMPLIANT, conclusion: `右肺结节。${residue}` })
      expect(result.failures.map((f) => f.code)).toContain('RWS-TEMPLATE-RESIDUE')
    }
  })

  it('③-5 患者信息: 缺失或与实际不符 → RWS-PATIENT-MISMATCH', () => {
    const missing = service.evaluateRws({ ...COMPLIANT, patientId: undefined })
    expect(missing.failures.map((f) => f.code)).toContain('RWS-PATIENT-MISMATCH')
    const mismatch = service.evaluateRws({ ...COMPLIANT, orderPatientName: '李四' })
    expect(mismatch.failures.map((f) => f.code)).toContain('RWS-PATIENT-MISMATCH')
  })

  it('全违规报告: 7 条规则全部命中', () => {
    const result = service.evaluateRws(ALL_VIOLATIONS)
    const codes = result.failures.map((f) => f.code)
    expect(codes).toEqual([
      'RWS-CONCLUSION-MISMATCH',
      'RWS-ORGAN-ABSENT',
      'RWS-PATIENT-MISMATCH',
      'RWS-POSITION-ERROR',
      'RWS-SIGN-MISSING',
      'RWS-TEMPLATE-RESIDUE',
      'RWS-UNIT-DATA-ERROR',
    ])
    expect(result.compliant).toBe(false)
  })

  it('规范率: 1 合规 + 1 违规 → numerator=1, denominator=2, rate=50', () => {
    const result = service.computeRwsRate([COMPLIANT, ALL_VIOLATIONS])
    expect(result.numerator).toBe(1)
    expect(result.denominator).toBe(2)
    expect(result.totalReports).toBe(2)
    expect(result.rate).toBe(50)
    expect(result.results).toHaveLength(2)
    expect(result.rateExplanation).toContain('书写规范报告份数')
  })

  it('规范率: 空列表 → rate=0 (边界)', () => {
    const result = service.computeRwsRate([])
    expect(result.denominator).toBe(0)
    expect(result.rate).toBe(0)
  })
})

describe('ReportRulesController 国标书写规范端点 (Wave 1C)', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReportRulesController],
      providers: [ReportRulesService, { provide: PrismaService, useValue: {} }],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('GET /report-rules/national-rws → 200, 7 条规则', async () => {
    const res = await request(app.getHttpServer()).get('/report-rules/national-rws').expect(200)
    expect(res.body.ruleCount).toBe(7)
    expect(res.body.target).toBe(98)
    expect(res.body.data).toHaveLength(7)
  })

  it('POST /report-rules/evaluate-rws 合规 → 200 compliant=true', async () => {
    const res = await request(app.getHttpServer()).post('/report-rules/evaluate-rws').send(COMPLIANT).expect(200)
    expect(res.body.compliant).toBe(true)
    expect(res.body.failures).toEqual([])
    expect(res.body.rateExplanation).toContain('RQI-RWS-03')
  })

  it('POST /report-rules/evaluate-rws 违规 → 200 failures 含 code/name/severity/suggestion', async () => {
    const res = await request(app.getHttpServer()).post('/report-rules/evaluate-rws').send(ALL_VIOLATIONS).expect(200)
    expect(res.body.compliant).toBe(false)
    expect(res.body.failures.length).toBe(7)
    const failure = res.body.failures[0]
    expect(failure).toEqual(
      expect.objectContaining({ code: expect.any(String), name: expect.any(String), severity: 'error', suggestion: expect.any(String) }),
    )
  })

  it('POST /report-rules/rws-rate → 200 numerator/denominator/rate', async () => {
    const res = await request(app.getHttpServer())
      .post('/report-rules/rws-rate')
      .send({ reports: [COMPLIANT, ALL_VIOLATIONS] })
      .expect(200)
    expect(res.body.numerator).toBe(1)
    expect(res.body.denominator).toBe(2)
    expect(res.body.rate).toBe(50)
  })

  it('POST /report-rules/rws-rate 非法 body → 400', async () => {
    await request(app.getHttpServer()).post('/report-rules/rws-rate').send({ reports: [] }).expect(400)
  })
})
