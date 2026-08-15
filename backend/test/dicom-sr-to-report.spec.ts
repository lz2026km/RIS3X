/**
 * G005 RIS v3.0.6.11-100 (Wave 8 流程闭环: DICOM SR → 报告字段回填)
 * 端点:
 *   - POST /dicom-sr/to-report  { srId, reportId } → 解析 SR 测量项 → { paragraph, measurements[] }
 * 解析规则: TID1500 测量组 (code 125007) / NUM 值项 / 文本数值+单位 (text-parse)
 */
import { NotFoundException } from '@nestjs/common'
import { DicomSrService, type SrContentTree } from '../src/modules/dicom-sr/dicom-sr.service'
import { Hl7Service } from '../src/hl7/hl7.service'

const mockHl7 = { buildAndPushOru: jest.fn() }

const mkRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'SR-001',
  reportId: 'RPT-100',
  templateId: 'tid1500',
  tid: '1500',
  status: 'draft',
  sopInstanceUid: '1.2.3',
  studyInstanceUid: '1.2.4',
  seriesInstanceUid: '1.2.5',
  sopClassUid: '1.2.840.10008.5.1.4.1.1.88.33',
  content: { context: { patient: {}, study: {}, report: {} }, sections: [], codedEntries: [] },
  rawContent: '# SR',
  hl7ControlId: null,
  hl7Message: null,
  pushedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const mkTree = (sections: SrContentTree['sections']): SrContentTree => ({
  templateId: 'TID 1500',
  templateLabel: 'TID 1500 - Measurement Report',
  context: {
    patient: { name: '张三', id: 'P-1', birthDate: '', sex: 'M' },
    study: { uid: '1.2.3', date: '20260810', time: '093000', description: '胸部CT', accessionNumber: 'ACC-1', modality: 'CT' },
    report: { id: 'RPT-100', authorId: '', authorName: '', findings: '', impression: '', conclusion: '', recommendations: '', reportDate: '' },
  },
  sections,
  codedEntries: [],
})

const makeService = (row: unknown) => {
  const prisma = {
    srDocument: { findUnique: jest.fn().mockResolvedValue(row), findMany: jest.fn().mockResolvedValue([]) },
    report: { findUnique: jest.fn().mockResolvedValue({ id: 'RPT-100', findings: 'x' }) },
  }
  const svc = new DicomSrService(prisma as never, mockHl7 as never)
  return { svc, prisma }
}

const MEASUREMENT_GROUP = {
  conceptName: { code: '125007', scheme: 'DCM', meaning: 'Measurement Group' },
  title: '测量组 / Measurement Group',
  items: [
    {
      relationshipType: 'CONTAINS',
      conceptName: { code: '121206', scheme: 'DCM', meaning: 'Distance' },
      valueType: 'NUM' as const,
      value: '12.5 mm',
    },
    {
      relationshipType: 'CONTAINS',
      conceptName: { code: '121207', scheme: 'DCM', meaning: 'Area' },
      valueType: 'NUM' as const,
      value: '48.2 mm2',
    },
  ],
}

