import { DeviceOpsService } from './device-ops.service'
import { computeOee, summarizeDowntime, type DowntimeEventInput } from './device-ops.types'

describe('[W11-DeviceOps] OEE (真实停机事件)', () => {
  describe('OEE 计算 (纯函数)', () => {
    it('可用率×性能×质量', () => {
      const result = computeOee({
        plannedProductionMinutes: 480,
        downtimeEvents: [{ reason: 'unplanned', minutes: 60 }, { reason: 'changeover', minutes: 20 }],
        idealCycleMinutes: 4,
        totalCount: 90,
        goodCount: 81,
      })
      // runtime = 480-80 = 400 → availability 83.33
      expect(result.availability).toBeCloseTo(83.33, 1)
      // performance = 4*90/400 = 90
      expect(result.performance).toBeCloseTo(90, 1)
      // quality = 81/90 = 90
      expect(result.quality).toBeCloseTo(90, 1)
      expect(result.oee).toBeCloseTo((83.33 * 90 * 90) / 10000, 0)
      expect(result.runtimeMinutes).toBe(400)
      expect(result.scrapCount).toBe(9)
    })

    it('性能上限 100 (理论节拍×产量不超过运行时间)', () => {
      const result = computeOee({
        plannedProductionMinutes: 600,
        downtimeEvents: [],
        idealCycleMinutes: 20,
        totalCount: 10,
        goodCount: 10,
      })
      expect(result.performance).toBeLessThanOrEqual(100)
    })

    it('损失分解: small-stop 计入性能不扣可用率, 但仍计入损失', () => {
      const events: DowntimeEventInput[] = [
        { reason: 'planned', minutes: 30 },
        { reason: 'unplanned', minutes: 45 },
        { reason: 'changeover', minutes: 15 },
        { reason: 'idle', minutes: 10 },
        { reason: 'small-stop', minutes: 20 },
      ]
      const loss = summarizeDowntime(events)
      expect(loss.total).toBe(120)
      expect(loss.smallStop).toBe(20)
      const result = computeOee({
        plannedProductionMinutes: 480,
        downtimeEvents: events,
        idealCycleMinutes: 5,
        totalCount: 50,
        goodCount: 48,
      })
      // runtime = 480 - (30+45+15+10) = 380 → availability 79.17 (small-stop 不计入)
      expect(result.availability).toBeCloseTo(79.17, 1)
      expect(result.lossPercent['small-stop']).toBeGreaterThan(0)
    })
  })

  describe('服务层 (设备维度)', () => {
    let svc: DeviceOpsService
    beforeEach(() => {
      svc = new DeviceOpsService()
    })

    it('list 返回全部设备 OEE, source=actual', () => {
      const { items, total } = svc.listOee()
      expect(total).toBe(8)
      expect(items.every((d) => d.source === 'actual')).toBe(true)
      expect(items.every((d) => d.oee >= 0 && d.oee <= 100)).toBe(true)
    })

    it('CT-01 由真实停机事件与检查计数推导', () => {
      const d = svc.getOeeDevice('CT-01')
      // downtime 95+45+25 = 165 (small-stop 18 不计可用率) → runtime 555
      expect(d.availability).toBeCloseTo(77.08, 1)
      expect(d.quality).toBeCloseTo(94.87, 1)
      expect(d.workOrderIds).toContain('WO-1001')
      expect(d.downtimeMinutes).toBe(183)
    })

    it('overview 汇总平均与最优/最差设备', () => {
      const ov = svc.getOeeOverview()
      expect(ov.totalDevices).toBe(8)
      expect(ov.bestDevice).not.toBeNull()
      expect(ov.worstDevice).not.toBeNull()
      expect(ov.totalDowntimeHours).toBeGreaterThan(0)
      expect(ov.byModality.length).toBeGreaterThan(0)
    })

    it('trend 当日为 actual, 历史为 derived', () => {
      const { items } = svc.getOeeTrend(5)
      expect(items).toHaveLength(5)
      expect(items[items.length - 1].source).toBe('actual')
      expect(items[0].source).toBe('derived')
    })

    it('downtime-loss 汇总损失分解', () => {
      const { items, total } = svc.getDowntimeLoss()
      expect(total).toBe(8)
      const ct = items.find((i) => i.deviceId === 'CT-01')
      expect(ct?.loss.unplanned).toBe(95)
      expect(ct?.loss.planned).toBe(45)
    })
  })
})
