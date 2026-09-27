import { DeviceOpsService } from './device-ops.service'
import { calibrationDueState, daysUntil } from './device-ops.types'
import { anchorOffset } from './device-ops.data'

const NOW = `${anchorOffset(0).slice(0, 10)}T09:00:00.000Z`

describe('[W11-DeviceOps] 校准 / 认证', () => {
  describe('到期判定 (纯函数)', () => {
    it('overdue / due_soon / valid / none', () => {
      expect(calibrationDueState('2026-08-01T00:00:00.000Z', NOW, 30)).toBe('overdue')
      expect(calibrationDueState(anchorOffset(15), NOW, 30)).toBe('due_soon')
      expect(calibrationDueState(anchorOffset(200), NOW, 30)).toBe('valid')
      expect(calibrationDueState(null, NOW, 30)).toBe('none')
    })

    it('daysUntil 返回整数天数', () => {
      expect(daysUntil(anchorOffset(10), NOW)).toBe(10)
      expect(daysUntil(anchorOffset(-5), NOW)).toBeLessThan(0)
    })
  })

  describe('服务层', () => {
    let svc: DeviceOpsService
    beforeEach(() => {
      svc = new DeviceOpsService()
    })

    it('list 带 dueState + daysRemaining', () => {
      const { items, total } = svc.listCalibrations({ now: NOW })
      expect(total).toBeGreaterThanOrEqual(10)
      expect(items.every((c) => c.dueState.length > 0)).toBe(true)
      expect(items.some((c) => c.dueState === 'overdue')).toBe(true)
    })

    it('due 只返回近期到期项', () => {
      const { items, days } = svc.calibrationDue(30, NOW)
      expect(days).toBe(30)
      expect(items.length).toBeGreaterThan(0)
      for (const c of items) {
        expect(['overdue', 'due_soon']).toContain(c.dueState)
      }
    })

    it('failures 覆盖失败与超期', () => {
      const { items } = svc.calibrationFailures()
      expect(items.length).toBeGreaterThan(0)
      expect(items.some((c) => c.result === 'fail')).toBe(true)
    })

    it('stats 汇总类型/结果/失败率', () => {
      const stats = svc.getCalibrationStats(NOW)
      expect(stats.total).toBeGreaterThanOrEqual(10)
      expect(stats.byKind.calibration).toBeGreaterThan(0)
      expect(stats.byKind.certification).toBeGreaterThan(0)
      expect(stats.overdue).toBeGreaterThan(0)
      expect(stats.failureRatePct).toBeGreaterThan(0)
    })

    it('create 新增记录并自动推导 dueState', () => {
      const rec = svc.createCalibration({
        deviceId: 'DR-01',
        kind: 'calibration',
        standard: 'JJG 1078-2012',
        lastDate: anchorOffset(0),
        nextDue: anchorOffset(-1),
        result: 'pending',
      })
      expect(rec.id).toMatch(/^CAL-/)
      expect(rec.dueState).toBe('overdue')
    })
  })
})
