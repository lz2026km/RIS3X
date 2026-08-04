import { AiDraftService, type DicomMetadata } from './ai-draft.service'

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const base = {
    report: { findFirst: jest.fn().mockRejectedValue(new Error('no db')) },
    aiReportDraft: { create: jest.fn().mockRejectedValue(new Error('no db')) },
  }
  return { ...base, ...overrides } as never
}

const meta: DicomMetadata = {
  patientId: 'P001',
  patientName: 'Zhang San',
  modality: 'CT',
  bodyPart: '胸部',
  findings: '右肺上叶见小结节',
}

describe('AiDraftService (modules/ai)', () => {
  describe('确定性草稿生成', () => {
    it('同一 meta draft 两次段落与置信度完全一致 (无随机)', async () => {
      const prisma = makePrisma({ report: { findFirst: jest.fn().mockResolvedValue(null) }, aiReportDraft: { create: jest.fn().mockResolvedValue({}) } })
      const service = new AiDraftService(prisma)
      const a = await service.draft(meta)
      const b = await service.draft(meta)
      expect(a.paragraphs).toEqual(b.paragraphs)
      expect(a.overallConfidence).toBe(b.overallConfidence)
    })

    it('不同 findings 内容生成不同置信度', async () => {
      const prisma = makePrisma({ report: { findFirst: jest.fn().mockResolvedValue(null) }, aiReportDraft: { create: jest.fn().mockResolvedValue({}) } })
      const service = new AiDraftService(prisma)
      const a = await service.draft({ ...meta, findings: '左肺下叶磨玻璃影' })
      const b = await service.draft(meta)
      expect(a.paragraphs[1]?.confidence).not.toBe(b.paragraphs[1]?.confidence)
    })

    it('找到关联报告时 draft 落库 AiReportDraft 且 simulated 未标注', async () => {
      const create = jest.fn().mockResolvedValue({ id: 'draft-1' })
      const prisma = makePrisma({ report: { findFirst: jest.fn().mockResolvedValue({ id: 'rep-1' }) }, aiReportDraft: { create } })
      const service = new AiDraftService(prisma)
      const result = await service.draft(meta)
      expect(create).toHaveBeenCalled()
      expect(create.mock.calls[0][0].data.reportId).toBe('rep-1')
      expect(result.simulated).toBeUndefined()
    })

    it('找不到关联报告时 draft 标注 simulated=true (未落库)', async () => {
      const create = jest.fn()
      const prisma = makePrisma({ report: { findFirst: jest.fn().mockResolvedValue(null) }, aiReportDraft: { create } })
      const service = new AiDraftService(prisma)
      const result = await service.draft(meta)
      expect(result.simulated).toBe(true)
      expect(create).not.toHaveBeenCalled()
    })

    it('DB 异常时 draft 回退内存生成并标注 simulated=true', async () => {
      const service = new AiDraftService(makePrisma())
      const result = await service.draft(meta)
      expect(result.simulated).toBe(true)
      expect(result.paragraphs.length).toBe(4)
    })
  })

  describe('续写/重写', () => {
    it('continueDraft 对同一输入确定性一致', async () => {
      const service = new AiDraftService(makePrisma())
      const a = await service.continueDraft(meta, '既往CT')
      const b = await service.continueDraft(meta, '既往CT')
      expect(a).toEqual(b)
    })

    it('rewriteDraft 对同一指令确定性一致', async () => {
      const service = new AiDraftService(makePrisma())
      const a = await service.rewriteDraft(meta, '诊断意见', '补充钙化描述')
      const b = await service.rewriteDraft(meta, '诊断意见', '补充钙化描述')
      expect(a.paragraphs).toEqual(b.paragraphs)
      expect(a.overallConfidence).toBeGreaterThanOrEqual(0.78)
      expect(a.overallConfidence).toBeLessThanOrEqual(0.94)
    })
  })
})
