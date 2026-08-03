import { ScheduleService } from '../src/schedule/schedule.service'

describe('ScheduleService', () => {
  let svc: ScheduleService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      report: { findMany: jest.fn().mockResolvedValue([]) },
      criticalValue: { findMany: jest.fn().mockResolvedValue([]) },
      auditLog: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }) },
      device: { findMany: jest.fn().mockResolvedValue([]) },
      exam: { findMany: jest.fn().mockResolvedValue([]) },
    }
    svc = new ScheduleService(mockPrisma)
  })

  it('checkReportSlaEscalation scans overdue reports', async () => {
    mockPrisma.report.findMany.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }])
    await svc.checkReportSlaEscalation()
    expect(mockPrisma.report.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ state: { in: ['PENDING_ASSIGNMENT', 'ASSIGNED', 'WRITING'] } }) }))
  })

  it('checkCriticalTimeout scans unacked critical values', async () => {
    mockPrisma.criticalValue.findMany.mockResolvedValue([{ id: 'c1' }])
    await svc.checkCriticalTimeout()
    expect(mockPrisma.criticalValue.findMany).toHaveBeenCalled()
  })

  it('dailyDatabaseBackup logs without prisma access', async () => {
    await expect(svc.dailyDatabaseBackup()).resolves.toBeUndefined()
  })

  it('archiveAuditLogs deletes entries older than one year', async () => {
    await svc.archiveAuditLogs()
    expect(mockPrisma.auditLog.deleteMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ createdAt: { lt: expect.any(Date) } }) }))
  })

  it('checkDeviceHeartbeat scans stale devices', async () => {
    mockPrisma.device.findMany.mockResolvedValue([{ code: 'CT-01', name: 'CT' }])
    await svc.checkDeviceHeartbeat()
    expect(mockPrisma.device.findMany).toHaveBeenCalled()
  })

  it('checkReportTimeoutEscalation scans submitted reports', async () => {
    mockPrisma.report.findMany.mockResolvedValue([{ id: 'r9' }])
    await svc.checkReportTimeoutEscalation()
    expect(mockPrisma.report.findMany).toHaveBeenCalled()
  })

  it('migrateColdStorage counts eligible studies', async () => {
    mockPrisma.exam.findMany.mockResolvedValue([{ id: 'e1' }])
    await svc.migrateColdStorage()
    expect(mockPrisma.exam.findMany).toHaveBeenCalled()
  })
})
