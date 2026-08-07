import { ScheduleService } from './schedule.service'

// [v3.0.6.11-79] admin config 读取桩: 可注入 critical_timeout_minutes 等键值
const makeSystemConfig = (values: Record<string, unknown> = {}) => ({
  getNumber: jest.fn(async (key: string, fb: number) => {
    const v = values[key] ?? (key === 'critical_timeout_minutes' ? 30 : undefined)
    return typeof v === 'number' ? v : fb
  }),
  getString: jest.fn(async (key: string, fb: string) => (typeof values[key] === 'string' ? values[key] : fb)),
  get: jest.fn(),
  invalidate: jest.fn(),
}) as never

const txClient = () => ({
  report: { update: jest.fn().mockResolvedValue({}) },
  reportRevision: { create: jest.fn().mockResolvedValue({}) },
  notification: { create: jest.fn().mockResolvedValue({}) },
  auditLog: { create: jest.fn().mockResolvedValue({}) },
})

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const prisma: Record<string, unknown> = {
    $transaction: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(txClient())),
    report: { findMany: jest.fn().mockRejectedValue(new Error('no db')) },
    reportRevision: { create: jest.fn().mockRejectedValue(new Error('no db')) },
    notification: { create: jest.fn().mockRejectedValue(new Error('no db')) },
    criticalValue: {
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      update: jest.fn().mockResolvedValue({}),
    },
    device: {
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      update: jest.fn().mockResolvedValue({}),
    },
    dicomInstance: {
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      update: jest.fn().mockResolvedValue({}),
    },
    systemConfig: { findUnique: jest.fn().mockResolvedValue(null) },
    auditLog: { create: jest.fn().mockResolvedValue({}), deleteMany: jest.fn().mockResolvedValue({ count: 0 }) },
    exam: { findMany: jest.fn().mockRejectedValue(new Error('no db')) },
    ...overrides,
  }
  return prisma as any}

const makeCriticals = (overrides: Record<string, unknown> = {}) => ({
  escalate: jest.fn().mockResolvedValue({ count: 1 }),
  ...overrides,
}) as any

const makeBackup = (overrides: Record<string, unknown> = {}) => ({
  createBackup: jest.fn().mockResolvedValue({
    id: 'bk-1',
    type: 'CONFIG',
    sizeBytes: 1024,
    checksum: 'a'.repeat(64),
    filename: 'backup-config-2026-08-07.json',
    recordCount: 3,
  }),
  ...overrides,
}) as any

