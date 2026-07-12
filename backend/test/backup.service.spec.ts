import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { BackupService } from '../src/modules/backup/backup.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('BackupService', () => {
  let svc: BackupService
  let prisma: any

  const mockBackup = { id: 'b1', type: 'CONFIG', status: 'COMPLETED', sizeBytes: 100, checksum: 'abc123', createdBy: 'u1', filePath: '/tmp/backup.json', createdAt: new Date() }

  const mockPrisma = {
    backupRecord: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    systemConfig: { findMany: jest.fn(), upsert: jest.fn() },
    auditLog: { findMany: jest.fn(), count: jest.fn() },
    loginLog: { count: jest.fn() },
    exportApproval: { findMany: jest.fn() },
    user: { findMany: jest.fn(), upsert: jest.fn() },
    patient: { findMany: jest.fn(), upsert: jest.fn() },
  }

  beforeAll(async () => {
    process.env['BACKUP_DIR'] = 'C:\\Users\\lz\\AppData\\Local\\Temp\\opencode\\backup_test'
    const module = await Test.createTestingModule({
      providers: [BackupService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile()
    svc = module.get(BackupService)
    prisma = module.get(PrismaService)
  })

  beforeEach(() => jest.clearAllMocks())

  describe('createBackup', () => {
    it('creates CONFIG backup', async () => {
      mockPrisma.systemConfig.findMany.mockResolvedValue([])
      mockPrisma.backupRecord.create.mockResolvedValue(mockBackup)
      const result = await svc.createBackup('CONFIG')
      expect(result.type).toBe('CONFIG')
    })

    it('creates FULL backup', async () => {
      mockPrisma.user.findMany.mockResolvedValue([])
      mockPrisma.patient.findMany.mockResolvedValue([])
      mockPrisma.systemConfig.findMany.mockResolvedValue([])
      mockPrisma.auditLog.count.mockResolvedValue(0)
      mockPrisma.backupRecord.create.mockResolvedValue(mockBackup)
      const result = await svc.createBackup('FULL')
      expect(result.type).toBe('FULL')
    })
  })

  describe('listBackups', () => {
    it('returns backups', async () => {
      mockPrisma.backupRecord.findMany.mockResolvedValue([mockBackup])
      mockPrisma.backupRecord.count.mockResolvedValue(1)
      const result = await svc.listBackups({ page: 1, pageSize: 20 })
      expect(result.items).toHaveLength(1)
    })
  })

  describe('getBackupById', () => {
    it('returns backup', async () => {
      mockPrisma.backupRecord.findUnique.mockResolvedValue(mockBackup)
      const result = await svc.getBackupById('b1')
      expect(result.id).toBe('b1')
    })

    it('throws on missing', async () => {
      mockPrisma.backupRecord.findUnique.mockResolvedValue(null)
      await expect(svc.getBackupById('x')).rejects.toThrow(NotFoundException)
    })
  })
})
