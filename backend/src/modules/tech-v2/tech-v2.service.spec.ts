/**
 * G005 RIS v3.0.6.11-101 Wave 4A (tech-v2 技师工作站 V2) - 服务 spec
 *
 * 覆盖:
 *   - 轮转规则: 班次 × 技能矩阵 (双检间 CT-1/CT-2 同技能池)
 *   - 轮转计划生成: 确定性贪心 (最小累计工作量优先 + 技能匹配 + 房间约束 + 连续天数)
 *   - 轮转均衡性: 组内最大-最小工作量差 ≤ 阈值
 *   - 工作量预测: WMA 确定性 / 7 天 × 8 时段 / 置信区间 / 周季节性 / 技师级别预测
 *   - 轮转执行记录 + 历史
 */
import { TechV2Service, type RotationAssignment } from './tech-v2.service'

const FIXED_START = '2026-08-17' // 周一

const addDays = (date: string, offset: number) => {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

describe('TechV2Service (Wave 4A 双检间轮转 + 工作量预测)', () => {
  let service: TechV2Service

  beforeEach(() => {
    service = new TechV2Service()
  })

  describe('轮转规则', () => {
    it('规则数 ≥ 6, 覆盖 DAY/NIGHT/WEEKEND/BACKUP 四班次', () => {
      const rules = service.getRotationRules()
      expect(rules.length).toBeGreaterThanOrEqual(6)
      const shifts = new Set(rules.map((r) => r.shift))
      expect(shifts.has('DAY')).toBe(true)
      expect(shifts.has('NIGHT')).toBe(true)
      expect(shifts.has('WEEKEND')).toBe(true)
      expect(shifts.has('BACKUP')).toBe(true)
    })

    it('CT 双检间规则: 技能矩阵同时覆盖 R-CT1 与 R-CT2 (同技能池轮转)', () => {
      const rule = service.getRotationRules().find((r) => r.id === 'RULE-CT-DAY')
      expect(rule).toBeDefined()
      expect(rule!.roomIds).toEqual(expect.arrayContaining(['R-CT1', 'R-CT2']))
      expect(rule!.skillMatrix['R-CT1']).toEqual(rule!.skillMatrix['R-CT2'])
      expect(rule!.skillMatrix['R-CT1']!.length).toBeGreaterThanOrEqual(3)
      expect(rule!.maxConsecutiveDays).toBeGreaterThanOrEqual(2)
      expect(rule!.balanceWeight).toBeGreaterThan(0)
    })
  })

  describe('轮转计划生成 (确定性贪心)', () => {
    it('同输入两次生成 → 完全一致 (planId/assignments/skipped/balance)', () => {
      const a = service.generatePlan({ startDate: FIXED_START, days: 7, balanceWeight: 0.6 })
      const b = service.generatePlan({ startDate: FIXED_START, days: 7, balanceWeight: 0.6 })
      expect(a.id).toBe(b.id)
      expect(a.assignments).toEqual(b.assignments)
      expect(a.skipped).toEqual(b.skipped)
      expect(a.balance).toEqual(b.balance)
    })

    it('技能矩阵约束: 每名技师的排班房间必须在其技能矩阵内 (或备班资格)', () => {
      const plan = service.generatePlan({ startDate: FIXED_START, days: 7 })
      const rules = service.getRotationRules()
      for (const a of plan.assignments) {
        const rule = rules.find((r) => r.id === a.ruleId)
        expect(rule).toBeDefined()
        if (!rule) continue
        if (a.roomId) {
          expect(rule.skillMatrix[a.roomId] ?? []).toContain(a.technicianId)
        } else {
          expect(rule.eligibleTechIds).toContain(a.technicianId)
        }
      }
    })

    it('房间约束: 工作日 CT 双检间 (R-CT1 + R-CT2) 均有白班技师', () => {
      const plan = service.generatePlan({ startDate: FIXED_START, days: 7 })
      // 周一 (2026-08-17): 工作日白班
      const monday = plan.assignments.filter((a) => a.date === '2026-08-17' && a.shift === 'DAY')
      const roomsCovered = new Set(monday.filter((a) => a.roomId).map((a) => a.roomId))
      expect(roomsCovered.has('R-CT1')).toBe(true)
      expect(roomsCovered.has('R-CT2')).toBe(true)
      // 同一技师同一天至多一个班次
      const perDay = new Map<string, Map<string, number>>()
      plan.assignments.forEach((a) => {
        if (!perDay.has(a.date)) perDay.set(a.date, new Map())
        const m = perDay.get(a.date)!
        m.set(a.technicianId, (m.get(a.technicianId) ?? 0) + 1)
      })
      perDay.forEach((m) => {
        m.forEach((count) => expect(count).toBeLessThanOrEqual(1))
      })
    })

    it('连续天数约束: 同技师连续排班天数 ≤ 规则 maxConsecutiveDays', () => {
      const plan = service.generatePlan({ startDate: FIXED_START, days: 7 })
      const rules = service.getRotationRules()
      const ruleMax = new Map(rules.map((r) => [r.id, r.maxConsecutiveDays]))
      const lastDate = new Map<string, string>()
      const run = new Map<string, number>()
      for (const a of [...plan.assignments].sort((x, y) => x.date.localeCompare(y.date) || x.technicianId.localeCompare(y.technicianId))) {
        const prev = lastDate.get(a.technicianId)
        const isConsecutive = prev !== undefined && a.date === addDays(prev, 1)
        run.set(a.technicianId, isConsecutive ? (run.get(a.technicianId) ?? 1) + 1 : 1)
        lastDate.set(a.technicianId, a.date)
        const max = ruleMax.get(a.ruleId) ?? 4
        expect(run.get(a.technicianId) ?? 1).toBeLessThanOrEqual(max)
      }
    })

    it('轮转均衡性: 组内最大-最小工作量差 ≤ 阈值', () => {
      const plan = service.generatePlan({ startDate: FIXED_START, days: 7 })
      expect(plan.balance.balanced).toBe(true)
      expect(plan.balance.maxMinDiff).toBeLessThanOrEqual(plan.balance.threshold)
      expect(plan.balance.groups.length).toBeGreaterThanOrEqual(5)
      const ct = plan.balance.groups.find((g) => g.groupId === 'GROUP-CT')
      expect(ct).toBeDefined()
      expect(ct!.loads.length).toBe(3)
    })

    it('不平衡输入拒绝: 非法日期 / days 越界 / balanceWeight 越界', () => {
      expect(() => service.generatePlan({ startDate: '2026-13-40' })).toThrow()
      expect(() => service.generatePlan({ startDate: FIXED_START, days: 15 })).toThrow()
      expect(() => service.generatePlan({ startDate: FIXED_START, balanceWeight: 2 })).toThrow()
    })
  })

  describe('工作量预测 (WMA 确定性 + 置信区间 + 季节性)', () => {
    it('确定性: 同一 startDate 两次调用 → 完全一致', () => {
      const a = service.forecast({ startDate: FIXED_START, days: 7 })
      const b = service.forecast({ startDate: FIXED_START, days: 7 })
      expect(a).toEqual(b)
    })

    it('输出形状: 7 天 × 8 时段, 每日 lower ≤ value ≤ upper', () => {
      const f = service.forecast({ startDate: FIXED_START, days: 7 })
      expect(f.daily).toHaveLength(7)
      f.daily.forEach((day) => {
        expect(day.periods).toHaveLength(8)
        expect(day.lower).toBeLessThanOrEqual(day.value)
        expect(day.upper).toBeGreaterThanOrEqual(day.value)
        expect(day.value).toBeGreaterThan(0)
      })
    })

    it('totals = 各日之和, 置信区间随天数扩大', () => {
      const f = service.forecast({ startDate: FIXED_START, days: 7 })
      const sum = f.daily.reduce((s, d) => s + d.value, 0)
      expect(f.totals.value).toBe(sum)
      expect(f.totals.upper).toBeGreaterThan(f.totals.value)
      expect(f.totals.lower).toBeLessThan(f.totals.value)
    })

    it('周季节性: 周五工作量 > 周日工作量 (WEEKDAY_FACTOR 1.15 vs 0.85)', () => {
      const f = service.forecast({ startDate: '2026-08-16', days: 7 }) // 周日开始
      const sunday = f.daily.find((d) => d.weekday === '周日')!.value
      const friday = f.daily.find((d) => d.weekday === '周五')!.value
      expect(friday).toBeGreaterThan(sunday)
      // 预测值在 7 天间存在差异 (非恒定)
      const values = f.daily.map((d) => d.value)
      expect(Math.max(...values) - Math.min(...values)).toBeGreaterThan(0)
    })

    it('预约趋势因子 ∈ [0.85, 1.30]', () => {
      const f = service.forecast({ startDate: FIXED_START, days: 7 })
      f.daily.forEach((d) => {
        expect(d.trendFactor).toBeGreaterThanOrEqual(0.85)
        expect(d.trendFactor).toBeLessThanOrEqual(1.3)
        expect(d.appointments).toBeGreaterThan(0)
      })
    })

    it('技师级别预测: 份额归一化, 按技师筛选只返回该技师', () => {
      const f = service.forecast({ startDate: FIXED_START, days: 7 })
      const dayShares = new Map<string, number>()
      f.perTechnician.forEach((t) => dayShares.set(t.date, (dayShares.get(t.date) ?? 0) + t.share))
      dayShares.forEach((sum) => expect(Math.abs(sum - 1)).toBeLessThan(0.01))
      const single = service.forecast({ startDate: FIXED_START, days: 7, technicianId: 'T-001' })
      expect(single.perTechnician.every((t) => t.technicianId === 'T-001')).toBe(true)
      expect(single.perTechnician).toHaveLength(7)
    })
  })

  describe('轮转执行记录 + 历史', () => {
    it('执行记录创建 → 出现在历史中; 重复执行返回同一条', () => {
      const plan = service.generatePlan({ startDate: FIXED_START, days: 7 })
      const target = plan.assignments[0]!
      const rec = service.executeAssignment(target.id, { note: '手动确认执行' })
      expect(rec.status).toBe('EXECUTED')
      expect(rec.assignmentId).toBe(target.id)
      expect(rec.technicianName).toBe(target.technicianName)
      const again = service.executeAssignment(target.id, { note: '重复' })
      expect(again.id).toBe(rec.id)
      const history = service.getRotationHistory()
      expect(history.executions.some((e) => e.id === rec.id)).toBe(true)
      expect(history.plans.some((p) => p.id === plan.id)).toBe(true)
    })

    it('不存在的排班执行 → NotFound', () => {
      expect(() => service.executeAssignment('ASG-NO-SUCH')).toThrow()
    })
  })

  describe('工作量均衡指标 + 轮转计划查询', () => {
    it('getWorkloadBalance 返回 perTechnician 累计工作量与均衡判定', () => {
      service.generatePlan({ startDate: FIXED_START, days: 7 })
      const b = service.getWorkloadBalance()
      expect(b.perTechnician).toHaveLength(8)
      b.perTechnician.forEach((t) => {
        expect(t.cumulativeLoad).toBeGreaterThanOrEqual(t.baseLoad)
        expect(t.assignmentCount).toBeGreaterThanOrEqual(0)
      })
      expect(typeof b.balanced).toBe('boolean')
    })

    it('getRotationPlan 支持按 startDate 获取 (确定性生成)', () => {
      const plan = service.getRotationPlan({ startDate: FIXED_START, days: '7' })
      expect(plan.startDate).toBe(FIXED_START)
      expect(plan.assignments.length).toBeGreaterThan(0)
      expect((plan.assignments[0] as RotationAssignment).roomId).toBeDefined()
    })
  })
})
