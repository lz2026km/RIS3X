import { Test } from '@nestjs/testing'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { OrchestratorService } from '../src/modules/orchestrator/orchestrator.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('OrchestratorService', () => {
  let svc: OrchestratorService
  let prisma: any

  const flow = {
    id: 'fl1',
    tenantId: 'default',
    name: '报告审核流',
    description: 'd',
    steps: [
      { name: '写报告', stepType: 'WRITE', slaMinutes: 30, autoDispatch: true, condition: '' },
      { name: '审核', stepType: 'REVIEW', slaMinutes: 60 },
    ],
    slaConfigId: null,
  }
  const execution = { id: 'ex1', tenantId: 'default', flowId: 'fl1', status: 'RUNNING', currentStep: 0, startedAt: new Date(), context: {}, slaDeadline: null, trigger: 'manual' }
  const stepExecution = { id: 'se1', executionId: 'ex1', stepIndex: 0, stepName: '写报告', stepType: 'WRITE', status: 'RUNNING', slaMinutes: 30, autoDispatch: true, condition: '', startedAt: new Date() }

  const mockPrisma = {
    orchestratorFlow: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    flowExecution: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    flowStepExecution: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    slaConfig: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [OrchestratorService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile()
    svc = module.get(OrchestratorService)
    prisma = module.get(PrismaService)
  })

  beforeEach(() => jest.clearAllMocks())

  it('createFlow persists a flow with steps', async () => {
    mockPrisma.orchestratorFlow.create.mockResolvedValue({ ...flow, slaConfig: null })
    const r = await svc.createFlow({ name: '报告审核流', description: 'd', steps: flow.steps, slaConfigId: 's1' })
    expect(r.name).toBe('报告审核流')
    expect(mockPrisma.orchestratorFlow.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ tenantId: 'default', slaConfigId: 's1' }) }),
    )
  })

  it('getFlow returns flow with executions and throws on missing', async () => {
    mockPrisma.orchestratorFlow.findUnique.mockResolvedValue({ ...flow, executions: [] })
    const r = await svc.getFlow('fl1')
    expect(r.executions).toEqual([])
    mockPrisma.orchestratorFlow.findUnique.mockResolvedValue(null)
    await expect(svc.getFlow('nope')).rejects.toThrow(NotFoundException)
  })

  it('triggerFlow creates execution and first step', async () => {
    mockPrisma.orchestratorFlow.findUnique.mockResolvedValue(flow)
    mockPrisma.flowExecution.create.mockResolvedValue(execution)
    mockPrisma.flowStepExecution.create.mockResolvedValue(stepExecution)
    mockPrisma.flowExecution.findUnique.mockResolvedValue({ ...execution, stepExecutions: [stepExecution] })
    const r = (await svc.triggerFlow('fl1', { executionId: 'wfl-1', context: { urgent: true } })) as any
    expect(r.stepExecutions).toHaveLength(1)
    expect(mockPrisma.flowExecution.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'RUNNING', trigger: 'wfl-1', currentStep: 0 }) }),
    )
    expect(mockPrisma.flowStepExecution.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ stepName: '写报告', autoDispatch: true }) }),
    )
  })

  it('triggerFlow throws when flow missing', async () => {
    mockPrisma.orchestratorFlow.findUnique.mockResolvedValue(null)
    await expect(svc.triggerFlow('nope', {})).rejects.toThrow(NotFoundException)
  })

  it('triggerFlow with empty steps creates no step execution', async () => {
    mockPrisma.orchestratorFlow.findUnique.mockResolvedValue({ ...flow, steps: [] })
    mockPrisma.flowExecution.create.mockResolvedValue(execution)
    mockPrisma.flowExecution.findUnique.mockResolvedValue({ ...execution, stepExecutions: [] })
    await svc.triggerFlow('fl1', {})
    expect(mockPrisma.flowStepExecution.create).not.toHaveBeenCalled()
  })

  it('triggerNextStep completes execution when past last step', async () => {
    mockPrisma.flowExecution.findUnique.mockResolvedValue({ ...execution, status: 'RUNNING', currentStep: 1, flow })
    mockPrisma.flowExecution.update.mockResolvedValue({ ...execution, status: 'COMPLETED', currentStep: 2 })
    const r = await svc.triggerNextStep('ex1')
    expect(r.status).toBe('COMPLETED')
    expect(mockPrisma.flowExecution.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED', currentStep: 2 }) }),
    )
  })

  it('triggerNextStep advances to next step', async () => {
    mockPrisma.flowExecution.findUnique.mockResolvedValue({ ...execution, status: 'RUNNING', currentStep: 0, flow })
    mockPrisma.flowStepExecution.create.mockResolvedValue(stepExecution)
    mockPrisma.flowExecution.update.mockResolvedValue({ ...execution, currentStep: 1 })
    const r = await svc.triggerNextStep('ex1')
    expect(r.currentStep).toBe(1)
    expect(mockPrisma.flowStepExecution.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ stepIndex: 1, stepName: '审核', slaMinutes: 60 }) }),
    )
  })

  it('triggerNextStep throws on missing or completed execution', async () => {
    mockPrisma.flowExecution.findUnique.mockResolvedValue(null)
    await expect(svc.triggerNextStep('nope')).rejects.toThrow(NotFoundException)
    mockPrisma.flowExecution.findUnique.mockResolvedValue({ ...execution, status: 'COMPLETED', flow })
    await expect(svc.triggerNextStep('ex1')).rejects.toThrow(BadRequestException)
  })

  it('getExecutions lists with pagination and status filter', async () => {
    mockPrisma.flowExecution.findMany.mockResolvedValue([execution])
    mockPrisma.flowExecution.count.mockResolvedValue(1)
    const r = await svc.getExecutions(2, 10, 'RUNNING')
    expect(r.items).toHaveLength(1)
    expect(r.total).toBe(1)
    expect(r.page).toBe(2)
    expect(mockPrisma.flowExecution.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'default', status: 'RUNNING' }, skip: 10, take: 10 }),
    )
    await svc.getExecutions(1, 20)
    expect(mockPrisma.flowExecution.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { tenantId: 'default' } }),
    )
  })

  it('upsertSlaConfig updates existing config and throws when missing', async () => {
    mockPrisma.slaConfig.findUnique.mockResolvedValue({ id: 's1' })
    mockPrisma.slaConfig.update.mockResolvedValue({ id: 's1', name: 'SLA-1' })
    const r = await svc.upsertSlaConfig({ id: 's1', name: 'SLA-1', targetMinutes: 30, warningMinutes: 20 })
    expect(r.name).toBe('SLA-1')
    expect(mockPrisma.slaConfig.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ priority: 'NORMAL', notifyOnBreach: true }) }),
    )
    mockPrisma.slaConfig.findUnique.mockResolvedValue(null)
    await expect(svc.upsertSlaConfig({ id: 's1', name: 'x', targetMinutes: 1, warningMinutes: 1 })).rejects.toThrow(NotFoundException)
  })

  it('upsertSlaConfig creates new config when no id', async () => {
    mockPrisma.slaConfig.create.mockResolvedValue({ id: 's9', name: 'SLA-9' })
    const r = await svc.upsertSlaConfig({ name: 'SLA-9', stepType: 'REVIEW', priority: 'HIGH', targetMinutes: 60, warningMinutes: 45, autoEscalate: true, escalateRole: 'lead', notifyOnBreach: false })
    expect(r.id).toBe('s9')
    expect(mockPrisma.slaConfig.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ priority: 'HIGH', autoEscalate: true, notifyOnBreach: false }) }),
    )
  })

  it('getSlaConfigs and getFlows query by tenant', async () => {
    mockPrisma.slaConfig.findMany.mockResolvedValue([{ id: 's1' }])
    expect((await svc.getSlaConfigs())).toHaveLength(1)
    mockPrisma.orchestratorFlow.findMany.mockResolvedValue([flow])
    expect((await svc.getFlows())).toHaveLength(1)
    expect(mockPrisma.orchestratorFlow.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: 'default' } }),
    )
  })

  it('getSlaStats computes compliance and averages', async () => {
    mockPrisma.flowExecution.count.mockResolvedValueOnce(10).mockResolvedValueOnce(2)
    mockPrisma.flowStepExecution.count.mockResolvedValueOnce(100).mockResolvedValueOnce(5)
    mockPrisma.flowStepExecution.findMany.mockResolvedValue([
      { slaMinutes: 30, slaBreached: false, completedAt: new Date(10000000), startedAt: new Date(0) },
      { slaMinutes: 60, slaBreached: false, completedAt: null, startedAt: new Date(0) },
    ])
    const r = await svc.getSlaStats()
    expect(r.totalExecutions).toBe(10)
    expect(r.breachedExecutions).toBe(2)
    expect(r.slaComplianceRate).toBe(95)
    expect(r.avgCompletionMin).toBeGreaterThan(0)
    expect(r.totalSteps).toBe(100)
  })

  it('getSlaStats handles empty steps', async () => {
    mockPrisma.flowExecution.count.mockResolvedValue(0)
    mockPrisma.flowStepExecution.count.mockResolvedValue(0)
    mockPrisma.flowStepExecution.findMany.mockResolvedValue([])
    const r = await svc.getSlaStats()
    expect(r.slaComplianceRate).toBe(100)
    expect(r.avgCompletionMin).toBe(0)
  })
})
