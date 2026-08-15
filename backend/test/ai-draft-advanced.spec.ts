import { ReportDraftService } from '../src/modules/ai-draft/report-draft.service'
import { LlmProviderService } from '../src/modules/ai-draft/llm-provider'

const reportRow = (over: Record<string, unknown> = {}) => ({
  id: 'rpt-100',
  tenantId: 't1',
  patientId: 'P001',
  examId: 'exam-1',
  findings: '右肺上叶见磨玻璃结节影',
  impression: '右肺上叶磨玻璃结节, 建议随访',
  recommendations: '',
  conclusion: '',
  diagnosis: '',
  state: 'DRAFT',
  createdAt: new Date('2026-07-01T00:00:00Z'),
  updatedAt: new Date('2026-07-01T00:00:00Z'),
  ...over,
})

const examRow = (over: Record<string, unknown> = {}) => ({
  id: 'exam-1',
  tenantId: 't1',
  patientId: 'P001',
  accessionNumber: 'ACC-001',
  modality: 'CT',
  bodyPart: '胸部',
  ...over,
})

const priorRow = (id: string, daysAgo: number, findings: string) => ({
  id,
  createdAt: new Date(Date.now() - daysAgo * 86_400_000),
  findings,
  impression: '右肺上叶磨玻璃影',
})

function makePrisma(overrides: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = {
    report: {
      findUnique: jest.fn().mockResolvedValue(reportRow()),
      findMany: jest.fn().mockResolvedValue([]),
    },
    exam: { findUnique: jest.fn().mockResolvedValue(examRow()) },
    aiReportDraft: {
      create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
        id: 'ad-adv-1',
        reportId: data.reportId as string,
        draftText: data.draftText as string,
        style: data.style as string,
        status: data.status as string,
        createdAt: new Date('2026-08-01T00:00:00Z'),
        updatedAt: new Date('2026-08-01T00:00:00Z'),
      })),
    },
    auditLog: { create: jest.fn() },
  }
  return { ...base, ...overrides } as never
}

