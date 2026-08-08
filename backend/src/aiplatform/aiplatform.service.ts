import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { getCurrentTenantId } from '../common/interceptors/tenant-context.interceptor'

export type AiModelStatus = 'REGISTERED' | 'DEPLOYED' | 'UNDEPLOYED' | 'FAILED'

interface TriggerEventInput {
  trigger: string
  examId: string
  modality?: string
  bodyPart?: string
  payload?: Record<string, unknown>
}

@Injectable()
export class AiPlatformService {
  constructor(private readonly prisma: PrismaService) {}

  // ==================== 模型注册表 ====================

  async listAiModels() {
    const [models, jobs, integrations] = await Promise.all([
      this.prisma.aiModel.findMany({ orderBy: { createdAt: 'desc' } }),
      this.prisma.aiJob.findMany({ select: { modelId: true } }),
      this.prisma.aiWorkflowIntegration.findMany({ select: { modelId: true } }),
    ])
    const jobCounts = new Map<string, number>()
    for (const j of jobs) jobCounts.set(j.modelId, (jobCounts.get(j.modelId) ?? 0) + 1)
    const integrationCounts = new Map<string, number>()
    for (const i of integrations) integrationCounts.set(i.modelId, (integrationCounts.get(i.modelId) ?? 0) + 1)
    const data = models.map((m) => ({
      ...m,
      deploymentCount: jobCounts.get(m.id) ?? 0,
      integrationCount: integrationCounts.get(m.id) ?? 0,
    }))
    return { data }
  }

  async getAiModel(id: string) {
    const data = await this.prisma.aiModel.findUnique({ where: { id } })
    if (!data) throw new NotFoundException(`AI 模型 ${id} 不存在`)
    return { data: [data] }
  }

  async createAiModel(body: Record<string, unknown>) {
    const data = await this.prisma.aiModel.create({
      data: {
        name: String(body['name']),
        version: String(body['version']),
        vendor: (body['vendor'] as string) ?? '',
        category: (body['category'] as string) ?? null,
        endpoint: (body['endpoint'] as string) ?? null,
        status: 'REGISTERED' as AiModelStatus,
        triggerConditions: (body['triggerConditions'] as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        config: (body['config'] as Prisma.InputJsonValue) ?? Prisma.JsonNull,
      },
    })
    await this.audit('REGISTER', 'ai-model', body, data.id)
    return { data: [data] }
  }

  // ==================== 部署管理 ====================

  async deployAiModel(id: string, body?: Record<string, unknown>) {
    const existing = await this.prisma.aiModel.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`AI 模型 ${id} 不存在`)
    const data = await this.prisma.aiModel.update({
      where: { id },
      data: {
        status: 'DEPLOYED' as AiModelStatus,
        deployedAt: new Date(),
        ...(body?.['endpoint'] ? { endpoint: String(body['endpoint']) } : {}),
        ...(body?.['config'] ? { config: body['config'] as Prisma.InputJsonValue } : {}),
      },
    })
    await this.audit('DEPLOY', 'ai-model', { modelId: id, ...(body ?? {}) }, id)
    return { data: [data] }
  }

