import { Test } from '@nestjs/testing'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { SafetyService } from '../src/safety/safety.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('SafetyService', () => {
  let svc: SafetyService
  let prisma: any

  const mockAdverseEvent = {
    id: 'ae1',
    eventType: 'FALL',
    severity: 'MODERATE',
    description: '患者摔倒',
    department: '放射科',
    reportedBy: 'u1',
    status: 'REPORTED',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockRca = {
    id: 'rca1',
    adverseEventId: 'ae1',
    eventTitle: 'Root cause analysis',
    description: '调查中',
    dateOccurred: new Date(),
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockRiskItem = {
    id: 'ri1',
    riskType: 'CLINICAL',
    title: '辐射暴露',
    category: '安全',
    description: '辐射剂量超标',
    likelihood: 3,
    severity: 4,
    rpn: 12,
    riskLevel: 'medium',
    identifiedBy: 'u1',
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockAdverseEventPrisma = {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }
  const mockRcaPrisma = {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }
  const mockRiskPrisma = {
    create: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }
  const mockTransactionPrisma = {
    adverseEvent: mockAdverseEventPrisma,
    rcaInvestigation: mockRcaPrisma,
    riskItem: mockRiskPrisma,
  }
  const mockPrisma: any = {
    adverseEvent: mockAdverseEventPrisma,
    rcaInvestigation: mockRcaPrisma,
    riskItem: mockRiskPrisma,
    $transaction: jest.fn((cb: any) => cb(mockTransactionPrisma)),
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        SafetyService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()
    svc = module.get(SafetyService)
    prisma = module.get(PrismaService)
  })

  beforeEach(() => jest.clearAllMocks())

  describe('AdverseEvent', () => {
    it('create', async () => {
      mockPrisma.adverseEvent.create.mockResolvedValue(mockAdverseEvent)
      const result = await svc.createAdverseEvent({
        eventType: 'FALL',
        severity: 'MODERATE',
        description: '患者摔倒',
        department: '放射科',
        reportedBy: 'u1',
      })
      expect(result.id).toBe('ae1')
    })

    it('get list with filters', async () => {
      mockPrisma.adverseEvent.findMany.mockResolvedValue([mockAdverseEvent])
      const result = await svc.getAdverseEvents({ status: 'REPORTED' })
      expect(result).toHaveLength(1)
    })

    it('get by id', async () => {
      mockPrisma.adverseEvent.findUnique.mockResolvedValue(mockAdverseEvent)
      const result = await svc.getAdverseEvent('ae1')
      expect(result.id).toBe('ae1')
    })

    it('get by id throws on missing', async () => {
      mockPrisma.adverseEvent.findUnique.mockResolvedValue(null)
      await expect(svc.getAdverseEvent('x')).rejects.toThrow(NotFoundException)
    })

    it('update with optimistic locking', async () => {
      mockPrisma.adverseEvent.findUnique.mockResolvedValue(mockAdverseEvent)
      mockPrisma.adverseEvent.update.mockResolvedValue({ ...mockAdverseEvent, description: 'updated' })
      const result = await svc.updateAdverseEvent('ae1', { description: 'updated' })
      expect(result.description).toBe('updated')
    })

    it('update throws on conflict', async () => {
      mockPrisma.adverseEvent.findUnique.mockResolvedValue(mockAdverseEvent)
      mockPrisma.adverseEvent.update.mockRejectedValue({ code: 'P2025' })
      await expect(svc.updateAdverseEvent('ae1', { description: 'x' })).rejects.toThrow(ConflictException)
    })

    it('delete', async () => {
      mockPrisma.adverseEvent.findUnique.mockResolvedValue(mockAdverseEvent)
      mockPrisma.adverseEvent.delete.mockResolvedValue(mockAdverseEvent)
      const result = await svc.deleteAdverseEvent('ae1')
      expect(result.id).toBe('ae1')
    })

    it('delete throws on missing', async () => {
      mockPrisma.adverseEvent.findUnique.mockResolvedValue(null)
      await expect(svc.deleteAdverseEvent('x')).rejects.toThrow(NotFoundException)
    })
  })

  describe('RcaInvestigation', () => {
    it('create', async () => {
      mockPrisma.rcaInvestigation.create.mockResolvedValue(mockRca)
      const result = await svc.createRcaInvestigation({
        adverseEventId: 'ae1',
        eventTitle: 'Root cause analysis',
        dateOccurred: new Date().toISOString(),
      })
      expect(result.id).toBe('rca1')
    })

    it('get list', async () => {
      mockPrisma.rcaInvestigation.findMany.mockResolvedValue([mockRca])
      const result = await svc.getRcaInvestigations({ capaStatus: 'open' })
      expect(result).toHaveLength(1)
    })

    it('get by id', async () => {
      mockPrisma.rcaInvestigation.findUnique.mockResolvedValue(mockRca)
      const result = await svc.getRcaInvestigation('rca1')
      expect(result.id).toBe('rca1')
    })

    it('get by id throws on missing', async () => {
      mockPrisma.rcaInvestigation.findUnique.mockResolvedValue(null)
      await expect(svc.getRcaInvestigation('x')).rejects.toThrow(NotFoundException)
    })

    it('update', async () => {
      mockPrisma.rcaInvestigation.findUnique.mockResolvedValue(mockRca)
      mockPrisma.rcaInvestigation.update.mockResolvedValue({ ...mockRca, conclusion: '完成' })
      const result = await svc.updateRcaInvestigation('rca1', { conclusion: '完成' })
      expect(result.conclusion).toBe('完成')
    })

    it('delete', async () => {
      mockPrisma.rcaInvestigation.findUnique.mockResolvedValue(mockRca)
      mockPrisma.rcaInvestigation.delete.mockResolvedValue(mockRca)
      await svc.deleteRcaInvestigation('rca1')
    })
  })

  describe('RiskItem', () => {
    it('create', async () => {
      mockPrisma.riskItem.create.mockResolvedValue(mockRiskItem)
      const result = await svc.createRiskItem({
        riskType: 'CLINICAL',
        title: '辐射暴露',
        category: '安全',
        description: '辐射剂量超标',
        likelihood: 3,
        severity: 4,
        identifiedBy: 'u1',
      })
      expect(result.id).toBe('ri1')
    })

    it('get list with filters', async () => {
      mockPrisma.riskItem.findMany.mockResolvedValue([mockRiskItem])
      const result = await svc.getRiskItems({ riskLevel: 'medium' })
      expect(result).toHaveLength(1)
    })

    it('get by id', async () => {
      mockPrisma.riskItem.findUnique.mockResolvedValue(mockRiskItem)
      const result = await svc.getRiskItem('ri1')
      expect(result.id).toBe('ri1')
    })

    it('update', async () => {
      mockPrisma.riskItem.findUnique.mockResolvedValue(mockRiskItem)
      mockPrisma.riskItem.update.mockResolvedValue({ ...mockRiskItem, status: 'closed' })
      const result = await svc.updateRiskItem('ri1', { status: 'closed' })
      expect(result.status).toBe('closed')
    })

    it('delete', async () => {
      mockPrisma.riskItem.findUnique.mockResolvedValue(mockRiskItem)
      mockPrisma.riskItem.delete.mockResolvedValue(mockRiskItem)
      await svc.deleteRiskItem('ri1')
    })
  })
})