describe('AiDraftAdvanced (G-19: LLM + RAG + 结构化字段)', () => {
  describe('LLM 提供方', () => {
    afterEach(() => {
      delete process.env.DEEPSEEK_API_KEY
      delete process.env.HUNYUAN_API_KEY
    })

    it('listProviders 返回 3 个模型且 mock 始终可用', () => {
      const svc = new LlmProviderService()
      const providers = svc.listProviders()
      expect(providers.map((p) => p.id)).toEqual(['mock', 'deepseek', 'hunyuan'])
      const mock = providers.find((p) => p.id === 'mock')!
      expect(mock.available).toBe(true)
      expect(mock.kind).toBe('template')
    })

    it('无 API key 时 deepseek/hunyuan available=false', () => {
      const providers = new LlmProviderService().listProviders()
      expect(providers.find((p) => p.id === 'deepseek')!.available).toBe(false)
      expect(providers.find((p) => p.id === 'hunyuan')!.available).toBe(false)
    })

    it('配置 API key 后 deepseek/hunyuan available=true', () => {
      process.env.DEEPSEEK_API_KEY = 'sk-test'
      process.env.HUNYUAN_API_KEY = 'hz-test'
      const providers = new LlmProviderService().listProviders()
      expect(providers.find((p) => p.id === 'deepseek')!.available).toBe(true)
      expect(providers.find((p) => p.id === 'hunyuan')!.available).toBe(true)
    })

    it('mock complete 同一 prompt 输出完全一致 (确定性, 模板 NLG)', async () => {
      const svc = new LlmProviderService()
      const prompt = '【modality:CT】【bodyPart:胸部】【style:standard】\n【findings:右肺上叶结节影】'
      const a = await svc.complete({ provider: 'mock', user: prompt })
      const b = await svc.complete({ provider: 'mock', user: prompt })
      expect(a).toEqual(b)
      expect(a.text).toContain('【影像所见】')
      expect(a.fallbackToMock).toBe(false)
      expect(a.model).toBe('mock-nlg-1.0')
    })

    it('deepseek 无 key 时回退 mock 并标注 fallbackToMock', async () => {
      delete process.env.DEEPSEEK_API_KEY
      const r = await new LlmProviderService().complete({
        provider: 'deepseek',
        user: '【modality:CT】【bodyPart:胸部】【style:standard】',
      })
      expect(r.fallbackToMock).toBe(true)
      expect(r.text).toContain('【影像所见】')
    })
  })

  describe('getRagContext', () => {
    it('返回既往报告摘要 + 匹配 SNOMED 术语', async () => {
      const prisma = makePrisma({
        exam: { findUnique: jest.fn().mockResolvedValue(examRow()) },
        report: {
          findUnique: jest.fn().mockResolvedValue(reportRow()),
          findMany: jest.fn().mockResolvedValue([
            priorRow('rpt-099', 30, '右肺上叶见磨玻璃结节影, 边界清晰, 与上次比较无明显变化'),
            priorRow('rpt-098', 120, '胸部CT未见明确异常'),
          ]),
        },
      })
      const svc = new ReportDraftService(prisma)
      const ctx = await svc.getRagContext('rpt-100')
      expect(ctx.reportId).toBe('rpt-100')
      expect(ctx.patientId).toBe('P001')
      expect(ctx.modality).toBe('CT')
      expect(ctx.bodyPart).toBe('胸部')
      expect(ctx.priorReports.length).toBe(2)
      expect(ctx.priorReports[0].reportId).toBe('rpt-099')
      expect(ctx.priorReports[0].snippet).toContain('磨玻璃')
      const lung = ctx.matchedTerms.find((t) => t.term === '肺')
      expect(lung?.code).toBe('SNOMED-CT:39607008')
    })

    it('报告不存在抛 NotFound', async () => {
      const prisma = makePrisma({ report: { findUnique: jest.fn().mockResolvedValue(null) } })
      const svc = new ReportDraftService(prisma)
      await expect(svc.getRagContext('nope')).rejects.toThrow('不存在')
    })

    it('reportId 为空抛 BadRequest', async () => {
      const svc = new ReportDraftService(makePrisma())
      await expect(svc.getRagContext('')).rejects.toThrow('reportId')
    })
  })

  describe('generateAdvanced / generateWithRag', () => {
    it('mock 生成: 草稿 + confidenceScore=0.9 + 空 sources (无 RAG)', async () => {
      const prisma = makePrisma()
      const svc = new ReportDraftService(prisma)
      const r = await svc.generateAdvanced({ reportId: 'rpt-100', provider: 'mock', includeRag: false })
      expect(r.provider).toBe('mock')
      expect(r.modelVersion).toBe('mock-nlg-1.0')
      expect(r.confidenceScore).toBe(0.9)
      expect(r.sources).toEqual([])
      expect(r.ragUsed).toBe(false)
      expect(r.draftText).toContain('【影像所见】')
      expect(r.draftText).toContain('右肺上叶见磨玻璃结节影')
      expect(r.status).toBe('PENDING')
    })

    it('RAG 增强: 返回既往报告来源且信心分提升至 0.93', async () => {
      const prisma = makePrisma({
        report: {
          findUnique: jest.fn().mockResolvedValue(reportRow()),
          findMany: jest.fn().mockResolvedValue([priorRow('rpt-099', 30, '右肺上叶见磨玻璃结节影, 无明显变化')]),
        },
      })
      const svc = new ReportDraftService(prisma)
      const r = await svc.generateAdvanced({ reportId: 'rpt-100', provider: 'mock', includeRag: true })
      expect(r.sources.length).toBe(1)
      expect(r.sources[0].reportId).toBe('rpt-099')
      expect(r.confidenceScore).toBe(0.93)
      expect(r.ragUsed).toBe(true)
      expect(r.draftText).toContain('与既往对比')
    })

    it('持久化 AiReportDraft (create 带 reportId/草稿/状态)', async () => {
      const create = jest.fn().mockResolvedValue({
        id: 'ad-1', reportId: 'rpt-100', draftText: 'x', style: 'standard', status: 'PENDING',
        createdAt: new Date(), updatedAt: new Date(),
      })
      const prisma = makePrisma({
        report: { findUnique: jest.fn().mockResolvedValue(reportRow()) },
        aiReportDraft: { create },
      })
      const svc = new ReportDraftService(prisma)
      await svc.generateAdvanced({ reportId: 'rpt-100' })
      expect(create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ reportId: 'rpt-100', status: 'PENDING' }),
      }))
    })

    it('同一输入两次生成完全一致 (确定性, 含 RAG)', async () => {
      const prisma = makePrisma({
        report: {
          findUnique: jest.fn().mockResolvedValue(reportRow()),
          findMany: jest.fn().mockResolvedValue([priorRow('rpt-099', 30, '右肺上叶磨玻璃影')]),
        },
      })
      const svc = new ReportDraftService(prisma)
      const a = await svc.generateWithRag({ reportId: 'rpt-100', provider: 'mock', includeRag: true })
      const b = await svc.generateWithRag({ reportId: 'rpt-100', provider: 'mock', includeRag: true })
      expect(a.draftText).toBe(b.draftText)
      expect(a.confidenceScore).toBe(b.confidenceScore)
      expect(a.sources).toEqual(b.sources)
    })

    it('deepseek 无 key 生成时 provider 仍标注 deepseek 且 fallbackToMock=true, 信心分下调', async () => {
      delete process.env.DEEPSEEK_API_KEY
      const prisma = makePrisma()
      const svc = new ReportDraftService(prisma)
      const r = await svc.generateAdvanced({ reportId: 'rpt-100', provider: 'deepseek' })
      expect(r.provider).toBe('deepseek')
      expect(r.fallbackToMock).toBe(true)
      expect(r.confidenceScore).toBeLessThan(0.9)
      expect(r.draftText).toContain('【影像所见】')
    })

    it('报告不存在抛 NotFound', async () => {
      const prisma = makePrisma({ report: { findUnique: jest.fn().mockResolvedValue(null) } })
      const svc = new ReportDraftService(prisma)
      await expect(svc.generateAdvanced({ reportId: 'nope' })).rejects.toThrow('不存在')
    })

    it('reportId 为空抛 BadRequest', async () => {
      const svc = new ReportDraftService(makePrisma())
      await expect(svc.generateAdvanced({ reportId: '' })).rejects.toThrow('reportId')
    })
  })

  describe('generateStructured', () => {
    it('生成 现病史/检查所见/诊断意见 三段并持久化', async () => {
      const prisma = makePrisma()
      const svc = new ReportDraftService(prisma)
      const r = await svc.generateStructured({ reportId: 'rpt-100' })
      expect(r.sections.map((s) => s.heading)).toEqual(['现病史', '检查所见', '诊断意见'])
      expect(r.sections[0].content).toContain('胸部')
      expect(r.sections[1].content).toContain('右肺上叶见磨玻璃结节影')
      expect(r.sections[2].content).toContain('磨玻璃')
      expect(r.confidenceScore).toBeGreaterThanOrEqual(0.86)
      expect(r.confidenceScore).toBeLessThanOrEqual(0.93)
      expect(r.provider).toBe('mock')
      expect((prisma as any).aiReportDraft.create).toHaveBeenCalled()
    })

    it('同一报告两次生成置信度一致 (确定性)', async () => {
      const prisma = makePrisma()
      const svc = new ReportDraftService(prisma)
      const a = await svc.generateStructured({ reportId: 'rpt-100' })
      const b = await svc.generateStructured({ reportId: 'rpt-100' })
      expect(a.draftText).toBe(b.draftText)
      expect(a.confidenceScore).toBe(b.confidenceScore)
    })

    it('报告不存在抛 NotFound', async () => {
      const prisma = makePrisma({ report: { findUnique: jest.fn().mockResolvedValue(null) } })
      const svc = new ReportDraftService(prisma)
      await expect(svc.generateStructured({ reportId: 'nope' })).rejects.toThrow('不存在')
    })
  })
})
