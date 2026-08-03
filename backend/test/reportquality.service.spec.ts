import { ReportQualityService } from '../src/reports-quality/reportquality.service'

describe('ReportQualityService', () => {
  let svc: ReportQualityService
  let mockPrisma: any

  beforeAll(() => {
    mockPrisma = {
      systemConfig: { findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      auditLog: { findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      report: { findMany: jest.fn(), create: jest.fn() },
      reportQualityScore: { count: jest.fn(), aggregate: jest.fn() },
    }
    svc = new ReportQualityService(mockPrisma)
  })

  beforeEach(() => jest.clearAllMocks())

  it('listScoreRules queries systemConfig with score_rule_ prefix', async () => {
    mockPrisma.systemConfig.findMany.mockResolvedValue([{ key: 'score_rule_1', value: { maxScore: 100 } }])
    const result = await svc.listScoreRules()
    expect(mockPrisma.systemConfig.findMany).toHaveBeenCalledWith({ where: { key: { startsWith: 'score_rule_' } } })
    expect(result.data).toHaveLength(1)
  })

  it('createScoreRule creates systemConfig with timestamp key', async () => {
    const now = Date.now()
    jest.spyOn(Date, 'now').mockReturnValue(now)
    const body = { name: 'quality-rule', weights: { clarity: 50 }, passingScore: 60, active: true }
    mockPrisma.systemConfig.create.mockResolvedValue({ key: `score_rule_${now}`, value: body })
    const result = await svc.createScoreRule(body)
    expect(mockPrisma.systemConfig.create).toHaveBeenCalledWith({ data: { key: `score_rule_${now}`, value: body } })
    expect(result.data[0].key).toBe(`score_rule_${now}`)
  })

  it('getReportQualityStats returns total and avg score', async () => {
    mockPrisma.reportQualityScore.count.mockResolvedValue(10)
    mockPrisma.reportQualityScore.aggregate.mockResolvedValue({ _avg: { totalScore: 85.5 } })
    const result = await svc.getReportQualityStats()
    expect(result.data.total).toBe(10)
    expect(result.data.avgScore).toBe(85.5)
  })

  it('listDefectLibrary queries auditLog with defect-library resource', async () => {
    mockPrisma.auditLog.findMany.mockResolvedValue([{ id: 'd1', resource: 'defect-library' }])
    const result = await svc.listDefectLibrary()
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({ where: { resource: 'defect-library' }, orderBy: { createdAt: 'desc' } })
    expect(result.data).toHaveLength(1)
  })

  it('listAiReportDrafts queries report with WRITING state', async () => {
    mockPrisma.report.findMany.mockResolvedValue([{ id: 'r1', state: 'WRITING' }])
    const result = await svc.listAiReportDrafts()
    expect(mockPrisma.report.findMany).toHaveBeenCalledWith({ where: { state: 'WRITING' }, orderBy: { createdAt: 'desc' } })
    expect(result.data).toHaveLength(1)
  })
})
