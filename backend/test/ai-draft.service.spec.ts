import { AiDraftService } from '../src/modules/ai-draft/ai-draft.service'

describe('AiDraftService', () => {
  let svc: AiDraftService

  beforeAll(() => {
    svc = new AiDraftService()
  })

  describe('generateDraft', () => {
    it('returns paragraphs for CT modality', async () => {
      const result = await svc.generateDraft({
        patientId: 'p1',
        examId: 'e1',
        modality: 'CT',
        bodyPart: '胸部',
      })
      expect(result.paragraphs.length).toBeGreaterThanOrEqual(3)
      expect(result.modelVersion).toBe('deepseek-v3.0')
      expect(result.overallConfidence).toBeGreaterThan(0)
      expect(result.generatedAt).toBeInstanceOf(Date)
      const headings = result.paragraphs.map(p => p.heading)
      expect(headings).toContain('检查技术')
      expect(headings).toContain('影像所见')
      expect(headings).toContain('诊断意见')
    })

    it('returns paragraphs for MR modality', async () => {
      const result = await svc.generateDraft({
        patientId: 'p2',
        examId: 'e2',
        modality: 'MR',
        bodyPart: '头颅',
      })
      const tech = result.paragraphs.find(p => p.heading === '检查技术')
      expect(tech?.content).toContain('T1WI/T2WI/FLAIR')
    })

    it('returns paragraphs for DR modality', async () => {
      const result = await svc.generateDraft({
        patientId: 'p3',
        examId: 'e3',
        modality: 'DR',
        bodyPart: '膝关节',
      })
      const tech = result.paragraphs.find(p => p.heading === '检查技术')
      expect(tech?.content).toContain('正侧位片')
    })

    it('returns paragraphs for US modality', async () => {
      const result = await svc.generateDraft({
        patientId: 'p4',
        examId: 'e4',
        modality: 'US',
        bodyPart: '肝脏',
      })
      const tech = result.paragraphs.find(p => p.heading === '检查技术')
      expect(tech?.content).toContain('超声检查')
    })

    it('falls back to CT template for unknown modality', async () => {
      const result = await svc.generateDraft({
        patientId: 'p5',
        examId: 'e5',
        modality: 'XX',
        bodyPart: '腹部',
      })
      expect(result.paragraphs.length).toBeGreaterThanOrEqual(3)
    })

    it('inserts clinical history paragraph when provided', async () => {
      const result = await svc.generateDraft({
        patientId: 'p6',
        examId: 'e6',
        modality: 'CT',
        bodyPart: '胸部',
        clinicalHistory: '患者咳嗽两周',
      })
      const history = result.paragraphs.find(p => p.heading === '临床病史')
      expect(history).toBeDefined()
      expect(history?.content).toBe('患者咳嗽两周')
    })

    it('appends keywords paragraph when provided', async () => {
      const result = await svc.generateDraft({
        patientId: 'p7',
        examId: 'e7',
        modality: 'CT',
        bodyPart: '肺部',
        keywords: ['结节', '磨玻璃影'],
      })
      const kw = result.paragraphs.find(p => p.heading === '关键词标注')
      expect(kw).toBeDefined()
      expect(kw?.content).toBe('结节、磨玻璃影')
    })

    it('all paragraphs are editable', async () => {
      const result = await svc.generateDraft({
        patientId: 'p8',
        examId: 'e8',
        modality: 'MR',
        bodyPart: '脊柱',
      })
      for (const p of result.paragraphs) {
        expect(p.editable).toBe(true)
        expect(p.id).toMatch(/^draft-/)
        expect(p.confidence).toBeGreaterThan(0)
        expect(p.confidence).toBeLessThanOrEqual(1)
      }
    })
  })

  describe('rewriteParagraph', () => {
    it('returns rewritten content with instruction prefix', async () => {
      const result = await svc.rewriteParagraph({
        content: '未见明显异常',
        instruction: '更详细描述',
      })
      expect(result.content).toContain('AI改写')
      expect(result.content).toContain('更详细描述')
      expect(result.content).toContain('未见明显异常')
      expect(result.confidence).toBeGreaterThan(0)
      expect(result.confidence).toBeLessThanOrEqual(1)
    })

    it('confidence is between 0.78 and 0.90', async () => {
      const results = await Promise.all(
        Array.from({ length: 20 }, () =>
          svc.rewriteParagraph({ content: 'test', instruction: 'test' }),
        ),
      )
      for (const r of results) {
        expect(r.confidence).toBeGreaterThanOrEqual(0.78)
        expect(r.confidence).toBeLessThanOrEqual(0.90)
      }
    })
  })

  describe('continueDraft', () => {
    it('returns a new paragraph with supplementary content', async () => {
      const result = await svc.continueDraft({
        existingParagraphs: [
          { heading: '影像所见', content: '左肺上叶见一结节影' },
        ],
        prompt: '与上次CT对比',
      })
      expect(result.heading).toBe('补充描述')
      expect(result.content).toContain('与上次CT对比')
      expect(result.content).toContain('既往')
      expect(result.editable).toBe(true)
      expect(result.id).toMatch(/^draft-/)
    })

    it('confidence is between 0.75 and 0.90', async () => {
      const results = await Promise.all(
        Array.from({ length: 20 }, () =>
          svc.continueDraft({
            existingParagraphs: [],
            prompt: '对比',
          }),
        ),
      )
      for (const r of results) {
        expect(r.confidence).toBeGreaterThanOrEqual(0.75)
        expect(r.confidence).toBeLessThanOrEqual(0.90)
      }
    })
  })
})
