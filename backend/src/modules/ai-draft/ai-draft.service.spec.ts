import { AiDraftService, type AiDraftRequest } from './ai-draft.service'

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const base = {
    report: { findFirst: jest.fn().mockRejectedValue(new Error('no db')) },
    aiReportDraft: { create: jest.fn().mockRejectedValue(new Error('no db')) },
  }
  return { ...base, ...overrides } as never
}

const request: AiDraftRequest = {
  patientId: 'P001',
  examId: 'EXAM-1',
  modality: 'CT',
  bodyPart: '胸部',
  clinicalHistory: '咳嗽两周',
  keywords: ['肺结节', '随访'],
}

describe('AiDraftService (modules/ai-draft)', () => {
  describe('确定性草稿生成', () => {
    it('同一 request generateDraft 两次段落 id/置信度完全一致 (无随机)', async () => {
      const prisma = makePrisma({ report: { findFirst: jest.fn().mockResolvedValue({ id: 'rep-1' }) }, aiReportDraft: { create: jest.fn().mockResolvedValue({}) } })
      const service = new AiDraftService(prisma)
      const a = await service.generateDraft(request)
      const b = await service.generateDraft(request)
      expect(a.paragraphs).toEqual(b.paragraphs)
      expect(a.overallConfidence).toBe(b.overallConfidence)
    })

    it('段落包含临床病史与关键词且置信度在 0.85-0.95', async () => {
      const prisma = makePrisma({ report: { findFirst: jest.fn().mockResolvedValue({ id: 'rep-1' }) }, aiReportDraft: { create: jest.fn().mockResolvedValue({}) } })
      const service = new AiDraftService(prisma)
      const result = await service.generateDraft(request)
      const headings = result.paragraphs.map((p) => p.heading)
      expect(headings).toContain('临床病史')
      expect(headings).toContain('关键词标注')
      expect(result.paragraphs.every((p) => p.confidence >= 0.85 && p.confidence <= 0.95)).toBe(true)
    })

    it('落库 AiReportDraft 且 simulated 未标注', async () => {
      const create = jest.fn().mockResolvedValue({ id: 'ad-1' })
      const prisma = makePrisma({ report: { findFirst: jest.fn().mockResolvedValue({ id: 'rep-1' }) }, aiReportDraft: { create } })
      const service = new AiDraftService(prisma)
      const result = await service.generateDraft(request)
      expect(create).toHaveBeenCalled()
      expect(create.mock.calls[0][0].data.reportId).toBe('rep-1')
      expect(create.mock.calls[0][0].data.draftText).toContain('影像所见')
      expect(result.simulated).toBeUndefined()
    })

    it('找不到关联报告时标注 simulated=true', async () => {
      const prisma = makePrisma({ report: { findFirst: jest.fn().mockResolvedValue(null) }, aiReportDraft: { create: jest.fn() } })
      const service = new AiDraftService(prisma)
      const result = await service.generateDraft(request)
      expect(result.simulated).toBe(true)
    })

    it('DB 异常时回退内存生成并标注 simulated=true', async () => {
      const service = new AiDraftService(makePrisma())
      const result = await service.generateDraft(request)
      expect(result.simulated).toBe(true)
      expect(result.paragraphs.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('改写/续写', () => {
    it('rewriteParagraph 对同一输入确定性一致且无随机', async () => {
      const service = new AiDraftService(makePrisma())
      const a = await service.rewriteParagraph({ content: '右肺上叶结节', instruction: '简化描述' })
      const b = await service.rewriteParagraph({ content: '右肺上叶结节', instruction: '简化描述' })
      expect(a).toEqual(b)
      expect(a.confidence).toBeGreaterThanOrEqual(0.85)
    })

    it('continueDraft 对同一 prompt 确定性一致', async () => {
      const service = new AiDraftService(makePrisma())
      const a = await service.continueDraft({ existingParagraphs: [{ heading: '影像所见', content: 'x' }], prompt: '补充病灶大小' })
      const b = await service.continueDraft({ existingParagraphs: [{ heading: '影像所见', content: 'x' }], prompt: '补充病灶大小' })
      expect(a).toEqual(b)
      expect(a.heading).toBe('补充描述')
    })
  })
})
