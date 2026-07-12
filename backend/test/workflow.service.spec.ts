import { Test } from '@nestjs/testing'
import { WorkflowService } from '../src/workflow/workflow.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('WorkflowService', () => {
  let svc: WorkflowService

  const mockDefinition = {
    id: 'wf1',
    name: 'CT检查流程',
    description: 'CT imaging workflow',
    active: true,
    version: 1,
  }

  const mockStep = {
    id: 'ws1',
    workflowId: 'wf1',
    name: '申请',
    stepType: 'ORDER',
    orderIndex: 1,
  }

  const mockSla = {
    id: 'sla1',
    name: '急诊CT',
    modality: 'CT',
    priority: 'HIGH',
    targetMinutes: 60,
    warningMinutes: 45,
  }

  const mockRule = {
    id: 'rr1',
    name: 'CT转诊',
    modality: 'CT',
    targetDept: '放射科',
    priority: 1,
    active: true,
  }

  let prisma: any

  const mockPrisma = {
    workflowDefinition: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    workflowStep: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    slaPolicy: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    routingRule: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        WorkflowService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()
    svc = module.get(WorkflowService)
    prisma = module.get(PrismaService)
  })

  beforeEach(() => jest.clearAllMocks())

  describe('Workflow Definitions', () => {
    it('listDefinitions returns all', async () => {
      mockPrisma.workflowDefinition.findMany.mockResolvedValue([mockDefinition])
      const result = await svc.listDefinitions()
      expect(result.data).toHaveLength(1)
    })

    it('createDefinition creates', async () => {
      mockPrisma.workflowDefinition.create.mockResolvedValue(mockDefinition)
      const result = await svc.createDefinition({ name: 'CT检查流程' })
      expect(result.data[0].id).toBe('wf1')
    })

    it('getDefinition returns with steps', async () => {
      mockPrisma.workflowDefinition.findUnique.mockResolvedValue(mockDefinition)
      const result = await svc.getDefinition('wf1')
      expect(result.data[0].id).toBe('wf1')
    })

    it('getDefinition returns empty when not found', async () => {
      mockPrisma.workflowDefinition.findUnique.mockResolvedValue(null)
      const result = await svc.getDefinition('x')
      expect(result.data).toHaveLength(0)
    })

    it('updateDefinition updates', async () => {
      mockPrisma.workflowDefinition.update.mockResolvedValue({ ...mockDefinition, name: 'updated' })
      const result = await svc.updateDefinition('wf1', { name: 'updated' })
      expect(result.data[0].name).toBe('updated')
    })

    it('deleteDefinition deletes', async () => {
      mockPrisma.workflowDefinition.delete.mockResolvedValue(mockDefinition)
      const result = await svc.deleteDefinition('wf1')
      expect(result.data).toEqual([])
    })

    it('activateDefinition activates', async () => {
      mockPrisma.workflowDefinition.update.mockResolvedValue({ ...mockDefinition, active: true })
      const result = await svc.activateDefinition({ id: 'wf1' })
      expect(result.data[0].active).toBe(true)
    })
  })

  describe('Workflow Steps', () => {
    it('listSteps returns steps for workflow', async () => {
      mockPrisma.workflowStep.findMany.mockResolvedValue([mockStep])
      const result = await svc.listSteps('wf1')
      expect(result.data).toHaveLength(1)
    })

    it('addStep creates step', async () => {
      mockPrisma.workflowStep.create.mockResolvedValue(mockStep)
      const result = await svc.addStep({ workflowId: 'wf1', name: '申请', stepType: 'ORDER', orderIndex: 1 })
      expect(result.data[0].id).toBe('ws1')
    })
  })

  describe('SLA Policies', () => {
    it('listSlaPolicies returns all', async () => {
      mockPrisma.slaPolicy.findMany.mockResolvedValue([mockSla])
      const result = await svc.listSlaPolicies()
      expect(result.data).toHaveLength(1)
    })

    it('createSlaPolicy creates', async () => {
      mockPrisma.slaPolicy.create.mockResolvedValue(mockSla)
      const result = await svc.createSlaPolicy({ name: '急诊CT', modality: 'CT', targetMinutes: 60, warningMinutes: 45 })
      expect(result.data[0].name).toBe('急诊CT')
    })

    it('updateSlaPolicy updates', async () => {
      mockPrisma.slaPolicy.update.mockResolvedValue({ ...mockSla, targetMinutes: 30 })
      const result = await svc.updateSlaPolicy('sla1', { targetMinutes: 30 })
      expect(result.data[0].targetMinutes).toBe(30)
    })
  })

  describe('Routing Rules', () => {
    it('listRoutingRules returns all', async () => {
      mockPrisma.routingRule.findMany.mockResolvedValue([mockRule])
      const result = await svc.listRoutingRules()
      expect(result.data).toHaveLength(1)
    })

    it('createRoutingRule creates', async () => {
      mockPrisma.routingRule.create.mockResolvedValue(mockRule)
      const result = await svc.createRoutingRule({ name: 'CT转诊', modality: 'CT', targetDept: '放射科', priority: 1 })
      expect(result.data[0].id).toBe('rr1')
    })

    it('updateRoutingRule updates', async () => {
      mockPrisma.routingRule.update.mockResolvedValue({ ...mockRule, priority: 2 })
      const result = await svc.updateRoutingRule('rr1', { priority: 2 })
      expect(result.data[0].priority).toBe(2)
    })

    it('deleteRoutingRule deletes', async () => {
      mockPrisma.routingRule.delete.mockResolvedValue(mockRule)
      const result = await svc.deleteRoutingRule('rr1')
      expect(result.data).toEqual([])
    })
  })
})
