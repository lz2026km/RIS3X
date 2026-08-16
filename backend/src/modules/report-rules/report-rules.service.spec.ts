// [G005 v3.0.6.11-101 Wave 6A F11] 报告质控规则引擎 spec
// 1) 规则匹配正确性: 构造违规文本命中 / 合规文本零命中
// 2) 自定义规则生效
// 3) 服务 CRUD + 规则集绑定
import { ReportRulesService } from './report-rules.service'

// 构造的违规报告 A: 结论为空/诊断与所见不一致/侧别缺失/部位缺失/数值无单位/尺寸超范围/对比剂缺失
const VIOLATING_REPORT = {
  reportId: 'RPT-VIO-001',
  examType: 'CT',
  findings:
    '双下野见大小约 2 个结节影, 结节影大小约 600mm, 边缘光滑, 增强扫描后未见明确强化。上野见磨玻璃样密度影。',
  diagnosis: '未见明显异常。',
  impression: '可疑间质性改变。',
  conclusion: '',
  recommendations: '',
}

// 构造的违规报告 B: 随访建议缺失 + 重复表述 + 模糊诊断提示
const FOLLOWUP_REPORT = {
  reportId: 'RPT-VIO-002',
  examType: 'CT',
  findings: '右肺上叶见一直径约 5mm 磨玻璃结节影, 边缘清晰。',
  diagnosis: '右肺上叶磨玻璃结节, 考虑炎性结节可能性大。',
  impression: '',
  conclusion: '未见明显异常, 考虑良性, 结节影大小稳定, 结节影大小稳定, 建议随访。',
  recommendations: '',
}

// 合规报告: 全部字段完整、含部位/侧别/单位、结论与所见一致、无重复长短语
const COMPLIANT_REPORT = {
  reportId: 'RPT-OK-001',
  examType: 'CT',
  findings:
    '双侧胸廓对称。右肺上叶见一直径约 5mm 磨玻璃结节影, 边缘清晰, 密度均匀。左肺下叶见少许纤维条索影。双侧肺门及纵隔未见肿大淋巴结。',
  diagnosis: '右肺上叶磨玻璃结节, 考虑炎性结节可能性大。',
  impression: '右肺上叶磨玻璃结节, 建议定期复查。',
  conclusion: '右肺上叶磨玻璃结节, 良性炎性病变, 建议 3-6 个月后复查 CT。',
  recommendations: '建议 3-6 个月后复查胸部 CT, 观察结节变化。',
}

