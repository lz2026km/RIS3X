import { Test } from '@nestjs/testing'
import { CdsService } from '../src/cds/cds.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('CdsService', () => {
  let svc: CdsService
  let prisma: any

  const mockPrisma = {
    systemConfig: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    notification: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
    },
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CdsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()
    svc = module.get(CdsService)
    prisma = module.get(PrismaService)
  })

  beforeEach(() => jest.clearAllMocks())

  describe('evaluateRule', () => {
    it('returns contrast warning when examType includes 增强', async () => {
      const result = await svc.evaluateRule({ examType: '头部增强', modality: 'CT', age: 40 })
      expect(result.cards).toHaveLength(2)
      expect(result.cards[0].uuid).toBe('contrast-001')
    })

    it('returns dose warning for pediatric CT', async () => {
      const result = await svc.evaluateRule({ modality: 'CT', age: 10 })
      expect(result.cards).toHaveLength(2)
      expect(result.cards.some((c: any) => c.uuid === 'dose-001')).toBe(true)
    })

    it('returns only protocol card for normal adult non-contrast', async () => {
      const result = await svc.evaluateRule({ modality: 'MR', age: 40, examType: '头部平扫' })
      expect(result.cards).toHaveLength(1)
      expect(result.cards[0].uuid).toBe('protocol-001')
    })
  })

  describe('updateRulePriority', () => {
    it('returns success', async () => {
      const result = await svc.updateRulePriority({ ruleId: 'r1', priority: 80 })
      expect(result).toEqual({ success: true })
    })
  })

  describe('listGuidelines', () => {
    it('queries systemConfig with cds_guideline_ prefix', async () => {
      mockPrisma.systemConfig.findMany.mockResolvedValue([{ key: 'cds_guideline_1', value: {} }])
      const result = await svc.listGuidelines()
      expect(mockPrisma.systemConfig.findMany).toHaveBeenCalledWith({ where: { key: { startsWith: 'cds_guideline_' } } })
      expect(result.data).toHaveLength(1)
    })
  })

  describe('getGuideline', () => {
    it('returns guideline by key', async () => {
      mockPrisma.systemConfig.findUnique.mockResolvedValue({ key: 'g1', value: {} })
      const result = await svc.getGuideline('g1')
      expect(result.data).toHaveLength(1)
    })

    it('returns empty array when not found', async () => {
      mockPrisma.systemConfig.findUnique.mockResolvedValue(null)
      const result = await svc.getGuideline('x')
      expect(result.data).toEqual([])
    })
  })

  describe('createGuideline', () => {
    it('creates systemConfig entry', async () => {
      mockPrisma.systemConfig.create.mockResolvedValue({ key: 'cds_guideline_123', value: { title: 'test' } })
      const result = await svc.createGuideline({ title: 'test', content: 'c', modality: 'CT' })
      expect(result.data).toHaveLength(1)
      expect(result.data[0].key).toContain('cds_guideline_')
    })
  })

  describe('listAlerts', () => {
    it('queries notifications', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([{ id: 'n1' }])
      const result = await svc.listAlerts()
      expect(result.data).toHaveLength(1)
    })
  })

  describe('acknowledgeAlert', () => {
    it('updates notification with read status', async () => {
      mockPrisma.notification.update.mockResolvedValue({ id: 'n1', read: true } as any)
      const result = await svc.acknowledgeAlert({ ackedBy: 'u1' })
      expect(result.data).toHaveLength(1)
    })
  })

  describe('getDoseMonitoring', () => {
    it('queries auditLog with cds-dose resource', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([{ id: 'a1' }])
      const result = await svc.getDoseMonitoring()
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({ where: { resource: 'cds-dose' }, orderBy: { createdAt: 'desc' } })
      expect(result.data).toHaveLength(1)
    })
  })

  describe('getCdsStatistics', () => {
    it('queries auditLog with cds- prefix', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([])
      await svc.getCdsStatistics()
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({ where: { resource: { startsWith: 'cds-' } }, orderBy: { createdAt: 'desc' } })
    })
  })

  describe('listCdsRules', () => {
    it('queries systemConfig with cds_rule_ prefix', async () => {
      mockPrisma.systemConfig.findMany.mockResolvedValue([{ key: 'cds_rule_1', value: {} }])
      const result = await svc.listCdsRules()
      expect(result.data).toHaveLength(1)
    })
  })

  describe('createCdsRule', () => {
    it('creates cds rule in systemConfig', async () => {
      mockPrisma.systemConfig.create.mockResolvedValue({ key: 'cds_rule_123', value: {} })
      const result = await svc.createCdsRule({ name: 'rule1', condition: 'c', action: 'a', priority: 50, enabled: true })
      expect(result.data).toHaveLength(1)
    })
  })

  describe('getCdsManagement', () => {
    it('queries systemConfig with cds_ prefix', async () => {
      mockPrisma.systemConfig.findMany.mockResolvedValue([])
      await svc.getCdsManagement()
      expect(mockPrisma.systemConfig.findMany).toHaveBeenCalledWith({ where: { key: { startsWith: 'cds_' } } })
    })
  })
})
