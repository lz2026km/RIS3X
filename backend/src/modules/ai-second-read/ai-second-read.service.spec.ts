/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 7C (ai-second-read) - AI 二次检出 V2 服务测试
 * 覆盖:
 *   1. 确定性: 同输入两次检出 → 风险项/评分/统计完全一致 (无随机)
 *   2. 风险项边界: 类别 (漏诊/缺项/不一致) + 严重度 + 风险评分 0-100 + 风险等级边界
 *   3. 交互流: 忽略 / 采纳 / 加入报告 (状态迁移 + 复查记录 + 200 语义)
 *   4. 孤儿模块: 无 DB 可 seed 启动, 统计聚合正确
 */
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { AiSecondReadService, analyzeSecondReadText, riskLevelOf, riskScoreOf } from './ai-second-read.service'

const CLEAN_INPUT = {
  reportId: 'RPT-CLEAN-001',
  patientName: '测试患者',
  modality: 'CT',
  findings: '胸部CT平扫: 双肺纹理清晰, 未见实变影。主动脉未见增宽, 纵隔居中, 心影不大。双侧胸膜未见增厚, 未见胸腔积液。',
  diagnosis: '双肺及纵隔未见明确异常。',
  conclusion: '双肺及纵隔未见明确异常, 建议定期随访复查。',
  recommendations: '建议 1 年后随访复查胸部 CT。',
}

const RISKY_INPUT = {
  reportId: 'RPT-RISKY-001',
  patientName: '测试患者',
  modality: 'CT',
  findings: '左肺上叶见一结节影, 边界欠清, 邻近胸膜牵拉。',
  diagnosis: '左肺上叶结节, 恶性待排。',
  conclusion: '胸部未见明确异常。',
  recommendations: '',
}

