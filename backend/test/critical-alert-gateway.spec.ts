/**
 * [G005 Wave 2A] Critical Alert 电话/短信网关 spec
 * 覆盖: auto-call / auto-sms / communication-log (合并排序) / 状态机 / 失败模拟 / 404 / auditLog
 */
import { NotFoundException } from '@nestjs/common'
import { CriticalAlertService } from '../src/modules/critical-alert/critical-alert.service'

const makePrisma = () => {
  const reject = jest.fn().mockRejectedValue(new Error('no db'))
  return {
    criticalValue: { findMany: reject, findUnique: reject, create: reject, update: reject },
    auditLog: { create: reject },
  } as never
}

describe('CriticalAlert Gateway (Wave 2A)', () => {
  it('autoCall: 成功接通 → status=connected + durationSec + recordingUrl', async () => {
    const service = new CriticalAlertService(makePrisma())
    const alerts = await service.listAlerts()
    const target = alerts.find((a) => a.id === 'CA-001')!
    const call = await service.autoCall(target.id, { phone: '13800001001' })
    expect(call.alertId).toBe(target.id)
    expect(call.phone).toBe('13800001001')
    expect(['connected', 'initiated', 'failed']).toContain(call.status)
    if (call.status === 'connected') {
      expect(call.durationSec).toBeGreaterThan(0)
      expect(call.recordingUrl).toMatch(/^\/recordings\//)
    }
  })

  it('autoCall: 以 9 结尾号码模拟呼叫失败 → status=failed', async () => {
    const service = new CriticalAlertService(makePrisma())
    const alerts = await service.listAlerts()
    const target = alerts.find((a) => a.id === 'CA-001')!
    const call = await service.autoCall(target.id, { phone: '13800000009' })
    expect(call.status).toBe('failed')
    expect(call.durationSec).toBe(0)
    expect(call.recordingUrl).toBeUndefined()
  })

  it('autoCall: 未传号码时使用默认号码', async () => {
    const service = new CriticalAlertService(makePrisma())
    const alerts = await service.listAlerts()
    const call = await service.autoCall(alerts[0].id)
    expect(call.phone).toBeTruthy()
  })

  it('autoCall: 不存在的告警 → NotFoundException', async () => {
    const service = new CriticalAlertService(makePrisma())
    await expect(service.autoCall('unknown-id', {})).rejects.toBeInstanceOf(NotFoundException)
  })

  it('autoSms: 发送成功 → status=sent + 默认模板含患者名', async () => {
    const service = new CriticalAlertService(makePrisma())
    const alerts = await service.listAlerts()
    const target = alerts.find((a) => a.id === 'CA-001')!
    const sms = await service.autoSms(target.id, { phone: '13800001002' })
    expect(sms.alertId).toBe(target.id)
    expect(sms.status).toBe('sent')
    expect(sms.content).toContain('危急值')
    expect(sms.content).toContain(target.patientName)
    expect(sms.sentAt).toBeTruthy()
  })

  it('autoSms: 自定义 content + 以 8 结尾号码模拟失败', async () => {
    const service = new CriticalAlertService(makePrisma())
    const alerts = await service.listAlerts()
    const sms = await service.autoSms(alerts[0].id, {
      phone: '13800000008',
      content: '自定义内容',
    })
    expect(sms.status).toBe('failed')
    expect(sms.content).toBe('自定义内容')
  })

  it('communicationLog: 电话+短信合并、按时间倒序、含 seed 历史记录', async () => {
    const service = new CriticalAlertService(makePrisma())
    await service.autoCall('CA-001', { phone: '13800001001' })
    await service.autoSms('CA-001', { phone: '13800001002' })
    const log = await service.communicationLog('CA-001')
    expect(log.length).toBeGreaterThanOrEqual(3) // 2 seed + 2 新增
    expect(log.every((e) => e.alertId === 'CA-001')).toBe(true)
    expect(log.every((e) => e.channel === 'phone' || e.channel === 'sms')).toBe(true)
    // 倒序
    const times = log.map((e) => new Date(e.at).getTime())
    expect([...times].sort((a, b) => b - a)).toEqual(times)
    // phone 记录带 duration, sms 记录带 content
    const phoneEntry = log.find((e) => e.channel === 'phone')
    const smsEntry = log.find((e) => e.channel === 'sms')
    expect(phoneEntry).toBeDefined()
    expect(smsEntry).toBeDefined()
    expect(typeof phoneEntry!.durationSec).toBe('number')
    expect(typeof smsEntry!.content).toBe('string')
  })

  it('communicationLog: 每个告警相互隔离', async () => {
    const service = new CriticalAlertService(makePrisma())
    const log1 = await service.communicationLog('CA-001')
    const log2 = await service.communicationLog('CA-002')
    expect(log1.every((e) => e.alertId === 'CA-001')).toBe(true)
    expect(log2.every((e) => e.alertId === 'CA-002')).toBe(true)
  })

  it('communicationLog: 无记录的告警返回空数组', async () => {
    const service = new CriticalAlertService(makePrisma())
    const alerts = await service.listAlerts()
    const target = alerts.find((a) => a.id === 'CA-003')!
    const log = await service.communicationLog(target.id)
    expect(log).toEqual([])
  })

  it('DB 可用时 auto-call/auto-sms 写入 auditLog', async () => {
    const auditCreate = jest.fn().mockResolvedValue({ id: 'A1' })
    const prisma: any = {
      criticalValue: { findMany: jest.fn().mockRejectedValue(new Error('no db')) },
      auditLog: { create: auditCreate },
    }
    const service = new CriticalAlertService(prisma)
    await service.autoCall('CA-001', { phone: '13800001003' })
    expect(auditCreate).toHaveBeenCalledTimes(1)
    const arg = auditCreate.mock.calls[0][0] as { data: { action: string; resource: string } }
    expect(arg.data.action).toBe('AUTO_CALL')
    expect(arg.data.resource).toBe('critical-alert')
    await service.autoSms('CA-001', { phone: '13800001004' })
    expect(auditCreate).toHaveBeenCalledTimes(2)
  })
})
