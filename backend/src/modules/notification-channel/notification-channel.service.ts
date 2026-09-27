/**
 * [G005 W12-PatientService] 通知渠道服务 (orphan module, DB-less-safe)
 *
 * 统一患者通知通路:
 *   - 短信网关桩 (SMS)
 *   - 微信模板消息 (WECHAT_TEMPLATE)
 *   - 电话语音桩 (VOICE)
 *
 * 覆盖:
 *   - GET    /notification-channel/templates           模板列表
 *   - POST   /notification-channel/templates           新建模板
 *   - GET    /notification-channel/templates/:id       模板详情
 *   - PUT    /notification-channel/templates/:id       更新模板
 *   - DELETE /notification-channel/templates/:id       停用/删除模板
 *   - POST   /notification-channel/send                发送 (渲染变量 + 投递日志)
 *   - GET    /notification-channel/logs                投递日志
 *   - POST   /notification-channel/logs/:id/retry       重试投递
 *   - GET    /notification-channel/stats               统计
 *   - POST   /notification-channel/notify/appointment-reminder  预约提醒 (W5 联动)
 *   - POST   /notification-channel/notify/report-ready          报告出具
 *   - POST   /notification-channel/notify/critical-alert        危急值警报
 *
 * 确定性: 同一输入 → 同一次渲染/判投递结果, 无随机。
 */
import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export type NotificationChannel = 'SMS' | 'WECHAT_TEMPLATE' | 'VOICE'
export type DeliveryStatus = 'PENDING' | 'SENT' | 'FAILED' | 'RETRYING'
export type TemplateStatus = 'active' | 'inactive'

export interface NotificationTemplateDto {
  id: string
  code: string
  name: string
  channel: NotificationChannel
  title: string
  content: string
  variables: string[]
  status: TemplateStatus
  createdAt: string
  updatedAt: string
}

export interface DeliveryLogDto {
  id: string
  templateId: string
  templateCode: string
  templateName: string
  channel: NotificationChannel
  recipient: string
  patientId?: string
  title: string
  content: string
  variables: Record<string, string | number>
  status: DeliveryStatus
  attempts: number
  maxAttempts: number
  lastError?: string
  createdAt: string
  sentAt?: string
}

const SEED_TEMPLATES: Array<Omit<NotificationTemplateDto, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    code: 'APPOINTMENT_REMINDER',
    name: '检查预约提醒',
    channel: 'SMS',
    title: '【G005影像】检查提醒',
    content: '{{patientName}}您好, 您预约的{{modality}}检查将于{{scheduledAt}}在{{deviceName}}进行, 请提前30分钟到达并完成准备。',
    variables: ['patientName', 'modality', 'scheduledAt', 'deviceName'],
    status: 'active',
  },
  {
    code: 'REPORT_READY',
    name: '报告出具通知',
    channel: 'WECHAT_TEMPLATE',
    title: '报告已出具',
    content: '{{patientName}}您好, 您在{{examDate}}进行的{{modality}}{{bodyPart}}检查报告已出具, 可点击查看。',
    variables: ['patientName', 'examDate', 'modality', 'bodyPart'],
    status: 'active',
  },
  {
    code: 'CRITICAL_ALERT',
    name: '危急值电话通知',
    channel: 'VOICE',
    title: '危急值提醒',
    content: '紧急通知: 患者{{patientName}}{{patientId}}的{{modality}}检查发现危急值「{{criticalValue}}」, 请立即处置。',
    variables: ['patientName', 'patientId', 'modality', 'criticalValue'],
    status: 'active',
  },
  {
    code: 'SATISFACTION_SURVEY',
    name: '满意度调查邀请',
    channel: 'SMS',
    title: '【G005影像】满意度调查',
    content: '{{patientName}}您好, 感谢就诊, 诚邀您参与满意度评价: {{surveyUrl}}',
    variables: ['patientName', 'surveyUrl'],
    status: 'active',
  },
]

function hashNum(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function extractVariables(content: string): string[] {
  const out = new Set<string>()
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) out.add(m[1]!)
  return [...out]
}

function renderTemplate(content: string, vars: Record<string, string | number>): string {
  return content.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => String(vars[key] ?? `{{${key}}}`))
}

@Injectable()
export class NotificationChannelService {
  private readonly logger = new Logger(NotificationChannelService.name)
  private readonly templates = new Map<string, NotificationTemplateDto>()
  private readonly codeIndex = new Map<string, string>()
  private readonly logs: DeliveryLogDto[] = []
  private templateSeq = 0
  private logSeq = 0

  constructor(@Optional() private readonly prisma?: PrismaService) {
    if (!prisma) this.logger.log('NotificationChannelService: no Prisma injected (orphan mode, memory overlay + deterministic stub)')
    for (const t of SEED_TEMPLATES) {
      const now = new Date().toISOString()
      const tpl: NotificationTemplateDto = { id: `NT-${String(++this.templateSeq).padStart(4, '0')}`, ...t, createdAt: now, updatedAt: now }
      this.templates.set(tpl.id, tpl)
      this.codeIndex.set(tpl.code, tpl.id)
    }
  }

