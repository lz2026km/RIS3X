import { ComplianceDocsService } from '../src/modules/compliance-docs/compliance-docs.service'

describe('ComplianceDocsService', () => {
  let svc: ComplianceDocsService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      auditLog: { count: jest.fn() },
      loginLog: { count: jest.fn() },
      user: { count: jest.fn() },
      backupRecord: { count: jest.fn(), findFirst: jest.fn() },
      exportApproval: { findMany: jest.fn() },
    }
    svc = new ComplianceDocsService(mockPrisma)
  })

  it('generates report with passing checklist when data exists', async () => {
    mockPrisma.auditLog.count.mockResolvedValue(120)
    mockPrisma.loginLog.count.mockResolvedValue(500)
    mockPrisma.user.count.mockResolvedValue(30)
    mockPrisma.backupRecord.count.mockResolvedValue(4)
    mockPrisma.backupRecord.findFirst.mockResolvedValue({ createdAt: new Date('2026-07-01T00:00:00Z') })
    mockPrisma.exportApproval.findMany.mockResolvedValue([
      { status: 'PENDING' },
      { status: 'APPROVED' },
    ])
    const report = await svc.generateReport()
    expect(report.systemName).toBe('G005 放射RIS系统')
    expect(report.summary.totalUsers).toBe(30)
    expect(report.summary.pendingExportApprovals).toBe(1)
    expect(report.checklist.find((c) => c.item === '身份鉴别')?.status).toBe('通过')
    expect(report.checklist).toHaveLength(10)
  })

  it('marks failed checks when counts are zero', async () => {
    mockPrisma.auditLog.count.mockResolvedValue(0)
    mockPrisma.loginLog.count.mockResolvedValue(0)
    mockPrisma.user.count.mockResolvedValue(0)
    mockPrisma.backupRecord.count.mockResolvedValue(0)
    mockPrisma.backupRecord.findFirst.mockResolvedValue(null)
    mockPrisma.exportApproval.findMany.mockResolvedValue([])
    const report = await svc.generateReport()
    expect(report.summary.lastBackupAt).toBeNull()
    expect(report.checklist.find((c) => c.item === '身份鉴别')?.status).toBe('不通过')
    expect(report.checklist.find((c) => c.item === '安全审计')?.status).toBe('不通过')
    expect(report.checklist.find((c) => c.item === '数据备份恢复')?.status).toBe('不通过')
  })
})
