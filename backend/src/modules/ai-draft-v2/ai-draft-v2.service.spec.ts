/**
 * G005 RIS v3.0.6.11-101 Wave 7A — AiDraftV2Service 规格
 * 覆盖: 字段提取正确性 / 草稿生成确定性 / 溯源结构完整 / 修改建议规则 / seed 回退
 */
import { AiDraftV2Service, type GenerateDraftV2Request } from './ai-draft-v2.service'
import { extractStructuredFields } from './field-extractor'
import { buildSuggestions } from './suggestions'

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const base = {
    report: { findFirst: jest.fn().mockRejectedValue(new Error('no db')) },
    aiReportDraft: { create: jest.fn().mockRejectedValue(new Error('no db')) },
  }
  return { ...base, ...overrides } as never
}

const POSITIVE_TEXT = '右肺上叶可见大小约18mm×15mm结节影，边缘毛刺，与既往检查相比无明显变化，考虑周围型肺癌可能，建议定期随访。'
const NEGATIVE_TEXT = '双肺纹理清晰，走行自然，肺野透亮度正常，未见明显异常密度影，所见符合正常胸部CT表现。'

const draftRequest: GenerateDraftV2Request = {
  patientId: 'P001',
  examId: 'EXAM-1',
  modality: 'CT',
  bodyPart: '胸部',
  findings: POSITIVE_TEXT,
  clinicalHistory: '咳嗽两周',
  keywords: ['肺结节', '随访'],
}

