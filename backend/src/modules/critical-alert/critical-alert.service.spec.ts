import { BadRequestException, NotFoundException } from '@nestjs/common'
import { CriticalAlertService } from './critical-alert.service'

const makePrisma = () => {
  const reject = jest.fn().mockRejectedValue(new Error('no db'))
  return {
    criticalValue: { findMany: reject, findUnique: reject, create: reject, update: reject },
  } as never
}

describe('CriticalAlertService', () => {
  describe('DB 不可用 → 种子告警回退', () => {
    it('listAlerts 返回非空告警列表', async () => {
      const service = new CriticalAlertService(makePrisma())
      const alerts = await service.listAlerts()
      expect(alerts.length).toBeGreaterThan(0)
      expect(alerts[0].id).toBeTruthy()
      expect(alerts[0].patientName).toBeTruthy()
    })

    it('支持 status/severity 过滤', async () => {
      const service = new CriticalAlertService(makePrisma())
      const active = await service.listAlerts({ status: 'active' })
      expect(active.every((a) => a.status === 'active')).toBe(true)
      const critical = await service.listAlerts({ severity: 'critical' })
      expect(critical.every((a) => a.severity === 'critical')).toBe(true)
    })

    it('stats 统计字段齐全', async () => {
      const service = new CriticalAlertService(makePrisma())
      const stats = await service.stats()
      expect(stats.totalAlerts).toBeGreaterThan(0)
      expect(typeof stats.activeCount).toBe('number')
      expect(Array.isArray(stats.severityDistribution)).toBe(true)
    })
  })

  describe('处理闭环', () => {
    it('acknowledge → status=acknowledged', async () => {
      const service = new CriticalAlertService(makePrisma())
      const alerts = await service.listAlerts()
      const target = alerts.find((a) => a.status === 'active')!
      const done = await service.acknowledge(target.id, { comment: '已电话确认' })
      expect(done.status).toBe('acknowledged')
      expect(done.acknowledgedBy).toBeTruthy()
    })

    it('resolve → status=resolved', async () => {
      const service = new CriticalAlertService(makePrisma())
      const alerts = await service.listAlerts()
      const done = await service.resolve(alerts[0].id, { resolution: '已处理完毕' })
      expect(done.status).toBe('resolved')
      expect(done.resolvedAt).toBeTruthy()
    })

    it('escalate → status=escalated + assignee', async () => {
      const service = new CriticalAlertService(makePrisma())
      const alerts = await service.listAlerts()
      const done = await service.escalate(alerts[0].id, '值班主任医师')
      expect(done.status).toBe('escalated')
      expect(done.assignee).toBe('值班主任医师')
    })

    it('create 生成新告警', async () => {
      const service = new CriticalAlertService(makePrisma())
      const created = await service.create({
        level: 'emergency',
        patientName: '测试患者',
        description: '测试危急值',
      })
      expect(created.status).toBe('active')
      expect(created.severity).toBe('emergency')
      const list = await service.listAlerts()
      expect(list.some((a) => a.id === created.id)).toBe(true)
    })

    it('未知 id 操作 → NotFoundException', async () => {
      const service = new CriticalAlertService(makePrisma())
      await expect(service.resolve('unknown-id', {})).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  // [v3.0.6.11-103 Wave 13] 危急值 5 步流程: 触发→通知→确认→处置→记录 (不能跳步 + 时间戳)
  describe('5 步流程 (触发→通知→确认→处置→记录)', () => {
    const freshService = () => new CriticalAlertService(makePrisma())
    // 种子告警为模块级共享状态, 用已用 id 排除集合保证每个测试取到独立「触发」告警
    const usedIds = new Set<string>()

    async function pickActiveId(): Promise<string> {
      const service = freshService()
      const alerts = await service.listAlerts()
      const target = alerts.find((a) => a.step === 0 && a.status === 'active' && !usedIds.has(a.id))
      if (target) {
        usedIds.add(target.id)
        return target.id
      }
      // 种子告警耗尽 (模块级状态共享): 动态创建新「触发」告警
      const created = await service.create({ level: 'critical', patientName: '流程测试患者', description: '5步流程测试危急值' })
      usedIds.add(created.id)
      return created.id
    }

    it('listAlerts 返回 5 步流程元数据 (step/flowStatus/flowSteps)', async () => {
      const service = freshService()
      const alerts = await service.listAlerts()
      expect(alerts.length).toBeGreaterThan(0)
      const a = alerts.find((x) => x.status === 'active')!
      expect(a.step).toBe(0)
      expect(a.flowStatus).toBe('triggered')
      expect(a.flowSteps).toBeDefined()
      expect(a.flowSteps!.triggered).toBeTruthy()
    })

    it('不能跳步: 未通知直接确认 → 400 INVALID_FLOW_STEP', async () => {
      const service = freshService()
      const id = await pickActiveId()
      await expect(service.confirm(id, { receiver: '王医生' })).rejects.toBeInstanceOf(BadRequestException)
      await expect(service.confirm(id, { receiver: '王医生' })).rejects.toThrow('INVALID_FLOW_STEP')
    })

    it('不能跳步: 未处置直接闭环 → 400 INVALID_FLOW_STEP', async () => {
      const service = freshService()
      const id = await pickActiveId()
      await expect(service.close(id, {})).rejects.toThrow('INVALID_FLOW_STEP')
    })

    it('全链路: 通知 → 确认 → 处置 → 记录闭环, 各步时间戳记录', async () => {
      const service = freshService()
      const id = await pickActiveId()

      const notified = await service.notify(id, { method: 'phone', phone: '13800000001' })
      expect(notified.step).toBe(1)
      expect(notified.flowStatus).toBe('notified')
      expect(notified.flowSteps!.notified).toBeTruthy()

      const confirmed = await service.confirm(id, { receiver: '王医生', comment: '已电话确认' })
      expect(confirmed.step).toBe(2)
      expect(confirmed.flowStatus).toBe('confirmed')
      expect(confirmed.flowSteps!.confirmed).toBeTruthy()

      const treated = await service.treat(id, { treatment: '急诊外科会诊', orders: '补液+监护' })
      expect(treated.step).toBe(3)
      expect(treated.flowStatus).toBe('treating')
      expect(treated.flowSteps!.treating).toBeTruthy()

      const closed = await service.close(id, { summary: '患者已收治' })
      expect(closed.step).toBe(4)
      expect(closed.flowStatus).toBe('closed')
      expect(closed.flowSteps!.closed).toBeTruthy()
      expect(closed.status).toBe('resolved')
      // 闭环后详情仍可查 (终态 getAlert 兜底)
      const after = await service.getAlert(id)
      expect(after.flowStatus).toBe('closed')
    })

    it('重复执行同一步 → 400 (状态已越过该步)', async () => {
      const service = freshService()
      const id = await pickActiveId()
      await service.notify(id, { method: 'sms' })
      await service.confirm(id, {})
      await expect(service.notify(id, { method: 'sms' })).rejects.toThrow('INVALID_FLOW_STEP')
    })

    it('通知方法: phone → VOICE_CALLED 步骤推进且时间戳记录', async () => {
      const service = freshService()
      const id1 = await pickActiveId()
      const id2 = await pickActiveId()
      const res = await service.notify(id1, { method: 'phone' })
      expect(res.flowSteps!.notified).toBeTruthy()
      const sms = await service.notify(id2, { method: 'sms' })
      expect(sms.flowSteps!.notified).toBeTruthy()
    })

    it('未知 id 走 5 步流程 → NotFoundException', async () => {
      const service = freshService()
      await expect(service.notify('unknown-id', {})).rejects.toBeInstanceOf(NotFoundException)
    })
  })
})
