/**
 * [G005 W12-PatientService] 微信 OAuth / 绑定 / 推送 规格
 */
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { WechatService } from './wechat.service'

describe('[W12] 微信服务号/小程序', () => {
  let svc: WechatService
  beforeEach(() => {
    svc = new WechatService()
  })

  it('oauth/callback: 同一 code 恒返回同一 openid (确定性)', () => {
    const a = svc.oauthCallback({ code: 'CODE-AAA', channel: 'MINI_PROGRAM' })
    const b = svc.oauthCallback({ code: 'CODE-AAA', channel: 'MINI_PROGRAM' })
    expect(a.openid).toBe(b.openid)
    expect(a.openid).toMatch(/^o[0-9a-f]+$/)
    expect(a.isNew).toBe(true)
    expect(b.isNew).toBe(false)
    expect(a.user.openid).toBe(a.openid)
  })

  it('oauth/callback: 空 code 抛 BadRequestException', () => {
    expect(() => svc.oauthCallback({ code: '' })).toThrow(BadRequestException)
  })

  it('bind: 手机号匹配患者并写入绑定信息 + 发送日志', () => {
    const { openid } = svc.oauthCallback({ code: 'CODE-BIND', channel: 'MINI_PROGRAM' })
    const res = svc.bind({ openid, phone: '13800001001' })
    expect(res.bound).toBe(true)
    expect(res.patient?.patientId).toBe('P100001')
    expect(res.user.boundPatientId).toBe('P100001')
    expect(res.user.boundEmpiId).toBe('EMPI-000001')
    const logs = svc.listLogs({ openid, type: 'BIND' })
    expect(logs.total).toBe(1)
    expect(logs.items[0]!.status).toBe('SENT')
  })

  it('bind: 未匹配患者抛 NotFoundException 且记录失败日志', () => {
    const { openid } = svc.oauthCallback({ code: 'CODE-NOBIND' })
    expect(() => svc.bind({ openid, phone: '19900000000' })).toThrow(NotFoundException)
    const logs = svc.listLogs({ openid, type: 'BIND' })
    expect(logs.items[0]!.status).toBe('FAILED')
    expect(logs.items[0]!.error).toBe('PATIENT_NOT_FOUND')
  })

  it('subscribe/config: 返回模板与订阅事件', () => {
    const cfg = svc.getSubscribeConfig()
    expect(cfg.subscribeTemplates.length).toBeGreaterThanOrEqual(5)
    expect(cfg.subscribedEvents.some((e) => e.event === 'report_ready')).toBe(true)
  })

  it('menu: 保存后版本递增并可读取', () => {
    const before = svc.getMenu().version
    const saved = svc.saveMenu({
      buttons: [{ name: '报告', type: 'view', url: 'https://example.com' }],
    })
    expect(saved.version).toBe(before + 1)
    expect(svc.getMenu().buttons).toHaveLength(1)
    expect(() => svc.saveMenu({ buttons: [] })).toThrow(BadRequestException)
  })

  it('user: 不存在抛 NotFoundException', () => {
    expect(() => svc.getUser('o-none')).toThrow(NotFoundException)
  })

  it('push: 合法 openid SENT, 非法 openid FAILED', () => {
    const { openid } = svc.oauthCallback({ code: 'CODE-PUSH' })
    const ok = svc.push({ openid, title: '通知', content: '报告已出具' })
    expect(ok.status).toBe('SENT')
    const bad = svc.push({ openid: 'bad-id', content: '测试' })
    expect(bad.status).toBe('FAILED')
    expect(() => svc.push({ openid, content: '' })).toThrow(BadRequestException)
  })

  it('template/send: 未知模板抛 NotFound, 已知模板生成日志', () => {
    const { openid } = svc.oauthCallback({ code: 'CODE-TPL' })
    expect(() => svc.sendTemplate({ openid, templateId: 'TPL-X' })).toThrow(NotFoundException)
    const log = svc.sendTemplate({
      openid,
      templateId: 'TPL-REPORT-READY',
      data: { patientName: '张伟', modality: 'CT' },
    })
    expect(log.type).toBe('TEMPLATE')
    expect(log.status).toBe('SENT')
    expect(log.content).toContain('patientName')
  })

  it('logs/archive: 归档已发送日志并改变状态', () => {
    const { openid } = svc.oauthCallback({ code: 'CODE-ARCH' })
    svc.push({ openid, content: 'msg-1' })
    const res = svc.archiveLogs()
    expect(res.archived).toBeGreaterThanOrEqual(2)
    expect(svc.listLogs({ status: 'SENT' }).items.every((l) => l.status === 'SENT')).toBe(true)
  })
})