describe('ScheduleService', () => {
  describe('checkCriticalTimeout (危急值 30min 未确认升级)', () => {
    it('escalates via criticals.escalate + marks state ESCALATED + audits', async () => {
      const criticalValueUpdate = jest.fn().mockResolvedValue({})
      const auditCreate = jest.fn().mockResolvedValue({})
      const prisma = makePrisma({
        criticalValue: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'cv-1',
              tenantId: 'default',
              severity: 'CRITICAL',
              description: '低钠血症',
              createdAt: new Date(Date.now() - 40 * 60 * 1000),
            },
          ]),
          update: criticalValueUpdate,
        },
        systemConfig: {
          findUnique: jest.fn().mockResolvedValue({
            key: 'critical_escalation_recipients',
            value: [{ name: '值班二线', dept: '急诊科', phone: '13800000000' }],
          }),
        },
        auditLog: { create: auditCreate },
      })
      const criticals = makeCriticals()
      const service = new ScheduleService(prisma, criticals, makeBackup(), makeSystemConfig())

      await service.checkCriticalTimeout()

      expect(criticals.escalate).toHaveBeenCalledWith(
        expect.objectContaining({ criticalId: 'cv-1', newRecipients: [{ name: '值班二线', dept: '急诊科', phone: '13800000000' }] }),
      )
      expect(criticalValueUpdate).toHaveBeenCalledWith({
        where: { id: 'cv-1' },
        data: expect.objectContaining({ state: 'ESCALATED' }),
      })
      expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'CRITICAL_TIMEOUT_ESCALATED', resourceId: 'cv-1' }) }))
    })

    it('queries only unacked, pre-escalation criticals', async () => {
      const findMany = jest.fn().mockResolvedValue([])
      const prisma = makePrisma({
        criticalValue: { findMany, update: jest.fn() },
      })
      const service = new ScheduleService(prisma, makeCriticals(), makeBackup(), makeSystemConfig())

      await service.checkCriticalTimeout()

      const where = findMany.mock.calls[0]![0]!.where
      expect(where.ackedAt).toBeNull()
      expect(where.state.in).toEqual(['FOUND', 'NOTIFIED', 'VOICE_CALLED'])
      expect(where.createdAt.lt).toBeInstanceOf(Date)
    })

    it('does not throw when escalate service fails (error is caught & logged)', async () => {
      const prisma = makePrisma({
        criticalValue: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'cv-2', tenantId: 'default', severity: 'HIGH', description: 'x', createdAt: new Date(Date.now() - 60 * 60 * 1000) },
          ]),
          update: jest.fn().mockResolvedValue({}),
        },
        systemConfig: {
          findUnique: jest.fn().mockResolvedValue({
            key: 'critical_escalation_recipients',
            value: [{ name: 'a', dept: 'b', phone: 'c' }],
          }),
        },
      })
      const criticals = makeCriticals({ escalate: jest.fn().mockRejectedValue(new Error('boom')) })
      const service = new ScheduleService(prisma, criticals, makeBackup(), makeSystemConfig())

      await expect(service.checkCriticalTimeout()).resolves.toBeUndefined()
    })

    // [v3.0.6.11-79] 消费者: critical_timeout_minutes admin config 替代硬编码 30 分钟
    it('uses admin config critical_timeout_minutes as the escalation cutoff', async () => {
      const criticalValueUpdate = jest.fn().mockResolvedValue({})
      const auditCreate = jest.fn().mockResolvedValue({})
      const prisma = makePrisma({
        criticalValue: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'cv-cfg', tenantId: 'default', severity: 'URGENT', description: '低血压', createdAt: new Date(Date.now() - 20 * 60 * 1000) },
          ]),
          update: criticalValueUpdate,
        },
        systemConfig: {
          findUnique: jest.fn().mockResolvedValue({
            key: 'critical_escalation_recipients',
            value: [{ name: '值班二线', dept: '急诊科', phone: '13800000000' }],
          }),
        },
        auditLog: { create: auditCreate },
      })
      const criticals = makeCriticals()
      // 20 分钟前的记录在默认 30min 阈值下不超时, 但配置 10min 后应被升级
      const service = new ScheduleService(prisma, criticals, makeBackup(), makeSystemConfig({ critical_timeout_minutes: 10 }))

      await service.checkCriticalTimeout()

      expect(criticals.escalate).toHaveBeenCalledWith(
        expect.objectContaining({ criticalId: 'cv-cfg', reason: expect.stringContaining('10 分钟') }),
      )
      expect(criticalValueUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ state: 'ESCALATED' }) }))
      expect(auditCreate).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'CRITICAL_TIMEOUT_ESCALATED' }) }),
      )
      const detail = auditCreate.mock.calls[0]![0]!.data.detail
      expect(detail.timeoutMinutes).toBe(10)
    })

    it('skips records younger than the configured timeout', async () => {
      const findMany = jest.fn().mockResolvedValue([])
      const prisma = makePrisma({
        criticalValue: { findMany, update: jest.fn() },
      })
      const service = new ScheduleService(prisma, makeCriticals(), makeBackup(), makeSystemConfig({ critical_timeout_minutes: 120 }))

      await service.checkCriticalTimeout()

      const where = findMany.mock.calls[0]![0]!.where
      const cutoff = where.createdAt.lt as Date
      expect(Date.now() - cutoff.getTime()).toBeGreaterThanOrEqual(119 * 60 * 1000)
    })
  })

  describe('checkReportSlaEscalation (报告 SLA 超时升级)', () => {
    it('writes ESCALATED state + revision + notification + audit via transaction', async () => {
      const tx = txClient()
      const prisma = makePrisma({
        report: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'r-1', tenantId: 'default', state: 'WRITING', radiologistId: 'U1', reviewerId: null },
          ]),
        },
      })
      ;(prisma as any).$transaction = jest.fn(async (fn: (t: unknown) => Promise<unknown>) => fn(tx))
      const service = new ScheduleService(prisma, makeCriticals(), makeBackup(), makeSystemConfig())

      await service.checkReportSlaEscalation()

      expect(tx.report.update).toHaveBeenCalledWith({
        where: { id: 'r-1' },
        data: expect.objectContaining({ state: 'ESCALATED' }),
      })
      expect(tx.reportRevision.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ reportId: 'r-1', actorId: 'system-scheduler', fromState: 'WRITING', toState: 'ESCALATED', reason: expect.stringContaining('REPORT_SLA_TIMEOUT_4H') }),
      })
      expect(tx.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ userId: 'U1', targetId: 'r-1', type: 'REPORT_ESCALATION' }),
      })
      expect(tx.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ action: 'REPORT_SLA_TIMEOUT_4H', resourceId: 'r-1' }),
      })
    })
  })

  describe('checkReportTimeoutEscalation (报告 2h 超时升级)', () => {
    it('escalates submitted reports older than 2h', async () => {
      const prisma = makePrisma({
        report: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'r-2', tenantId: 'default', state: 'SUBMITTED', radiologistId: null, reviewerId: 'RV1' },
          ]),
        },
      })
      const service = new ScheduleService(prisma, makeCriticals(), makeBackup(), makeSystemConfig())

      await service.checkReportTimeoutEscalation()

      const where = (prisma.report.findMany as jest.Mock).mock.calls[0]![0]!.where
      expect(where.state.in).toEqual(['SUBMITTED', 'INITIAL_REVIEW'])
      expect(where.updatedAt.lt).toBeInstanceOf(Date)
    })
  })

  describe('dailyDatabaseBackup (每日备份执行)', () => {
    it('calls backupService.createBackup with CONFIG and records success', async () => {
      const createBackup = jest.fn().mockResolvedValue({
        id: 'bk-1',
        type: 'CONFIG',
        sizeBytes: 512,
        checksum: 'b'.repeat(64),
        filename: 'backup-config-2026-08-07.json',
        recordCount: 2,
      })
      const service = new ScheduleService(makePrisma(), makeCriticals(), makeBackup({ createBackup }), makeSystemConfig())

      await service.dailyDatabaseBackup()

      expect(createBackup).toHaveBeenCalledWith('CONFIG')
    })

    it('logs failure and does not throw when backup fails', async () => {
      const createBackup = jest.fn().mockRejectedValue(new Error('disk full'))
      const service = new ScheduleService(makePrisma(), makeCriticals(), makeBackup({ createBackup }), makeSystemConfig())

      await expect(service.dailyDatabaseBackup()).resolves.toBeUndefined()
    })
  })

  describe('checkDeviceHeartbeat (设备心跳真实更新)', () => {
    it('marks stale online devices OFFLINE + audits', async () => {
      const deviceUpdate = jest.fn().mockResolvedValue({})
      const auditCreate = jest.fn().mockResolvedValue({})
      const prisma = makePrisma({
        device: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'd-1', tenantId: 'default', code: 'DR-01', name: 'DR 一号', updatedAt: new Date(Date.now() - 20 * 60 * 1000) },
          ]),
          update: deviceUpdate,
        },
        auditLog: { create: auditCreate },
      })
      const service = new ScheduleService(prisma, makeCriticals(), makeBackup(), makeSystemConfig())

      await service.checkDeviceHeartbeat()

      expect(deviceUpdate).toHaveBeenCalledWith({ where: { id: 'd-1' }, data: expect.objectContaining({ state: 'OFFLINE' }) })
      expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: 'DEVICE_HEARTBEAT_LOST' }) }))
    })

    it('skips MAINTENANCE/OFFLINE devices (only queries IDLE/IN_USE)', async () => {
      const findMany = jest.fn().mockResolvedValue([])
      const prisma = makePrisma({ device: { findMany, update: jest.fn() } })
      const service = new ScheduleService(prisma, makeCriticals(), makeBackup(), makeSystemConfig())

      await service.checkDeviceHeartbeat()

      expect(findMany.mock.calls[0]![0]!.where.state.in).toEqual(['IDLE', 'IN_USE'])
    })
  })

  describe('migrateColdStorage (冷存储迁移)', () => {
    it('prefixes storagePath of old instances with cold:// and skips already-cold', async () => {
      const instanceUpdate = jest.fn().mockResolvedValue({})
      const prisma = makePrisma({
        dicomInstance: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'i-1', tenantId: 'default', storagePath: null, studyInstanceUid: '1.2.3' },
            { id: 'i-2', tenantId: 'default', storagePath: 'cold://dicom/i-2', studyInstanceUid: '1.2.4' },
            { id: 'i-3', tenantId: 'default', storagePath: '/data/dicom/i-3', studyInstanceUid: '1.2.5' },
          ]),
          update: instanceUpdate,
        },
      })
      const service = new ScheduleService(prisma, makeCriticals(), makeBackup(), makeSystemConfig())

      await service.migrateColdStorage()

      expect(instanceUpdate).toHaveBeenCalledTimes(2)
      expect(instanceUpdate).toHaveBeenCalledWith({ where: { id: 'i-1' }, data: { storagePath: 'cold://dicom/i-1' } })
      expect(instanceUpdate).toHaveBeenCalledWith({ where: { id: 'i-3' }, data: { storagePath: 'cold:///data/dicom/i-3' } })
    })
  })

  describe('archiveAuditLogs', () => {
    it('deletes audit logs older than 12 months', async () => {
      const deleteMany = jest.fn().mockResolvedValue({ count: 7 })
      const prisma = makePrisma({ auditLog: { create: jest.fn(), deleteMany } })
      const service = new ScheduleService(prisma, makeCriticals(), makeBackup(), makeSystemConfig())

      await service.archiveAuditLogs()

      const where = deleteMany.mock.calls[0]![0]!.where
      expect(where.createdAt.lt).toBeInstanceOf(Date)
    })
  })
})
