import { Test } from '@nestjs/testing'
import { CriticalExtService } from '../src/criticals/criticalext.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('CriticalExtService', () => {
  let svc: CriticalExtService
  let prisma: any

  const mockPrisma = {
    systemConfig: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    criticalValue: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    criticalValueNotification: {
      findMany: jest.fn(),
    },
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CriticalExtService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()
    svc = module.get(CriticalExtService)
    prisma = module.get(PrismaService)
  })

  beforeEach(() => jest.clearAllMocks())

  describe('listCriticalRules', () => {
    it('returns rules with startsWith filter', async () => {
      mockPrisma.systemConfig.findMany.mockResolvedValue([{ key: 'critical_rule_1', value: {} }])
      const result = await svc.listCriticalRules()
      expect(result.data).toHaveLength(1)
      expect(mockPrisma.systemConfig.findMany).toHaveBeenCalledWith({
        where: { key: { startsWith: 'critical_rule_' } },
      })
    })
  })

  describe('createCriticalRule', () => {
    it('creates a rule with timestamp key', async () => {
      mockPrisma.systemConfig.create.mockResolvedValue({ key: 'critical_rule_123', value: {} })
      const result = await svc.createCriticalRule({ name: 'High Priority', triggerCondition: 'severity >= HIGH', severity: 'HIGH', channels: ['SMS'], recipients: ['admin@hospital.com'] })
      expect(result.data).toHaveLength(1)
    })
  })

  describe('updateCriticalRule', () => {
    it('updates existing rule', async () => {
      mockPrisma.systemConfig.update.mockResolvedValue({ key: 'critical_rule_1', value: {} })
      const result = await svc.updateCriticalRule('critical_rule_1', { severity: 'CRITICAL' })
      expect(result.data).toHaveLength(1)
    })
  })

  describe('deleteCriticalRule', () => {
    it('deletes rule by key', async () => {
      mockPrisma.systemConfig.delete.mockResolvedValue({} as any)
      const result = await svc.deleteCriticalRule('critical_rule_1')
      expect(result.data).toEqual([])
    })
  })

  describe('getCriticalStats', () => {
    it('returns stats with total, byState, bySeverity', async () => {
      mockPrisma.criticalValue.count.mockResolvedValue(10)
      mockPrisma.criticalValue.groupBy.mockResolvedValueOnce([{ state: 'FOUND', _count: { id: 5 } }])
      mockPrisma.criticalValue.groupBy.mockResolvedValueOnce([{ severity: 'HIGH', _count: { id: 3 } }])
      const result = await svc.getCriticalStats()
      expect(result.data.total).toBe(10)
      expect(result.data.byState).toHaveLength(1)
      expect(result.data.bySeverity).toHaveLength(1)
    })
  })

  describe('getCriticalSummary', () => {
    it('returns recent criticals', async () => {
      mockPrisma.criticalValue.findMany.mockResolvedValue([{ id: 'c1' }])
      const result = await svc.getCriticalSummary()
      expect(result.data).toHaveLength(1)
    })
  })

  describe('getCriticalTimeline', () => {
    it('returns recent notifications', async () => {
      mockPrisma.criticalValueNotification.findMany.mockResolvedValue([{ id: 'n1' }])
      const result = await svc.getCriticalTimeline()
      expect(result.data).toHaveLength(1)
    })
  })

  describe('listCriticalCenter', () => {
    it('returns all criticals', async () => {
      mockPrisma.criticalValue.findMany.mockResolvedValue([{ id: 'c1' }])
      const result = await svc.listCriticalCenter()
      expect(result.data).toHaveLength(1)
    })
  })

  describe('getCriticalCenterItem', () => {
    it('returns item when found', async () => {
      mockPrisma.criticalValue.findUnique.mockResolvedValue({ id: 'c1' })
      const result = await svc.getCriticalCenterItem('c1')
      expect(result.data).toHaveLength(1)
    })

    it('returns empty array when not found', async () => {
      mockPrisma.criticalValue.findUnique.mockResolvedValue(null)
      const result = await svc.getCriticalCenterItem('x')
      expect(result.data).toEqual([])
    })
  })

  describe('autoDetectCritical', () => {
    it('creates critical value and returns it', async () => {
      mockPrisma.criticalValue.create.mockResolvedValue({ id: 'c1' })
      const result = await svc.autoDetectCritical({ examId: 'e1', reportContent: '发现异常' })
      expect(result.data).toHaveLength(1)
    })
  })

  describe('closeCriticalLoop', () => {
    it('updates to RESOLVED state', async () => {
      mockPrisma.criticalValue.update.mockResolvedValue({ id: 'c1', state: 'RESOLVED' })
      const result = await svc.closeCriticalLoop({ criticalId: 'c1', resolution: '已确认并处理', resolvedBy: 'doctor1' })
      expect(result.data).toHaveLength(1)
      expect(mockPrisma.criticalValue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1' },
          data: expect.objectContaining({ state: 'RESOLVED' }),
        })
      )
    })
  })

  describe('getReceiverPortal', () => {
    it('returns pending notifications', async () => {
      mockPrisma.criticalValueNotification.findMany.mockResolvedValue([{ id: 'n1', status: 'PENDING' }])
      const result = await svc.getReceiverPortal()
      expect(result.data).toHaveLength(1)
      expect(mockPrisma.criticalValueNotification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: 'PENDING' } })
      )
    })
  })
})
