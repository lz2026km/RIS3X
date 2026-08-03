import { AiService } from '../src/aiplatform/ai.service'

describe('AiService (aiplatform)', () => {
  let svc: AiService

  beforeAll(() => {
    svc = new AiService()
  })

  it('generateReport builds sections with findings', async () => {
    const r = await svc.generateReport({ modality: 'CT', bodyPart: '胸部', findings: '双肺纹理清晰', impression: '未见异常', clinicalHistory: '咳嗽' })
    expect(r.provider).toBe('mock')
    expect(r.sections).toHaveLength(4)
    expect(r.sections[1].content).toBe('双肺纹理清晰')
    expect(r.confidence).toBe(0.85)
  })

  it('generateReport falls back to defaults when findings/impression missing', async () => {
    const r = await svc.generateReport({ modality: 'MR', bodyPart: '头颅', findings: '' })
    expect(r.sections[1].content).toBe('头颅 未见异常')
    expect(r.sections[2].content).toBe('未见明确异常')
  })

  it('reviewReport flags short findings and conclusion', async () => {
    const r = await svc.reviewReport({ reportText: 'x', findings: '短', conclusion: '短' })
    expect(r.issues).toHaveLength(2)
    expect(r.overallScore).toBe(80)
  })

  it('reviewReport passes when texts are long enough', async () => {
    const r = await svc.reviewReport({ reportText: 'x', findings: '双肺纹理清晰，肺野透亮度正常，未见明显异常密度影', conclusion: '未见明确异常，建议定期随访' })
    expect(r.issues).toHaveLength(0)
    expect(r.overallScore).toBe(100)
  })

  it('scoreReport grades with rads category', async () => {
    const withRads = await svc.scoreReport({ reportText: 'x', findings: 'x', conclusion: 'x', radsCategory: 'Lung-RADS 3' })
    expect(withRads.totalScore).toBe(85)
    expect(withRads.grade).toBe('B')
    const without = await svc.scoreReport({ reportText: 'x', findings: 'x', conclusion: 'x' })
    expect(without.totalScore).toBe(70)
    expect(without.grade).toBe('C')
  })
})
