import { ScheduleService } from '../src/schedule/schedule.service'

describe('ScheduleService', () => {
  let svc: ScheduleService
  let mockPrisma: any
  let mockCriticals: any
  let mockBackup: any

  beforeEach(() => {
    mockPrisma = {
      report: { findMany: jest.fn().mockResolvedValue([]) },
      criticalValue: {
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockResolvedValue({}),
      },
      auditLog: { deleteMany: jest.fn().mockResolvedValue({ count: 3 }), create: jest.fn().mockResolvedValue({}) },
      device: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
      exam: { findMany: jest.fn().mockResolvedValue([]) },
      dicomInstance: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn().mockResolvedValue({}) },
      systemConfig: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn({})),
    }
    mockCriticals = { escalate: jest.fn().mockResolvedValue({ count: 1 }) }
    mockBackup = { createBackup: jest.fn().mockResolvedValue({ filename: 'x.json', sizeBytes: 1, checksum: 'c', recordCount: 1 }) }
    svc = new ScheduleService(mockPrisma, mockCriticals, mockBackup, { getNumber: jest.fn().mockResolvedValue(20), getString: jest.fn().mockResolvedValue(undefined) } as never)
  })

  it('checkReportSlaEscalation scans overdue reports', async () => {
    mockPrisma.report.findMany.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }])
    await svc.checkReportSlaEscalation()
    expect(mockPrisma.report.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ state: { in: ['PENDING_ASSIGNMENT', 'ASSIGNED', 'WRITING'] } }) }))
  })

  it('checkCriticalTimeout scans unacked critical values', async () => {
    mockPrisma.criticalValue.findMany.mockResolvedValue([{ id: 'c1', tenantId: 'default' }])
    await svc.checkCriticalTimeout()
    expect(mockPrisma.criticalValue.findMany).toHaveBeenCalled()
    expect(mockPrisma.criticalValue.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { state: 'ESCALATED' } })
  })

  it('dailyDatabaseBackup calls backup service with CONFIG', async () => {
    await svc.dailyDatabaseBackup()
    expect(mockBackup.createBackup).toHaveBeenCalledWith('CONFIG')
  })

  it('archiveAuditLogs deletes entries older than one year', async () => {
    await svc.archiveAuditLogs()
    expect(mockPrisma.auditLog.deleteMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ createdAt: { lt: expect.any(Date) } }) }))
  })

  it('checkDeviceHeartbeat scans stale devices', async () => {
    mockPrisma.device.findMany.mockResolvedValue([{ id: 'd1', tenantId: 'default', code: 'CT-01', name: 'CT', updatedAt: new Date(0) }])
    await svc.checkDeviceHeartbeat()
    expect(mockPrisma.device.findMany).toHaveBeenCalled()
    expect(mockPrisma.device.update).toHaveBeenCalledWith({ where: { id: 'd1' }, data: { state: 'OFFLINE' } })
  })

  it('checkReportTimeoutEscalation scans submitted reports', async () => {
    mockPrisma.report.findMany.mockResolvedValue([{ id: 'r9' }])
    await svc.checkReportTimeoutEscalation()
    expect(mockPrisma.report.findMany).toHaveBeenCalled()
  })

  it('migrateColdStorage marks old dicom instances cold', async () => {
    mockPrisma.dicomInstance.findMany.mockResolvedValue([{ id: 'i1', tenantId: 'default', storagePath: null, studyInstanceUid: '1' }])
    await svc.migrateColdStorage()
    expect(mockPrisma.dicomInstance.findMany).toHaveBeenCalled()
    expect(mockPrisma.dicomInstance.update).toHaveBeenCalledWith({ where: { id: 'i1' }, data: { storagePath: 'cold://dicom/i1' } })
  })
})
