import { AiService } from '../src/aiplatform/ai.service'

describe('AiService (aiplatform)', () => {
  let svc: AiService

  beforeAll(() => {
    svc = new AiService()
  })

  describe('generateReport (v3.0.6.11-61 环境式报告生成)', () => {
    it('基于模板库生成完整报告 (所见+诊断+建议)', async () => {
      const r = await svc.generateReport({ modality: 'CT', bodyPart: '胸部', findings: '右肺上叶结节影' })
      expect(r.provider).toBe('mock')
      expect(r.sections.length).toBeGreaterThanOrEqual(4)
      const headings = r.sections.map((s) => s.heading)
      expect(headings).toContain('检查技术')
      expect(headings).toContain('影像所见')
      expect(headings).toContain('影像诊断')
      expect(headings).toContain('建议')
      expect(r.sections[0].content).toContain('胸部CT')
      expect(r.findingsText).toContain('右肺上叶结节影')
      expect(r.confidence).toBe(0.9)
    })

    it('CT 胸部模板命中', async () => {
      const r = await svc.generateReport({ modality: 'CT', bodyPart: '胸部', findings: '' })
      expect(r.sections[1].content).toContain('双肺纹理清晰')
      expect(r.recommendation).toContain('胸部CT')
    })

    it('未见异常时使用模板阴性所见', async () => {
      const r = await svc.generateReport({ modality: 'MR', bodyPart: '头颅', findings: '' })
      expect(r.sections[1].content).toContain('未见明显异常')
    })

    it('style=concise 精简为每段首句', async () => {
      const r = await svc.generateReport({ modality: 'CT', bodyPart: '腹部', findings: '', style: 'concise' })
      const findings = r.sections.find((s) => s.heading === '影像所见')?.content ?? ''
      expect(findings.split('\n').filter(Boolean).length).toBeLessThanOrEqual(4)
      expect(r.style).toBe('concise')
      expect(r.sections.find((s) => s.heading === '影像诊断')?.content.split('\n').filter(Boolean).length).toBe(1)
    })

    it('style=detailed 追加补充描述', async () => {
      const r = await svc.generateReport({ modality: 'CT', bodyPart: '胸部', findings: '', style: 'detailed' })
      const findings = r.sections.find((s) => s.heading === '影像所见')?.content ?? ''
      expect(findings).toContain('图像质量良好')
    })

    it('未知模态回退到默认模板', async () => {
      const r = await svc.generateReport({ modality: 'XX', bodyPart: '未知部位', findings: '' })
      expect(r.sections.length).toBeGreaterThanOrEqual(4)
    })

    it('clinicalInfo 生成临床信息段', async () => {
      const r = await svc.generateReport({ modality: 'DR', bodyPart: '胸部', findings: '', clinicalInfo: '咳嗽两周, 无发热' })
      const headings = r.sections.map((s) => s.heading)
      expect(headings).toContain('临床信息')
      const clinical = r.sections.find((s) => s.heading === '临床信息')
      expect(clinical?.content).toBe('咳嗽两周, 无发热')
    })
  })

  describe('reviewReport', () => {
    it('flags short findings and conclusion', async () => {
      const r = await svc.reviewReport({ reportText: 'x', findings: '短', conclusion: '短' })
      expect(r.issues).toHaveLength(2)
      expect(r.overallScore).toBe(80)
    })

    it('passes when texts are long enough', async () => {
      const r = await svc.reviewReport({ reportText: 'x', findings: '双肺纹理清晰，肺野透亮度正常，未见明显异常密度影', conclusion: '未见明确异常，建议定期随访' })
      expect(r.issues).toHaveLength(0)
      expect(r.overallScore).toBe(100)
    })
  })

  describe('scoreReport', () => {
    it('grades with rads category', async () => {
      const withRads = await svc.scoreReport({ reportText: 'x', findings: 'x', conclusion: 'x', radsCategory: 'Lung-RADS 3' })
      expect(withRads.totalScore).toBe(85)
      expect(withRads.grade).toBe('B')
      const without = await svc.scoreReport({ reportText: 'x', findings: 'x', conclusion: 'x' })
      expect(without.totalScore).toBe(70)
      expect(without.grade).toBe('C')
    })
  })
})