describe('AiDraftV2Service (modules/ai-draft-v2)', () => {
  let service: AiDraftV2Service

  beforeEach(() => {
    service = new AiDraftV2Service(makePrisma())
  })

  describe('结构化字段自动提取', () => {
    it('阳性文本提取出 部位/征象/测量值/对比/结论 五类字段', async () => {
      const result = await service.extractFields({ findings: POSITIVE_TEXT, modality: 'CT', bodyPart: '胸部' })
      expect(result.categoriesFound).toContain('bodyPart')
      expect(result.categoriesFound).toContain('finding')
      expect(result.categoriesFound).toContain('measurement')
      expect(result.categoriesFound).toContain('comparison')
      expect(result.categoriesFound).toContain('conclusion')

      const size = result.fields.find((f) => f.category === 'measurement' && f.ruleId === 'measurement:size-axb')
      expect(size).toBeDefined()
      expect(size!.value).toMatch(/18mm/)
      const comparison = result.fields.find((f) => f.category === 'comparison')
      expect(comparison!.value).toContain('与既往相比')
      const conclusion = result.fields.find((f) => f.category === 'conclusion')
      expect(conclusion!.value).toContain('考虑')
    })

    it('阴性文本不产生阳性征象, 产生阴性征象与阴性结论', async () => {
      const result = await service.extractFields({ findings: NEGATIVE_TEXT, modality: 'CT', bodyPart: '胸部' })
      const finding = result.fields.find((f) => f.category === 'finding')
      expect(finding).toBeDefined()
      expect(finding!.value).toContain('未见')
      expect(result.fields.every((f) => f.category !== 'conclusion' || /未见|正常/.test(f.value))).toBe(true)
    })

    it('同一输入两次提取结果完全一致 (确定性, 无随机; 忽略生成时间)', async () => {
      const a = await service.extractFields({ findings: POSITIVE_TEXT, modality: 'CT', bodyPart: '胸部' })
      const b = await service.extractFields({ findings: POSITIVE_TEXT, modality: 'CT', bodyPart: '胸部' })
      const { generatedAt: _ga, ...restA } = a
      const { generatedAt: _gb, ...restB } = b
      expect(restA).toEqual(restB)
    })

    it('每个字段置信度在 (0, 1] 且带可追溯 id/ruleId/evidence', async () => {
      const result = await service.extractFields({ findings: POSITIVE_TEXT })
      expect(result.fields.length).toBeGreaterThan(0)
      for (const f of result.fields) {
        expect(f.confidence).toBeGreaterThan(0)
        expect(f.confidence).toBeLessThanOrEqual(1)
        expect(f.id).toMatch(/^fld-/)
        expect(f.ruleId.length).toBeGreaterThan(0)
        expect(f.evidence.length).toBeGreaterThan(0)
        expect(f.source).toMatch(/dictionary|rule/)
      }
    })

    it('空文本返回空字段且 overallConfidence=0', async () => {
      const result = await service.extractFields({ findings: '' })
      expect(result.fields).toEqual([])
      expect(result.overallConfidence).toBe(0)
    })
  })

  describe('多模态草稿生成', () => {
    it('同一 request 两次生成段落 id/内容/置信度完全一致 (无随机)', async () => {
      const prisma = makePrisma({
        report: { findFirst: jest.fn().mockResolvedValue({ id: 'rep-1' }) },
        aiReportDraft: { create: jest.fn().mockResolvedValue({ id: 'ad-1' }) },
      })
      const svc = new AiDraftV2Service(prisma)
      const a = await svc.generateDraft(draftRequest)
      const b = await svc.generateDraft(draftRequest)
      const { generatedAt: _ga, ...restA } = a
      const { generatedAt: _gb, ...restB } = b
      expect(restA).toEqual(restB)
      expect(a.id).toBe(b.id)
      expect(a.overallConfidence).toBe(b.overallConfidence)
    })

    it('按检查类型选择模板: CT/MR/DR/US 技术描述不同', async () => {
      const cases = [
        { modality: 'CT', bodyPart: '胸部', expect: 'CT' },
        { modality: 'MR', bodyPart: '头颅', expect: 'T1WI' },
        { modality: 'DR', bodyPart: '胸部', expect: '正位' },
        { modality: 'US', bodyPart: '甲状腺', expect: '超声' },
      ]
      for (const c of cases) {
        const result = await service.generateDraft({ ...draftRequest, modality: c.modality, bodyPart: c.bodyPart, findings: undefined })
        const technique = result.segments.find((s) => s.paragraphType === 'technique')!.content
        expect(technique).toContain(c.expect)
        expect(result.segments.some((s) => s.paragraphType === 'conclusion')).toBe(true)
      }
    })

    it('未知模态回退通用模板且标记 generic 溯源', async () => {
      const result = await service.generateDraft({ ...draftRequest, modality: 'XX', bodyPart: '未知' })
      const technique = result.segments.find((s) => s.paragraphType === 'technique')!
      expect(technique.content).toContain('XX')
      expect(technique.sources[0]!.refId).toMatch(/generic|tpl-v2-generic/)
    })

    it('结构化字段注入所见段落 (测量值/对比句追加)', async () => {
      const result = await service.generateDraft(draftRequest)
      const findings = result.segments.find((s) => s.paragraphType === 'findings')!.content
      expect(findings).toContain('结节')
      expect(findings).toContain('18mm×15mm')
      expect(findings).toContain('与既往相比')
    })

    it('结论段优先使用提取的结论字段', async () => {
      const result = await service.generateDraft(draftRequest)
      const conclusion = result.segments.find((s) => s.paragraphType === 'conclusion')!
      expect(conclusion.content).toContain('考虑')
      expect(conclusion.sources.some((s) => s.kind === 'field')).toBe(true)
    })

    it('落库 AiReportDraft 时结果带 reportId 且不标注 simulated', async () => {
      const prisma = makePrisma({
        report: { findFirst: jest.fn().mockResolvedValue({ id: 'rep-1' }) },
        aiReportDraft: { create: jest.fn().mockResolvedValue({ id: 'ad-1' }) },
      })
      const svc = new AiDraftV2Service(prisma)
      const result = await svc.generateDraft(draftRequest)
      expect(result.simulated).toBeUndefined()
      expect(result.reportId).toBe('rep-1')
    })

    it('DB 异常时回退内存路径并标注 simulated=true', async () => {
      const result = await service.generateDraft(draftRequest)
      expect(result.simulated).toBe(true)
      expect(result.segments.length).toBeGreaterThanOrEqual(4)
    })

    it('找不到关联报告时同样回退并标注 simulated=true', async () => {
      const prisma = makePrisma({ report: { findFirst: jest.fn().mockResolvedValue(null) } })
      const svc = new AiDraftV2Service(prisma)
      const result = await svc.generateDraft(draftRequest)
      expect(result.simulated).toBe(true)
    })
  })

  describe('信心溯源结构', () => {
    it('每个段落 id 唯一且 sources 非空, kind 合法, refId/description/confidence 完整', async () => {
      const result = await service.generateDraft(draftRequest)
      const ids = result.segments.map((s) => s.id)
      expect(new Set(ids).size).toBe(ids.length)
      const allowedKinds = new Set(['template', 'rule', 'field', 'clinicalHistory', 'seed'])
      for (const seg of result.segments) {
        expect(seg.sources.length).toBeGreaterThan(0)
        for (const src of seg.sources) {
          expect(allowedKinds.has(src.kind)).toBe(true)
          expect(src.refId.length).toBeGreaterThan(0)
          expect(src.description.length).toBeGreaterThan(0)
          expect(src.confidence).toBeGreaterThan(0)
          expect(src.confidence).toBeLessThanOrEqual(1)
        }
      }
      expect(result.overallConfidence).toBeGreaterThan(0)
      expect(result.overallConfidence).toBeLessThanOrEqual(1)
    })

    it('临床病史段落溯源 kind=clinicalHistory, 关键词段落同样带来源', async () => {
      const result = await service.generateDraft(draftRequest)
      const history = result.segments.find((s) => s.paragraphType === 'clinicalHistory')
      expect(history).toBeDefined()
      expect(history!.sources.every((s) => s.kind === 'clinicalHistory')).toBe(true)
      const keywords = result.segments.find((s) => s.heading === '关键词标注')
      expect(keywords).toBeDefined()
      expect(keywords!.sources.length).toBeGreaterThan(0)
    })
  })

  describe('修改建议 (确定性规则)', () => {
    it('空段落列表 → 报告为空 critical 建议 + overallScore=0', async () => {
      const result = await service.suggest({ paragraphs: [] })
      expect(result.suggestions.length).toBeGreaterThan(0)
      expect(result.suggestions[0]!.severity).toBe('critical')
      expect(result.overallScore).toBe(0)
    })

    it('缺诊断意见 → critical; 缺影像所见 → warning', async () => {
      const result = await service.suggest({ paragraphs: [{ heading: '检查技术', content: '胸部CT平扫' }] })
      const titles = result.suggestions.map((s) => s.title).join('')
      expect(titles).toContain('诊断意见')
      expect(titles).toContain('影像所见')
    })

    it('所见阳性 + 结论阴性 → 不一致 critical 建议', async () => {
      const result = await service.suggest({
        paragraphs: [
          { heading: '影像所见', content: '右肺上叶可见18mm×15mm结节影，边缘毛刺。' },
          { heading: '诊断意见', content: '未见明显异常。' },
        ],
      })
      const hit = result.suggestions.find((s) => s.ruleId === 'suggest:impression-conflict')
      expect(hit).toBeDefined()
      expect(hit!.severity).toBe('critical')
    })

    it('阳性征象缺随访建议 → warning; 建议带 suggestedText', async () => {
      const result = await service.suggest({
        paragraphs: [
          { heading: '影像所见', content: '右肺上叶可见结节影。' },
          { heading: '诊断意见', content: '考虑周围型肺癌可能。' },
        ],
      })
      const hit = result.suggestions.find((s) => s.ruleId === 'suggest:no-recommendation')
      expect(hit).toBeDefined()
      expect(hit!.suggestedText).toContain('随访')
    })

    it('同一输入两次建议完全一致 (确定性)', async () => {
      const a = await service.suggest({
        paragraphs: [
          { heading: '影像所见', content: '右肺上叶结节影，约12mm，与既往相比无明显变化。' },
          { heading: '诊断意见', content: '考虑炎性结节可能，不除外早期肿瘤，建议随访。' },
        ],
      })
      const b = await service.suggest({
        paragraphs: [
          { heading: '影像所见', content: '右肺上叶结节影，约12mm，与既往相比无明显变化。' },
          { heading: '诊断意见', content: '考虑炎性结节可能，不除外早期肿瘤，建议随访。' },
        ],
      })
      const { generatedAt: _ga, ...restA } = a
      const { generatedAt: _gb, ...restB } = b
      expect(restA).toEqual(restB)
    })
  })

  describe('seed 回退 (孤儿模块)', () => {
    it('无 DB 时 listMemoryDrafts 仍返回 seed 草稿', async () => {
      const drafts = await service.listMemoryDrafts()
      expect(drafts.length).toBeGreaterThan(0)
      expect(drafts.every((d) => d.simulated === true)).toBe(true)
    })

    it('生成失败后草稿进入内存历史 (seed 回退可查询)', async () => {
      const result = await service.generateDraft(draftRequest)
      expect(result.simulated).toBe(true)
      const drafts = await service.listMemoryDrafts()
      expect(drafts.some((d) => d.id === result.id)).toBe(true)
    })
  })

  describe('纯函数正确性', () => {
    it('extractStructuredFields 纯函数同输入恒定', () => {
      const a = extractStructuredFields({ findings: POSITIVE_TEXT })
      const b = extractStructuredFields({ findings: POSITIVE_TEXT })
      expect(a).toEqual(b)
    })

    it('buildSuggestions 纯函数同输入恒定', () => {
      const a = buildSuggestions({ paragraphs: [{ heading: '影像所见', content: '未见明显异常' }] })
      const b = buildSuggestions({ paragraphs: [{ heading: '影像所见', content: '未见明显异常' }] })
      expect(a).toEqual(b)
    })
  })
})
