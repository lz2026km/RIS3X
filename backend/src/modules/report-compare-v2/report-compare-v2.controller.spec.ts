/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 8A (report-compare-v2) - 控制器端点 spec
 * - 全部端点 200 (孤儿模块, 无 DB, POST 经 @HttpCode(200))
 * - 委托正确性 (controller → service)
 * - 参数校验: id/原文 二选一, 未知 id 404
 */
import { Test } from '@nestjs/testing'
import { BadRequestException, INestApplication, NotFoundException } from '@nestjs/common'
import request from 'supertest'
import { ReportCompareV2Controller } from './report-compare-v2.controller'
import { ReportCompareV2Service } from './report-compare-v2.service'

const reportSummary = {
  id: 'RPC-HIS-001',
  patientName: '王秀兰',
  examDate: '2026-02-10',
  modality: 'CT',
  bodyPart: '胸部',
  doctorName: '张海涛',
  source: 'doctor',
  organization: '中心医院',
  isAiGenerated: false,
}

const compareResult = {
  id: 'RPC-1',
  type: 'patient-history',
  reportA: reportSummary,
  reportB: { ...reportSummary, id: 'RPC-HIS-002', examDate: '2026-05-22' },
  sectionDiffs: [
    { section: 'findings', label: '所见', type: 'modified', original: 'a', updated: 'b', originalLineCount: 1, updatedLineCount: 1, ops: [] },
  ],
  keyFields: [
    { field: 'diagnosis', label: '诊断结论', original: 'a', updated: 'b', equal: false, change: 'modified' },
  ],
  lineDiffs: [{ section: 'findings', sectionLabel: '所见', type: 'modified', line: 'b', original: 'a', lineNoOld: 1, lineNoNew: 1 }],
  statistics: { totalLines: 2, same: 1, modified: 1, added: 0, removed: 0, changeRate: 50, similarity: 87, keyFieldChanges: 1, sectionsCompared: 1 },
  deterministic: true,
  generatedAt: '2026-08-16T09:00:00.000Z',
}

const stats = {
  totalReports: 8,
  presetCount: 3,
  byType: { 'patient-history': 1, 'dual-read': 1, 'doctor-ai': 1 },
  avgSimilarity: 76,
  organizationCount: 3,
}

describe('ReportCompareV2Controller (Wave 8A 端点 200)', () => {
  let app: INestApplication
  const serviceMock = {
    listReports: jest.fn().mockReturnValue([reportSummary]),
    listPresets: jest.fn().mockReturnValue([
      { id: 'P1', type: 'patient-history', label: 'x', description: 'd', reportAId: 'A', reportBId: 'B' },
    ]),
    compare: jest.fn().mockImplementation((input: unknown) => {
      const raw = input as { reportAId?: string; textA?: string }
      if (!raw.reportAId && raw.textA === undefined) throw new BadRequestException('bad')
      if (raw.reportAId === 'no-such') throw new NotFoundException('Report no-such not found')
      return compareResult
    }),
    getStats: jest.fn().mockReturnValue(stats),
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ReportCompareV2Controller],
      providers: [{ provide: ReportCompareV2Service, useValue: serviceMock }],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => jest.clearAllMocks())

  it('GET /report-compare-v2/reports → 200 (报告目录)', async () => {
    const res = await request(app.getHttpServer()).get('/report-compare-v2/reports').expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data[0].id).toBe('RPC-HIS-001')
    expect(serviceMock.listReports).toHaveBeenCalled()
  })

  it('GET /report-compare-v2/presets → 200 (预设对比组合)', async () => {
    const res = await request(app.getHttpServer()).get('/report-compare-v2/presets').expect(200)
    expect(res.body.data[0].type).toBe('patient-history')
  })

  it('POST /report-compare-v2/compare 按 id → 200 (段落/关键字段/统计)', async () => {
    const res = await request(app.getHttpServer())
      .post('/report-compare-v2/compare')
      .send({ reportAId: 'RPC-HIS-001', reportBId: 'RPC-HIS-002' })
      .expect(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.statistics.similarity).toBe(87)
    expect(res.body.data.sectionDiffs.length).toBeGreaterThan(0)
    expect(serviceMock.compare).toHaveBeenCalledWith({ reportAId: 'RPC-HIS-001', reportBId: 'RPC-HIS-002' })
  })

  it('POST /report-compare-v2/compare 按原文 → 200 (textA/textB)', async () => {
    const res = await request(app.getHttpServer())
      .post('/report-compare-v2/compare')
      .send({ textA: '双肺纹理清晰。', textB: '双肺纹理清晰。\n右肺结节。', sectionLabel: '所见' })
      .expect(200)
    expect(res.body.data.keyFields[0].change).toBe('modified')
  })

  it('POST /report-compare-v2/compare 参数缺失 (id/原文 二选一) → 400', async () => {
    await request(app.getHttpServer()).post('/report-compare-v2/compare').send({}).expect(400)
    await request(app.getHttpServer()).post('/report-compare-v2/compare').send({ reportAId: 'A' }).expect(400)
    await request(app.getHttpServer()).post('/report-compare-v2/compare').send({ reportAId: 'A', reportBId: 'B', textA: 'x', textB: 'y' }).expect(400)
  })

  it('POST /report-compare-v2/compare type 非法 → 400', async () => {
    await request(app.getHttpServer()).post('/report-compare-v2/compare').send({ reportAId: 'A', reportBId: 'B', type: 'weird' }).expect(400)
  })

  it('POST /report-compare-v2/compare 未知 id → 404', async () => {
    await request(app.getHttpServer()).post('/report-compare-v2/compare').send({ reportAId: 'no-such', reportBId: 'B' }).expect(404)
  })

  it('GET /report-compare-v2/stats → 200 (类型分布/平均相似度)', async () => {
    const res = await request(app.getHttpServer()).get('/report-compare-v2/stats').expect(200)
    expect(res.body.data.byType['doctor-ai']).toBe(1)
    expect(res.body.data.avgSimilarity).toBe(76)
  })
})
