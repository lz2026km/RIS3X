/**
 * G005 放射RIS系统 v3.0.6.11-92 Wave3A (P2) - 急诊通道管理服务 (PACS 急诊通道)
 * 内存 + 种子数据:
 *   - GET/PUT  /emergency-channel/config  通道配置 (开关/优先级/目标角色 + 自动触发关键词)
 *   - GET      /emergency-channel/records 触发记录列表
 *   - POST     /emergency-channel/trigger 创建触发记录 + 模拟通知
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'

export type EmergencyChannelType = 'sms' | 'phone' | 'in-app' | 'wechat' | 'email' | 'pager'

export interface EmergencyChannelConfigItem {
  type: EmergencyChannelType
  label: string
  enabled: boolean
  priority: number
  targetRole: string
}

export interface EmergencyChannelConfigUpdate {
  channels?: Array<{
    type: EmergencyChannelType
    enabled?: boolean
    priority?: number
    targetRole?: string
  }>
  autoTrigger?: {
    enabled?: boolean
    keywords?: string[]
  }
}

export interface EmergencyChannelConfig {
  channels: EmergencyChannelConfigItem[]
  autoTrigger: {
    enabled: boolean
    keywords: string[]
  }
  updatedAt?: string
}

export interface EmergencyNotification {
  channel: EmergencyChannelType
  targetRole: string
  deliveredAt: string
  simulated: boolean
}

export interface EmergencyTriggerRecord {
  id: string
  patientId: string
  patientName?: string
  type: string
  reason: string
  channels: EmergencyChannelType[]
  triggeredBy: string
  triggeredAt: string
  status: 'sent' | 'acknowledged' | 'completed'
  notifications: EmergencyNotification[]
}

export interface EmergencyTriggerQuery {
  patientId?: string
  status?: string
}

export interface EmergencyTriggerDto {
  patientId: string
  patientName?: string
  type?: string
  reason: string
  triggeredBy?: string
}

const CHANNEL_LABELS: Record<EmergencyChannelType, string> = {
  sms: '短信',
  phone: '电话',
  'in-app': '应用内',
  wechat: '微信',
  email: '邮件',
  pager: '呼叫器',
}

const TARGET_ROLES: Record<string, string> = {
  'critical-finding': '值班主任医师',
  'stat-imaging': '急诊影像二线',
  'icu-request': 'ICU 值班医师',
  'er-request': '急诊科值班医师',
  manual: '终核医师',
}

const DEFAULT_CONFIG: EmergencyChannelConfig = {
  channels: [
    { type: 'sms', label: '短信', enabled: true, priority: 3, targetRole: '值班医师' },
    { type: 'phone', label: '电话', enabled: true, priority: 1, targetRole: '值班主任医师' },
    { type: 'in-app', label: '应用内', enabled: true, priority: 2, targetRole: '终核医师' },
    { type: 'wechat', label: '微信', enabled: true, priority: 4, targetRole: '急诊科值班医师' },
    { type: 'email', label: '邮件', enabled: false, priority: 5, targetRole: '科主任' },
    { type: 'pager', label: '呼叫器', enabled: false, priority: 6, targetRole: '总值班' },
  ],
  autoTrigger: {
    enabled: true,
    keywords: ['主动脉夹层', '急性脑梗死', '张力性气胸', '肝破裂', '肺栓塞'],
  },
}

const iso = (offsetMin: number) => new Date(Date.now() - offsetMin * 60_000).toISOString()

const SEED_RECORDS: EmergencyTriggerRecord[] = [
  {
    id: 'EMR-20260813-001',
    patientId: 'RAD-P003',
    patientName: '李明',
    type: 'critical-finding',
    reason: 'CTA 显示主动脉增宽伴内膜片, 疑似主动脉夹层',
    channels: ['phone', 'in-app', 'sms'],
    triggeredBy: '张明远',
    triggeredAt: iso(45),
    status: 'acknowledged',
    notifications: [
      { channel: 'phone', targetRole: '值班主任医师', deliveredAt: iso(44), simulated: true },
      { channel: 'in-app', targetRole: '终核医师', deliveredAt: iso(44), simulated: true },
      { channel: 'sms', targetRole: '值班医师', deliveredAt: iso(43), simulated: true },
    ],
  },
  {
    id: 'EMR-20260813-002',
    patientId: 'RAD-P001',
    patientName: '张伟',
    type: 'stat-imaging',
    reason: 'DWI 显示左侧大脑中动脉供血区大面积高信号',
    channels: ['phone', 'wechat'],
    triggeredBy: '吴芳',
    triggeredAt: iso(120),
    status: 'sent',
    notifications: [
      { channel: 'phone', targetRole: '急诊影像二线', deliveredAt: iso(119), simulated: true },
      { channel: 'wechat', targetRole: '急诊科值班医师', deliveredAt: iso(118), simulated: true },
    ],
  },
  {
    id: 'EMR-20260813-003',
    patientId: 'RAD-P007',
    patientName: '周婷',
    type: 'er-request',
    reason: '急诊科请求优先出片: 疑似肠梗阻伴穿孔',
    channels: ['in-app'],
    triggeredBy: '系统(自动触发)',
    triggeredAt: iso(300),
    status: 'completed',
    notifications: [
      { channel: 'in-app', targetRole: '终核医师', deliveredAt: iso(299), simulated: true },
    ],
  },
]

@Injectable()
export class EmergencyChannelService {
  private config: EmergencyChannelConfig = this.clone(DEFAULT_CONFIG)
  private records: EmergencyTriggerRecord[] = SEED_RECORDS.map((r) => ({ ...r, notifications: [...r.notifications] }))

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T
  }

  getConfig(): EmergencyChannelConfig {
    return this.clone(this.config)
  }

  updateConfig(dto: EmergencyChannelConfigUpdate): EmergencyChannelConfig {
    if (dto.channels !== undefined) {
      if (!Array.isArray(dto.channels) || dto.channels.length === 0) {
        throw new BadRequestException('channels 不能为空数组')
      }
      const seen = new Set<string>()
      const channels: EmergencyChannelConfigItem[] = dto.channels.map((c) => {
        const rawType = String((c as { type?: unknown })?.type ?? '')
        if (!CHANNEL_LABELS[rawType as EmergencyChannelType]) {
          throw new BadRequestException(`非法通道类型: ${rawType}`)
        }
        const type = rawType as EmergencyChannelType
        if (seen.has(type)) throw new BadRequestException(`通道 ${type} 重复`)
        seen.add(type)
        return {
          type,
          label: CHANNEL_LABELS[type],
          enabled: Boolean(c.enabled),
          priority: Number(c.priority) || 1,
          targetRole: String(c.targetRole || '值班医师'),
        }
      })
      this.config.channels = channels
    }
    if (dto.autoTrigger !== undefined) {
      const at = dto.autoTrigger
      if (typeof at !== 'object' || at === null) throw new BadRequestException('autoTrigger 格式错误')
      this.config.autoTrigger = {
        enabled: Boolean(at.enabled),
        keywords: Array.isArray(at.keywords) ? at.keywords.map((k) => String(k)).slice(0, 50) : [],
      }
    }
    this.config.updatedAt = new Date().toISOString()
    return this.getConfig()
  }

  listRecords(query: EmergencyTriggerQuery = {}): EmergencyTriggerRecord[] {
    let items = this.records
    if (query.patientId) items = items.filter((r) => r.patientId === query.patientId)
    if (query.status) items = items.filter((r) => r.status === query.status)
    return this.clone([...items].sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt)))
  }

  trigger(dto: EmergencyTriggerDto): EmergencyTriggerRecord {
    if (!dto.patientId || !String(dto.patientId).trim()) {
      throw new BadRequestException('patientId 必填')
    }
    if (!dto.reason || String(dto.reason).trim().length < 5) {
      throw new BadRequestException('reason 至少 5 个字符')
    }
    const type = String(dto.type || 'manual')
    const enabled = this.config.channels
      .filter((c) => c.enabled)
      .sort((a, b) => a.priority - b.priority)
    const channels = enabled.map((c) => c.type)
    if (channels.length === 0) throw new BadRequestException('所有通知通道均已停用, 无法触发')

    const autoTriggered =
      this.config.autoTrigger.enabled &&
      this.config.autoTrigger.keywords.some((k) => dto.reason.includes(k))

    const record: EmergencyTriggerRecord = {
      id: `EMR-${Date.now()}`,
      patientId: dto.patientId,
      patientName: dto.patientName,
      type: autoTriggered ? type : type,
      reason: dto.reason,
      channels,
      triggeredBy: dto.triggeredBy || (autoTriggered ? '系统(自动触发)' : '当前用户'),
      triggeredAt: new Date().toISOString(),
      status: 'sent',
      notifications: enabled.map((c) => ({
        channel: c.type,
        targetRole: autoTriggered ? TARGET_ROLES[type] ?? c.targetRole : c.targetRole,
        deliveredAt: new Date().toISOString(),
        simulated: true,
      })),
    }
    this.records.unshift(record)
    return this.clone(record)
  }

  acknowledge(id: string): EmergencyTriggerRecord {
    const hit = this.records.find((r) => r.id === id)
    if (!hit) throw new NotFoundException(`Emergency trigger record ${id} not found`)
    hit.status = 'acknowledged'
    return this.clone(hit)
  }
}