describe('DicomSrService.toReport - SR 测量值回填报告', () => {
  it('SR 文档不存在 → NotFoundException', async () => {
    const { svc } = makeService(null)
    await expect(svc.toReport({ srId: 'SR-NOPE', reportId: 'RPT-100' })).rejects.toThrow(NotFoundException)
  })

  it('报告不存在 → NotFoundException', async () => {
    const { svc, prisma } = makeService(mkRow())
    prisma.report.findUnique.mockResolvedValue(null)
    await expect(svc.toReport({ srId: 'SR-001', reportId: 'RPT-NOPE' })).rejects.toThrow(NotFoundException)
  })

  it('解析 TID1500 测量组 (code 125007) NUM 项 → measurements[]', async () => {
    const { svc } = makeService(mkRow({ content: mkTree([MEASUREMENT_GROUP]) }))
    const res = await svc.toReport({ srId: 'SR-001', reportId: 'RPT-100' })
    expect(res.srId).toBe('SR-001')
    expect(res.reportId).toBe('RPT-100')
    expect(res.templateId).toBe('tid1500')
    expect(res.measurements.length).toBe(2)
    expect(res.measurements[0]).toEqual({ name: 'Distance', value: '12.5', unit: 'mm', source: 'measurement-group' })
    expect(res.measurements[1]).toEqual({ name: 'Area', value: '48.2', unit: 'mm2', source: 'measurement-group' })
  })

  it('段落文本包含测量摘要头 + 每条测量值', async () => {
    const { svc } = makeService(mkRow({ content: mkTree([MEASUREMENT_GROUP]) }))
    const res = await svc.toReport({ srId: 'SR-001', reportId: 'RPT-100' })
    expect(res.paragraph).toContain('【DICOM SR 测量摘要】')
    expect(res.paragraph).toContain('Distance: 12.5 mm')
    expect(res.paragraph).toContain('Area: 48.2 mm2')
  })

  it('文本测量解析 (text-parse): 非测量组 TEXT 含数值+单位', async () => {
    const tree = mkTree([
      {
        conceptName: { code: '121071', scheme: 'DCM', meaning: 'Finding' },
        title: '检查所见 / Findings',
        items: [
          { relationshipType: 'CONTAINS', conceptName: { code: '121071', scheme: 'DCM', meaning: 'Finding' }, valueType: 'TEXT' as const, value: '右肺上叶结节最大径 12.5 mm, 密度 38 HU' },
        ],
      },
    ])
    const { svc } = makeService(mkRow({ content: tree }))
    const res = await svc.toReport({ srId: 'SR-001', reportId: 'RPT-100' })
    expect(res.measurements.length).toBe(2)
    expect(res.measurements[0]?.source).toBe('text-parse')
    expect(res.measurements[0]?.value).toBe('12.5')
    expect(res.measurements[0]?.unit).toBe('mm')
  })

  it('无测量项 → 确定性空段落提示, measurements 为空数组', async () => {
    const { svc } = makeService(mkRow({ content: mkTree([]) }))
    const res = await svc.toReport({ srId: 'SR-001', reportId: 'RPT-100' })
    expect(res.measurements).toEqual([])
    expect(res.paragraph).toContain('未包含结构化测量项')
    expect(res.paragraph).toContain('SR-001')
  })

  it('重复测量项去重 (同名同值同单位只保留一条)', async () => {
    const group = {
      conceptName: { code: '125007', scheme: 'DCM', meaning: 'Measurement Group' },
      title: '测量组 / Measurement Group',
      items: [
        { relationshipType: 'CONTAINS', conceptName: { code: '121206', scheme: 'DCM', meaning: 'Distance' }, valueType: 'NUM' as const, value: '10.0 mm' },
        { relationshipType: 'CONTAINS', conceptName: { code: '121206', scheme: 'DCM', meaning: 'Distance' }, valueType: 'NUM' as const, value: '10.0 mm' },
      ],
    }
    const { svc } = makeService(mkRow({ content: mkTree([group]) }))
    const res = await svc.toReport({ srId: 'SR-001', reportId: 'RPT-100' })
    expect(res.measurements.length).toBe(1)
  })

  it('TID2000 NUM 项 (非测量组) 也能被解析 (num-item)', async () => {
    const tree = mkTree([
      {
        conceptName: { code: '121120', scheme: 'DCM', meaning: 'CAD Processing and Findings Summary' },
        title: 'CAD 总结 / CAD Processing and Findings Summary',
        items: [
          { relationshipType: 'CONTAINS', conceptName: { code: '121071', scheme: 'DCM', meaning: 'Finding' }, valueType: 'NUM' as const, value: '0.87' },
        ],
      },
    ])
    const { svc } = makeService(mkRow({ templateId: 'tid2000', tid: '2000', content: tree }))
    const res = await svc.toReport({ srId: 'SR-001', reportId: 'RPT-100' })
    expect(res.measurements.length).toBe(1)
    expect(res.measurements[0]?.source).toBe('num-item')
    expect(res.measurements[0]?.value).toBe('0.87')
  })
})
