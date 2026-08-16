/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 8B (qc-analytics) - 报告质控闭环与趋势分析服务测试
 * 覆盖:
 *   1. 闭环状态机: 缺陷 → 整改任务 → 复查验证 → 关闭 (含退回路径), 非法流转拒绝
 *   2. 趋势计算确定性: 同输入同输出, 周/月分桶, 环比改善率
 *   3. 帕累托: 降序 + 累计占比 + 主要问题判定
 *   4. 科室排名: 缺陷率升序
 *   5. 驾驶舱: 报告/质控率/缺陷率/及时率/平均响应时间
 *   6. 孤儿模块回退: DB 不可用 → 确定性种子可工作
 */
import { BadRequestException, NotFoundException } from '@nestjs/common'
import {
  QcAnalyticsService,
  assertLoopTransition,
  buildDashboardData,
  buildDepartmentRanking,
  buildPareto,
  buildSeedRecords,
  buildTrends,
  weekStartOf,
} from './qc-analytics.service'

const makePrisma = () => {
  const reject = jest.fn().mockRejectedValue(new Error('no db'))
  return { auditLog: { findMany: reject, create: reject } } as never
}

describe('QcAnalyticsService (Wave 8B 报告质控闭环与趋势分析)', () => {
  describe('1. 闭环状态机: 缺陷 → 整改 → 复查 → 关闭', () => {
    const pickOpenDefect = async (service: QcAnalyticsService) => {
      const defects = await service.listLoopDefects()
      return defects.data.find((d) => d.status === 'open' && !d.itemId)!
    }

    it('完整闭环: create(open) → start(rectifying) → fix(rechecking) → recheck pass(closed)', async () => {
      const service = new QcAnalyticsService(makePrisma())
      const defect = await pickOpenDefect(service)
      const created = await service.createLoopItem({ defectId: defect.id })
      expect(created.status).toBe('open')
      expect(created.history[0]!.action).toBe('created')
      const started = await service.startFix(created.id)
      expect(started.status).toBe('rectifying')
      const fixed = await service.submitFix(created.id, { note: '模板已更新' })
      expect(fixed.status).toBe('rechecking')
      expect(fixed.fixNote).toContain('模板已更新')
      const closed = await service.recheckItem(fixed.id, { result: 'pass', reviewer: '张质控', note: '复查通过' })
      expect(closed.status).toBe('closed')
      expect(closed.closedAt).toBeTruthy()
      expect(closed.recheckRounds).toBe(1)
      expect(closed.recheckResult).toBe('pass')
      const actions = (await service.getLoopItem(created.id)).history.map((h) => h.action)
      expect(actions).toEqual(['created', 'started', 'fixed', 'rechecked', 'closed'])
    })

    it('退回路径: recheck fail → 返回 rectifying, 复查轮次 +1', async () => {
      const service = new QcAnalyticsService(makePrisma())
      const defect = await pickOpenDefect(service)
      const created = await service.createLoopItem({ defectId: defect.id })
      await service.startFix(created.id)
      await service.submitFix(created.id, { note: '整改说明' })
      const failed = await service.recheckItem(created.id, { result: 'fail', reviewer: '张质控', note: '未全部回刷' })
      expect(failed.status).toBe('rectifying')
      expect(failed.recheckRounds).toBe(1)
      expect(failed.recheckResult).toBe('fail')
      await service.submitFix(created.id, { note: '重新提交' })
      const closed = await service.recheckItem(created.id, { result: 'pass', reviewer: '张质控' })
      expect(closed.status).toBe('closed')
      expect(closed.recheckRounds).toBe(2)
    })

    it('非法流转 → BadRequestException: 未开始不可提交 / 已关闭不可再操作', async () => {
      const service = new QcAnalyticsService(makePrisma())
      const defect = await pickOpenDefect(service)
      const created = await service.createLoopItem({ defectId: defect.id })
      await expect(service.submitFix(created.id)).rejects.toThrow(BadRequestException)
      await expect(service.recheckItem(created.id, { result: 'pass', reviewer: '张质控' })).rejects.toThrow(BadRequestException)
      await service.startFix(created.id)
      await expect(service.startFix(created.id)).rejects.toThrow(BadRequestException)
      await expect(service.recheckItem(created.id, { result: 'pass', reviewer: '张质控' })).rejects.toThrow(BadRequestException)
      await service.submitFix(created.id)
      await service.recheckItem(created.id, { result: 'pass', reviewer: '张质控' })
      await expect(service.closeLoopItem(created.id)).rejects.toThrow(BadRequestException)
      await expect(service.submitFix(created.id)).rejects.toThrow(BadRequestException)
    })

    it('assertLoopTransition: 转移表外组合拒绝', () => {
      expect(() => assertLoopTransition('open', 'rechecking')).toThrow(BadRequestException)
      expect(() => assertLoopTransition('rectifying', 'closed')).toThrow(BadRequestException)
      expect(() => assertLoopTransition('closed', 'open')).toThrow(BadRequestException)
      expect(() => assertLoopTransition('rechecking', 'rectifying')).not.toThrow()
      expect(() => assertLoopTransition('open', 'rectifying')).not.toThrow()
    })

    it('缺陷 → 整改任务 派生与查重: 已有进行中任务拒绝二次创建', async () => {
      const service = new QcAnalyticsService(makePrisma())
      const defect = await pickOpenDefect(service)
      await service.createLoopItem({ defectId: defect.id })
      await expect(service.createLoopItem({ defectId: defect.id })).rejects.toThrow(BadRequestException)
      await expect(service.createLoopItem({ defectId: 'qcd-UNKNOWN' })).rejects.toBeInstanceOf(NotFoundException)
    })

    it('闭环统计: byStatus 之和 = total, 关闭率 = closed/total', async () => {
      const service = new QcAnalyticsService(makePrisma())
      const stats = service.getLoopStats().data
      expect(stats.total).toBeGreaterThan(0)
      const sum = Object.values(stats.byStatus).reduce((a, b) => a + (b ?? 0), 0)
      expect(sum).toBe(stats.total)
      expect(stats.closureRate).toBeGreaterThanOrEqual(0)
      expect(stats.closureRate).toBeLessThanOrEqual(100)
      expect(stats.avgDaysToClose).toBeGreaterThan(0)
      expect(stats.avgRecheckRounds).toBeGreaterThanOrEqual(0)
    })
  })

  describe('2. 趋势计算确定性 + 环比改善率', () => {
    it('确定性: 同输入两次 buildTrends → 完全一致', () => {
      const records = buildSeedRecords()
      const a = buildTrends(records, 'month')
      const b = buildTrends(records, 'month')
      expect(a).toEqual(b)
      expect(buildTrends(records, 'week')).toEqual(buildTrends(records, 'week'))
    })

    it('月度趋势: 分桶升序, bucket 形如 YYYY-MM, count 总和 = 记录数, 首期 improvement = null', () => {
      const records = buildSeedRecords()
      const points = buildTrends(records, 'month')
      expect(points.length).toBeGreaterThan(4)
      const buckets = points.map((p) => p.bucket)
      expect(buckets).toEqual([...buckets].sort())
      points.forEach((p) => expect(p.bucket).toMatch(/^\d{4}-\d{2}$/))
      const totalReports = points.reduce((a, p) => a + p.reports, 0)
      expect(totalReports).toBe(records.length)
      expect(points[0]!.improvement).toBeNull()
      expect(points[1]!.improvement).not.toBeNull()
      points.forEach((p) => {
        expect(p.defectRate).toBeGreaterThanOrEqual(0)
        expect(p.qcRate).toBeLessThanOrEqual(100)
        expect(p.timelyRate).toBeLessThanOrEqual(100)
      })
    })

    it('周趋势: 分桶为周一日期, 与月度分桶不同粒度', () => {
      const records = buildSeedRecords()
      const weeks = buildTrends(records, 'week')
      const months = buildTrends(records, 'month')
      expect(weeks.length).toBeGreaterThan(months.length)
      weeks.forEach((p) => expect(p.bucket).toMatch(/^\d{4}-\d{2}-\d{2}$/))
      const monday = weekStartOf('2026-08-05T03:00:00.000Z')
      expect(monday).toBe('2026-08-03')
      const sunday = weekStartOf('2026-08-09T03:00:00.000Z')
      expect(sunday).toBe('2026-08-03')
    })

    it('环比改善率: 缺陷率下降 → 正改善; 上升 → 负值', () => {
      const base = buildSeedRecords()
      const points = buildTrends(base, 'month')
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1]!
        const cur = points[i]!
        const expected = prev.defectRate > 0 ? Math.round(((prev.defectRate - cur.defectRate) / prev.defectRate) * 100 * 10) / 10 : null
        expect(cur.improvement).toBe(expected)
        const diff = prev.defectRate - cur.defectRate
        if (diff > 0 && expected !== null) expect(cur.improvement!).toBeGreaterThan(0)
        else if (diff < 0 && expected !== null) expect(cur.improvement!).toBeLessThan(0)
      }
    })
  })

  describe('3. 帕累托排序', () => {
    it('降序 + 累计占比 + isMain (累计 ≤ 80%)', () => {
      const records = buildSeedRecords()
      const items = buildPareto(records)
      expect(items.length).toBeGreaterThan(0)
      const counts = items.map((i) => i.count)
      expect(counts).toEqual([...counts].sort((a, b) => b - a))
      let cumulative = 0
      for (const item of items) {
        cumulative += item.count
        expect(item.cumulativeCount).toBe(cumulative)
        expect(item.cumulativePercent).toBe(Math.round((cumulative / (items.reduce((a, i) => a + i.count, 0))) * 1000) / 10)
        expect(item.isMain).toBe(item.cumulativePercent <= 80)
        expect(item.label).toBeTruthy()
      }
      expect(items.some((i) => i.isMain)).toBe(true)
    })

    it('平局按 code 升序 (确定性)', () => {
      const a = buildPareto([
        { id: '1', reportId: 'R1', department: '放射科一区', modality: 'CT', reportedAt: '2026-08-01T01:00:00.000Z', defectCodes: ['terminology', 'unit'], qcScored: true, responseMinutes: 40, timely: true },
        { id: '2', reportId: 'R2', department: '放射科二区', modality: 'DR', reportedAt: '2026-08-02T01:00:00.000Z', defectCodes: ['unit', 'terminology'], qcScored: true, responseMinutes: 50, timely: true },
      ])
      expect(a[0]!.code).toBe('terminology')
      expect(a[1]!.code).toBe('unit')
    })
  })

  describe('4. 科室排名', () => {
    it('缺陷率升序 (最好在前), 平局按科室名', () => {
      const records = buildSeedRecords()
      const ranking = buildDepartmentRanking(records)
      expect(ranking.length).toBeGreaterThan(3)
      const rates = ranking.map((r) => r.defectRate)
      expect(rates).toEqual([...rates].sort((a, b) => a - b))
      ranking.forEach((r) => {
        expect(r.reports).toBeGreaterThan(0)
        expect(r.timelyRate).toBeLessThanOrEqual(100)
        expect(r.qcRate).toBeLessThanOrEqual(100)
        expect(r.avgResponseMinutes).toBeGreaterThan(0)
      })
    })
  })

  describe('5. 质控驾驶舱', () => {
    it('聚合指标: 缺陷率 = 缺陷数/报告数, 率值 0-100', async () => {
      const service = new QcAnalyticsService(makePrisma())
      const dashboard = await service.getDashboard()
      expect(dashboard.source).toBe('demo')
      expect(dashboard.totalReports).toBeGreaterThan(100)
      expect(dashboard.totalDefects).toBeGreaterThan(0)
      expect(dashboard.defectRate).toBe(Math.round((dashboard.totalDefects / dashboard.totalReports) * 1000) / 10)
      expect(dashboard.qcRate).toBeGreaterThanOrEqual(0)
      expect(dashboard.qcRate).toBeLessThanOrEqual(100)
      expect(dashboard.timelyRate).toBeGreaterThan(0)
      expect(dashboard.timelyRate).toBeLessThanOrEqual(100)
      expect(dashboard.avgResponseMinutes).toBeGreaterThan(0)
      expect(dashboard.avgScore).toBeGreaterThan(0)
      expect(dashboard.loopClosed).toBeGreaterThan(0)
      expect(dashboard.closureRate).toBeGreaterThan(0)
    })

    it('buildDashboardData 确定性: 同输入同输出', () => {
      const records = buildSeedRecords()
      const a = buildDashboardData(records, [])
      const b = buildDashboardData(records, [])
      expect(a).toEqual(b)
    })
  })

  describe('6. 孤儿模块回退 (DB 不可用)', () => {
    it('种子可用: 缺陷池/整改任务/趋势/帕累托/科室全部可读', async () => {
      const service = new QcAnalyticsService(makePrisma())
      const defects = await service.listLoopDefects()
      expect(defects.data.length).toBeGreaterThan(0)
      expect(defects.source).toBe('demo')
      expect(defects.data.every((d) => d.typeLabel && d.message)).toBe(true)
      const items = await service.listLoopItems()
      expect(items.data.length).toBeGreaterThan(0)
      expect(items.data.some((i) => i.status === 'closed')).toBe(true)
      const byStatus = await service.listLoopItems('rechecking')
      expect(byStatus.data.every((i) => i.status === 'rechecking')).toBe(true)
      const detail = await service.getLoopItem(items.data[0]!.id)
      expect(detail.history.length).toBeGreaterThan(0)
      const trends = await service.getTrends('month')
      expect(trends.source).toBe('demo')
      expect(trends.points.length).toBeGreaterThan(0)
      const pareto = await service.getPareto()
      expect(pareto.items.length).toBeGreaterThan(0)
      const depts = await service.getDepartments()
      expect(depts.data.length).toBeGreaterThan(0)
    })

    it('未知整改任务 → NotFoundException', async () => {
      const service = new QcAnalyticsService(makePrisma())
      await expect(service.getLoopItem('it-UNKNOWN')).rejects.toBeInstanceOf(NotFoundException)
    })
  })
})
