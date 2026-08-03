import { AiService } from '../src/modules/ai/ai.service'
import { AiDraftService } from '../src/modules/ai/ai-draft.service'

describe('Modules AiService', () => {
  let svc: AiService

  beforeAll(() => {
    svc = new AiService()
  })

  it('generateReport includes MR enhancement wording', async () => {
    const r = await svc.generateReport({ modality: 'MR', bodyPart: '头颅', findings: '未见异常信号' })
    expect(r.sections[0].content).toContain('MR')
    expect(r.sections).toHaveLength(4)
  })

  it('reviewReport and scoreReport behave consistently', async () => {
    const review = await svc.reviewReport({ reportText: 'a', findings: '很短', conclusion: '短' })
    expect(review.issues.length).toBeGreaterThan(0)
    const scored = await svc.scoreReport({ reportText: 'a', findings: 'b', conclusion: 'c', hasCritical: true })
    expect(scored.grade).toMatch(/^[BC]$/)
  })
})

describe('AiDraftService', () => {
  let svc: AiDraftService

  beforeAll(() => {
    svc = new AiDraftService()
  })

  it('draft builds four paragraphs with confidence', async () => {
    const r = await svc.draft({ patientId: 'p1', modality: 'CT', bodyPart: '胸部', findings: '结节影', impression: '随访' })
    expect(r.paragraphs).toHaveLength(4)
    expect(r.paragraphs[1].content).toBe('结节影')
    expect(r.overallConfidence).toBe(0.9)
    expect(r.modelVersion).toBe('deepseek-v3.0')
  })

  it('draft falls back to defaults and MR adds enhancement', async () => {
    const ct = await svc.draft({ patientId: 'p1', modality: 'CT' })
    expect(ct.paragraphs[0].content).toContain('平扫')
    const mr = await svc.draft({ patientId: 'p1', modality: 'MR' })
    expect(mr.paragraphs[0].content).toContain('+增强扫描')
    expect(ct.paragraphs[1].content).toContain('未见明确异常')
  })

  it('continueDraft references clinical history', async () => {
    const r = await svc.continueDraft({ patientId: 'p1', modality: 'CT', clinicalHistory: '2026-01 手术史' }, 'old')
    expect(r.paragraphs).toHaveLength(2)
    expect(r.paragraphs[0].content).toContain('2026-01 手术史')
    const noHistory = await svc.continueDraft({ patientId: 'p1', modality: 'CT' }, 'old')
    expect(noHistory.paragraphs[0].content).toContain('未见')
  })

  it('rewriteDraft embeds instruction', async () => {
    const r = await svc.rewriteDraft({ patientId: 'p1', modality: 'CT', bodyPart: '腰椎' }, '影像所见', '补充骨折描述')
    expect(r.paragraphs[0].heading).toBe('影像所见')
    expect(r.paragraphs[0].content).toContain('补充骨折描述')
  })

  it('getTemplates filters by modality', async () => {
    const all = await svc.getTemplates()
    expect(all.templates).toHaveLength(6)
    const mr = await svc.getTemplates('MR')
    expect(mr.templates).toHaveLength(3)
    expect(mr.templates.every((t) => t.modality === 'MR')).toBe(true)
  })
})
