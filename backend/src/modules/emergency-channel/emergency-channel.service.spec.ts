/**
 * G005 RIS v3.0.6.11-92 (Wave3A P2) - EmergencyChannelService 测试
 * 通道配置 GET/PUT + 触发记录 + 模拟通知 (内存 + 种子)
 */
import { EmergencyChannelService, EmergencyChannelType } from './emergency-channel.service'
import { BadRequestException, NotFoundException } from '@nestjs/common'

describe('EmergencyChannelService', () => {
  describe('getConfig (种子通道配置)', () => {
    it('返回 6 类通道 + 自动触发关键词', () => {
      const svc = new EmergencyChannelService()
      const cfg = svc.getConfig()
      expect(cfg.channels).toHaveLength(6)
      const types = cfg.channels.map((c) => c.type)
      expect(types).toEqual(['sms', 'phone', 'in-app', 'wechat', 'email', 'pager'])
      expect(cfg.autoTrigger.enabled).toBe(true)
      expect(cfg.autoTrigger.keywords.length).toBeGreaterThan(0)
    })

    it('返回副本, 修改返回值不影响内部状态', () => {
      const svc = new EmergencyChannelService()
      const cfg = svc.getConfig()
      cfg.channels[0]!.enabled = false
      expect(svc.getConfig().channels[0]!.enabled).toBe(true)
    })
  })

  describe('updateConfig (保存通道配置)', () => {
    it('保存开关/优先级/目标角色并回读', () => {
      const svc = new EmergencyChannelService()
      const updated = svc.updateConfig({
        channels: [
          { type: 'phone', enabled: true, priority: 1, targetRole: '值班主任医师' },
          { type: 'sms', enabled: false, priority: 2, targetRole: '值班医师' },
        ],
        autoTrigger: { enabled: false, keywords: ['主动脉夹层'] },
      })
      expect(updated.channels).toHaveLength(2)
      expect(updated.channels.find((c) => c.type === 'phone')?.priority).toBe(1)
      expect(updated.channels.find((c) => c.type === 'sms')?.enabled).toBe(false)
      expect(updated.autoTrigger.enabled).toBe(false)
      expect(updated.updatedAt).toBeTruthy()
    })

    it('空 channels → BadRequestException', () => {
      const svc = new EmergencyChannelService()
      expect(() => svc.updateConfig({ channels: [] })).toThrow(BadRequestException)
    })

    it('非法通道类型 → BadRequestException', () => {
      const svc = new EmergencyChannelService()
      expect(() =>
        svc.updateConfig({
          channels: [{ type: 'fax' as EmergencyChannelType, enabled: true, priority: 1 }],
        }),
      ).toThrow(BadRequestException)
    })
  })

  describe('listRecords (触发记录)', () => {
    it('种子记录非空且按触发时间倒序', () => {
      const svc = new EmergencyChannelService()
      const records = svc.listRecords()
      expect(records.length).toBeGreaterThan(0)
      expect(records[0]!.triggeredAt >= records[records.length - 1]!.triggeredAt).toBe(true)
    })

    it('支持按 patientId / status 过滤', () => {
      const svc = new EmergencyChannelService()
      const byPatient = svc.listRecords({ patientId: 'RAD-P003' })
      expect(byPatient.every((r) => r.patientId === 'RAD-P003')).toBe(true)
      const byStatus = svc.listRecords({ status: 'completed' })
      expect(byStatus.every((r) => r.status === 'completed')).toBe(true)
    })
  })

  describe('trigger (创建触发记录 + 模拟通知)', () => {
    it('使用启用通道按优先级生成模拟通知', () => {
      const svc = new EmergencyChannelService()
      const created = svc.trigger({
        patientId: 'RAD-P999',
        patientName: '测试患者',
        type: 'critical-finding',
        reason: 'CTA 提示主动脉夹层, 需立即处理',
      })
      expect(created.id).toBeTruthy()
      expect(created.status).toBe('sent')
      expect(created.channels.length).toBeGreaterThan(0)
      expect(created.notifications.every((n) => n.simulated === true)).toBe(true)
      expect(created.notifications[0]!.targetRole).toBeTruthy()
      const list = svc.listRecords({ patientId: 'RAD-P999' })
      expect(list.some((r) => r.id === created.id)).toBe(true)
    })

    it('reason 过短 → BadRequestException', () => {
      const svc = new EmergencyChannelService()
      expect(() => svc.trigger({ patientId: 'P1', reason: '短' })).toThrow(BadRequestException)
    })

    it('全部通道停用后触发 → BadRequestException', () => {
      const svc = new EmergencyChannelService()
      svc.updateConfig({
        channels: [
          { type: 'sms', enabled: false, priority: 1, targetRole: '值班医师' },
          { type: 'phone', enabled: false, priority: 2, targetRole: '值班医师' },
        ],
      })
      expect(() => svc.trigger({ patientId: 'P1', reason: '测试触发记录场景' })).toThrow(BadRequestException)
    })

    it('命中关键词标记系统自动触发', () => {
      const svc = new EmergencyChannelService()
      const created = svc.trigger({
        patientId: 'RAD-P777',
        type: 'critical-finding',
        reason: '发现张力性气胸, 肺压缩约 30%',
      })
      expect(created.triggeredBy).toBe('系统(自动触发)')
    })

    it('acknowledge 未知记录 → NotFoundException', () => {
      const svc = new EmergencyChannelService()
      expect(() => svc.acknowledge('unknown-id')).toThrow(NotFoundException)
    })
  })
})
