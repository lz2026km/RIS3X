/**
 * G005 RIS v3.0.6.11-100 (Wave 6B D-5 历史报告→本次报告字段复用) - ReportsService 既往报告摘要测试
 * 端点 (backend/src/reports):
 *   - GET /reports/:id/prior-summary  同患者既往报告摘要 { count, lastReportDate, lastFindings, lastImpression, commonDiagnoses[], source }
 * 数据源: 同患者其他报告 (排除自身, createdAt desc); 无既往记录 seed 回退 (source: 'seed')
 */
import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { ReportsService } from '../src/reports/reports.service'
import { PrismaService } from '../src/prisma/prisma.service'
import { QueueService } from '../src/queue/queue.service'
import { createNoopGateway, NotificationsGateway } from '../src/notifications/notifications.gateway'
import { SystemConfigService } from '../src/system-storage/system-config.service'
import { FollowUpService } from '../src/modules/followup/followup.service'

const mockSystemConfig = {
  getNumber: jest.fn().mockResolvedValue(20),
  getString: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  invalidate: jest.fn(),
}

const mockPrisma = {
  report: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  reportRevision: { create: jest.fn() },
  $transaction: jest.fn(),
}

const mockQueue = { addReportExport: jest.fn() }

const mkReport = (id: string, createdAt: string, findings: string, conclusion: string) => ({
  id,
  findings,
  impression: conclusion,
  conclusion,
  createdAt: new Date(createdAt),
})

