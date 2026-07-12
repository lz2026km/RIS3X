import { Test } from '@nestjs/testing'
import { AuditService } from '../src/modules/audit/audit.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('AuditService', () => {
  let svc: AuditService
  let prisma: any

  const mockLog = { id: 'al1', userId: 'u1', action: 'LOGIN', resource: 'auth', createdAt: new Date() }

  const mockPrisma = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [AuditService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile()
    svc = module.get(AuditService)
    prisma = module.get(PrismaService)
  })

  beforeEach(() => jest.clearAllMocks())

  describe('log', () => {
    it('creates audit log', async () => {
      mockPrisma.auditLog.create.mockResolvedValue(mockLog)
      const result = await svc.log({ action: 'LOGIN', resource: 'auth' })
      expect(result.id).toBe('al1')
    })
  })

  describe('list', () => {
    it('returns items and total', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([mockLog])
      mockPrisma.auditLog.count.mockResolvedValue(1)
      const result = await svc.list({ page: 1, pageSize: 20 })
      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('filters by userId and action', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([])
      mockPrisma.auditLog.count.mockResolvedValue(0)
      await svc.list({ userId: 'u1', action: 'LOGIN' })
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalled()
    })
  })

  describe('stats', () => {
    it('returns audit stats', async () => {
      mockPrisma.auditLog.count.mockResolvedValueOnce(100)
      mockPrisma.auditLog.count.mockResolvedValueOnce(10)
      const result = await svc.stats()
      expect(result.total).toBe(100)
      expect(result.last24h).toBe(10)
    })
  })
})
