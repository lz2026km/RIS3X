import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateCriticalRuleSchema, UpdateCriticalRuleSchema, AutoDetectCriticalSchema, CloseCriticalLoopSchema } from './criticalext.schema'
import { z } from 'zod'

type CreateCriticalRuleDto = z.infer<typeof CreateCriticalRuleSchema>
type UpdateCriticalRuleDto = z.infer<typeof UpdateCriticalRuleSchema>
type AutoDetectCriticalDto = z.infer<typeof AutoDetectCriticalSchema>
type CloseCriticalLoopDto = z.infer<typeof CloseCriticalLoopSchema>

// [W5] 危急值通知通道 (与 criticals.service.resolveDeliveryStatus 读的 critical_channel_<CHANNEL> 对齐)
const NOTIFY_CHANNELS: Array<{ channel: string; label: string }> = [
  { channel: 'SYSTEM', label: '站内通知' },
  { channel: 'SMS', label: '短信' },
  { channel: 'PHONE', label: '电话' },
  { channel: 'WECHAT', label: '微信' },
  { channel: 'EMAIL', label: '邮件' },
]

export interface CriticalChannelDto {
  channel: string
  label: string
  enabled: boolean
}

@Injectable()
export class CriticalExtService {
  constructor(private readonly prisma: PrismaService) {}

  // [G005 P1] 响应形状统一: 列表端点返回 { items, total }, 单实体端点返回实体,
  // 统计端点返回直接对象, 不再 { data: ... } 双包裹。
  async listCriticalRules() {
    const items = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'critical_rule_' } } })
    return { items, total: items.length }
  }

  async createCriticalRule(body: CreateCriticalRuleDto) {
    return this.prisma.systemConfig.create({ data: { key: `critical_rule_${Date.now()}`, value: body as any } })
  }

  async updateCriticalRule(id: string, body: UpdateCriticalRuleDto) {
    return this.prisma.systemConfig.update({ where: { key: id }, data: { value: body as any } })
  }

  async deleteCriticalRule(id: string) {
    await this.prisma.systemConfig.delete({ where: { key: id } })
    return { deleted: true }
  }

  async getCriticalStats() {
    const total = await this.prisma.criticalValue.count()
    const byState = await this.prisma.criticalValue.groupBy({ by: ['state'], _count: { id: true } })
    const bySeverity = await this.prisma.criticalValue.groupBy({ by: ['severity'], _count: { id: true } })
    return { total, byState, bySeverity }
  }

  async getCriticalSummary() {
    const items = await this.prisma.criticalValue.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
    return { items, total: items.length }
  }

  async getCriticalTimeline() {
    const items = await this.prisma.criticalValueNotification.findMany({ orderBy: { triggeredAt: 'desc' }, take: 100 })
    return { items, total: items.length }
  }

  async listCriticalCenter() {
    const items = await this.prisma.criticalValue.findMany({ orderBy: { createdAt: 'desc' } })
    return { items, total: items.length }
  }

  async getCriticalCenterItem(id: string) {
    return this.prisma.criticalValue.findUnique({ where: { id } })
  }

  async autoDetectCritical(body: AutoDetectCriticalDto) {
    return this.prisma.criticalValue.create({ data: body as any })
  }

  // [G005-P0] 闭环统一终态: CLOSED_LOOP + closedAt/closedBy (与 PATCH /criticals/:id 一致)
  async closeCriticalLoop(body: CloseCriticalLoopDto) {
    const { criticalId, resolvedBy, resolvedAt } = body
    const now = resolvedAt ? new Date(resolvedAt) : new Date()
    return this.prisma.criticalValue.update({
      where: { id: criticalId },
      data: {
        state: 'CLOSED_LOOP',
        closedBy: resolvedBy,
        closedAt: now,
        resolvedBy,
        resolvedAt: now,
      } as any,
    })
  }

  async getReceiverPortal() {
    const items = await this.prisma.criticalValueNotification.findMany({ where: { status: 'PENDING' }, orderBy: { triggeredAt: 'desc' } })
    return { items, total: items.length }
  }

  // [G005-P0] 危急值随访记录 (与 MSW criticalExtHandlers /follow-up-records 对齐)
  async getFollowUpRecords() {
    const items = await this.prisma.criticalValueNotification.findMany({ orderBy: { triggeredAt: 'desc' }, take: 100 })
    return { items, total: items.length }
  }

  // [W5] GET /critical-ext/channels: 读 critical_channel_<CHANNEL> 开关 (未配置默认启用)
  async getChannels(): Promise<{ items: CriticalChannelDto[]; total: number }> {
    const rows = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'critical_channel_' } } })
    const enabledByChannel = new Map<string, boolean>()
    for (const row of rows) {
      const channel = row.key.replace(/^critical_channel_/, '')
      const value = (row.value ?? {}) as { enabled?: unknown }
      enabledByChannel.set(channel, Boolean(value.enabled))
    }
    const items = NOTIFY_CHANNELS.map(({ channel, label }) => ({
      channel,
      label,
      enabled: enabledByChannel.get(channel) ?? true,
    }))
    return { items, total: items.length }
  }

  // [W5] PUT /critical-ext/channels: 写 critical_channel_<CHANNEL>, 供 criticals.service 判定投递结果
  async saveChannels(channels: Array<{ channel: string; enabled: boolean }>): Promise<{ items: CriticalChannelDto[]; total: number }> {
    for (const { channel, enabled } of channels) {
      await this.prisma.systemConfig.upsert({
        where: { key: `critical_channel_${channel}` },
        update: { value: { enabled } as any },
        create: { key: `critical_channel_${channel}`, value: { enabled } as any },
      })
    }
    return this.getChannels()
  }
}
