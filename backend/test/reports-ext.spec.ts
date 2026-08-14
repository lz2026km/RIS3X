import { NotFoundException } from '@nestjs/common'
import { ReportsService } from '../src/reports/reports.service'

// [v3.0.6.11-99 Wave 10D] reports 扩展端点: overview / by-doctor / daily-trend / related / templates-apply
describe('ReportsService Wave10D (overview/by-doctor/daily-trend/related/templates-apply)', () => {
  let svc: ReportsService
  let mockPrisma: any

  const mockSystemConfig = {
    getNumber: jest.fn().mockResolvedValue(20),
    getString: jest.fn().mockResolvedValue(undefined),
    get: jest.fn(),
    invalidate: jest.fn(),
  }
  const mockQueue = { addReportExport: jest.fn() }

  const reportRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'r1',
    tenantId: 't1',
    patientId: 'p1',
    examId: 'e1',
    radiologistId: 'd1',
    findings: '正常',
    conclusion: '未见异常',
    htmlContent: '',
    state: 'PENDING_ASSIGNMENT',
    version: 1,
    isCritical: false,
    qualityScore: null,
    reviewerId: null,
    coSignerId: null,
    signedAt: null,
    signedById: null,
    reviewedAt: null,
    publishedAt: null,
    rejectReason: null,
    createdAt: new Date(Date.now() - 2 * 3600000),
    updatedAt: new Date(),
    patient: { id: 'p1', name: '张三', gender: 'MALE' },
    exam: { id: 'e1', modality: 'CT', bodyPart: '胸部', priority: 'ROUTINE', accessionNumber: 'ACC001' },
    ...overrides,
  })

  beforeEach(() => {
    mockPrisma = {
      report: {
        groupBy: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      user: { findMany: jest.fn() },
      reportTemplate: { findUnique: jest.fn() },
      criticalValue: { findMany: jest.fn().mockResolvedValue([]) },
      followUpPlan: { findMany: jest.fn().mockResolvedValue([]) },
    }
    svc = new ReportsService(mockPrisma, mockQueue as never, mockSystemConfig as never)
  })

  describe('getOverview', () => {
    it('aggregates byStatus/today counts/avg turnaround', async () => {
      mockPrisma.report.groupBy.mockResolvedValue([
        { state: 'PUBLISHED', _count: { _all: 2 } },
        { state: 'WRITING', _count: { _all: 1 } },
      ])
      mockPrisma.report.count
        .mockResolvedValueOnce(1) // todayCreated
        .mockResolvedValueOnce(1) // todaySigned
        .mockResolvedValueOnce(0) // todayPublished
        .mockResolvedValueOnce(0) // criticalCount
        .mockResolvedValueOnce(1) // overdueCount
      const now = Date.now()
      mockPrisma.report.findMany.mockResolvedValue([
        { createdAt: new Date(now - 6 * 3600000), signedAt: new Date(now - 3 * 3600000) },
        { createdAt: new Date(now - 10 * 3600000), signedAt: new Date(now - 2 * 3600000) },
      ])
      const r = await svc.getOverview()
      expect(r.total).toBe(3)
      expect(r.byStatus).toMatchObject({ PUBLISHED: 2, WRITING: 1 })
      expect(r.todayCreated).toBe(1)
      expect(r.todayCompleted).toBe(1)
      expect(r.todaySigned).toBe(1)
      expect(r.todayPublished).toBe(0)
      expect(r.criticalCount).toBe(0)
      expect(r.pendingCount).toBe(1)
      expect(r.overdueCount).toBe(1)
      expect(r.avgTurnaroundHours).toBe(5.5)
    })

    it('falls back to seed when DB empty', async () => {
      mockPrisma.report.groupBy.mockResolvedValue([])
      mockPrisma.report.count.mockResolvedValue(0)
      mockPrisma.report.findMany.mockResolvedValue([])
      const r = await svc.getOverview()
      expect(r.total).toBe(124)
      expect(r.byStatus.PUBLISHED).toBe(71)
      expect(r.todayCompleted).toBe(7)
      expect(r.avgTurnaroundHours).toBe(4.6)
    })

    it('falls back to seed when groupBy throws', async () => {
      mockPrisma.report.groupBy.mockRejectedValue(new Error('no table'))
      const r = await svc.getOverview()
      expect(r.total).toBe(124)
    })
  })

  describe('getByDoctor', () => {
    it('groups reports by radiologist with published/pending/avg', async () => {
      const now = Date.now()
      mockPrisma.report.groupBy.mockResolvedValue([
        { radiologistId: 'd1', state: 'PUBLISHED', _count: { _all: 3 } },
        { radiologistId: 'd1', state: 'WRITING', _count: { _all: 1 } },
        { radiologistId: null, state: 'PENDING_ASSIGNMENT', _count: { _all: 2 } },
      ])
      mockPrisma.report.findMany.mockResolvedValue([
        { radiologistId: 'd1', createdAt: new Date(now - 8 * 3600000), signedAt: new Date(now - 3 * 3600000) },
        { radiologistId: 'd1', createdAt: new Date(now - 5 * 3600000), signedAt: new Date(now - 1 * 3600000) },
      ])
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'd1', fullName: '王医生' }])
      const r = await svc.getByDoctor()
      expect(r.total).toBe(2)
      const d1 = r.items.find((i: any) => i.id === 'd1')!
      expect(d1).toMatchObject({ name: '王医生', total: 4, published: 3, pending: 1 })
      expect(d1.avgTurnaroundHours).toBe(4.5)
      expect(r.items[0].id).toBe('d1')
    })

    it('falls back to seed when only unassigned reports exist', async () => {
      mockPrisma.report.groupBy.mockResolvedValue([{ radiologistId: null, state: 'PENDING_ASSIGNMENT', _count: { _all: 2 } }])
      mockPrisma.report.findMany.mockResolvedValue([])
      mockPrisma.user.findMany.mockResolvedValue([])
      const r = await svc.getByDoctor()
      expect(r.items[0]).toMatchObject({ name: '王医生', total: 32 })
    })
  })

  describe('getDailyTrend', () => {
    it('buckets created/published per day over last N days', async () => {
      const today = new Date()
      mockPrisma.report.findMany
        .mockResolvedValueOnce([{ createdAt: new Date(today.setHours(10, 0, 0, 0)) }])
        .mockResolvedValueOnce([{ publishedAt: new Date(today.setHours(14, 0, 0, 0)) }])
        .mockResolvedValueOnce([{ signedAt: new Date(today.setHours(13, 0, 0, 0)) }])
      const r = await svc.getDailyTrend(7)
      expect(r.items).toHaveLength(7)
      const localKey = (d: Date) => {
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${d.getFullYear()}-${m}-${day}`
      }
      expect(r.items[6]).toMatchObject({ date: localKey(new Date()), created: 1, published: 1, signed: 1 })
    })

    it('falls back to deterministic seed when no data', async () => {
      mockPrisma.report.findMany.mockResolvedValue([])
      const r = await svc.getDailyTrend(30)
      expect(r.items).toHaveLength(30)
      expect(r.total).toBe(30)
      expect(r.items[0].created).toBeGreaterThan(0)
      expect(r.items[1].created).not.toBe(r.items[2].created)
    })
  })

  describe('getRelated', () => {
    it('returns exam/patient/previous reports/followups/critical values', async () => {
      mockPrisma.report.findFirst.mockResolvedValue(
        reportRow({ exam: { id: 'e1', modality: 'CT', bodyPart: '胸部', state: 'COMPLETED', accessionNumber: 'ACC001', scheduledAt: new Date(), completedAt: new Date() } }),
      )
      mockPrisma.report.findMany.mockResolvedValue([reportRow({ id: 'r-old', state: 'PUBLISHED' })])
      mockPrisma.followUpPlan.findMany.mockResolvedValue([
        { id: 'f1', planDate: new Date(), nextDate: new Date(Date.now() + 30 * 86400000), status: 'PENDING', note: '复查' },
      ])
      mockPrisma.criticalValue.findMany.mockResolvedValue([
        { id: 'c1', description: '气胸', severity: 'HIGH', state: 'FOUND', createdAt: new Date() },
      ])
      const r = await svc.getRelated('r1')
      expect(r.exam!.modality).toBe('CT')
      expect(r.patient.name).toBe('张三')
      expect(r.previousReports).toHaveLength(1)
      expect(r.followUpPlans[0]).toMatchObject({ id: 'f1', status: 'PENDING' })
      expect(r.criticalValues[0]).toMatchObject({ description: '气胸', severity: 'HIGH' })
      expect(mockPrisma.followUpPlan.findMany).toHaveBeenCalled()
    })

    it('throws NotFoundException when report missing', async () => {
      mockPrisma.report.findFirst.mockResolvedValue(null)
      await expect(svc.getRelated('ghost')).rejects.toThrow(NotFoundException)
    })
  })

  describe('applyTemplate', () => {
    const template = { id: 'tpl1', name: '胸部CT常规', body: '双肺纹理清晰，未见实质性病变。', structure: [] }

    it('appends template body to findings and htmlContent (default mode)', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(reportRow({ findings: '原有描述', htmlContent: '原有描述' }))
      mockPrisma.reportTemplate.findUnique.mockResolvedValue(template)
      mockPrisma.report.update.mockImplementation(async ({ data }: any) => ({ ...reportRow(), ...data }))
      const r = await svc.applyTemplate('r1', 'tpl1')
      expect(r.findings).toBe('原有描述\n双肺纹理清晰，未见实质性病变。')
      expect(r.htmlContent).toBe('原有描述\n双肺纹理清晰，未见实质性病变。')
      expect(r.templateApplied).toMatchObject({ templateId: 'tpl1', name: '胸部CT常规', mode: 'append' })
    })

    it('overwrite mode replaces findings', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(reportRow({ findings: '旧内容', htmlContent: '旧内容' }))
      mockPrisma.reportTemplate.findUnique.mockResolvedValue(template)
      mockPrisma.report.update.mockImplementation(async ({ data }: any) => ({ ...reportRow(), ...data }))
      const r = await svc.applyTemplate('r1', 'tpl1', 'overwrite')
      expect(r.findings).toBe('双肺纹理清晰，未见实质性病变。')
    })

    it('throws NotFoundException when template missing', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(reportRow())
      mockPrisma.reportTemplate.findUnique.mockResolvedValue(null)
      await expect(svc.applyTemplate('r1', 'missing')).rejects.toThrow(NotFoundException)
    })
  })
})
