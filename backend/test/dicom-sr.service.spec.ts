import { BadRequestException, NotFoundException } from '@nestjs/common'
import { DicomSrService } from '../src/modules/dicom-sr/dicom-sr.service'

function mockHl7() {
  return {
    buildAndPushOru: jest.fn().mockResolvedValue({
      message: 'MSH|^~\\&|G005_RIS|G005_HOSPITAL|HIS_RECEIVER|HIS|20260803090000||ORU^R01|G005-r1-20260803090000|P|2.5.1\rOBX|1|TX|18782-3^Radiology study observation^LN||结节\rOBX|2|TX|19005-8^Radiology study conclusion^LN||随访',
      controlId: 'G005-r1-20260803090000',
      pushed: false,
      ackStatus: 'SKIPPED',
    }),
  }
}

function mockPrisma(overrides: Record<string, unknown> = {}) {
  const report = {
    id: 'r1',
    tenantId: 'default',
    patientId: 'p1',
    findings: '右上肺磨玻璃结节, 边界清晰',
    impression: '未见明确恶性征象',
    conclusion: '结论: 随访',
    recommendations: '3-6 个月后复查',
    createdAt: new Date('2026-08-01T10:00:00Z'),
    patient: { id: 'p1', name: '张三', idCard: 'P20260001', birthDate: new Date('1980-01-01'), gender: 'MALE' },
    exam: { accessionNumber: 'ACC-10001', modality: 'CT', bodyPart: 'CHEST', startedAt: new Date('2026-08-01T09:00:00Z') },
    radiologist: { id: 'D101', fullName: 'Dr. Wang' },
    DicomInstance: [],
  }
  const srDoc = {
    id: 'sr-1',
    tenantId: 'default',
    reportId: 'r1',
    templateId: 'tid1500',
    tid: '1500',
    content: {},
    rawContent: '',
    status: 'draft',
    sopInstanceUid: '1.2.840.10008.5.1.4.1.1.88.11.1.1',
    studyInstanceUid: 'study-1',
    seriesInstanceUid: 'series-1',
    sopClassUid: '1.2.840.10008.5.1.4.1.1.88.33',
    hl7ControlId: null,
    hl7Message: null,
    pushedAt: null,
    createdAt: new Date('2026-08-01T11:00:00Z'),
    updatedAt: new Date('2026-08-01T11:00:00Z'),
  }
  return {
    report: {
      findUnique: jest.fn().mockResolvedValue(report),
    },
    srDocument: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => ({ ...srDoc, ...data, id: 'sr-1', createdAt: srDoc.createdAt, updatedAt: srDoc.updatedAt })),
      update: jest.fn().mockImplementation(({ data }) => ({ ...srDoc, ...data, updatedAt: new Date('2026-08-01T12:00:00Z') })),
    },
    ...overrides,
  }
}

