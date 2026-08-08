/**
 * G005 RIS v3.0.6.11-80 (W1-C) - DataReportService 统计端点测试
 * GET /data-report/exam-statistics · /report-logs · /monthly-trends
 */
import { DataReportService } from './datareport.service'

const EXAM = (id: string, modality: string, bodyPart: string, createdAt: string, extra: Record<string, unknown> = {}) => ({
  id,
  tenantId: 't1',
  patientId: `p-${id}`,
  accessionNumber: `acc-${id}`,
  modality,
  bodyPart,
  scheduledAt: null,
  startedAt: null,
  completedAt: null,
  deviceId: null,
  state: 'COMPLETED',
  version: 0,
  createdAt: new Date(createdAt),
  ...extra,
})

const REPORT = (id: string, examId: string, createdAt: string, extra: Record<string, unknown> = {}) => ({
  id,
  tenantId: 't1',
  patientId: 'p-1',
  examId,
  radiologistId: null,
  state: 'PUBLISHED',
  findings: '',
  diagnosis: '',
  impression: '',
  recommendations: '',
  conclusion: '',
  signedAt: null,
  signedById: null,
  rejectReason: null,
  reviewedAt: null,
  publishedAt: null,
  reviewerId: null,
  coSignerId: null,
  coSignedAt: null,
  amendmentReason: null,
  rectificationCount: 0,
  supplementCount: 0,
  isCritical: false,
  qualityScore: null,
  version: 0,
  createdAt: new Date(createdAt),
  ...extra,
})

const NATIONAL_REPORT = (id: string, period: string, submittedAt: string, extra: Record<string, unknown> = {}) => ({
  id,
  tenantId: 't1',
  title: '',
  reportType: 'GENERAL',
  period,
  payload: {},
  submittedBy: null,
  submittedAt: new Date(submittedAt),
  status: 'SUBMITTED',
  externalId: null,
  createdAt: new Date(submittedAt),
  updatedAt: new Date(submittedAt),
  ...extra,
})

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const prisma: Record<string, unknown> = {
    patient: { findMany: jest.fn().mockRejectedValue(new Error('no db')) },
    report: { findMany: jest.fn().mockRejectedValue(new Error('no db')), findUnique: jest.fn(), create: jest.fn() },
    nationalReport: { findMany: jest.fn().mockRejectedValue(new Error('no db')), findUnique: jest.fn(), create: jest.fn() },
    insuranceAudit: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    exam: { findMany: jest.fn().mockRejectedValue(new Error('no db')) },
    ...overrides,
  }
  return prisma as never
}

describe('DataReportService (W1-C statistics)', () => {
  describe('listExamStatistics', () => {
    it('aggregates exam/report counts by modality', async () => {
      const exams = [
        EXAM('e1', 'CT', 'CHEST', '2026-05-01T10:00:00Z'),
        EXAM('e2', 'CT', 'HEAD', '2026-05-02T10:00:00Z'),
        EXAM('e3', 'DR', 'CHEST', '2026-05-03T10:00:00Z'),
      ]
      const reports = [
        REPORT('r1', 'e1', '2026-05-01T12:00:00Z', {
          signedAt: new Date('2026-05-01T11:00:00Z'),
          isCritical: true,
          qualityScore: 90,
        }),
        REPORT('r2', 'e2', '2026-05-02T12:00:00Z', { signedAt: new Date('2026-05-02T10:30:00Z'), qualityScore: 80 }),
        REPORT('r3', 'e1', '2026-05-01T13:00:00Z', { signedAt: new Date('2026-05-01T10:30:00Z') }),
      ]
      const service = new DataReportService(
        makePrisma({ exam: { findMany: jest.fn().mockResolvedValue(exams) }, report: { findMany: jest.fn().mockResolvedValue(reports) } }),
      )
      const rows = await service.listExamStatistics()
      const ct = rows.find(r => r.modality === 'CT')!
      const dr = rows.find(r => r.modality === 'DR')!
      expect(ct.examCount).toBe(2)
      expect(ct.positiveCount).toBeGreaterThanOrEqual(1)
      expect(ct.avgReportTime).toBeGreaterThan(0)
      expect(ct.qualifiedRate).toBe(85)
      expect(dr.examCount).toBe(1)
      expect(rows.length).toBeGreaterThanOrEqual(2)
    })

    it('returns empty array when DB has no exams', async () => {
      const service = new DataReportService(
        makePrisma({ exam: { findMany: jest.fn().mockResolvedValue([]) }, report: { findMany: jest.fn().mockResolvedValue([]) } }),
      )
      await expect(service.listExamStatistics()).resolves.toEqual([])
    })
  })

  describe('listReportLogs', () => {
    it('maps national-report rows to log DTO shape', async () => {
      const rows = [
        NATIONAL_REPORT('nr1', '2026-05', '2026-06-05T10:30:00Z', {
          title: '剂量上报',
          submittedBy: 'dr-001',
          reportType: 'GENERAL',
          status: 'SUBMITTED',
        }),
        NATIONAL_REPORT('nr2', '2026-05', '2026-06-05T11:00:00Z', {
          reportType: 'QUALITY',
          status: 'CONFIRMED',
          submittedBy: 'dr-002',
        }),
      ]
      const service = new DataReportService(
        makePrisma({ nationalReport: { findMany: jest.fn().mockResolvedValue(rows) } }),
      )
      const logs = await service.listReportLogs()
      expect(logs).toHaveLength(2)
      expect(logs[0]).toMatchObject({
        id: 'nr1',
        reportType: 'dose',
        reportMonth: '2026-05',
        status: '已上报',
        operator: 'dr-001',
        note: '剂量上报',
      })
      expect(logs[0].submitTime).toContain('2026-06-05 10:30')
      expect(logs[1].status).toBe('已确认')
      expect(logs[1].reportType).toBe('quality')
    })
  })

  describe('listMonthlyTrends', () => {
    it('groups exam/report/upload counts by month and modality', async () => {
      const exams = [
        EXAM('e1', 'CT', 'CHEST', '2026-05-01T10:00:00Z'),
        EXAM('e2', 'MR', 'HEAD', '2026-05-02T10:00:00Z'),
        EXAM('e3', 'CT', 'CHEST', '2026-05-20T10:00:00Z'),
        EXAM('e4', 'DR', 'CHEST', '2026-04-30T10:00:00Z'),
      ]
      const reports = [
        REPORT('r1', 'e1', '2026-05-01T12:00:00Z'),
        REPORT('r2', 'e2', '2026-05-02T12:00:00Z'),
      ]
      const nationals = [
        NATIONAL_REPORT('nr1', '2026-05', '2026-06-05T10:30:00Z'),
      ]
      const service = new DataReportService(
        makePrisma({
          exam: { findMany: jest.fn().mockResolvedValue(exams) },
          report: { findMany: jest.fn().mockResolvedValue(reports) },
          nationalReport: { findMany: jest.fn().mockResolvedValue(nationals) },
        }),
      )
      const trends = await service.listMonthlyTrends()
      const may = trends.find(t => t.month === '2026-05')!
      expect(may).toBeDefined()
      expect(may.CT).toBe(2)
      expect(may.MRI).toBe(1)
      expect(may.exams).toBe(3)
      expect(may.reports).toBe(2)
      const jun = trends.find(t => t.month === '2026-06')!
      expect(jun.submitted).toBe(1)
      const apr = trends.find(t => t.month === '2026-04')!
      expect(apr.DR).toBe(1)
      expect(trends[0].month).toBe('2026-04')
    })
  })
})
