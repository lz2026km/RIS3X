// [v3.0.6.11-103 Wave 17] SNOMED/ICD 自动编码 spec
// 1) 提取正确性: 报告文本 → 诊断词提取 (最长匹配/区间去重/分节)
// 2) 编码确定性: 相同输入恒得相同 SNOMED + ICD-10 建议
import { SnomedService, extractDiagnosisTerms, splitSections } from './snomed.service'

const REPORT_TEXT = `【所见】右肺上叶见一磨玻璃结节影,大小约1.2cm×0.9cm,边缘见毛刺征,邻近胸膜牵拉。左肺下叶散在条索影。
【印象】右肺上叶磨玻璃结节,考虑早期肺癌可能,建议定期随访。
【结论】右肺上叶磨玻璃结节,建议3个月后复查CT。`

describe('SnomedService 自动编码 (Wave 17)', () => {
  let svc: SnomedService

  beforeEach(() => {
    svc = new SnomedService()
  })

  it('提取正确性: 命中 磨玻璃/结节/毛刺征, 且输出稳定有序', () => {
    const terms = extractDiagnosisTerms('右肺上叶见一磨玻璃结节影,边缘见毛刺征', 'findings')
    const keywords = terms.map((t) => t.keyword)
    expect(keywords).toContain('磨玻璃')
    expect(keywords).toContain('毛刺征')
    expect(terms.every((t) => t.matched)).toBe(true)
    expect(terms.every((t) => t.section === 'findings')).toBe(true)
    // 位置递增
    expect(terms.every((t, i) => i === 0 || t.start >= terms[i - 1]!.start)).toBe(true)
  })

  it('区间去重: 长词优先, 覆盖区间内不再重复匹配短词', () => {
    const terms = extractDiagnosisTerms('右肺上叶见一磨玻璃结节影', 'findings')
    const keywords = terms.map((t) => t.keyword)
    // "磨玻璃结节影" 区间内 "磨玻璃" 与 "结节" 重叠 → 只保留一次命中
    expect(keywords.some((k) => k === '磨玻璃' || k === '结节')).toBe(true)
    const overlapping = terms.filter(
      (t, i) => terms.some((other, j) => i !== j && t.start < other.end && t.end > other.start),
    )
    expect(overlapping).toHaveLength(0)
  })

  it('autoEncode 全流程: 分节提取 + SNOMED/ICD-10 双编码建议', async () => {
    const res = await svc.autoEncode(REPORT_TEXT)
    expect(res.total).toBeGreaterThanOrEqual(3)
    const impression = res.terms.find((t) => t.section === 'impression')
    expect(impression).toBeDefined()
    const nodule = res.terms.find((t) => t.snomed.some((s) => s.conceptId === '30092000'))
    expect(nodule).toBeDefined()
    expect(nodule!.icd10.some((c) => c.code === 'R91.1')).toBe(true)
    const ggo = res.terms.find((t) => t.snomed.some((s) => s.conceptId === '427283000'))
    expect(ggo).toBeDefined()
  })

  it('编码确定性: 相同输入两次调用结果完全一致', async () => {
    const a = await svc.autoEncode(REPORT_TEXT)
    const b = await svc.autoEncode(REPORT_TEXT)
    expect(a).toEqual(b)
    expect(a.terms.map((t) => t.confidence)).toEqual(b.terms.map((t) => t.confidence))
  })

  it('空文本与无关文本: 返回空 terms 不报错', async () => {
    const empty = await svc.autoEncode('')
    expect(empty.total).toBe(0)
    const unrelated = await svc.autoEncode('患者一般情况良好,无特殊不适。')
    expect(unrelated.total).toBe(0)
  })

  it('splitSections: 【所见】/【印象】/【结论】 分块正确', () => {
    const sections = splitSections(REPORT_TEXT)
    expect(sections.map((s) => s.key)).toContain('findings')
    expect(sections.map((s) => s.key)).toContain('impression')
    expect(sections.map((s) => s.key)).toContain('conclusion')
    expect(sections.find((s) => s.key === 'impression')?.text).toContain('磨玻璃结节')
  })

  it('既有端点回归: encode/search 不受影响', async () => {
    const encoded = await svc.encode('右肺上叶磨玻璃结节')
    expect(encoded.codes.some((c) => c.conceptId === '30092000')).toBe(true)
    const found = await svc.search('nodule')
    expect(found.length).toBeGreaterThan(0)
  })
})
