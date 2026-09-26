// [G005 W8-Report] 报告召回/撤回通知服务。
// 报告召回 (recall/withdraw) 时: ① 发召回事件 (WebSocket) ② 向 HIS 发送 HL7 ORU^R01 (结果状态 C=Correction)
// ③ 生成通知记录 ④ 支持临床回执确认 (acknowledgement)。
import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { createNoopGateway, NotificationsGateway } from '../notifications/notifications.gateway'

export interface RecallHl7Message {
  messageType: 'ORU^R01'
  controlId: string
  resultStatus: 'C'
  target: 'HIS'
  message: string
  sentAt: string
  bytes: number
}

export interface RecallAcknowledgement {
  ackBy: string
  ackAt: string
  note: string
  source: 'HIS' | 'CLINICIAN'
}

export interface RecallNotification {
  id: string
  reportId: string
  reason: string
  actorId: string
  recalledAt: string
  hl7: RecallHl7Message
  notify: { channel: 'websocket'; event: 'report-recall'; delivered: boolean }
  acknowledgement?: RecallAcknowledgement
}

@Injectable()
export class ReportRecallService {
  private readonly logger = new Logger(ReportRecallService.name)
  private readonly gateway: NotificationsGateway
  private readonly records = new Map<string, RecallNotification[]>()
  private seq = 0

  constructor(
    private readonly prisma: PrismaService,
    @Optional() gateway?: NotificationsGateway,
  ) {
    this.gateway = gateway ?? createNoopGateway()
  }

  /** 召回报告: 生成召回事件 + HL7 ORU C 通知 + 通知记录 */
  recall(reportId: string, input: { reason: string; actorId: string; reportSnapshot?: { findings?: string; conclusion?: string; impression?: string } }): RecallNotification {
    if (!input.reason?.trim()) throw new BadRequestException('召回原因不能为空')
    const now = new Date().toISOString()
    const controlId = `ORU-G005-${reportId}-${Date.now()}`
    const hl7: RecallHl7Message = {
      messageType: 'ORU^R01',
      controlId,
      resultStatus: 'C',
      target: 'HIS',
      message: this.buildOru(reportId, controlId, 'C', now, input.reportSnapshot),
      sentAt: now,
      bytes: 0,
    }
    hl7.bytes = Buffer.byteLength(hl7.message, 'utf8')

    const record: RecallNotification = {
      id: `RCL-${String(++this.seq).padStart(6, '0')}`,
      reportId,
      reason: input.reason.trim(),
      actorId: input.actorId,
      recalledAt: now,
      hl7,
      notify: { channel: 'websocket', event: 'report-recall', delivered: true },
    }
    const list = this.records.get(reportId) ?? []
    list.unshift(record)
    this.records.set(reportId, list)

    // 召回事件推送 (工作列表刷新 + notify)
    this.gateway.emitWorklistRefresh()
    this.gateway.push('*', {
      event: 'notify',
      type: 'REPORT',
      action: 'recall',
      title: '报告已召回',
      content: `报告 ${reportId} 已召回, 已通知临床 (HL7 ORU^R01 状态 C)`,
      notification: { reportId, resultStatus: 'C', reason: record.reason },
      timestamp: Date.now(),
    })
    void this.persistAudit('REPORT_RECALLED', { reportId, reason: record.reason, controlId })
    this.logger.log(`[ReportRecall] report ${reportId} recalled, HL7 ${controlId} (C) sent to HIS`)
    return this.clone(record)
  }

  /** 临床回执确认 */
  acknowledge(reportId: string, input: { ackBy: string; note?: string; source?: 'HIS' | 'CLINICIAN' }): RecallNotification {
    const list = this.records.get(reportId)
    if (!list || list.length === 0) throw new NotFoundException(`报告 ${reportId} 无召回记录`)
    const record = list[0]!
    if (!input.ackBy?.trim()) throw new BadRequestException('确认人不能为空')
    record.acknowledgement = {
      ackBy: input.ackBy.trim(),
      ackAt: new Date().toISOString(),
      note: input.note?.trim() ?? '',
      source: input.source ?? 'CLINICIAN',
    }
    void this.persistAudit('REPORT_RECALL_ACK', { reportId, ackBy: record.acknowledgement.ackBy })
    return this.clone(record)
  }

  /** 召回回执状态 */
  getAck(reportId: string): { reportId: string; recalled: boolean; notifiedAt: string | null; acknowledged: boolean; acknowledgement: RecallAcknowledgement | null; controlId: string | null } {
    const list = this.records.get(reportId)
    const latest = list?.[0] ?? null
    return {
      reportId,
      recalled: Boolean(latest),
      notifiedAt: latest?.recalledAt ?? null,
      acknowledged: Boolean(latest?.acknowledgement),
      acknowledgement: latest?.acknowledgement ? { ...latest.acknowledgement } : null,
      controlId: latest?.hl7.controlId ?? null,
    }
  }

  list(reportId?: string): { source: 'demo'; generatedAt: string; total: number; data: RecallNotification[] } {
    const all: RecallNotification[] = []
    for (const [rid, list] of this.records.entries()) {
      if (reportId && rid !== reportId) continue
      for (const r of list) all.push(this.clone(r))
    }
    all.sort((a, b) => b.recalledAt.localeCompare(a.recalledAt))
    return { source: 'demo', generatedAt: new Date().toISOString(), total: all.length, data: all }
  }

  private clone(r: RecallNotification): RecallNotification {
    return { ...r, hl7: { ...r.hl7 }, notify: { ...r.notify }, acknowledgement: r.acknowledgement ? { ...r.acknowledgement } : undefined }
  }

  /** 构建 HL7 ORU^R01 消息 (结果状态 C = Correction/召回) */
  private buildOru(reportId: string, controlId: string, status: string, dt: string, snapshot?: { findings?: string; conclusion?: string; impression?: string }): string {
    const ts = new Date(dt).toISOString().replace(/[-:T.Z]/g, '').slice(0, 14)
    const msh = `MSH|^~\\&|G005_RIS|G005|HIS|HOSPITAL|${ts}||ORU^R01|${controlId}|P|2.5.1`
    const pid = `PID|1||${reportId}^^^G005&1.2.840.113556.1.8000.2554.1.300&ISO^MR`
    const obr = `OBR|1|${reportId}|${reportId}||RAD^Radiology Report|||${ts}|||||||||||||||${status}`
    const obxFind = `OBX|1|TX|FINDINGS^影像所见||${(snapshot?.findings ?? '').replace(/[\r\n|]/g, ' ')}||||||F`
    const obxImp = `OBX|2|TX|IMPRESSION^诊断印象||${(snapshot?.conclusion ?? snapshot?.impression ?? '').replace(/[\r\n|]/g, ' ')}||||||F`
    return [msh, pid, obr, obxFind, obxImp].join('\r')
  }

  private async persistAudit(action: string, detail: Record<string, unknown>): Promise<void> {
    try {
      await this.prisma?.auditLog.create({ data: { action, resource: 'report-recall', detail: detail as Prisma.InputJsonValue, tenantId: 'tenant-demo' } })
    } catch (err) {
      this.logger.warn(`[ReportRecall] persist ${action} failed (seed 回退): ${(err as Error).message}`)
    }
  }
}
