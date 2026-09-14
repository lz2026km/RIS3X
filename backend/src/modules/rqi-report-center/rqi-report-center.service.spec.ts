/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 2A - 国家上报中心服务测试
 * 覆盖:
 *   1. 批次生成含 7 指标 + 确定性 (同周期同输入同输出)
 *   2. 状态机: DRAFT→SUBMITTED→ACCEPTED 合法; 非法流转 400; REJECTED→DRAFT 可重报
 *   3. CSV (含 BOM) / JSON 导出内容含指标编码与比率; contentHash 确定性
 *   4. 回执写入 receiptNo; 历史 / 统计正确
 *   5. 孤儿模块 seed 回退 (无 DB 可启动) 与 404
 */
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { Rqi2024Service } from '../rqi-2024/rqi-2024.service'
import { INDICATOR_CODES } from '../rqi-2024/rqi-2024.types'
import { RqiReportCenterService, computeContentHash } from './rqi-report-center.service'
import { canTransition } from './rqi-report-center.types'

function newService(): RqiReportCenterService {
  return new RqiReportCenterService(new Rqi2024Service())
}

describe('RqiReportCenterService (Wave 2A 国家上报中心)', () => {
  describe('1. 批次生成含 7 指标 + 确定性', () => {
    it('createBatch 返回 DRAFT + 7 指标明细 (编码/分子/分母/比率/单位/目标/达标)', async () => {
      const svc = newService()
      const batch = await svc.createBatch({ period: '2026-08', createdBy: '质控科-张医师' })
      expect(batch.status).toBe('DRAFT')
      expect(batch.period).toBe('2026-08')
      expect(batch.periodLabel).toBe('2026-08')
      expect(batch.granularity).toBe('month')
      expect(batch.createdBy).toBe('质控科-张医师')
      expect(batch.submittedAt).toBeNull()
      expect(batch.receiptAt).toBeNull()
      expect(batch.receiptNo).toBeNull()
      expect(batch.indicators).toHaveLength(7)
      expect(batch.indicators.map((i) => i.code)).toEqual([...INDICATOR_CODES])
      for (const i of batch.indicators) {
        expect(i.name).toBeTruthy()
        expect(typeof i.numerator).toBe('number')
        expect(i.denominator).toBeGreaterThan(0)
        expect(typeof i.rate).toBe('number')
        expect(['%', '‰']).toContain(i.unit)
        expect(typeof i.target).toBe('number')
        expect(['pass', 'warn', 'fail']).toContain(i.status)
        expect(i.standard).toContain('150')
      }
    })

    it('确定性: 同周期同输入 → indicators / contentHash 完全一致', async () => {
      const svc = newService()
      const a = await svc.createBatch({ period: '2026-08', createdBy: 'tester' })
      const b = await svc.createBatch({ period: '2026-08', createdBy: 'tester' })
      expect(a.id).not.toBe(b.id)
      expect(a.indicators).toEqual(b.indicators)
      expect(a.contentHash).toBe(b.contentHash)
      expect(a.fileName).toBe(b.fileName)
      expect(a.contentHash).toMatch(/^[0-9a-f]{16}$/)
    })

    it('period 支持月/季/年粒度关键字 (解析到 anchor 最新周期)', async () => {
      const svc = newService()
      const monthly = await svc.createBatch({ period: 'month', createdBy: 'tester' })
      expect(monthly.granularity).toBe('month')
      expect(monthly.periodLabel).toMatch(/^\d{4}-\d{2}$/)
      const quarterly = await svc.createBatch({ period: 'quarter', createdBy: 'tester' })
      expect(quarterly.granularity).toBe('quarter')
      expect(quarterly.periodLabel).toMatch(/^\d{4}-Q[1-4]$/)
      const yearly = await svc.createBatch({ period: 'year', createdBy: 'tester' })
      expect(yearly.granularity).toBe('year')
      expect(yearly.periodLabel).toMatch(/^\d{4}$/)
    })

    it('非法周期 / 空 createdBy → 400', async () => {
      const svc = newService()
      await expect(svc.createBatch({ period: 'garbage', createdBy: 'tester' })).rejects.toBeInstanceOf(BadRequestException)
      await expect(svc.createBatch({ period: '2026-08', createdBy: '   ' })).rejects.toBeInstanceOf(BadRequestException)
    })
  })

  describe('2. 状态机门禁', () => {
    it('DRAFT→SUBMITTED→ACCEPTED 合法, 回执号写入', async () => {
      const svc = newService()
      const created = await svc.createBatch({ period: '2026-08', createdBy: 'tester' })
      const submitted = await svc.submitBatch(created.id)
      expect(submitted.status).toBe('SUBMITTED')
      expect(submitted.submittedAt).toBeTruthy()
      const accepted = await svc.acceptBatch(created.id, { receiptNo: 'GJ-2026-08-0001', remark: '回执已收取' })
      expect(accepted.status).toBe('ACCEPTED')
      expect(accepted.receiptNo).toBe('GJ-2026-08-0001')
      expect(accepted.receiptAt).toBeTruthy()
      expect(accepted.remark).toBe('回执已收取')
      expect((await svc.getBatch(created.id)).receiptNo).toBe('GJ-2026-08-0001')
    })

    it('非法流转 400: DRAFT→ACCEPTED / ACCEPTED→SUBMITTED / DRAFT→REJECTED', async () => {
      const svc = newService()
      const a = await svc.createBatch({ period: '2026-08', createdBy: 'tester' })
      await expect(svc.acceptBatch(a.id, { receiptNo: 'X-1' })).rejects.toBeInstanceOf(BadRequestException)
      await expect(svc.rejectBatch(a.id, { reason: '口径不符' })).rejects.toBeInstanceOf(BadRequestException)

      const b = await svc.createBatch({ period: '2026-08', createdBy: 'tester' })
      await svc.submitBatch(b.id)
      await svc.acceptBatch(b.id, { receiptNo: 'X-2' })
      await expect(svc.submitBatch(b.id)).rejects.toBeInstanceOf(BadRequestException)
      await expect(svc.reopenBatch(b.id)).rejects.toBeInstanceOf(BadRequestException)
    })

    it('REJECTED→DRAFT 可重报, 重报后回到 SUBMITTED', async () => {
      const svc = newService()
      const created = await svc.createBatch({ period: '2026-08', createdBy: 'tester' })
      await svc.submitBatch(created.id)
      const rejected = await svc.rejectBatch(created.id, { reason: 'ICME-05 分母口径需复核' })
      expect(rejected.status).toBe('REJECTED')
      expect(rejected.rejectReason).toContain('ICME-05')
      expect(rejected.receiptAt).toBeTruthy()

      const reopened = await svc.reopenBatch(created.id)
      expect(reopened.status).toBe('DRAFT')
      expect(reopened.submittedAt).toBeNull()
      expect(reopened.receiptAt).toBeNull()
      expect(reopened.rejectReason).toBeNull()

      const resubmitted = await svc.submitBatch(created.id)
      expect(resubmitted.status).toBe('SUBMITTED')
    })

    it('流转表与同态幂等', () => {
      expect(canTransition('DRAFT', 'SUBMITTED')).toBe(true)
      expect(canTransition('SUBMITTED', 'ACCEPTED')).toBe(true)
      expect(canTransition('SUBMITTED', 'REJECTED')).toBe(true)
      expect(canTransition('REJECTED', 'DRAFT')).toBe(true)
      expect(canTransition('DRAFT', 'ACCEPTED')).toBe(false)
      expect(canTransition('ACCEPTED', 'SUBMITTED')).toBe(false)
    })

    it('未知批次 → 404', async () => {
      const svc = newService()
      await expect(svc.getBatch('rrc-missing')).rejects.toBeInstanceOf(NotFoundException)
      await expect(svc.submitBatch('rrc-missing')).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('3. 导出 (CSV/JSON) 与 contentHash 确定性', () => {
    it('CSV 含 BOM + 表头 + 7 行, 内容含指标编码与比率', async () => {
      const svc = newService()
      const batch = await svc.createBatch({ period: '2026-08', createdBy: 'tester' })
      const csv = await svc.exportBatch(batch.id, 'csv')
      expect(csv.format).toBe('csv')
      expect(csv.content.startsWith('\ufeff')).toBe(true)
      expect(csv.filename).toMatch(/^rqi-report-center-.*\.csv$/)
      expect(csv.content).toContain('指标编码')
      expect(csv.content).toContain('RQI-IIA-01')
      const iia = batch.indicators.find((i) => i.code === 'RQI-IIA-01')!
      expect(csv.content).toContain(String(iia.rate))
      expect(csv.content).toContain(String(iia.numerator))
      expect(csv.content).toContain(batch.contentHash)
      expect(csv.contentHash).toBe(batch.contentHash)
    })

    it('JSON 可解析且含 7 指标 + contentHash', async () => {
      const svc = newService()
      const batch = await svc.createBatch({ period: '2026-08', createdBy: 'tester' })
      const json = await svc.exportBatch(batch.id, 'json')
      expect(json.filename).toMatch(/\.json$/)
      const parsed = JSON.parse(json.content) as { period: string; contentHash: string; indicators: unknown[] }
      expect(parsed.period).toBe('2026-08')
      expect(parsed.contentHash).toBe(batch.contentHash)
      expect(parsed.indicators).toHaveLength(7)
      expect(json.contentHash).toBe(batch.contentHash)
    })

    it('contentHash 确定性 (同周期同输入) 且等于纯函数重算值', async () => {
      const svc = newService()
      const a = await svc.createBatch({ period: '2026-07', createdBy: 'tester' })
      const b = await svc.createBatch({ period: '2026-07', createdBy: 'tester' })
      expect(a.contentHash).toBe(b.contentHash)
      expect(computeContentHash(a.periodLabel, a.indicators)).toBe(a.contentHash)
      expect(computeContentHash(b.periodLabel, b.indicators)).toBe(b.contentHash)
    })
  })

  describe('4. 历史 / 统计', () => {
    it('无内存批次时回退确定性 seed (3 个批次)', async () => {
      const svc = newService()
      const list = await svc.listBatches()
      expect(list.source).toBe('seed')
      expect(list.total).toBe(3)
      expect(list.items.map((b) => b.status)).toEqual(['SUBMITTED', 'REJECTED', 'ACCEPTED'])
      const detail = await svc.getBatch('rrc-seed-2026-06')
      expect(detail.indicators).toHaveLength(7)
      expect(detail.contentHash).toMatch(/^[0-9a-f]{16}$/)
    })

    it('历史含状态与回执, 周期倒序', async () => {
      const svc = newService()
      const history = await svc.getHistory()
      expect(history.source).toBe('seed')
      expect(history.total).toBe(3)
      const labels = history.items.map((h) => h.periodLabel)
      expect(labels).toEqual([...labels].sort().reverse())
      const accepted = history.items.find((h) => h.status === 'ACCEPTED')!
      expect(accepted.receiptNo).toBe('GJ-RQI-2026-06-0001')
      expect(accepted.receiptAt).toBeTruthy()
      const rejected = history.items.find((h) => h.status === 'REJECTED')!
      expect(rejected.rejectReason).toBeTruthy()
    })

    it('统计: 批次数 / 各状态数 / 最近上报 / 按时上报率', async () => {
      const svc = newService()
      const stats = await svc.getStats()
      expect(stats.source).toBe('seed')
      expect(stats.total).toBe(3)
      expect(stats.byStatus).toEqual({ DRAFT: 0, SUBMITTED: 1, ACCEPTED: 1, REJECTED: 1 })
      expect(stats.draftCount).toBe(0)
      expect(stats.acceptedCount).toBe(1)
      expect(stats.rejectedCount).toBe(1)
      expect(stats.reportableCount).toBe(3)
      expect(stats.onTimeCount).toBe(2)
      expect(stats.onTimeRate).toBe(66.7)
      expect(stats.latest).not.toBeNull()
      expect(stats.latest!.periodLabel).toBe('2026-08')
    })

    it('内存批次优先于 seed: createBatch 后 source=memory', async () => {
      const svc = newService()
      await svc.createBatch({ period: '2026-08', createdBy: 'tester' })
      const list = await svc.listBatches()
      expect(list.source).toBe('memory')
      expect(list.total).toBe(1)
      const stats = await svc.getStats()
      expect(stats.source).toBe('memory')
      expect(stats.draftCount).toBe(1)
    })

    it('列表支持状态/周期筛选与分页', async () => {
      const svc = newService()
      await svc.createBatch({ period: '2026-06', createdBy: 'tester' })
      const july = await svc.createBatch({ period: '2026-07', createdBy: 'tester' })
      await svc.submitBatch(july.id)

      const drafts = await svc.listBatches({ status: 'DRAFT' })
      expect(drafts.total).toBe(1)
      expect(drafts.items[0]!.periodLabel).toBe('2026-06')

      const julyOnly = await svc.listBatches({ period: '2026-07' })
      expect(julyOnly.total).toBe(1)
      expect(julyOnly.items[0]!.status).toBe('SUBMITTED')

      const paged = await svc.listBatches({ page: 2, pageSize: 1 })
      expect(paged.page).toBe(2)
      expect(paged.pageSize).toBe(1)
      expect(paged.total).toBe(2)
      expect(paged.items).toHaveLength(1)
      expect(paged.items[0]!.periodLabel).toBe('2026-06')
    })
  })
})
