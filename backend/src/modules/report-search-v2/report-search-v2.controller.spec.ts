/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 8A (report-search-v2) - 控制器端点 spec
 * - 全部端点 200 (孤儿模块, 无 DB, POST 经 @HttpCode(200))
 * - 委托正确性 (controller → service)
 * - 参数校验: 空 phrase 400 / 非法日期 400
 */
import { Test } from '@nestjs/testing'
import { BadRequestException, INestApplication } from '@nestjs/common'
import request from 'supertest'
import { ReportSearchV2Controller } from './report-search-v2.controller'
import { ReportSearchV2Service } from './report-search-v2.service'

const hit = {
  reportId: 'RPS-000001',
  patientId: 'P-20001',
  patientName: '陈志强',
  examDate: '2026-08-10',
  modality: 'CT',
  bodyPart: '胸部',
  doctorName: '张海涛',
  organization: '中心医院',
  conclusion: '右肺上叶磨玻璃结节（8mm），肺结节阳性，建议 3-6 个月随访复查。',
  isCritical: false,
  relevance: 92,
  matchedKeywords: ['肺结节'],
  snippets: [{ field: 'conclusion', label: '诊断结论', text: '肺结节阳性，建议', ranges: [{ start: 0, end: 3 }] }],
}

const searchResult = {
  items: [hit],
  total: 1,
  aggregations: {
    total: 1,
    byModality: [{ key: 'CT', count: 1 }],
    byOrganization: [{ key: '中心医院', count: 1 }],
    byDoctor: [{ key: '张海涛', count: 1 }],
    byDiagnosis: [{ key: '肺结节', count: 1 }],
    dateRange: { from: '2026-08-10', to: '2026-08-10' },
  },
  source: 'seed',
}

const nlpResult = {
  ...searchResult,
  phrase: '近 3 个月肺结节阳性 CT 报告',
  conditions: { dateFrom: '2026-05-16', dateTo: '2026-08-16', modality: 'CT', diagnosisKeyword: '肺结节', keyword: '肺结节 阳性' },
  parsed: [
    { key: 'dateRange', label: '时间范围', value: '2026-05-16 ~ 2026-08-16 (近 3 个月)' },
    { key: 'modality', label: '检查类型', value: 'CT' },
  ],
}

const meta = {
  modalities: ['CT', 'DR', 'MG', 'MR'],
  organizations: [{ name: '中心医院', count: 8 }],
  doctors: [{ name: '张海涛', count: 5 }],
  keywords: ['肺结节', '脑梗死'],
}

const stats = {
  totalReports: 13,
  organizationCount: 4,
  byOrganization: [{ key: '中心医院', count: 7 }],
  byModality: [{ key: 'CT', count: 8 }],
  criticalCount: 3,
  latestExamDate: '2026-08-12',
  earliestExamDate: '2026-02-14',
}

describe('ReportSearchV2Controller (Wave 8A 端点 200)', () => {
  let app: INestApplication
  const serviceMock = {
    search: jest.fn().mockImplementation((input: unknown) => {
      const raw = input as { keyword?: string }
      if (raw.keyword === 'bad') throw new BadRequestException('bad')
      return searchResult
    }),
    naturalLanguage: jest.fn().mockImplementation((phrase: string) => {
      if (phrase === 'bad') throw new BadRequestException('bad')
      return nlpResult
    }),
    getMeta: jest.fn().mockReturnValue(meta),
    getStats: jest.fn().mockReturnValue(stats),
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReportSearchV2Controller],
      providers: [{ provide: ReportSearchV2Service, useValue: serviceMock }],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => jest.clearAllMocks())

  it('POST /report-search-v2/search → 200 (关键词/结构化条件)', async () => {
    const res = await request(app.getHttpServer())
      .post('/report-search-v2/search')
      .send({ keyword: '肺结节', modality: 'CT', organization: '中心医院' })
      .expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.items[0].relevance).toBe(92)
    expect(res.body.data.items[0].snippets[0].ranges[0]).toMatchObject({ start: 0, end: 3 })
    expect(serviceMock.search).toHaveBeenCalledWith({ keyword: '肺结节', modality: 'CT', organization: '中心医院' })
  })

  it('POST /report-search-v2/search 非法日期 → 400', async () => {
    await request(app.getHttpServer()).post('/report-search-v2/search').send({ dateFrom: 'not-a-date' }).expect(400)
  })

  it('POST /report-search-v2/natural-language → 200 (短语/条件/命中 一体)', async () => {
    const res = await request(app.getHttpServer())
      .post('/report-search-v2/natural-language')
      .send({ phrase: '近 3 个月肺结节阳性 CT 报告' })
      .expect(200)
    expect(res.body.data.conditions.modality).toBe('CT')
    expect(res.body.data.conditions.diagnosisKeyword).toBe('肺结节')
    expect(res.body.data.parsed[0].key).toBe('dateRange')
    expect(serviceMock.naturalLanguage).toHaveBeenCalledWith('近 3 个月肺结节阳性 CT 报告')
  })

  it('POST /report-search-v2/natural-language 空短语 → 400', async () => {
    await request(app.getHttpServer()).post('/report-search-v2/natural-language').send({ phrase: '' }).expect(400)
    await request(app.getHttpServer()).post('/report-search-v2/natural-language').send({}).expect(400)
  })

  it('GET /report-search-v2/meta → 200 (模态/机构/医生/关键词)', async () => {
    const res = await request(app.getHttpServer()).get('/report-search-v2/meta').expect(200)
    expect(res.body.data.modalities).toContain('CT')
    expect(res.body.data.keywords).toContain('肺结节')
  })

  it('GET /report-search-v2/stats → 200 (机构/模态分布)', async () => {
    const res = await request(app.getHttpServer()).get('/report-search-v2/stats').expect(200)
    expect(res.body.data.criticalCount).toBe(3)
    expect(res.body.data.latestExamDate).toBe('2026-08-12')
  })
})
