/**
 * [G005 v3.0.6.13] 接口监控 + 持久化重试队列 spec
 * 覆盖: 消息日志统计 / 入队 / 指数退避重试 / 死信 / requeue
 */
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { InterfaceMonitorService } from './interface-monitor.service'

const farFuture = (): string => new Date(Date.now() + 10 * 60_000).toISOString()

describe('InterfaceMonitorService 消息日志 + 统计', () => {
  let svc: InterfaceMonitorService

  beforeEach(() => {
    svc = new InterfaceMonitorService()
  })

  it('seed 覆盖 HL7/FHIR/DICOM/ORU/XDS 各接口', () => {
    const stats = svc.getStats()
    expect(stats.totalMessages).toBeGreaterThanOrEqual(10)
    const types = stats.byInterface.map((b) => b.interfaceType)
    expect(types).toEqual(['HL7', 'FHIR', 'DICOM', 'ORU', 'XDS'])
    expect(stats.byInterface.every((b) => b.total > 0)).toBe(true)
  })

  it('getMessages 按接口/状态过滤', () => {
    const hl7 = svc.getMessages({ interfaceType: 'HL7' })
    expect(hl7.entries.every((m) => m.interfaceType === 'HL7')).toBe(true)
    const failed = svc.getMessages({ status: 'fail' })
    expect(failed.entries.every((m) => m.status === 'fail')).toBe(true)
  })

  it('recordMessage 记录新消息', () => {
    const before = svc.getStats().totalMessages
    svc.recordMessage({ interfaceType: 'HL7', direction: 'OUTBOUND', messageType: 'ORU^R01', status: 'success', retryCount: 0, summary: 'test' })
    expect(svc.getStats().totalMessages).toBe(before + 1)
  })
})

describe('InterfaceMonitorService 持久化重试队列', () => {
  let svc: InterfaceMonitorService

  beforeEach(() => {
    svc = new InterfaceMonitorService()
    svc.resetForTest()
  })

  it('enqueue 入队 pending', async () => {
    const entry = await svc.enqueue({ interfaceType: 'HL7', endpoint: 'mllp://his:2576', payload: { failTimes: 0 } })
    expect(entry.status).toBe('pending')
    expect(entry.attempts).toBe(0)
    expect(svc.listQueue({ status: 'pending' }).entries.some((e) => e.id === entry.id)).toBe(true)
  })

  it('enqueue 缺少 endpoint → BadRequest', async () => {
    await expect(svc.enqueue({ interfaceType: 'HL7', endpoint: '' })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('processDue: failTimes=1 → 首次 retrying, 二次 success (指数退避)', async () => {
    const entry = await svc.enqueue({ interfaceType: 'FHIR', endpoint: 'fhir://his', payload: { failTimes: 1 }, maxAttempts: 3 })
    const first = await svc.processDue()
    const afterFirst = svc.getEntry(entry.id)
    expect(first.processed).toBeGreaterThanOrEqual(1)
    expect(afterFirst.status).toBe('retrying')
    expect(afterFirst.attempts).toBe(1)
    expect(afterFirst.nextAttemptAt > new Date().toISOString()).toBe(true)

    const second = await svc.processDue(farFuture())
    const afterSecond = svc.getEntry(entry.id)
    expect(afterSecond.status).toBe('success')
    expect(second.succeeded).toBeGreaterThanOrEqual(1)
  })

  it('processDue: 超过 maxAttempts → dead_letter', async () => {
    const entry = await svc.enqueue({ interfaceType: 'DICOM', endpoint: 'dicom://pacs', payload: { failTimes: 99 }, maxAttempts: 2 })
    await svc.processDue()
    await svc.processDue(farFuture())
    expect(svc.getEntry(entry.id).status).toBe('dead_letter')
    expect(svc.listDeadLetters().some((e) => e.id === entry.id)).toBe(true)
  })

  it('retry 重置 pending; 已成功不可重试', async () => {
    const entry = await svc.enqueue({ interfaceType: 'HL7', endpoint: 'mllp://his', payload: { failTimes: 0 }, maxAttempts: 2 })
    await svc.processDue()
    await svc.processDue(farFuture())
    expect(svc.getEntry(entry.id).status).toBe('success')
    await expect(svc.retry(entry.id)).rejects.toBeInstanceOf(BadRequestException)
  })

  it('deadLetter + requeue 流程', async () => {
    const entry = await svc.enqueue({ interfaceType: 'XDS', endpoint: 'xds://repo', payload: { failTimes: 0 } })
    await svc.deadLetter(entry.id)
    expect(svc.getEntry(entry.id).status).toBe('dead_letter')
    await expect(svc.retry(entry.id)).rejects.toBeInstanceOf(BadRequestException)
    const requeued = await svc.requeue(entry.id)
    expect(requeued.status).toBe('pending')
    expect(requeued.attempts).toBe(0)
  })

  it('getEntry 不存在 → NotFound', () => {
    expect(() => svc.getEntry('RQ-XXXXX')).toThrow(NotFoundException)
  })

  it('stats.queue 汇总各状态数量', async () => {
    const stats = svc.getStats()
    expect(stats.queue.total).toBe(4)
    expect(stats.queue.pending).toBe(1)
    expect(stats.queue.retrying).toBe(1)
    expect(stats.queue.success).toBe(1)
    expect(stats.queue.deadLetter).toBe(1)
  })
})