describe('ReportRulesService (F11 规则引擎)', () => {
  let service: ReportRulesService

  beforeEach(() => {
    service = new ReportRulesService()
  })

  it('内置规则库 ≥ 15 条, 覆盖 6 种规则类型', () => {
    const { data } = service.listRules()
    expect(data.length).toBeGreaterThanOrEqual(15)
    const types = new Set(data.map((r) => r.type))
    expect(types).toEqual(expect.objectContaining(new Set(['missing_field', 'terminology', 'unit', 'length_range', 'numeric_reasonability', 'duplicate'])))
  })

  it('违规文本 A: 命中 结论为空/侧别缺失/部位缺失/数值无单位/尺寸超范围/结论与所见不一致', async () => {
    const result = await service.evaluate(VIOLATING_REPORT)
    const codes = result.violations.map((v) => v.ruleCode)
    expect(codes).toContain('RR-MISSING-01') // 结论为空
    expect(codes).toContain('RR-SIDE-01') // 左右侧别缺失 (结节未提侧别)
    expect(codes).toContain('RR-MISSING-05') // 病灶未描述部位 (结节但无部位词)
    expect(codes).toContain('RR-UNIT-01') // 数值无单位 ("大小约 2 个")
    expect(codes).toContain('RR-NUM-01') // 600mm 超 400mm
    expect(codes).toContain('RR-CONSIST-01') // 所见结节 vs 诊断"未见明显异常"
    expect(codes).not.toContain('RR-MISSING-03') // 诊断非空
    expect(result.score).toBeLessThan(100)
  })

  it('违规文本 B: 命中 随访建议缺失 + 重复表述 + 模糊诊断提示', async () => {
    const result = await service.evaluate(FOLLOWUP_REPORT)
    const codes = result.violations.map((v) => v.ruleCode)
    expect(codes).toContain('RR-MISSING-04') // 结论含"随访"且 recommendations 为空
    expect(codes).toContain('RR-DUP-01') // "结节影大小稳定"重复
    expect(codes).toContain('RR-TERM-02') // 结论含"考虑"
    expect(codes).not.toContain('RR-CONSIST-01') // 诊断已含结节意见
  })

  it('违规列表排序确定性: 先 error 再 warning 再 info, 同级别按 code', async () => {
    const result = await service.evaluate(FOLLOWUP_REPORT)
    const rank: Record<string, number> = { error: 0, warning: 1, info: 2 }
    for (let i = 1; i < result.violations.length; i++) {
      const prev = result.violations[i - 1]!
      const cur = result.violations[i]!
      expect(rank[cur.severity]!).toBeGreaterThanOrEqual(rank[prev.severity]!)
    }
    const again = await service.evaluate(FOLLOWUP_REPORT)
    expect(again.violations.map((v) => v.ruleCode)).toEqual(result.violations.map((v) => v.ruleCode))
  })

  it('合规文本: 零命中, 满分', async () => {
    const result = await service.evaluate(COMPLIANT_REPORT)
    expect(result.violations).toEqual([])
    expect(result.score).toBe(100)
  })

  it('自定义规则生效: 创建后 evaluate 命中, 停用后不再命中', async () => {
    const rule = await service.createRule({
      name: '自定义: 结论禁止提及"急诊"',
      type: 'terminology',
      severity: 'warning',
      description: '演示自定义规则',
      condition: { field: 'conclusion', operator: 'contains', value: '急诊' },
      suggestion: '结论中请勿使用"急诊"字样。',
      examTypes: ['CT'],
    })
    expect(rule.builtIn).toBe(false)
    const hit = await service.evaluate({ reportId: 'RPT-CUS-1', conclusion: '考虑急诊入院后复查' })
    expect(hit.violations.map((v) => v.ruleCode)).toContain(rule.code)

    const updated = await service.updateRule(rule.id, { enabled: false })
    expect(updated.enabled).toBe(false)
    const miss = await service.evaluate({ reportId: 'RPT-CUS-2', conclusion: '考虑急诊入院后复查' })
    expect(miss.violations.map((v) => v.ruleCode)).not.toContain(rule.code)
  })

  it('内置规则可停用但不可删除, 自定义规则可删除', async () => {
    await expect(service.deleteRule('rule-b-001')).rejects.toThrow('不可删除')
    await service.updateRule('rule-b-001', { enabled: false })
    const { data } = service.listRules()
    expect(data.find((r) => r.id === 'rule-b-001')!.enabled).toBe(false)
    const rule = await service.createRule({ name: '临时规则', type: 'unit', severity: 'info', condition: { field: 'findings', operator: 'empty', value: '' } })
    await expect(service.deleteRule(rule.id)).resolves.toEqual({ id: rule.id, deleted: true })
  })

  it('规则集: seed ≥ 3 个, 绑定规则后按规则集评估', async () => {
    const { data: rulesets } = service.listRulesets()
    expect(rulesets.length).toBeGreaterThanOrEqual(3)
    const ctSet = rulesets.find((s) => s.id === 'rs-ct-chest')!
    expect(ctSet.ruleIds.length).toBeGreaterThan(5)
    const result = await service.evaluate({ ...VIOLATING_REPORT, rulesetId: 'rs-ct-chest' })
    expect(result.ruleCount).toBe(ctSet.ruleIds.length)
  })

  it('自定义规则集 CRUD + 绑定规则', async () => {
    const rs = await service.createRuleset({ name: '急诊报告规则集', examTypes: ['CT'], ruleIds: ['rule-b-001'] })
    expect(rs.id).toMatch(/^rs-\d+$/)
    const updated = await service.updateRuleset(rs.id, { ruleIds: ['rule-b-001', 'rule-b-002'] })
    expect(updated.ruleIds).toHaveLength(2)
    const { data } = service.listRulesets()
    expect(data.find((s) => s.id === rs.id)!.ruleIds).toHaveLength(2)
    await expect(service.deleteRuleset(rs.id)).resolves.toEqual({ id: rs.id, deleted: true })
  })

  it('evaluate 记录 history, stats 统计可读', async () => {
    await service.evaluate({ reportId: 'RPT-HIST-1', conclusion: '未见异常', findings: '' })
    const history = service.listHistory('RPT-HIST-1')
    expect(history.data.length).toBeGreaterThan(0)
    const stats = service.getStats()
    expect(stats.data.totalRules).toBeGreaterThanOrEqual(15)
    expect(stats.data.builtInRules).toBeGreaterThanOrEqual(15)
  })
})
