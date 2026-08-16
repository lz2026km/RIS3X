// [G005 v3.0.6.11-101 Wave 6A F11] ReportRulesController 端点 spec (supertest 200)
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { ReportRulesController } from './report-rules.controller'
import { ReportRulesService } from './report-rules.service'
import { PrismaService } from '../../prisma/prisma.service'

describe('ReportRulesController (F11 端点 200)', () => {
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

  it('GET /report-rules/rules → 200, ≥15 条规则', async () => {
    const res = await request(app.getHttpServer()).get('/report-rules/rules').expect(200)
    expect(res.body.source).toBe('demo')
    expect(res.body.data.length).toBeGreaterThanOrEqual(15)
  })

  it('GET /report-rules/rules?examType=CT → 200, 过滤生效', async () => {
    const res = await request(app.getHttpServer()).get('/report-rules/rules?examType=CT').expect(200)
    const all = res.body.data as Array<{ examTypes: string[] }>
    expect(all.every((r) => r.examTypes.length === 0 || r.examTypes.includes('CT'))).toBe(true)
  })

  it('POST /report-rules/rules → 201, 自定义规则返回', async () => {
    const res = await request(app.getHttpServer())
      .post('/report-rules/rules')
      .send({
        name: '端点测试规则',
        type: 'terminology',
        severity: 'warning',
        condition: { field: 'conclusion', operator: 'contains', value: '测试' },
        suggestion: '测试建议',
      })
      .expect(201)
    expect(res.body.builtIn).toBe(false)
    expect(res.body.id).toMatch(/^rule-c-\d+$/)
  })

  it('POST /report-rules/rules 非法 severity → 400', async () => {
    await request(app.getHttpServer())
      .post('/report-rules/rules')
      .send({ name: '坏规则', type: 'terminology', severity: 'fatal', condition: { field: 'conclusion', operator: 'empty', value: '' } })
      .expect(400)
  })

  it('PUT /report-rules/rules/:id → 200, 停用生效', async () => {
    const res = await request(app.getHttpServer()).put('/report-rules/rules/rule-b-001').send({ enabled: false }).expect(200)
    expect(res.body.enabled).toBe(false)
  })

  it('POST /report-rules/evaluate → 200, 违规命中', async () => {
    const res = await request(app.getHttpServer())
      .post('/report-rules/evaluate')
      .send({ reportId: 'RPT-EP-1', findings: '右肺上叶结节影', conclusion: '' })
      .expect(200)
    expect(res.body.violations.length).toBeGreaterThan(0)
    expect(res.body.score).toBeLessThan(100)
  })

  it('POST /report-rules/evaluate 合规 → 200 零命中', async () => {
    const res = await request(app.getHttpServer())
      .post('/report-rules/evaluate')
      .send({
        findings: '双侧胸廓对称, 右肺上叶见一直径约 5mm 磨玻璃结节影, 边缘清晰。',
        diagnosis: '右肺上叶磨玻璃结节。',
        conclusion: '右肺上叶磨玻璃结节, 建议随访。',
        recommendations: '建议 3-6 个月后复查。',
      })
      .expect(200)
    expect(res.body.violations).toEqual([])
    expect(res.body.score).toBe(100)
  })

  it('GET/POST/PUT/DELETE /report-rules/rulesets → 200/201 全链路', async () => {
    const created = await request(app.getHttpServer())
      .post('/report-rules/rulesets')
      .send({ name: '端点规则集', examTypes: ['DR'], ruleIds: ['rule-b-001'] })
      .expect(201)
    const id: string = created.body.id
    const list = await request(app.getHttpServer()).get('/report-rules/rulesets').expect(200)
    expect(list.body.data.length).toBeGreaterThanOrEqual(4)
    const updated = await request(app.getHttpServer())
      .put(`/report-rules/rulesets/${id}`)
      .send({ ruleIds: ['rule-b-001', 'rule-b-002'] })
      .expect(200)
    expect(updated.body.ruleIds).toHaveLength(2)
    await request(app.getHttpServer()).delete(`/report-rules/rulesets/${id}`).expect(200)
  })

  it('GET /report-rules/history + /report-rules/stats → 200', async () => {
    const history = await request(app.getHttpServer()).get('/report-rules/history').expect(200)
    expect(Array.isArray(history.body.data)).toBe(true)
    const stats = await request(app.getHttpServer()).get('/report-rules/stats').expect(200)
    expect(stats.body.data.totalRules).toBeGreaterThanOrEqual(15)
  })
})