  private findTemplate(idOrCode: string): NotificationTemplateDto | null {
    return this.templates.get(idOrCode) ?? this.templates.get(this.codeIndex.get(idOrCode) ?? '') ?? null
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 模板 CRUD
  // ──────────────────────────────────────────────────────────────────────────

  listTemplates(filter?: { channel?: NotificationChannel; status?: TemplateStatus }): { items: NotificationTemplateDto[]; total: number } {
    let items = [...this.templates.values()]
    if (filter?.channel) items = items.filter((t) => t.channel === filter.channel)
    if (filter?.status) items = items.filter((t) => t.status === filter.status)
    return { items, total: items.length }
  }

  getTemplate(id: string): NotificationTemplateDto {
    const tpl = this.findTemplate(id)
    if (!tpl) throw new NotFoundException(`通知模板 ${id} 不存在`)
    return tpl
  }

  createTemplate(body: {
    code: string
    name: string
    channel: NotificationChannel
    title?: string
    content: string
    variables?: string[]
    status?: TemplateStatus
  }): NotificationTemplateDto {
    const code = body.code?.trim()
    if (!code) throw new BadRequestException('模板编码 code 不能为空')
    if (this.codeIndex.has(code)) throw new BadRequestException(`模板编码 ${code} 已存在`)
    if (!body.content?.trim()) throw new BadRequestException('模板内容不能为空')
    const now = new Date().toISOString()
    const tpl: NotificationTemplateDto = {
      id: `NT-${String(++this.templateSeq).padStart(4, '0')}`,
      code,
      name: body.name ?? code,
      channel: body.channel ?? 'SMS',
      title: body.title ?? body.name ?? code,
      content: body.content,
      variables: body.variables ?? extractVariables(body.content),
      status: body.status ?? 'active',
      createdAt: now,
      updatedAt: now,
    }
    this.templates.set(tpl.id, tpl)
    this.codeIndex.set(tpl.code, tpl.id)
    return tpl
  }

  updateTemplate(id: string, body: Partial<Omit<NotificationTemplateDto, 'id' | 'createdAt'>>): NotificationTemplateDto {
    const tpl = this.getTemplate(id)
    if (body.code && body.code !== tpl.code) {
      if (this.codeIndex.has(body.code)) throw new BadRequestException(`模板编码 ${body.code} 已存在`)
      this.codeIndex.delete(tpl.code)
      this.codeIndex.set(body.code, tpl.id)
      tpl.code = body.code
    }
    if (body.name !== undefined) tpl.name = body.name
    if (body.channel !== undefined) tpl.channel = body.channel
    if (body.title !== undefined) tpl.title = body.title
    if (body.content !== undefined) {
      tpl.content = body.content
      tpl.variables = body.variables ?? extractVariables(body.content)
    }
    if (body.status !== undefined) tpl.status = body.status
    tpl.updatedAt = new Date().toISOString()
    return tpl
  }

  deleteTemplate(id: string): { deleted: boolean; id: string } {
    const tpl = this.getTemplate(id)
    tpl.status = 'inactive'
    tpl.updatedAt = new Date().toISOString()
    return { deleted: true, id }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 发送
  // ──────────────────────────────────────────────────────────────────────────

  private validateRecipient(channel: NotificationChannel, recipient: string): string | null {
    if (!recipient?.trim()) return 'RECIPIENT_REQUIRED'
    if (channel === 'SMS' || channel === 'VOICE') {
      if (!/^1[3-9]\d{9}$/.test(recipient)) return 'INVALID_PHONE'
    }
    if (channel === 'WECHAT_TEMPLATE') {
      if (!/^(o|u)[0-9a-f]{8,}$/.test(recipient)) return 'INVALID_OPENID'
    }
    return null
  }

  /** POST /notification-channel/send */
  send(body: {
    templateId?: string
    templateCode?: string
    channel?: NotificationChannel
    recipient: string
    variables?: Record<string, string | number>
    patientId?: string
  }): DeliveryLogDto {
    const key = body.templateId ?? body.templateCode
    if (!key) throw new BadRequestException('templateId 或 templateCode 必填')
    const tpl = this.findTemplate(key)
    if (!tpl) throw new NotFoundException(`通知模板 ${key} 不存在`)
    if (tpl.status !== 'active') throw new BadRequestException(`模板 ${tpl.code} 已停用`)
    const channel = body.channel ?? tpl.channel
    const recipient = body.recipient?.trim() ?? ''
    const error = this.validateRecipient(channel, recipient)
    const now = new Date().toISOString()
    const content = renderTemplate(tpl.content, body.variables ?? {})
    const log: DeliveryLogDto = {
      id: `NLOG-${String(++this.logSeq).padStart(6, '0')}`,
      templateId: tpl.id,
      templateCode: tpl.code,
      templateName: tpl.name,
      channel,
      recipient,
      patientId: body.patientId,
      title: tpl.title,
      content,
      variables: body.variables ?? {},
      status: error ? 'FAILED' : 'SENT',
      attempts: 1,
      maxAttempts: 3,
      lastError: error ?? undefined,
      createdAt: now,
      sentAt: error ? undefined : now,
    }
    this.logs.unshift(log)
    return log
  }

  /** GET /notification-channel/logs */
  listLogs(filter?: { status?: DeliveryStatus; channel?: NotificationChannel; patientId?: string; templateCode?: string }): { items: DeliveryLogDto[]; total: number } {
    let items = this.logs
    if (filter?.status) items = items.filter((l) => l.status === filter.status)
    if (filter?.channel) items = items.filter((l) => l.channel === filter.channel)
    if (filter?.patientId) items = items.filter((l) => l.patientId === filter.patientId)
    if (filter?.templateCode) items = items.filter((l) => l.templateCode === filter.templateCode)
    return { items, total: items.length }
  }

  /** POST /notification-channel/logs/:id/retry */
  retry(logId: string): DeliveryLogDto {
    const log = this.logs.find((l) => l.id === logId)
    if (!log) throw new NotFoundException(`投递日志 ${logId} 不存在`)
    if (log.status === 'SENT') throw new BadRequestException('该通知已发送成功, 无需重试')
    if (log.attempts >= log.maxAttempts) throw new BadRequestException('已达到最大重试次数')
    log.attempts += 1
    const error = this.validateRecipient(log.channel, log.recipient)
    if (error) {
      log.status = 'FAILED'
      log.lastError = error
    } else {
      log.status = 'SENT'
      log.sentAt = new Date().toISOString()
      log.lastError = undefined
    }
    return log
  }

  /** GET /notification-channel/stats */
  stats(): {
    total: number
    byStatus: Record<string, number>
    byChannel: Record<string, number>
    templateCount: number
    successRate: number
  } {
    const byStatus: Record<string, number> = {}
    const byChannel: Record<string, number> = {}
    for (const l of this.logs) {
      byStatus[l.status] = (byStatus[l.status] ?? 0) + 1
      byChannel[l.channel] = (byChannel[l.channel] ?? 0) + 1
    }
    const sent = this.logs.filter((l) => l.status === 'SENT').length
    return {
      total: this.logs.length,
      byStatus,
      byChannel,
      templateCount: this.templates.size,
      successRate: this.logs.length > 0 ? Number(((sent / this.logs.length) * 100).toFixed(2)) : 0,
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 业务联动 (预约提醒 W5 / 报告出具 / 危急值)
  // ──────────────────────────────────────────────────────────────────────────

  /** POST /notification-channel/notify/appointment-reminder — 预约提醒 (W5 联动) */
  notifyAppointmentReminder(body: {
    patientId?: string
    patientName: string
    modality: string
    scheduledAt: string
    deviceName?: string
    recipient: string
    channel?: NotificationChannel
  }): DeliveryLogDto {
    return this.send({
      templateCode: 'APPOINTMENT_REMINDER',
      channel: body.channel ?? 'SMS',
      recipient: body.recipient,
      patientId: body.patientId,
      variables: {
        patientName: body.patientName,
        modality: body.modality,
        scheduledAt: body.scheduledAt,
        deviceName: body.deviceName ?? '影像科',
      },
    })
  }

  /** POST /notification-channel/notify/report-ready — 报告出具通知 */
  notifyReportReady(body: {
    patientId?: string
    patientName: string
    examDate: string
    modality: string
    bodyPart?: string
    recipient: string
    channel?: NotificationChannel
  }): DeliveryLogDto {
    return this.send({
      templateCode: 'REPORT_READY',
      channel: body.channel ?? 'WECHAT_TEMPLATE',
      recipient: body.recipient,
      patientId: body.patientId,
      variables: {
        patientName: body.patientName,
        examDate: body.examDate,
        modality: body.modality,
        bodyPart: body.bodyPart ?? '',
      },
    })
  }

  /** POST /notification-channel/notify/critical-alert — 危急值警报 (语音+短信双通道) */
  notifyCriticalAlert(body: {
    patientId: string
    patientName: string
    modality: string
    criticalValue: string
    recipient: string
  }): { voice: DeliveryLogDto; sms: DeliveryLogDto } {
    const voice = this.send({
      templateCode: 'CRITICAL_ALERT',
      channel: 'VOICE',
      recipient: body.recipient,
      patientId: body.patientId,
      variables: { patientName: body.patientName, patientId: body.patientId, modality: body.modality, criticalValue: body.criticalValue },
    })
    const sms = this.send({
      templateCode: 'CRITICAL_ALERT',
      channel: 'SMS',
      recipient: body.recipient,
      patientId: body.patientId,
      variables: { patientName: body.patientName, patientId: body.patientId, modality: body.modality, criticalValue: body.criticalValue },
    })
    return { voice, sms }
  }

  /** 供内部/缩写: 确定性判定码 (供测试与外部引用) */
  recipientFingerprint(recipient: string): string {
    return hashNum(recipient).toString(16)
  }
}
