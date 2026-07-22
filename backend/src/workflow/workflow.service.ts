import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  async listDefinitions() {
    const data = await this.prisma.workflowDefinition.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async createDefinition(body: Record<string, unknown>) {
    const data = await this.prisma.workflowDefinition.create({ data: body })
    return { data: [data] }
  }

  async getDefinition(id: string) {
    const data = await this.prisma.workflowDefinition.findUnique({ where: { id }, include: { steps: true } })
    return { data: data ? [data] : [] }
  }

  async updateDefinition(id: string, body: Record<string, unknown>) {
    const data = await this.prisma.workflowDefinition.update({ where: { id }, data: body })
    return { data: [data] }
  }

  async deleteDefinition(id: string) {
    await this.prisma.workflowDefinition.delete({ where: { id } })
    return { data: [] }
  }

  async activateDefinition(body: Record<string, unknown>) {
    const { id, ...rest } = body
    const data = await this.prisma.workflowDefinition.update({ where: { id }, data: { active: true, ...rest } })
    return { data: [data] }
  }

  async listSteps(id: string) {
    const data = await this.prisma.workflowStep.findMany({ where: { workflowId: id }, orderBy: { orderIndex: 'asc' } })
    return { data }
  }

  async addStep(body: Record<string, unknown>) {
    const data = await this.prisma.workflowStep.create({ data: body })
    return { data: [data] }
  }

  async listSlaPolicies() {
    const data = await this.prisma.slaPolicy.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async createSlaPolicy(body: Record<string, unknown>) {
    const data = await this.prisma.slaPolicy.create({ data: body })
    return { data: [data] }
  }

  async updateSlaPolicy(id: string, body: Record<string, unknown>) {
    const data = await this.prisma.slaPolicy.update({ where: { id }, data: body })
    return { data: [data] }
  }

  async listRoutingRules() {
    const data = await this.prisma.routingRule.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async createRoutingRule(body: Record<string, unknown>) {
    const data = await this.prisma.routingRule.create({ data: body })
    return { data: [data] }
  }

  async updateRoutingRule(id: string, body: Record<string, unknown>) {
    const data = await this.prisma.routingRule.update({ where: { id }, data: body })
    return { data: [data] }
  }

  async deleteRoutingRule(id: string) {
    await this.prisma.routingRule.delete({ where: { id } })
    return { data: [] }
  }
}
