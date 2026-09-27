import { DeviceOpsService } from './device-ops.service'
import { nextRunAt } from './device-ops.types'

describe('[W11-DeviceOps] 定时 BI 报表', () => {
  describe('nextRunAt (纯函数)', () => {
    it('daily 返回下一次整点', () => {
      expect(nextRunAt('daily', '07:00', '2026-09-01T05:00:00.000Z')).toBeTruthy()
      // 传入晚于当日 07:00 → 顺延到次日
      const next = nextRunAt('daily', '07:00', '2026-09-01T08:00:00.000Z')
      expect(next && new Date(next).getDate()).toBeGreaterThanOrEqual(1)
    })

    it('manual 无下一次运行', () => {
      expect(nextRunAt('manual', '08:00', '2026-09-01T05:00:00.000Z')).toBeNull()
    })
  })

  describe('服务层', () => {
    let svc: DeviceOpsService
    beforeEach(() => {
      svc = new DeviceOpsService()
    })

    it('list 报表定义带 nextRunAt', () => {
      const { items, total } = svc.listReportDefinitions()
      expect(total).toBeGreaterThanOrEqual(4)
      expect(items[0].nextRunAt).toBeDefined()
      expect(items.find((d) => d.frequency === 'manual')?.nextRunAt).toBeNull()
    })

    it('run 生成实例 + 投递日志, 全部成功时状态 success', () => {
      const inst = svc.runReportDefinition('RPT-4001', { trigger: 'manual' })
      expect(inst.id).toMatch(/^INST-/)
      expect(inst.status).toBe('success')
      expect(inst.deliveryLog).toHaveLength(2)
      expect(inst.rowCount).toBe(8)
    })

    it('投递失败写入 deliveryLog 且状态 failed', () => {
      const inst = svc.runReportDefinition('RPT-4003')
      expect(inst.status).toBe('failed')
      expect(inst.deliveryLog.some((l) => l.status === 'failed')).toBe(true)
    })

    it('create 定义 + 运行后可查询实例', () => {
      const def = svc.createReportDefinition({ name: '测试日报', frequency: 'daily', recipients: ['设备科'] })
      expect(def.nextRunAt).toBeTruthy()
      const inst = svc.runReportDefinition(def.id)
      const list = svc.listReportInstances({ definitionId: def.id })
      expect(list.total).toBe(1)
      expect(list.items[0].id).toBe(inst.id)
    })

    it('report-instances 按时间倒序', () => {
      const { items } = svc.listReportInstances()
      expect(items.length).toBeGreaterThanOrEqual(3)
      for (let i = 1; i < items.length; i++) {
        expect(items[i - 1].generatedAt >= items[i].generatedAt).toBe(true)
      }
    })
  })
})
