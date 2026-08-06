import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  // [G005 P1] 响应形状统一: 列表端点一律返回 { items, total } (与 Nest CRUD 一致),
  // 单实体端点返回实体本身, 不再 { data: [...] } 双包裹。
  async listDefinitions() {
    const items = await this.prisma.workflowDefinition.findMany({ orderBy: { createdAt: 'desc' } })
    return { items, total: items.length }
  }

  async createDefinition(body: Record<string, unknown>) {
    return this.prisma.workflowDefinition.create({ data: body as any })
  }

  async getDefinition(id: string) {
    return this.prisma.workflowDefinition.findUnique({ where: { id }, include: { steps: true } })
  }

  async updateDefinition(id: string, body: Record<string, unknown>) {
    return this.prisma.workflowDefinition.update({ where: { id }, data: body as any })
  }

  async deleteDefinition(id: string) {
    await this.prisma.workflowDefinition.delete({ where: { id } })
    return { deleted: true }
  }

  async activateDefinition(body: Record<string, unknown>) {
    const { id, ...rest } = body
    return this.prisma.workflowDefinition.update({ where: { id: id as string }, data: { active: true, ...(rest as any) } })
  }

  async listSteps(id: string) {
    const items = await this.prisma.workflowStep.findMany({ where: { workflowId: id }, orderBy: { orderIndex: 'asc' } })
    return { items, total: items.length }
  }

  async addStep(body: Record<string, unknown>) {
    return this.prisma.workflowStep.create({ data: body as any })
  }

  async listSlaPolicies() {
    const items = await this.prisma.slaPolicy.findMany({ orderBy: { createdAt: 'desc' } })
    return { items, total: items.length }
  }

  async createSlaPolicy(body: Record<string, unknown>) {
    return this.prisma.slaPolicy.create({ data: body as any })
  }

  async updateSlaPolicy(id: string, body: Record<string, unknown>) {
    return this.prisma.slaPolicy.update({ where: { id }, data: body as any })
  }

  async listRoutingRules() {
    const items = await this.prisma.routingRule.findMany({ orderBy: { createdAt: 'desc' } })
    return { items, total: items.length }
  }

  async createRoutingRule(body: Record<string, unknown>) {
    return this.prisma.routingRule.create({ data: body as any })
  }

  async updateRoutingRule(id: string, body: Record<string, unknown>) {
    return this.prisma.routingRule.update({ where: { id }, data: body as any })
  }

  async deleteRoutingRule(id: string) {
    await this.prisma.routingRule.delete({ where: { id } })
    return { deleted: true }
  }
}
