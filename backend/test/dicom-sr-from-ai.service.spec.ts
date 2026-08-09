import { NotFoundException } from '@nestjs/common'
import { DicomSrService } from '../src/modules/dicom-sr/dicom-sr.service'

// [G005 Wave4A] G-14 AI 结果 → DICOM SR 封装 (POST /dicom-sr/from-ai)

function mockHl7() {
  return {
    buildAndPushOru: jest.fn().mockResolvedValue({
      message: 'MSH|ORU^R01|P|2.5.1',
      controlId: 'G005-ai-1',
      pushed: false,
      ackStatus: 'SKIPPED',
    }),
  }
}

function mockPrisma() {
  const exam = {
    id: 'EX-5001',
    tenantId: 'default',
    patientId: 'p1',
    accessionNumber: 'ACC-5001',
    modality: 'CT',
    bodyPart: 'CHEST',
    startedAt: new Date('2026-08-01T09:00:00Z'),
    patient: { id: 'p1', name: '张三', idCard: 'P20260001', birthDate: new Date('1980-01-01'), gender: 'MALE' },
  }
  const report = {
    id: 'r-ai-1',
    tenantId: 'default',
    patientId: 'p1',
    examId: 'EX-5001',
    findings: '',
    impression: '',
    conclusion: '',
    createdAt: new Date('2026-08-01T09:00:00Z'),
  }
  const srDoc = {
    id: 'sr-ai-1',
    tenantId: 'default',
    reportId: 'r-ai-1',
    templateId: 'tid2000',
    tid: '2000',
    content: {},
    rawContent: '',
    status: 'draft',
    sopInstanceUid: '1.2.840.10008.5.1.4.1.1.88.11.1.1',
    studyInstanceUid: 'study-1',
    seriesInstanceUid: 'series-1',
    sopClassUid: '1.2.840.10008.5.1.4.1.1.88.22',
    hl7ControlId: null,
    hl7Message: null,
    pushedAt: null,
    createdAt: new Date('2026-08-01T11:00:00Z'),
    updatedAt: new Date('2026-08-01T11:00:00Z'),
  }
  return {
    exam: {
      findUnique: jest.fn().mockResolvedValue(exam),
    },
    report: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(report),
      findUnique: jest.fn().mockResolvedValue(report),
    },
    srDocument: {
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(({ data }) => ({ ...srDoc, ...data, id: 'sr-ai-1', createdAt: srDoc.createdAt, updatedAt: srDoc.updatedAt })),
      update: jest.fn().mockImplementation(({ data }) => ({ ...srDoc, ...data, updatedAt: new Date('2026-08-01T12:00:00Z') })),
    },
  }
}

describe('DicomSrService.fromAi', () => {
  let svc: DicomSrService
  let prisma: ReturnType<typeof mockPrisma>

  const dto = {
    studyId: 'EX-5001',
    findings: [
      { label: '右肺上叶磨玻璃结节', confidence: 0.93, x: 0.35, y: 0.22, width: 0.08, height: 0.06 },
      { label: '左上肺钙化灶', confidence: 0.87, x: 0.2, y: 0.3 },
    ],
    modelName: 'lung-nodule-v2',
    summary: '发现 2 处异常, 建议随访',
  }

  beforeEach(() => {
    prisma = mockPrisma()
    svc = new DicomSrService(prisma as never, mockHl7() as never)
  })

  it('creates a TID 2000 SR document from AI findings with report stub', async () => {
    const doc = await svc.fromAi(dto)
    expect(doc.reportId).toBe('r-ai-1')
    expect(doc.templateId).toBe('tid2000')
    expect(doc.sopClassUid).toBe('1.2.840.10008.5.1.4.1.1.88.22')
    expect(doc.content.sections.some((s) => s.conceptName.code === '121120')).toBe(true)
    expect(doc.rawContent).toContain('TID 2000')
    expect(doc.rawContent).toContain(doc.sopInstanceUid)
    expect(prisma.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ patientId: 'p1', examId: 'EX-5001' }),
      }),
    )
  })

  it('reuses existing report when exam already has one', async () => {
    prisma.report.findFirst = jest.fn().mockResolvedValue({ id: 'r-existing', tenantId: 'default', patientId: 'p1', examId: 'EX-5001' })
    const doc = await svc.fromAi(dto)
    expect(doc.reportId).toBe('r-existing')
    expect(prisma.report.create).not.toHaveBeenCalled()
  })

  it('defaults to tid2000 and embeds per-finding CAD summary items', async () => {
    const doc = await svc.fromAi({ ...dto, templateId: undefined })
    expect(doc.templateId).toBe('tid2000')
    const cad = doc.content.sections.find((s) => s.conceptName.code === '121120')!
    expect(cad.items).toHaveLength(2)
    expect(cad.items[0].value).toContain('右肺上叶磨玻璃结节')
  })

  it('supports tid1500 template', async () => {
    const doc = await svc.fromAi({ ...dto, templateId: 'tid1500' })
    expect(doc.templateId).toBe('tid1500')
    expect(doc.sopClassUid).toBe('1.2.840.10008.5.1.4.1.1.88.33')
  })

  it('throws NotFoundException when exam does not exist', async () => {
    prisma.exam.findUnique = jest.fn().mockResolvedValue(null)
    await expect(svc.fromAi(dto)).rejects.toThrow(NotFoundException)
  })

  it('throws NotFoundException for unknown template', async () => {
    await expect(svc.fromAi({ ...dto, templateId: 'tid9999' as never })).rejects.toThrow(NotFoundException)
  })

  it('replaces existing SR document for same report+template instead of stacking', async () => {
    prisma.srDocument.findFirst = jest.fn().mockResolvedValue({ id: 'sr-old', sopInstanceUid: '1.2.840.10008.5.1.4.1.1.88.11.1.OLD' })
    const doc = await svc.fromAi(dto)
    expect(doc.sopInstanceUid).toBe('1.2.840.10008.5.1.4.1.1.88.11.1.OLD')
    expect(prisma.srDocument.create).not.toHaveBeenCalled()
    expect(prisma.srDocument.update).toHaveBeenCalled()
  })
})
