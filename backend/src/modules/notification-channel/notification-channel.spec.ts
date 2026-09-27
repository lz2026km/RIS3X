/**
 * [G005 W12-PatientService] 通知渠道 模板/发送/重试 规格
 */
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { NotificationChannelService } from './notification-channel.service'

describe('[W12] 通知渠道 (短信/微信模板/语音)', () => {
  let svc: NotificationChannelService
  beforeEach(() => {
    svc = new NotificationChannelService()
  })

  it('种子模板: 预约提醒/报告出具/危急值/满意度', () => {
    const { items } = svc.listTemplates()
    const codes = items.map((t) => t.code)
    expect(codes).toEqual(expect.arrayContaining(['APPOINTMENT_REMINDER', 'REPORT_READY', 'CRITICAL_ALERT', 'SATISFACTION_SURVEY']))
  })

  it('模板 CRUD: 新建/更新/停用 + 重名校验', () => {
    const tpl = svc.createTemplate({ code: 'TEST_TPL', name: '测试', channel: 'SMS', content: '你好 {{name}}' })
    expect(tpl.variables).toEqual(['name'])
    expect(() => svc.createTemplate({ code: 'TEST_TPL', name: 'x', channel: 'SMS', content: 'x' })).toThrow(BadRequestException)
    const updated = svc.updateTemplate(tpl.id, { content: '您好 {{name}} {{time}}' })
    expect(updated.variables).toEqual(['name', 'time'])
    expect(svc.deleteTemplate(tpl.id).deleted).toBe(true)
    expect(svc.getTemplate(tpl.id).status).toBe('inactive')
  })

  it('send: 合法手机号渲染变量并 SENT', () => {
    const log = svc.send({
      templateCode: 'APPOINTMENT_REMINDER',
      recipient: '13800001001',
      variables: { patientName: '张伟', modality: 'CT', scheduledAt: '2026-09-01 09:00', deviceName: 'CT-01' },
    })
    expect(log.status).toBe('SENT')
    expect(log.content).toContain('张伟')
    expect(log.content).not.toContain('{{')
    expect(log.attempts).toBe(1)
  })

  it('send: 非法手机号 / 非法 openid FAILED', () => {
    const badPhone = svc.send({ templateCode: 'APPOINTMENT_REMINDER', recipient: '123', variables: {} })
    expect(badPhone.status).toBe('FAILED')
    expect(badPhone.lastError).toBe('INVALID_PHONE')
    const badOpenid = svc.send({ templateCode: 'REPORT_READY', recipient: 'not-openid', variables: {} })
    expect(badOpenid.lastError).toBe('INVALID_OPENID')
  })

  it('send: 未知模板 / 停用模板 抛异常', () => {
    expect(() => svc.send({ templateCode: 'NOPE', recipient: '13800001001' })).toThrow(NotFoundException)
    const tpl = svc.createTemplate({ code: 'OFF', name: 'x', channel: 'SMS', content: 'x', status: 'inactive' })
    expect(() => svc.send({ templateId: tpl.id, recipient: '13800001001' })).toThrow(BadRequestException)
  })

  it('logs/retry: 失败可重试成功, 已成功不可重试', () => {
    const failed = svc.send({ templateCode: 'APPOINTMENT_REMINDER', recipient: 'bad' })
    const retried = svc.retry(failed.id)
    expect(retried.attempts).toBe(2)
    expect(retried.status).toBe('FAILED')
    const ok = svc.send({ templateCode: 'APPOINTMENT_REMINDER', recipient: '13800001002', variables: {} })
    expect(() => svc.retry(ok.id)).toThrow(BadRequestException)
    expect(() => svc.retry('NLOG-NONE')).toThrow(NotFoundException)
  })

  it('notify/appointment-reminder (W5) 生成 SENT 日志', () => {
    const log = svc.notifyAppointmentReminder({
      patientId: 'P100001', patientName: '张伟', modality: 'CT', scheduledAt: '2026-09-01 09:00', recipient: '13800001001',
    })
    expect(log.templateCode).toBe('APPOINTMENT_REMINDER')
    expect(log.status).toBe('SENT')
  })

  it('notify/critical-alert 双通道 (语音+短信)', () => {
    const res = svc.notifyCriticalAlert({ patientId: 'P100004', patientName: '陈杰', modality: 'CT', criticalValue: '主动脉夹层', recipient: '13800001004' })
    expect(res.voice.channel).toBe('VOICE')
    expect(res.sms.channel).toBe('SMS')
    expect(res.voice.status).toBe('SENT')
    expect(res.sms.status).toBe('SENT')
  })

  it('stats: 汇总状态/渠道/成功率', () => {
    svc.send({ templateCode: 'APPOINTMENT_REMINDER', recipient: '13800001001' })
    svc.send({ templateCode: 'APPOINTMENT_REMINDER', recipient: 'bad' })
    const stats = svc.stats()
    expect(stats.total).toBe(2)
    expect(stats.byStatus['SENT']).toBe(1)
    expect(stats.templateCount).toBeGreaterThanOrEqual(4)
    expect(stats.successRate).toBe(50)
  })
})