describe('ReportsService - 同患者既往报告摘要 (prior-summary)', () => {
  let svc: ReportsService

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: QueueService, useValue: mockQueue },
        { provide: NotificationsGateway, useValue: createNoopGateway() },
        { provide: SystemConfigService, useValue: mockSystemConfig },
        { provide: FollowUpService, useValue: {} },
      ],
    }).compile()
    svc = module.get(ReportsService)
  })

  beforeEach(() => jest.clearAllMocks())

  it('报告不存在 → NotFoundException', async () => {
    mockPrisma.report.findFirst.mockResolvedValue(null)
    await expect(svc.getPriorSummary('RPT-NOPE')).rejects.toThrow(NotFoundException)
  })

  it('查询排他自身: where 携带 id: { not: 当前报告 }', async () => {
    mockPrisma.report.findFirst.mockResolvedValue({ id: 'RPT-100', patientId: 'P-1' })
    mockPrisma.report.findMany.mockResolvedValue([])
    await svc.getPriorSummary('RPT-100')
    expect(mockPrisma.report.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ patientId: 'P-1', id: { not: 'RPT-100' } }),
      orderBy: { createdAt: 'desc' },
    }))
  })

  it('无既往报告 → seed 回退 (source=seed, count/lastReportDate/commonDiagnoses 非空)', async () => {
    mockPrisma.report.findFirst.mockResolvedValue({ id: 'RPT-100', patientId: 'P-1' })
    mockPrisma.report.findMany.mockResolvedValue([])
    const res = await svc.getPriorSummary('RPT-100')
    expect(res.source).toBe('seed')
    expect(res.count).toBeGreaterThan(0)
    expect(res.lastReportDate).toBeTruthy()
    expect(res.lastFindings).toBeTruthy()
    expect(res.lastImpression).toBeTruthy()
    expect(Array.isArray(res.commonDiagnoses)).toBe(true)
    expect(res.commonDiagnoses.length).toBeGreaterThanOrEqual(1)
    expect(res.reportId).toBe('RPT-100')
  })

  it('有既往报告 → count/最近报告日期/所见/结论 来自 createdAt desc 第一条', async () => {
    mockPrisma.report.findFirst.mockResolvedValue({ id: 'RPT-100', patientId: 'P-1' })
    mockPrisma.report.findMany.mockResolvedValue([
      mkReport('RPT-3', '2026-08-10T09:00:00Z', '右肺下叶小结节 8mm。', '右肺下叶结节,建议 6 个月随访。'),
      mkReport('RPT-2', '2026-06-01T09:00:00Z', '双肺纹理清晰。', '未见明显异常。'),
    ])
    const res = await svc.getPriorSummary('RPT-100')
    expect(res.source).toBe('db')
    expect(res.count).toBe(2)
    expect(res.lastReportDate).toBe('2026-08-10T09:00:00.000Z')
    expect(res.lastFindings).toContain('右肺下叶小结节')
    expect(res.lastImpression).toContain('随访')
  })

  it('commonDiagnoses 聚合: 关键词在 ≥2 份既往报告出现 → 计入并按频次降序', async () => {
    mockPrisma.report.findFirst.mockResolvedValue({ id: 'RPT-100', patientId: 'P-1' })
    mockPrisma.report.findMany.mockResolvedValue([
      mkReport('RPT-3', '2026-08-10T09:00:00Z', '右肺上叶结节,伴钙化。', '肺结节。'),
      mkReport('RPT-2', '2026-06-01T09:00:00Z', '结节较前相仿,有钙化影。', '结节,建议随访。'),
      mkReport('RPT-1', '2026-03-01T09:00:00Z', '未见明显异常。', '未见明显异常。'),
    ])
    const res = await svc.getPriorSummary('RPT-100')
    const nodule = res.commonDiagnoses.find((d) => d.keyword === '结节')
    expect(nodule).toBeTruthy()
    expect(nodule!.count).toBeGreaterThanOrEqual(2)
    const calcification = res.commonDiagnoses.find((d) => d.keyword === '钙化')
    expect(calcification).toBeTruthy()
    expect(res.commonDiagnoses[0]!.count).toBeGreaterThanOrEqual(res.commonDiagnoses[res.commonDiagnoses.length - 1]!.count)
  })

  it('commonDiagnoses 排除仅出现 1 次的关键词 (无重复诊断 → 空数组)', async () => {
    mockPrisma.report.findFirst.mockResolvedValue({ id: 'RPT-100', patientId: 'P-1' })
    mockPrisma.report.findMany.mockResolvedValue([
      mkReport('RPT-3', '2026-08-10T09:00:00Z', '右肺气胸。', '气胸。'),
      mkReport('RPT-2', '2026-06-01T09:00:00Z', '未见明显异常。', '未见明显异常。'),
    ])
    const res = await svc.getPriorSummary('RPT-100')
    expect(res.commonDiagnoses).toEqual([])
  })

  it('常见诊断取前 8 个且 max 8', async () => {
    mockPrisma.report.findFirst.mockResolvedValue({ id: 'RPT-100', patientId: 'P-1' })
    const reports = Array.from({ length: 10 }, (_, i) =>
      mkReport(`RPT-${i}`, `2026-08-${String(10 - i).padStart(2, '0')}T09:00:00Z`,
        `结节、磨玻璃影、斑片影、钙化、占位、囊肿、气胸、积液、肺炎、结核 第${i}份`,
        '结节、钙化。'))
    mockPrisma.report.findMany.mockResolvedValue(reports)
    const res = await svc.getPriorSummary('RPT-100')
    expect(res.commonDiagnoses.length).toBeLessThanOrEqual(8)
    expect(res.commonDiagnoses.every((d) => d.count >= 2)).toBe(true)
  })

  it('lastImpression 优先取 conclusion, 缺失回退 impression', async () => {
    mockPrisma.report.findFirst.mockResolvedValue({ id: 'RPT-100', patientId: 'P-1' })
    mockPrisma.report.findMany.mockResolvedValue([
      { id: 'RPT-3', findings: 'x', impression: '印象: 陈旧性病灶。', conclusion: '', createdAt: new Date('2026-08-10T09:00:00Z') },
    ])
    const res = await svc.getPriorSummary('RPT-100')
    expect(res.lastImpression).toContain('陈旧性病灶')
  })
})