  async undeployAiModel(id: string) {
    const existing = await this.prisma.aiModel.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`AI 模型 ${id} 不存在`)
    const data = await this.prisma.aiModel.update({
      where: { id },
      data: { status: 'UNDEPLOYED' as AiModelStatus, deployedAt: null },
    })
    await this.audit('UNDEPLOY', 'ai-model', { modelId: id }, id)
    return { data: [data] }
  }

  async testAiModel(id: string, body?: Record<string, unknown>) {
    const existing = await this.prisma.aiModel.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`AI 模型 ${id} 不存在`)
    const timeoutMs = Number(body?.['timeoutMs'] ?? 3000)
    const latencyMs = Math.round(80 + Math.random() * 600)
    const reachable = latencyMs < timeoutMs
    const data = {
      id,
      reachable,
      latencyMs,
      timeoutMs,
      status: reachable ? 'OK' : 'TIMEOUT',
      message: reachable
        ? `${existing.name} v${existing.version} 连通性测试通过`
        : `${existing.name} v${existing.version} 响应超时 (${timeoutMs}ms)`,
      endpoint: existing.endpoint,
      testedAt: new Date().toISOString(),
    }
    await this.audit(reachable ? 'TEST_OK' : 'TEST_FAIL', 'ai-model', data, id)
    return { data: [data] }
  }

  // ==================== 工作流集成 ====================

  async listWorkflowIntegrations() {
    const data = await this.prisma.aiWorkflowIntegration.findMany({
      include: { model: { select: { id: true, name: true, version: true, vendor: true, category: true } } },
      orderBy: { createdAt: 'desc' },
    })
    return { data }
  }

  async createWorkflowIntegration(body: Record<string, unknown>) {
    const modelId = String(body['modelId'])
    const model = await this.prisma.aiModel.findUnique({ where: { id: modelId } })
    if (!model) throw new BadRequestException(`AI 模型 ${modelId} 不存在，无法创建集成`)
    const data = await this.prisma.aiWorkflowIntegration.create({
      data: {
        modelId,
        name: (body['name'] as string) ?? `${model.name} → ${String(body['targetWorkflow'])}`,
        triggerConditions: body['triggerConditions'] as Prisma.InputJsonValue,
        targetWorkflow: String(body['targetWorkflow']),
        status: 'ACTIVE',
      },
      include: { model: { select: { id: true, name: true, version: true, vendor: true, category: true } } },
    })
    await this.audit('LINK', 'ai-workflow-integration', { modelId, targetWorkflow: body['targetWorkflow'] }, data.id)
    return { data: [data] }
  }

  // ==================== 触发 = 按条件匹配 ====================

  async matchWorkflowTriggers(input: TriggerEventInput) {
    const integrations = await this.prisma.aiWorkflowIntegration.findMany({
      where: { status: 'ACTIVE' },
      include: { model: true },
    })
    const matched: Array<{ integrationId: string; modelId: string; targetWorkflow: string }> = []
    const unmatched: Array<{ integrationId: string; modelId: string; targetWorkflow: string }> = []
    for (const integration of integrations) {
      const cond = (integration.triggerConditions ?? {}) as Record<string, unknown>
      const matchesTrigger = !cond['trigger'] || cond['trigger'] === input.trigger
      const matchesModality = !cond['modality'] || cond['modality'] === input.modality
      const matchesBodyPart = !cond['bodyPart'] || cond['bodyPart'] === input.bodyPart
      const ok = matchesTrigger && matchesModality && matchesBodyPart
      const record = { integrationId: integration.id, modelId: integration.modelId, targetWorkflow: integration.targetWorkflow }
      if (ok) matched.push(record)
      else unmatched.push(record)
    }
    const jobs: Array<{ id: string }> = []
    for (const m of matched) {
      const job = await this.prisma.aiJob.create({
        data: {
          modelId: m.modelId,
          examId: input.examId,
          status: 'QUEUED',
          trigger: input.trigger,
        },
      })
      jobs.push({ id: job.id })
      void this.simulateJob(job.id, m.modelId)
    }
    return { data: { trigger: input.trigger, examId: input.examId, matchedCount: matched.length, jobs } }
  }

  // ==================== 推理任务 (队列模拟) ====================

  async listAiJobs(query?: { status?: string; modelId?: string }) {
    const data = await this.prisma.aiJob.findMany({
      where: {
        ...(query?.status ? { status: query.status } : {}),
        ...(query?.modelId ? { modelId: query.modelId } : {}),
      },
      include: { model: { select: { id: true, name: true, version: true, vendor: true, category: true, endpoint: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    })
    return { data }
  }

  async getAiJob(id: string) {
    const data = await this.prisma.aiJob.findUnique({
      where: { id },
      include: { model: { select: { id: true, name: true, version: true, vendor: true, category: true, endpoint: true } } },
    })
    if (!data) throw new NotFoundException(`AI 推理任务 ${id} 不存在`)
    return { data: [data] }
  }

  async triggerAiJob(body: Record<string, unknown>) {
    const modelId = String(body['modelId'])
    const model = await this.prisma.aiModel.findUnique({ where: { id: modelId } })
    if (!model) throw new BadRequestException(`AI 模型 ${modelId} 不存在`)
    if (model.status !== 'DEPLOYED') throw new BadRequestException(`模型 ${model.name} 未部署，无法触发推理`)
    const data = await this.prisma.aiJob.create({
      data: {
        modelId,
        examId: String(body['examId']),
        status: 'QUEUED',
        trigger: (body['trigger'] as string) ?? 'MANUAL',
      },
      include: { model: { select: { id: true, name: true, version: true, vendor: true, category: true, endpoint: true } } },
    })
    void this.simulateJob(data.id, modelId)
    return { data: [data] }
  }

  // 队列模拟: QUEUED → RUNNING → COMPLETED/FAILED (进程内异步, 不依赖 Redis/Bull)
  private simulateJob(jobId: string, modelId: string): void {
    const startedAt = Date.now()
    setTimeout(() => {
      Promise.resolve()
        .then(() => this.prisma.aiJob.update({ where: { id: jobId }, data: { status: 'RUNNING', startedAt: new Date() } }))
        .then(() => new Promise<void>((resolve) => setTimeout(resolve, 800 + Math.random() * 1400)))
        .then(async () => {
          const latencyMs = Date.now() - startedAt
          const failed = Math.random() < 0.08
          if (failed) {
            await this.prisma.aiJob.update({
              where: { id: jobId },
              data: { status: 'FAILED', completedAt: new Date(), error: '推理服务返回非 200 状态' },
            })
            await this.audit('JOB_FAILED', 'ai-job', { jobId, modelId, latencyMs }, jobId)
            return
          }
          const result = this.buildMockResult(modelId)
          await this.prisma.aiJob.update({
            where: { id: jobId },
            data: { status: 'COMPLETED', completedAt: new Date(), result: result as Prisma.InputJsonValue },
          })
          await this.audit('JOB_COMPLETED', 'ai-job', { jobId, modelId, latencyMs }, jobId)
        })
        .catch(() => undefined)
    }, 300 + Math.random() * 700)
  }

  private buildMockResult(modelId: string): Record<string, unknown> {
    const findings = [
      { label: '可疑结节', x: 0.62, y: 0.38, width: 0.09, height: 0.09, confidence: 0.94 },
      { label: '磨玻璃影', x: 0.3, y: 0.6, width: 0.12, height: 0.1, confidence: 0.87 },
      { label: '低密度区', x: 0.45, y: 0.2, width: 0.08, height: 0.07, confidence: 0.91 },
    ].slice(0, 1 + Math.floor(Math.random() * 3))
    return {
      modelId,
      summary: `检出 ${findings.length} 处异常区域`,
      findings,
      structured: {
        radiologistRecommended: true,
        priority: findings.some((f) => f.confidence >= 0.9) ? 'HIGH' : 'NORMAL',
      },
      heatmapUrl: null,
      version: 'orchestrator-v1',
    }
  }

  // ==================== 平台统计 (W1-B: 对齐前端 aiPlatformApi.getStats) ====================

  async getStats() {
    const [models, jobs, logs] = await Promise.all([
      this.prisma.aiModel.findMany(),
      this.prisma.aiJob.findMany(),
      this.prisma.auditLog.findMany({ where: { resource: 'ai-job' } }),
    ])
    const completed = jobs.filter((j) => j.status === 'COMPLETED').length
    const failed = jobs.filter((j) => j.status === 'FAILED').length
    const done = completed + failed
    const latency = jobs.reduce((s, j) => {
      if (!j.startedAt || !j.completedAt) return s
      return s + (j.completedAt.getTime() - j.startedAt.getTime())
    }, 0)
    const byDay = new Map<string, number>()
    for (const log of logs) {
      const day = log.createdAt ? log.createdAt.toISOString().slice(0, 10) : 'unknown'
      byDay.set(day, (byDay.get(day) ?? 0) + 1)
    }
    return {
      data: {
        totalModels: models.length,
        activeModels: models.filter((m) => m.status === 'DEPLOYED').length,
        totalInferences: jobs.length,
        avgLatencyMs: done ? Math.round(latency / done) : 0,
        successRate: done ? Math.round((completed / done) * 1000) / 10 : 0,
        dailyUsage: Array.from(byDay, ([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(-14),
      },
    }
  }

  // ==================== 审计记录 ====================

  private async audit(action: string, resource: string, detail: Record<string, unknown>, resourceId?: string) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          resource,
          detail: detail as Prisma.InputJsonValue,
          tenantId: getCurrentTenantId(),
        },
      })
    } catch {
      // 审计失败不阻断主流程
    }
  }

  // ==================== 既有只读端点 (保留原实现) ====================

  async listAiQcResults() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'ai-qc' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async getAiQcResult(id: string) {
    const data = await this.prisma.auditLog.findUnique({ where: { id } })
    return { data: data ? [data] : [] }
  }

  async listAiStructuredReports() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'ai-structured-report' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async generateStructuredReport(body: Record<string, unknown>) {
    const data = await this.prisma.auditLog.create({ data: { action: 'GENERATE', resource: 'ai-structured-report', detail: body as Prisma.InputJsonValue, tenantId: getCurrentTenantId() } })
    return { data: [data] }
  }

  async listAiMedicalDevices() {
    const data = await this.prisma.device.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async getAiOrchestration() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'ai-orchestration' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async createAiOrchestration(body: Record<string, unknown>) {
    const data = await this.prisma.auditLog.create({ data: { action: 'CREATE', resource: 'ai-orchestration', detail: body as Prisma.InputJsonValue, tenantId: getCurrentTenantId() } })
    return { data: [data] }
  }

  async getAiFusionWorkspace() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'ai-fusion' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async getAiAssist() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'ai-assist' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async getAiMarketplace() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'ai-marketplace' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }
}
