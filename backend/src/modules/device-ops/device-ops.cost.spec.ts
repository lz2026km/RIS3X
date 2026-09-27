import { DeviceOpsService } from './device-ops.service'
import { computeMargin, drgPayment, groupDrg, sumCost } from './device-ops.types'

describe('[W11-DeviceOps] 成本核算 + DRG', () => {
  describe('纯函数', () => {
    it('sumCost 汇总直接/间接成本', () => {
      expect(sumCost({ consumables: 10, contrast: 20, labor: 30, depreciation: 40, overhead: 5 })).toBe(105)
    })

    it('computeMargin 计算毛利与毛利率', () => {
      const m = computeMargin(520, 380)
      expect(m.margin).toBe(140)
      expect(m.marginPct).toBeCloseTo(26.92, 1)
      expect(computeMargin(0, 100).marginPct).toBe(0)
    })

    it('DRG 分组桩: 主诊断前缀映射 + 未知回退', () => {
      expect(groupDrg('I21.0').code).toBe('FM19')
      expect(groupDrg('G45').mdc).toBe('MDC-B')
      expect(groupDrg('Z99').code).toBe('ZZ01')
      expect(drgPayment(3.42, 12000)).toBe(41040)
    })
  })

  describe('服务层', () => {
    let svc: DeviceOpsService
    beforeEach(() => {
      svc = new DeviceOpsService()
    })

    it('cost summary 汇总收入/成本/毛利 + 按模态拆分', () => {
      const summary = svc.getCostSummary()
      expect(summary.totalRevenue).toBeCloseTo(2145800, 0)
      expect(summary.totalCost).toBeCloseTo(1273240, 0)
      expect(summary.margin.margin).toBeCloseTo(872560, 0)
      expect(summary.byModality.length).toBeGreaterThan(0)
      expect(summary.byModality[0].unitCost).toBeGreaterThan(0)
      const modalitySum = summary.byModality.reduce((s, m) => s + m.revenue, 0)
      expect(modalitySum).toBeCloseTo(summary.totalRevenue, 0)
    })

    it('cost by-exam 逐项单位成本与毛利', () => {
      const { items } = svc.getCostByExam()
      const dsa = items.find((i) => i.modality === 'DSA')
      expect(dsa?.unitCost).toBe(2740)
      expect(dsa?.margin).toBeGreaterThan(0)
    })

    it('DRG groups 汇总权重/支付/毛利', () => {
      const drg = svc.listDrg()
      expect(drg.total).toBe(6)
      expect(drg.totals.cases).toBe(1206)
      expect(drg.totals.totalWeight).toBeCloseTo(1744.64, 1)
      expect(drg.items[0].payment).toBeCloseTo(drg.items[0].totalWeight * 12000, 0)
    })

    it('groupDiagnosis 返回分组与支付额', () => {
      const g = svc.groupDiagnosis('M17.1', 12000)
      expect(g.code).toBe('IR15')
      expect(g.payment).toBeCloseTo(1.76 * 12000, 0)
    })
  })
})
