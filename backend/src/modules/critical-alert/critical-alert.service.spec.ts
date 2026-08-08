import { NotFoundException } from '@nestjs/common'
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
})
