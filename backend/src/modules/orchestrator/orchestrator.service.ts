import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { getCurrentTenantId } from '../../common/interceptors/tenant-context.interceptor'

export interface CreateFlowDto {
  name: string
  description?: string
  steps: FlowStepDefinition[]
  slaConfigId?: string
}

export interface FlowStepDefinition {
  name: string
  stepType: string
  assigneeRole?: string
  timeoutMinutes?: number
  autoDispatch?: boolean
  condition?: string
  slaMinutes?: number
  config?: Record<string, unknown>
}

export interface TriggerStepDto {
  executionId?: string
  context?: Record<string, unknown>
}

export interface SlaConfigDto {
  id?: string
  name: string
  stepType?: string
  priority?: string
  targetMinutes: number
  warningMinutes: number
  autoEscalate?: boolean
  escalateRole?: string
  notifyOnBreach?: boolean
}

@Injectable()
export class OrchestratorService {
  constructor(private readonly prisma: PrismaService) {}

  async createFlow(dto: CreateFlowDto) {
    const tenantId = getCurrentTenantId()
    return this.prisma.orchestratorFlow.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description ?? '',
        steps: dto.steps as unknown as Prisma.InputJsonValue,
        slaConfigId: dto.slaConfigId,
      },
      include: { slaConfig: true },
    })
  }

  async getFlow(id: string) {
    const flow = await this.prisma.orchestratorFlow.findUnique({
      where: { id },
      include: {
        slaConfig: true,
        executions: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { stepExecutions: { orderBy: { stepIndex: 'asc' } } },
        },
      },
    })
    if (!flow) throw new NotFoundException(`Flow ${id} not found`)
    return flow
  }

  async triggerFlow(flowId: string, dto: TriggerStepDto) {
    const flow = await this.prisma.orchestratorFlow.findUnique({ where: { id: flowId } })
    if (!flow) throw new NotFoundException(`Flow ${flowId} not found`)

    const tenantId = getCurrentTenantId()
    const steps = flow.steps as unknown as FlowStepDefinition[]
    const now = new Date()

    let slaDeadline: Date | undefined
    if (steps.length > 0) {
      const sla = steps[0].slaMinutes
      if (sla) {
        slaDeadline = new Date(now.getTime() + sla * 60000)
      }
    }

    const execution = await this.prisma.flowExecution.create({
      data: {
        tenantId,
        flowId,
        status: 'RUNNING',
        currentStep: 0,
        startedAt: now,
        context: (dto.context ?? {}) as unknown as Prisma.InputJsonValue,
        slaDeadline,
        trigger: dto.executionId ?? 'manual',
      },
    })

    if (steps.length > 0) {
      await this._createStepExecution(execution.id, tenantId, 0, steps[0])
    }

    return this.prisma.flowExecution.findUnique({
      where: { id: execution.id },
      include: { stepExecutions: { orderBy: { stepIndex: 'asc' } } },
    })
  }

  async triggerNextStep(executionId: string) {
    const execution = await this.prisma.flowExecution.findUnique({
      where: { id: executionId },
      include: { flow: true, stepExecutions: { orderBy: { stepIndex: 'asc' } } },
    })
    if (!execution) throw new NotFoundException(`Execution ${executionId} not found`)
    if (execution.status === 'COMPLETED') throw new BadRequestException('Execution already completed')

    const steps = execution.flow.steps as unknown as FlowStepDefinition[]
    const nextIndex = execution.currentStep + 1

    if (nextIndex >= steps.length) {
      return this.prisma.flowExecution.update({
        where: { id: executionId },
        data: { status: 'COMPLETED', completedAt: new Date(), currentStep: nextIndex },
        include: { stepExecutions: { orderBy: { stepIndex: 'asc' } } },
      })
    }

    const tenantId = getCurrentTenantId()
    await this._createStepExecution(executionId, tenantId, nextIndex, steps[nextIndex])

    return this.prisma.flowExecution.update({
      where: { id: executionId },
      data: { currentStep: nextIndex },
      include: { stepExecutions: { orderBy: { stepIndex: 'asc' } } },
    })
  }

  private async _createStepExecution(
    executionId: string,
    tenantId: string,
    stepIndex: number,
    step: FlowStepDefinition,
  ) {
    const now = new Date()
    let slaDeadline: Date | undefined
    if (step.slaMinutes) {
      slaDeadline = new Date(now.getTime() + step.slaMinutes * 60000)
    }

    return this.prisma.flowStepExecution.create({
      data: {
        tenantId,
        executionId,
        stepIndex,
        stepName: step.name,
        stepType: step.stepType,
        status: 'RUNNING',
        autoDispatch: step.autoDispatch ?? false,
        slaMinutes: step.slaMinutes,
        condition: step.condition ?? '',
        startedAt: now,
        slaDeadline,
      },
    })
  }

  async getExecutions(page = 1, limit = 20, status?: string) {
    const tenantId = getCurrentTenantId()
    const where: Record<string, unknown> = { tenantId }
    if (status) where['status'] = status

    const [items, total] = await Promise.all([
      this.prisma.flowExecution.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          flow: { select: { id: true, name: true } },
          stepExecutions: { orderBy: { stepIndex: 'asc' } },
        },
      }),
      this.prisma.flowExecution.count({ where }),
    ])

    return { items, total, page, limit }
  }

  async upsertSlaConfig(dto: SlaConfigDto) {
    const tenantId = getCurrentTenantId()
    if (dto.id) {
      const existing = await this.prisma.slaConfig.findUnique({ where: { id: dto.id } })
      if (!existing) throw new NotFoundException(`SLA config ${dto.id} not found`)
      return this.prisma.slaConfig.update({
        where: { id: dto.id },
        data: {
          name: dto.name,
          stepType: dto.stepType,
          priority: dto.priority ?? 'NORMAL',
          targetMinutes: dto.targetMinutes,
          warningMinutes: dto.warningMinutes,
          autoEscalate: dto.autoEscalate ?? false,
          escalateRole: dto.escalateRole,
          notifyOnBreach: dto.notifyOnBreach ?? true,
        },
      })
    }
    return this.prisma.slaConfig.create({
      data: {
        tenantId,
        name: dto.name,
        stepType: dto.stepType,
        priority: dto.priority ?? 'NORMAL',
        targetMinutes: dto.targetMinutes,
        warningMinutes: dto.warningMinutes,
        autoEscalate: dto.autoEscalate ?? false,
        escalateRole: dto.escalateRole,
        notifyOnBreach: dto.notifyOnBreach ?? true,
      },
    })
  }

  async getSlaConfigs() {
    const tenantId = getCurrentTenantId()
    return this.prisma.slaConfig.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getFlows() {
    const tenantId = getCurrentTenantId()
    return this.prisma.orchestratorFlow.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      include: { slaConfig: true, _count: { select: { executions: true } } },
    })
  }

  async getSlaStats() {
    const tenantId = getCurrentTenantId()
    const [totalExecutions, breachedExecutions, totalSteps, breachedSteps] = await Promise.all([
      this.prisma.flowExecution.count({ where: { tenantId } }),
      this.prisma.flowExecution.count({ where: { tenantId, slaBreached: true } }),
      this.prisma.flowStepExecution.count({ where: { tenantId } }),
      this.prisma.flowStepExecution.count({ where: { tenantId, slaBreached: true } }),
    ])

    const recentSteps = await this.prisma.flowStepExecution.findMany({
      where: { tenantId, slaMinutes: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { slaMinutes: true, slaBreached: true, completedAt: true, startedAt: true },
    })

    const avgCompletionMin = recentSteps
      .filter(s => s.completedAt && s.startedAt)
      .reduce((acc, s) => acc + (s.completedAt!.getTime() - s.startedAt!.getTime()) / 60000, 0) /
      Math.max(1, recentSteps.filter(s => s.completedAt).length)

    const slaComplianceRate =
      totalSteps > 0 ? +((1 - breachedSteps / totalSteps) * 100).toFixed(1) : 100

    return {
      totalExecutions,
      breachedExecutions,
      slaComplianceRate,
      avgCompletionMin: +avgCompletionMin.toFixed(1),
      totalSteps,
      breachedSteps,
    }
  }
}
