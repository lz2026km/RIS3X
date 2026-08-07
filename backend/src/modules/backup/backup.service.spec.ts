/**
 * G005 RIS v3.0.6.11-79 (W3-B) - BackupService 保留策略测试
 * BACKUP_RETENTION_DAYS: 创建备份时清理超过保留期的旧备份文件与记录
 */
import { BackupService } from './backup.service'

const OLD_FILE = '/data/backups/backup-old.json'
const KEEP_FILE = '/data/backups/backup-keep.json'

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const prisma: Record<string, unknown> = {
    systemConfig: { findMany: jest.fn().mockResolvedValue([]) },
    auditLog: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    loginLog: { count: jest.fn().mockResolvedValue(0) },
    exportApproval: { findMany: jest.fn().mockResolvedValue([]) },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    patient: { findMany: jest.fn().mockResolvedValue([]) },
    backupRecord: {
      create: jest.fn().mockResolvedValue({ id: 'bkp-1' }),
      findMany: jest.fn().mockResolvedValue([]),
      delete: jest.fn().mockResolvedValue({}),
    },
    ...overrides,
  }
  return prisma as never
}

const makeService = (prisma: unknown) => new BackupService(prisma as never)

describe('BackupService (W3-B retention)', () => {
  it('createBackup prunes records older than BACKUP_RETENTION_DAYS', async () => {
    const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000)
    const oldRecord = {
      id: 'old-1',
      filePath: OLD_FILE,
      createdAt: new Date(cutoff.getTime() - 86400_000),
    }
    const keepRecord = {
      id: 'keep-1',
      filePath: KEEP_FILE,
      createdAt: new Date(Date.now() - 1000),
    }
    const unlink = jest.spyOn(require('fs/promises'), 'unlink').mockResolvedValue(undefined)
    const prisma = makePrisma({
      backupRecord: {
        create: jest.fn().mockResolvedValue({ id: 'bkp-new' }),
        findMany: jest.fn().mockResolvedValue([oldRecord, keepRecord]),
        delete: jest.fn().mockResolvedValue({}),
      },
    })
    const service = makeService(prisma)
    const result = await service.createBackup('FULL', 'admin')

    const records = (prisma as unknown as { backupRecord: { delete: jest.Mock } }).backupRecord
    expect(result.prunedOldCount).toBe(2)
    expect(unlink).toHaveBeenCalledWith(OLD_FILE)
    expect(unlink).toHaveBeenCalledWith(KEEP_FILE)
    expect(records.delete).toHaveBeenCalledWith({ where: { id: 'old-1' } })
    expect(records.delete).toHaveBeenCalledWith({ where: { id: 'keep-1' } })
    unlink.mockRestore()
  })

  it('createBackup keeps records when none exceed retention', async () => {
    const prisma = makePrisma({
      backupRecord: {
        create: jest.fn().mockResolvedValue({ id: 'bkp-2' }),
        findMany: jest.fn().mockResolvedValue([]),
        delete: jest.fn().mockResolvedValue({}),
      },
    })
    const service = makeService(prisma)
    const result = await service.createBackup('FULL', 'admin')
    expect(result.prunedOldCount).toBe(0)
  })

  it('prune failure does not break backup creation', async () => {
    const prisma = makePrisma({
      backupRecord: {
        create: jest.fn().mockResolvedValue({ id: 'bkp-3' }),
        findMany: jest.fn().mockRejectedValue(new Error('db down')),
        delete: jest.fn().mockResolvedValue({}),
      },
    })
    const service = makeService(prisma)
    const result = await service.createBackup('FULL', 'admin')
    expect(result.id).toBe('bkp-3')
    expect(result.prunedOldCount).toBe(0)
  })
})
