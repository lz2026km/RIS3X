import { ReportDraftService } from '../src/modules/ai-draft/report-draft.service'
import { parseDraftText, extractReportFields, serializeDraft } from '../src/aiplatform/report-templates'

describe('ReportDraftService (环境式 AI 报告草稿)', () => {
  let svc: ReportDraftService
  let mockPrisma: any

  const draftRow = (over: Record<string, unknown> = {}) => ({
    id: 'draft-1',
    reportId: 'rpt-038',
    draftText: '【影像所见】\n双肺纹理清晰。\n【影像诊断】\n1. 未见异常。',
    style: 'standard',
    status: 'PENDING',
    createdBy: 't1',
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    acceptedAt: null,
    ...over,
  })

  beforeEach(() => {
    mockPrisma = {
      aiReportDraft: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      report: { findUnique: jest.fn(), update: jest.fn() },
      auditLog: { create: jest.fn() },
    }
    // 默认回显: create/update 返回所提交的 data
    const echo = ({ data }: { data: Record<string, unknown> }) => ({
      id: 'draft-1',
      reportId: data.reportId as string,
      draftText: data.draftText as string,
      style: (data.style as string) ?? 'standard',
      status: (data.status as string) ?? 'PENDING',
      createdBy: (data.createdBy as string) ?? 't1',
      createdAt: new Date('2026-08-01T00:00:00Z'),
      updatedAt: new Date('2026-08-01T00:00:00Z'),
      acceptedAt: null,
    })
    mockPrisma.aiReportDraft.create.mockImplementation(echo)
    mockPrisma.aiReportDraft.update.mockImplementation(echo)
    svc = new ReportDraftService(mockPrisma)
  })

  describe('generateReportDraft', () => {
    it('CT 胸部生成完整草稿并持久化', async () => {
      const r = await svc.generateReportDraft({
        reportId: 'rpt-038',
        modality: 'CT',
        bodyPart: '胸部',
        clinicalInfo: '体检发现结节',
        findings: '右肺上叶结节影',
      })
      expect(mockPrisma.aiReportDraft.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ reportId: 'rpt-038', status: 'PENDING', style: 'standard' }),
      }))
      expect(r.sections.length).toBeGreaterThanOrEqual(4)
      expect(r.sections.map((s) => s.heading)).toEqual(expect.arrayContaining(['检查技术', '影像所见', '影像诊断', '建议']))
      expect(r.draftText).toContain('胸部CT平扫')
      expect(r.modelVersion).toBe('deepseek-v3.0')
      expect(r.status).toBe('PENDING')
    })

    it('findings 关键词填充所见段落', async () => {
      const r = await svc.generateReportDraft({
        reportId: 'rpt-1',
        modality: 'CT',
        bodyPart: '胸部',
        findings: '右肺上叶磨玻璃影',
      })
      const parsed = parseDraftText(r.draftText)
      const findings = parsed.find((s) => s.heading === '影像所见')?.content ?? ''
      expect(findings).toContain('右肺上叶磨玻璃影')
    })

    it('style=detailed 生成补充描述', async () => {
      const r = await svc.generateReportDraft({
        reportId: 'rpt-2',
        modality: 'MR',
        bodyPart: '头颅',
        style: 'detailed',
      })
      const parsed = parseDraftText(r.draftText)
      const findings = parsed.find((s) => s.heading === '影像所见')?.content ?? ''
      expect(findings).toContain('图像质量良好')
      expect(r.style).toBe('detailed')
    })

    it('style=concise 精简', async () => {
      const r = await svc.generateReportDraft({
        reportId: 'rpt-3',
        modality: 'DR',
        bodyPart: '四肢',
        style: 'concise',
      })
      const parsed = parseDraftText(r.draftText)
      const conclusion = parsed.find((s) => s.heading === '影像诊断')?.content ?? ''
      expect(conclusion.split('\n').filter(Boolean).length).toBeLessThanOrEqual(2)
    })

    it('缺少 reportId 抛 BadRequest', async () => {
      await expect(svc.generateReportDraft({ reportId: '', modality: 'CT', bodyPart: '胸部' })).rejects.toThrow()
    })
  })

  describe('getDraftByReport', () => {
    it('返回最新草稿 (含解析段落)', async () => {
      mockPrisma.aiReportDraft.findFirst.mockResolvedValue(draftRow({
        draftText: '【影像所见】\n双肺纹理清晰。\n【影像诊断】\n1. 未见异常。',
      }))
      const r = await svc.getDraftByReport('rpt-038')
      expect(r).not.toBeNull()
      expect(r!.reportId).toBe('rpt-038')
      expect(r!.sections[0]).toEqual({ heading: '影像所见', content: '双肺纹理清晰。' })
      expect(mockPrisma.aiReportDraft.findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { reportId: 'rpt-038' },
        orderBy: { createdAt: 'desc' },
      }))
    })

    it('无草稿返回 null', async () => {
      mockPrisma.aiReportDraft.findFirst.mockResolvedValue(null)
      expect(await svc.getDraftByReport('rpt-null')).toBeNull()
    })
  })

  describe('acceptDraft (草稿 → 正式, 落 reports 表)', () => {
    it('解析草稿字段更新报告并标记 ACCEPTED', async () => {
      mockPrisma.aiReportDraft.findUnique.mockResolvedValue(draftRow({
        draftText: serializeDraft([
          { heading: '影像所见', content: '双肺纹理清晰。\n未见明显异常。' },
          { heading: '影像诊断', content: '1. 胸部CT未见明显异常。\n2. 建议随访。' },
          { heading: '建议', content: '定期复查。' },
        ]),
      }))
      mockPrisma.report.findUnique.mockResolvedValue({ id: 'rpt-038' })
      mockPrisma.report.update.mockResolvedValue({ id: 'rpt-038' })
      mockPrisma.aiReportDraft.update.mockResolvedValue(draftRow({ status: 'ACCEPTED' }))

      const r = await svc.acceptDraft('draft-1')

      expect(mockPrisma.report.findUnique).toHaveBeenCalledWith({ where: { id: 'rpt-038' } })
      expect(mockPrisma.report.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'rpt-038' },
        data: expect.objectContaining({
          findings: '双肺纹理清晰。\n未见明显异常。',
          impression: '1. 胸部CT未见明显异常。\n2. 建议随访。',
          recommendations: '定期复查。',
        }),
      }))
      expect(mockPrisma.aiReportDraft.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'ACCEPTED' }),
      }))
      expect(r.status).toBe('ACCEPTED')
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'ACCEPT', resource: 'ai-report-draft' }),
      }))
    })

    it('草稿不存在抛 NotFound', async () => {
      mockPrisma.aiReportDraft.findUnique.mockResolvedValue(null)
      await expect(svc.acceptDraft('x')).rejects.toThrow('不存在')
    })

    it('已接受草稿不可重复接受', async () => {
      mockPrisma.aiReportDraft.findUnique.mockResolvedValue(draftRow({ status: 'ACCEPTED' }))
      await expect(svc.acceptDraft('draft-1')).rejects.toThrow('已被接受')
    })

    it('报告不存在抛 NotFound', async () => {
      mockPrisma.aiReportDraft.findUnique.mockResolvedValue(draftRow())
      mockPrisma.report.findUnique.mockResolvedValue(null)
      await expect(svc.acceptDraft('draft-1')).rejects.toThrow('报告')
    })
  })

  describe('modifyDraft (医生修改后保存)', () => {
    it('保存修改文本并标记 MODIFIED', async () => {
      mockPrisma.aiReportDraft.findUnique.mockResolvedValue(draftRow())
      const modifiedText = '【影像所见】\n右肺上叶见结节影。\n【影像诊断】\n1. 右肺上叶结节, 性质待定。'

      const r = await svc.modifyDraft('draft-1', modifiedText)
      expect(mockPrisma.aiReportDraft.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ draftText: modifiedText, status: 'MODIFIED' }),
      }))
      expect(r.status).toBe('MODIFIED')
      expect(r.draftText).toBe(modifiedText)
      expect(r.sections[0]).toEqual({ heading: '影像所见', content: '右肺上叶见结节影。' })
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ action: 'MODIFY' }),
      }))
    })

    it('空内容抛 BadRequest', async () => {
      await expect(svc.modifyDraft('draft-1', '  ')).rejects.toThrow('不能为空')
    })

    it('草稿不存在抛 NotFound', async () => {
      mockPrisma.aiReportDraft.findUnique.mockResolvedValue(null)
      await expect(svc.modifyDraft('x', '内容')).rejects.toThrow('不存在')
    })
  })

  describe('模板工具函数', () => {
    it('parseDraftText 解析段落', () => {
      const sections = parseDraftText('【影像所见】\n双肺纹理清晰。\n\n【影像诊断】\n1. 未见异常。')
      expect(sections).toEqual([
        { heading: '影像所见', content: '双肺纹理清晰。' },
        { heading: '影像诊断', content: '1. 未见异常。' },
      ])
    })

    it('extractReportFields 映射 reports 表字段', () => {
      const fields = extractReportFields([
        { heading: '影像所见', content: '所见A' },
        { heading: '影像诊断', content: '结论A' },
        { heading: '建议', content: '建议A' },
      ])
      expect(fields).toEqual({
        findings: '所见A',
        impression: '结论A',
        recommendations: '建议A',
        conclusion: '结论A',
      })
    })
  })
})
