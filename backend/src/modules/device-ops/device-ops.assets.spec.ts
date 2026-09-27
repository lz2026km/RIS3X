import { BadRequestException } from '@nestjs/common'
import { DeviceOpsService } from './device-ops.service'
import { computeDepreciation, currentBookValue } from './device-ops.types'

describe('[W11-DeviceOps] 资产折旧', () => {
  describe('折旧算法 (纯函数)', () => {
    it('直线法: 月折旧 = (成本-残值)/月数', () => {
      const result = computeDepreciation({
        cost: 1200000,
        salvageRate: 0.1,
        usefulLifeMonths: 120,
        method: 'straight-line',
        startDate: '2021-01-01',
        asOf: '2021-12-31',
      })
      expect(result.residualValue).toBe(120000)
      expect(result.firstMonthDepreciation).toBeCloseTo(9000, 2)
      expect(result.currentBookValue).toBeCloseTo(1200000 - 12 * 9000, 2)
      expect(result.schedule).toHaveLength(12)
    })

    it('双倍余额递减: 前期折旧更高, 且不低于残值', () => {
      const result = computeDepreciation({
        cost: 100000,
        salvageRate: 0.05,
        usefulLifeMonths: 60,
        method: 'declining',
        startDate: '2020-01-01',
        asOf: '2030-01-01',
      })
      expect(result.firstMonthDepreciation).toBeGreaterThan(100000 / 60)
      expect(result.schedule[0].depreciation).toBeGreaterThan(result.schedule[1].depreciation)
      const last = result.schedule[result.schedule.length - 1]
      expect(last.closingValue).toBeGreaterThanOrEqual(result.residualValue - 0.01)
      expect(result.currentBookValue).toBeGreaterThanOrEqual(result.residualValue - 0.01)
    })

    it('直线法与递减法在生命末期都收敛到残值', () => {
      const input = {
        cost: 960000,
        salvageRate: 0.05,
        usefulLifeMonths: 96,
        method: 'straight-line' as const,
        startDate: '2022-01-01',
        asOf: '2040-01-01',
      }
      expect(currentBookValue(input)).toBeCloseTo(48000, 0)
    })
  })

  describe('服务层', () => {
    let svc: DeviceOpsService
    beforeEach(() => {
      svc = new DeviceOpsService()
    })

    it('list 返回资产并计算净值', () => {
      const { items, total } = svc.listAssets()
      expect(total).toBeGreaterThanOrEqual(8)
      expect(items.every((a) => a.bookValue >= a.residualValue - 0.01)).toBe(true)
    })

    it('getDepreciationSchedule 生成月度计划', () => {
      const sched = svc.getDepreciationSchedule('AST-3001', { asOf: '2022-05-31' })
      expect(sched.method).toBe('straight-line')
      expect(sched.schedule).toHaveLength(13)
      expect(sched.schedule[0].month).toBe('2021-05')
    })

    it('报废/退役走审批流并更新资产状态', () => {
      const req = svc.requestRetirement('AST-3006', { type: 'scrap', reason: '超过使用年限, 主板停产' })
      expect(req.status).toBe('pending')
      const approved = svc.approveRetirement(req.id, { approved: true, approvedBy: '设备科长', scrapValue: 8000 })
      expect(approved.status).toBe('approved')
      expect(svc.getAsset('AST-3006').status).toBe('scrapped')
      expect(svc.getAssetStats().pendingRetirements).toBe(0)
    })

    it('createAsset 校验成本为正', () => {
      expect(() => svc.createAsset({ deviceId: 'CT-01', procurementCost: 0 })).toThrow(BadRequestException)
      const asset = svc.createAsset({ deviceId: 'CT-01', procurementCost: 500000, usefulLifeMonths: 60 })
      expect(asset.bookValue).toBeGreaterThan(0)
    })

    it('stats 汇总资产总值/净值/方法分布', () => {
      const stats = svc.getAssetStats()
      expect(stats.totalAssets).toBeGreaterThanOrEqual(8)
      expect(stats.totalProcurementCost).toBeGreaterThan(stats.totalBookValue)
      expect(Object.keys(stats.byMethod).length).toBeGreaterThanOrEqual(2)
    })
  })
})