describe('DicomSrService', () => {
  let svc: DicomSrService
  let prisma: ReturnType<typeof mockPrisma>
  let hl7: ReturnType<typeof mockHl7>

  beforeEach(() => {
    prisma = mockPrisma()
    hl7 = mockHl7()
    svc = new DicomSrService(prisma as never, hl7 as never)
  })

  it('getTemplates returns TID 1500 and 2000', () => {
    const templates = svc.getTemplates()
    expect(templates).toHaveLength(2)
    expect(templates[0].tid).toBe('1500')
    expect(templates[1].tid).toBe('2000')
  })

  describe('generate', () => {
    it('creates TID 1500 document with required SR tags and content tree', async () => {
      const doc = await svc.generate({ reportId: 'r1', templateId: 'tid1500' })

      expect(doc.tid).toBe('1500')
      expect(doc.status).toBe('draft')
      expect(doc.sopClassUid).toBe('1.2.840.10008.5.1.4.1.1.88.33')
      expect(doc.sopInstanceUid).toMatch(/^1\.2\.840\.10008\.5\.1\.4\.1\.1\.88\.11\.1\./)

      // 内容树: Patient/Study/Report 上下文 + 结论/所见 + SNOMED 编码
      expect(doc.content.context.patient.name).toBe('张三')
      expect(doc.content.context.patient.id).toBe('P20260001')
      expect(doc.content.context.study.modality).toBe('CT')
      expect(doc.content.context.report.id).toBe('r1')
      const findingSection = doc.content.sections.find((s) => s.conceptName.code === '121071')
      expect(findingSection?.items.some((i) => i.valueType === 'TEXT' && i.value?.includes('结节'))).toBe(true)
      expect(doc.content.codedEntries.some((c) => c.scheme === 'SCT')).toBe(true)

      // 文本 SR: 必要 tags + TID + SOP Class
      expect(doc.rawContent).toContain('(0040DB00) CS = TID 1500')
      expect(doc.rawContent).toContain('(0040A730) SQ (Content Sequence)')
      expect(doc.rawContent).toContain('(00080016) UI = 1.2.840.10008.5.1.4.1.1.88.33')
      expect(doc.rawContent).toContain('(0040A168) SQ (Concept Code Sequence)')
      expect(doc.rawContent).toContain('(00100010) PN = 张三')

      expect(prisma.srDocument.create).toHaveBeenCalled()
    })

    it('creates TID 2000 CAD document', async () => {
      const doc = await svc.generate({ reportId: 'r1', templateId: 'tid2000' })
      expect(doc.tid).toBe('2000')
      expect(doc.sopClassUid).toBe('1.2.840.10008.5.1.4.1.1.88.22')
      expect(doc.rawContent).toContain('(0040DB00) CS = TID 2000')
    })

    it('throws for unknown template', async () => {
      await expect(svc.generate({ reportId: 'r1', templateId: 'tid9999' as never })).rejects.toThrow(NotFoundException)
    })

    it('throws when report not found', async () => {
      prisma.report.findUnique.mockResolvedValue(null)
      await expect(svc.generate({ reportId: 'ghost', templateId: 'tid1500' })).rejects.toThrow(NotFoundException)
    })

    it('updates existing document for same report+template', async () => {
      prisma.srDocument.findFirst.mockResolvedValue({ id: 'sr-1', sopInstanceUid: 'keep-uid', templateId: 'tid1500', reportId: 'r1' })
      await svc.generate({ reportId: 'r1', templateId: 'tid1500' })
      expect(prisma.srDocument.update).toHaveBeenCalled()
      expect(prisma.srDocument.create).not.toHaveBeenCalled()
    })
  })

  describe('query', () => {
    it('findById returns document or null', async () => {
      prisma.srDocument.findUnique.mockResolvedValue({
        id: 'sr-1', reportId: 'r1', templateId: 'tid1500', tid: '1500',
        content: { context: { patient: { name: '张三', id: 'P1' }, study: { modality: 'CT' }, report: { impression: '随访' } } },
        rawContent: 'raw', status: 'draft',
        sopInstanceUid: 'sop-1', studyInstanceUid: 'stu-1', seriesInstanceUid: 'ser-1', sopClassUid: 'cls-1',
        hl7ControlId: null, hl7Message: null, pushedAt: null,
        createdAt: new Date(), updatedAt: new Date(),
      })
      const doc = await svc.findById('sr-1')
      expect(doc?.reportId).toBe('r1')
      prisma.srDocument.findUnique.mockResolvedValue(null)
      expect(await svc.findById('ghost')).toBeNull()
    })

    it('findByReportId returns latest document', async () => {
      prisma.srDocument.findFirst.mockResolvedValue({
        id: 'sr-1', reportId: 'r1', templateId: 'tid1500', tid: '1500',
        content: { context: { patient: { name: '张三', id: 'P1' }, study: { modality: 'CT' }, report: { impression: '随访' } } },
        rawContent: 'raw', status: 'finalized',
        sopInstanceUid: 'sop-1', studyInstanceUid: 'stu-1', seriesInstanceUid: 'ser-1', sopClassUid: 'cls-1',
        hl7ControlId: null, hl7Message: null, pushedAt: null,
        createdAt: new Date(), updatedAt: new Date(),
      })
      const doc = await svc.findByReportId('r1')
      expect(doc?.id).toBe('sr-1')
      expect(doc?.status).toBe('finalized')
    })
  })

  describe('finalize', () => {
    it('marks document as finalized', async () => {
      prisma.srDocument.findUnique.mockResolvedValue({
        id: 'sr-1', reportId: 'r1', templateId: 'tid1500', tid: '1500',
        content: {}, rawContent: 'raw', status: 'draft',
        sopInstanceUid: 'sop-1', studyInstanceUid: 'stu-1', seriesInstanceUid: 'ser-1', sopClassUid: 'cls-1',
        hl7ControlId: null, hl7Message: null, pushedAt: null,
        createdAt: new Date(), updatedAt: new Date(),
      })
      const doc = await svc.finalize('sr-1')
      expect(doc.status).toBe('finalized')
      expect(prisma.srDocument.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'finalized' } }))
    })

    it('rejects finalize after push', async () => {
      prisma.srDocument.findUnique.mockResolvedValue({
        id: 'sr-1', reportId: 'r1', templateId: 'tid1500', tid: '1500',
        content: {}, rawContent: 'raw', status: 'pushed',
        sopInstanceUid: 'sop-1', studyInstanceUid: 'stu-1', seriesInstanceUid: 'ser-1', sopClassUid: 'cls-1',
        hl7ControlId: 'c1', hl7Message: 'm', pushedAt: new Date(),
        createdAt: new Date(), updatedAt: new Date(),
      })
      await expect(svc.finalize('sr-1')).rejects.toThrow(BadRequestException)
    })
  })

  describe('pushOru', () => {
    it('assembles ORU^R01 with OBX segments from SR content and marks pushed', async () => {
      const generated = await svc.generate({ reportId: 'r1', templateId: 'tid1500' })
      prisma.srDocument.findUnique.mockResolvedValue({
        id: generated.id, reportId: 'r1', templateId: 'tid1500', tid: '1500',
        content: generated.content, rawContent: generated.rawContent, status: 'draft',
        sopInstanceUid: generated.sopInstanceUid, studyInstanceUid: generated.studyInstanceUid,
        seriesInstanceUid: generated.seriesInstanceUid, sopClassUid: generated.sopClassUid,
        hl7ControlId: null, hl7Message: null, pushedAt: null,
        createdAt: new Date(), updatedAt: new Date(),
      })

      const result = await svc.pushOru(generated.id)

      // SR 内容转 OBX 段: 所见 + 结论
      const input = hl7.buildAndPushOru.mock.calls[0][0] as { findings: string; conclusion: string; patientId: string; accessionNumber: string }
      expect(input.findings).toContain('结节')
      expect(input.conclusion).toContain('随访')
      expect(input.patientId).toBe('P20260001')
      expect(input.accessionNumber).toBe('ACC-10001')

      expect(result.oru.message).toContain('ORU^R01')
      expect(result.oru.message).toContain('OBX')
      expect(result.document.status).toBe('pushed')
      expect(result.document.hl7ControlId).toBe('G005-r1-20260803090000')
      expect(prisma.srDocument.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'pushed', hl7ControlId: expect.any(String) }) }))
    })
  })
})