describe('AiSecondReadService (Wave 7C AI 二次检出 V2)', () => {
  describe('1. 确定性: 同输入同输出', () => {
    it('同输入两次 analyze → 风险项/评分/特征统计完全一致 (忽略时间戳)', async () => {
      const service = new AiSecondReadService()
      const a = await service.analyze({ ...CLEAN_INPUT, reportId: 'RPT-DET-001' })
      const b = await service.analyze({ ...CLEAN_INPUT, reportId: 'RPT-DET-001' })
      const { createdAt: _ca, ...restA } = a
      const { createdAt: _cb, ...restB } = b
      expect(restA).toEqual(restB)
      expect(a.riskScore).toBe(b.riskScore)
      expect(a.riskItems.map((i) => i.title)).toEqual(b.riskItems.map((i) => i.title))
    })

    it('风险规则纯确定性: 同输入两次 analyzeSecondReadText 逐条一致', () => {
      const a = analyzeSecondReadText(RISKY_INPUT)
      const b = analyzeSecondReadText(RISKY_INPUT)
      expect(a.riskItems).toEqual(b.riskItems)
      expect(a.featureStats).toEqual(b.featureStats)
      expect(analyzeSecondReadText(RISKY_INPUT).riskItems.length).toBe(analyzeSecondReadText(RISKY_INPUT).riskItems.length)
    })

    it('不同报告文本产生不同的风险画像', () => {
      const clean = analyzeSecondReadText(CLEAN_INPUT)
      const risky = analyzeSecondReadText(RISKY_INPUT)
      expect(clean.riskItems.length).toBeLessThan(risky.riskItems.length)
      expect(clean.featureStats.textLength).not.toBe(risky.featureStats.textLength)
    })
  })

  describe('2. 风险项边界: 类别 / 严重度 / 评分', () => {
    it('漏诊风险: 所见含关键征象而结论未提及 → 类别 missed_finding + high', () => {
      const { riskItems } = analyzeSecondReadText({
        ...RISKY_INPUT,
        conclusion: '胸部未见明确异常。',
      })
      const missed = riskItems.filter((r) => r.category === 'missed_finding')
      expect(missed.length).toBeGreaterThan(0)
      for (const item of missed) {
        expect(item.severity).toBe('high')
        expect(item.suggestion).toBeTruthy()
        expect(item.evidence).toBeTruthy()
      }
    })

    it('描述缺项: 结论缺失 → description_gap + high; 随访缺失 → low', () => {
      const { riskItems } = analyzeSecondReadText({
        ...RISKY_INPUT,
        conclusion: '',
        recommendations: '',
      })
      const gapItems = riskItems.filter((r) => r.category === 'description_gap')
      expect(gapItems.some((g) => g.title.includes('诊断结论缺失'))).toBe(true)
      expect(gapItems.find((g) => g.title.includes('诊断结论缺失'))?.severity).toBe('high')
      const clean = analyzeSecondReadText({
        ...CLEAN_INPUT,
        recommendations: '',
        conclusion: '双肺及纵隔未见明确异常。',
      })
      const lowGap = clean.riskItems.find((g) => g.title.includes('随访建议'))
      expect(lowGap).toBeDefined()
      expect(lowGap?.severity).toBe('low')
    })

    it('结论不一致: 结论与所见矛盾 → conclusion_inconsistency', () => {
      const { riskItems } = analyzeSecondReadText({
        ...RISKY_INPUT,
        findings: '双肺纹理清晰, 未见异常。',
        conclusion: '左肺上叶结节, 考虑恶性可能。',
      })
      expect(riskItems.filter((r) => r.category === 'conclusion_inconsistency').length).toBeGreaterThan(0)
    })

    it('风险评分边界: 0-100, 高严重度扣分多于低严重度', () => {
      const high = riskScoreOf([{ severity: 'high' }, { severity: 'high' }])
      const low = riskScoreOf([{ severity: 'low' }, { severity: 'low' }])
      expect(high).toBeGreaterThanOrEqual(0)
      expect(high).toBeLessThanOrEqual(100)
      expect(high).toBeLessThan(low)
      expect(riskScoreOf([])).toBe(100)
      expect(riskScoreOf(Array.from({ length: 10 }, () => ({ severity: 'high' as const })))).toBe(0)
    })

    it('风险等级边界: ≥85 low, 60-84 medium, <60 high', () => {
      expect(riskLevelOf(100)).toBe('low')
      expect(riskLevelOf(85)).toBe('low')
      expect(riskLevelOf(84)).toBe('medium')
      expect(riskLevelOf(60)).toBe('medium')
      expect(riskLevelOf(59)).toBe('high')
      expect(riskLevelOf(0)).toBe('high')
    })

    it('reportId 缺失 → BadRequestException', async () => {
      const service = new AiSecondReadService()
      await expect(service.analyze({ reportId: '' })).rejects.toBeInstanceOf(BadRequestException)
    })
  })

  describe('3. 交互流: 忽略 / 采纳 / 加入报告', () => {
    it('忽略风险项 → status ignored + 复查记录 (reviewedBy/reviewedAt)', async () => {
      const service = new AiSecondReadService()
      const result = await service.analyze({ ...RISKY_INPUT, reportId: 'RPT-FLOW-001' })
      expect(result.riskItems.length).toBeGreaterThan(0)
      const target = result.riskItems[0]!
      const updated = service.ignoreRiskItem(result.id, target.id, '李医生')
      const item = updated.riskItems.find((i) => i.id === target.id)!
      expect(item.status).toBe('ignored')
      expect(item.handledBy).toBe('李医生')
      expect(item.handledAt).toBeTruthy()
      expect(updated.reviewedBy).toBe('李医生')
      expect(updated.reviewedAt).toBeTruthy()
    })

    it('采纳风险项 → status adopted, 其余风险项保持 open', async () => {
      const service = new AiSecondReadService()
      const result = await service.analyze({ ...RISKY_INPUT, reportId: 'RPT-FLOW-002' })
      const target = result.riskItems[1] ?? result.riskItems[0]!
      const updated = service.adoptRiskItem(result.id, target.id, '张医生')
      const adopted = updated.riskItems.find((i) => i.id === target.id)!
      expect(adopted.status).toBe('adopted')
      const open = updated.riskItems.filter((i) => i.status === 'open')
      expect(open.length).toBe(result.riskItems.length - 1)
    })

    it('加入报告 → appendedText 写入 + 开放风险项置 appended', async () => {
      const service = new AiSecondReadService()
      const result = await service.analyze({ ...RISKY_INPUT, reportId: 'RPT-FLOW-003' })
      const updated = service.appendToReport(result.id, { reviewer: '王医生', appendedText: '建议 3 个月后低剂量 CT 随访复查。' })
      expect(updated.appendedText).toBe('建议 3 个月后低剂量 CT 随访复查。')
      expect(updated.appendedAt).toBeTruthy()
      expect(updated.riskItems.every((i) => i.status !== 'open')).toBe(true)
      expect(updated.riskItems.some((i) => i.status === 'appended')).toBe(true)
    })

    it('未知风险项 / 未知结果 → NotFoundException; 空 reviewer → BadRequestException', async () => {
      const service = new AiSecondReadService()
      const result = await service.analyze({ ...RISKY_INPUT, reportId: 'RPT-FLOW-004' })
      expect(() => service.ignoreRiskItem(result.id, 'no-such-item', '李医生')).toThrow(NotFoundException)
      expect(() => service.ignoreRiskItem('no-such-result', result.riskItems[0]!.id, '李医生')).toThrow(NotFoundException)
      expect(() => service.ignoreRiskItem(result.id, result.riskItems[0]!.id, '')).toThrow(BadRequestException)
      expect(() => service.appendToReport(result.id, { reviewer: '王医生', appendedText: '' })).toThrow(BadRequestException)
    })

    it('交互流返回 200 语义: 每次操作返回完整 updated 结果对象', async () => {
      const service = new AiSecondReadService()
      const result = await service.analyze({ ...RISKY_INPUT, reportId: 'RPT-FLOW-005' })
      const adopted = service.adoptRiskItem(result.id, result.riskItems[0]!.id, '赵医生')
      expect(adopted).toMatchObject({ id: result.id, reportId: 'RPT-FLOW-005', status: 'completed' })
      expect(adopted.riskItems[0]!.status).toBe('adopted')
      const appended = service.appendToReport(result.id, { reviewer: '赵医生', appendedText: '补充复查建议。' })
      expect(appended.appendedText).toBeTruthy()
    })
  })

  describe('4. 孤儿模块: seed 回退 + 统计', () => {
    it('无 DB 构造服务 → seed 结果可用 (listResults 非空, getResult 可查)', () => {
      const service = new AiSecondReadService()
      const list = service.listResults()
      expect(list.length).toBeGreaterThan(0)
      const first = service.getResult(list[0]!.id)
      expect(first.id).toBe(list[0]!.id)
      expect(() => service.getResult('no-such')).toThrow(NotFoundException)
    })

    it('统计: 平均分 0-100, 类别/严重度分布与风险项总数一致', async () => {
      const service = new AiSecondReadService()
      await service.analyze({ ...RISKY_INPUT, reportId: 'RPT-STAT-001' })
      const stats = service.getStats()
      expect(stats.total).toBeGreaterThan(0)
      expect(stats.avgRiskScore).toBeGreaterThanOrEqual(0)
      expect(stats.avgRiskScore).toBeLessThanOrEqual(100)
      const totalByCategory = stats.byCategory.reduce((a, c) => a + c.count, 0)
      const totalBySeverity = stats.bySeverity.reduce((a, s) => a + s.count, 0)
      expect(totalByCategory).toBe(totalBySeverity)
      expect(stats.openRiskItems + stats.handledRiskItems).toBe(totalByCategory)
      expect(stats.byCategory).toHaveLength(3)
      expect(stats.bySeverity).toHaveLength(3)
    })
  })
})
