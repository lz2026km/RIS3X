/**
 * G005 放射RIS系统 v3.0.6.13 - 接口监控 + 持久化重试队列 (DB-less-safe)
 *
 * 能力:
 *   - 消息日志 (HL7 / FHIR / DICOM / ORU / XDS): 成功/失败/重试 计数
 *   - 持久化重试队列: 指数退避, 支持 retry / dead-letter / requeue / process
 *   - 持久化: SystemConfig JSON 键 interface_retry_queue (Prisma 可用时), 否则内存
 */
import { BadRequestException, Injectable, Logger, NotFoundException, Optional, type OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import type { InputJsonValue } from '@prisma/client/runtime/library.js'

export type InterfaceType = 'HL7' | 'FHIR' | 'DICOM' | 'ORU' | 'XDS'
export type QueueStatus = 'pending' | 'retrying' | 'success' | 'dead_letter'
export type MessageStatus = 'success' | 'fail' | 'retry' | 'pending'

export interface InterfaceMessage {
  id: string
  interfaceType: InterfaceType
  direction: 'INBOUND' | 'OUTBOUND'
  messageType: string
  status: MessageStatus
  ackStatus?: string
  retryCount: number
  patientId?: string
  endpoint?: string
  summary: string
  createdAt: string
}

export interface RetryQueueEntry {
  id: string
  interfaceType: InterfaceType
  endpoint: string
  payload: Record<string, unknown>
  status: QueueStatus
  attempts: number
  maxAttempts: number
  nextAttemptAt: string
  lastError?: string
  createdAt: string
  updatedAt: string
}

export interface InterfaceStats {
  totalMessages: number
  success: number
  fail: number
  retry: number
  pending: number
  successRate: number
  byInterface: Array<{ interfaceType: InterfaceType; total: number; success: number; fail: number; retry: number }>
  queue: { total: number; pending: number; retrying: number; success: number; deadLetter: number }
}

export interface EnqueueInput {
  interfaceType: InterfaceType
  endpoint: string
  payload?: Record<string, unknown>
  maxAttempts?: number
}

export interface QueueFilter {
  status?: QueueStatus
  interfaceType?: InterfaceType
  limit?: number
}

export interface MessageFilter {
  interfaceType?: InterfaceType
  status?: MessageStatus
  limit?: number
}

const SYS_KEY_RETRY_QUEUE = 'interface_retry_queue'
const BASE_BACKOFF_MS = 1000
const MAX_BACKOFF_MS = 60_000

const iso = (offsetMin = 0): string => new Date(Date.now() - offsetMin * 60_000).toISOString()

@Injectable()
export class InterfaceMonitorService implements OnModuleInit {
  private readonly logger = new Logger(InterfaceMonitorService.name)
  private messages: InterfaceMessage[] = []
  private queue: RetryQueueEntry[] = []
  private seq = 0
  private loaded = false

  constructor(@Optional() private readonly prisma?: PrismaService) {
    this.messages = this.seedMessages()
    this.queue = this.seedQueue()
  }

  async onModuleInit(): Promise<void> {
    await this.loadQueue()
  }

  // ── 消息日志 ──

  getMessages(filter: MessageFilter = {}): { total: number; entries: InterfaceMessage[] } {
    let items = [...this.messages]
    if (filter.interfaceType) items = items.filter((m) => m.interfaceType === filter.interfaceType)
    if (filter.status) items = items.filter((m) => m.status === filter.status)
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const limit = filter.limit ?? 100
    return { total: items.length, entries: items.slice(0, Math.max(1, Math.min(limit, 500))) }
  }

  recordMessage(msg: Omit<InterfaceMessage, 'id' | 'createdAt'> & { createdAt?: string }): InterfaceMessage {
    const entry: InterfaceMessage = {
      ...msg,
      id: `MSG-${String(++this.seq).padStart(5, '0')}`,
      createdAt: msg.createdAt ?? iso(),
    }
    this.messages.unshift(entry)
    if (this.messages.length > 5000) this.messages.pop()
    return entry
  }

  getStats(): InterfaceStats {
    const success = this.messages.filter((m) => m.status === 'success').length
    const fail = this.messages.filter((m) => m.status === 'fail').length
    const retry = this.messages.filter((m) => m.status === 'retry').length
    const pending = this.messages.filter((m) => m.status === 'pending').length
    const types: InterfaceType[] = ['HL7', 'FHIR', 'DICOM', 'ORU', 'XDS']
    const byInterface = types.map((interfaceType) => {
      const rows = this.messages.filter((m) => m.interfaceType === interfaceType)
      return {
        interfaceType,
        total: rows.length,
        success: rows.filter((m) => m.status === 'success').length,
        fail: rows.filter((m) => m.status === 'fail').length,
        retry: rows.filter((m) => m.status === 'retry').length,
      }
    })
    const count = (s: QueueStatus) => this.queue.filter((q) => q.status === s).length
    return {
      totalMessages: this.messages.length,
      success,
      fail,
      retry,
      pending,
      successRate: this.messages.length > 0 ? Math.round((success / this.messages.length) * 100) : 0,
      byInterface,
      queue: {
        total: this.queue.length,
        pending: count('pending'),
        retrying: count('retrying'),
        success: count('success'),
        deadLetter: count('dead_letter'),
      },
    }
  }

  // ── 持久化重试队列 ──

  private backoff(attempts: number): number {
    return Math.min(BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1), MAX_BACKOFF_MS)
  }

  private schedule(entry: RetryQueueEntry): void {
    entry.nextAttemptAt = new Date(Date.now() + this.backoff(entry.attempts)).toISOString()
  }

  private async persist(): Promise<void> {
    try {
      const model = (this.prisma as any)?.systemConfig
      if (!model?.upsert) return
      await model.upsert({
        where: { key: SYS_KEY_RETRY_QUEUE },
        create: { key: SYS_KEY_RETRY_QUEUE, value: this.queue as unknown as InputJsonValue },
        update: { value: this.queue as unknown as InputJsonValue },
      })
    } catch (err) {
      this.logger.warn(`[InterfaceMonitor] persist retry queue failed: ${(err as Error).message}`)
    }
  }

  private async loadQueue(): Promise<void> {
    this.loaded = true
    try {
      const model = (this.prisma as any)?.systemConfig
      if (!model?.findUnique) return
      const cfg = await model.findUnique({ where: { key: SYS_KEY_RETRY_QUEUE } })
      if (Array.isArray(cfg?.value)) this.queue = cfg.value as RetryQueueEntry[]
    } catch (err) {
      this.logger.warn(`[InterfaceMonitor] load retry queue failed: ${(err as Error).message}`)
    }
  }

  async enqueue(input: EnqueueInput): Promise<RetryQueueEntry> {
    if (!input?.endpoint) throw new BadRequestException('endpoint is required')
    const now = iso()
    const entry: RetryQueueEntry = {
      id: `RQ-G${String(++this.seq).padStart(4, '0')}`,
      interfaceType: input.interfaceType ?? 'HL7',
      endpoint: input.endpoint,
      payload: input.payload ?? {},
      status: 'pending',
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 3,
      nextAttemptAt: now,
      createdAt: now,
      updatedAt: now,
    }
    this.queue.push(entry)
    await this.persist()
    return entry
  }

  listQueue(filter: QueueFilter = {}): { total: number; entries: RetryQueueEntry[] } {
    let items = [...this.queue]
    if (filter.status) items = items.filter((q) => q.status === filter.status)
    if (filter.interfaceType) items = items.filter((q) => q.interfaceType === filter.interfaceType)
    items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    const limit = filter.limit ?? 100
    return { total: items.length, entries: items.slice(0, Math.max(1, Math.min(limit, 500))) }
  }

  getEntry(id: string): RetryQueueEntry {
    const entry = this.queue.find((q) => q.id === id)
    if (!entry) throw new NotFoundException(`Retry queue entry ${id} not found`)
    return entry
  }

  listDeadLetters(): RetryQueueEntry[] {
    return this.queue.filter((q) => q.status === 'dead_letter')
  }

  /** 单次投递尝试: payload.failTimes 次失败后成功 (确定性可测) */
  private attempt(entry: RetryQueueEntry): void {
    const failTimes = Number((entry.payload as any)?.failTimes ?? 0)
    entry.attempts += 1
    entry.updatedAt = iso()
    if (entry.attempts > failTimes) {
      entry.status = 'success'
      entry.lastError = undefined
      entry.nextAttemptAt = entry.updatedAt
      return
    }
    if (entry.attempts >= entry.maxAttempts) {
      entry.status = 'dead_letter'
      entry.lastError = (entry.payload as any)?.error ?? `exceeded maxAttempts=${entry.maxAttempts}`
      entry.nextAttemptAt = entry.updatedAt
      return
    }
    entry.status = 'retrying'
    entry.lastError = (entry.payload as any)?.error ?? `attempt ${entry.attempts}/${entry.maxAttempts} failed`
    this.schedule(entry)
  }

  /** 手动重试: 重置为 pending/retrying 并重新调度 */
  async retry(id: string): Promise<RetryQueueEntry> {
    const entry = this.getEntry(id)
    if (entry.status === 'success') throw new BadRequestException(`队列 ${id} 已成功, 无需重试`)
    if (entry.status === 'dead_letter') {
      throw new BadRequestException(`队列 ${id} 已进入死信, 请先 requeue`)
    }
    entry.status = 'pending'
    entry.nextAttemptAt = iso()
    entry.lastError = undefined
    entry.updatedAt = iso()
    await this.persist()
    return entry
  }

  async deadLetter(id: string): Promise<RetryQueueEntry> {
    const entry = this.getEntry(id)
    entry.status = 'dead_letter'
    entry.updatedAt = iso()
    await this.persist()
    return entry
  }

  async requeue(id: string): Promise<RetryQueueEntry> {
    const entry = this.getEntry(id)
    entry.status = 'pending'
    entry.attempts = 0
    entry.lastError = undefined
    entry.nextAttemptAt = iso()
    entry.updatedAt = iso()
    await this.persist()
    return entry
  }

  /** 处理到期的队列条目 (nextAttemptAt <= now); nowIso 可注入以便确定性测试 */
  async processDue(nowIso?: string): Promise<{ processed: number; succeeded: number; retried: number; deadLettered: number; entries: RetryQueueEntry[] }> {
    const now = nowIso ?? iso()
    const due = this.queue.filter((q) => (q.status === 'pending' || q.status === 'retrying') && q.nextAttemptAt <= now)
    let succeeded = 0
    let retried = 0
    let deadLettered = 0
    for (const entry of due) {
      this.attempt(entry)
      if (entry.status === 'success') succeeded += 1
      else if (entry.status === 'dead_letter') deadLettered += 1
      else retried += 1
      this.recordMessage({
        interfaceType: entry.interfaceType,
        direction: 'OUTBOUND',
        messageType: `RETRY:${entry.interfaceType}`,
        status: entry.status === 'success' ? 'success' : entry.status === 'dead_letter' ? 'fail' : 'retry',
        retryCount: entry.attempts,
        endpoint: entry.endpoint,
        summary: `重试队列 ${entry.id} → ${entry.status}`,
      })
    }
    if (due.length > 0) await this.persist()
    return { processed: due.length, succeeded, retried, deadLettered, entries: due }
  }

  // ── seed ──

  private seedMessages(): InterfaceMessage[] {
    const defs: Array<[InterfaceType, MessageStatus, string, string]> = [
      ['HL7', 'success', 'ORU^R01', '报告结果发送 HIS'],
      ['HL7', 'success', 'ADT^A01', '患者入院更新'],
      ['HL7', 'fail', 'ORM^O01', '检查申请接收失败'],
      ['HL7', 'retry', 'SIU^S12', '预约排程重试'],
      ['FHIR', 'success', 'Patient', '患者资源同步'],
      ['FHIR', 'success', 'ImagingStudy', '影像研究发布'],
      ['FHIR', 'fail', 'DiagnosticReport', '诊断报告发布失败'],
      ['DICOM', 'success', 'C-STORE', '影像存储 PACS'],
      ['DICOM', 'retry', 'C-MOVE', '跨院调阅重试'],
      ['DICOM', 'fail', 'C-FIND', 'MWL 查询超时'],
      ['ORU', 'success', 'ORU^R01', '报告发布 ORU 投递 STUB'],
      ['XDS', 'success', 'ITI-41', '文档注册上架'],
      ['XDS', 'retry', 'ITI-43', '文档检索重试'],
    ]
    return defs.map(([interfaceType, status, messageType, summary], i) => ({
      id: `MSG-${String(i + 1).padStart(5, '0')}`,
      interfaceType,
      direction: interfaceType === 'DICOM' || interfaceType === 'XDS' ? 'INBOUND' : 'OUTBOUND',
      messageType,
      status,
      ackStatus: status === 'success' ? 'AA' : status === 'fail' ? 'AE' : undefined,
      retryCount: status === 'retry' ? 2 : 0,
      endpoint: `${interfaceType.toLowerCase()}://his.local/${i + 1}`,
      summary,
      createdAt: iso(5 + i * 7),
    }))
  }

  private seedQueue(): RetryQueueEntry[] {
    const defs: Array<[InterfaceType, QueueStatus, number, number]> = [
      ['HL7', 'pending', 0, 3],
      ['FHIR', 'retrying', 1, 3],
      ['DICOM', 'dead_letter', 3, 3],
      ['XDS', 'success', 1, 3],
    ]
    return defs.map(([interfaceType, status, attempts, maxAttempts], i) => ({
      id: `RQ-${String(i + 1).padStart(5, '0')}`,
      interfaceType,
      endpoint: `${interfaceType.toLowerCase()}://his.local/retry/${i + 1}`,
      payload: { failTimes: status === 'dead_letter' ? 99 : 0 },
      status,
      attempts,
      maxAttempts,
      nextAttemptAt: iso(-10),
      lastError: status === 'dead_letter' ? 'exceeded maxAttempts=3' : undefined,
      createdAt: iso(30 + i * 5),
      updatedAt: iso(10 + i * 3),
    }))
  }

  /** 测试辅助: 清空 + 重新 seed */
  resetForTest(): void {
    this.messages = this.seedMessages()
    this.queue = this.seedQueue()
    this.seq = 0
  }
}
