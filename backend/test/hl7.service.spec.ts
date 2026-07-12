import { Hl7Service, ReportForHL7, OrmOrder, DftTransaction } from '../src/hl7/hl7.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('Hl7Service - message builders', () => {
  let svc: Hl7Service

  const mockPrisma = {
    hl7MessageArchive: { create: jest.fn() },
    patient: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    exam: { findUnique: jest.fn(), create: jest.fn() },
    appointment: { create: jest.fn() },
    $connect: jest.fn(),
  } as any

  beforeAll(() => {
    process.env['HL7_MLLP_RETRY_MAX'] = '1'
    process.env['HL7_MLLP_RETRY_INTERVAL'] = '100'
    svc = new Hl7Service(mockPrisma as PrismaService)
  })

  const baseReport: ReportForHL7 = {
    accessionNumber: 'ACC001',
    patientName: '张三',
    patientId: 'P001',
    patientSex: 'M',
    modality: 'CT',
    studyDate: '20240615',
    studyTime: '143000',
    findings: '双肺纹理清晰',
    conclusion: '未见异常',
    authorName: '张医师',
    authorId: 'D001',
    reportId: 'R001',
  }

  describe('buildORU', () => {
    it('returns valid HL7 ORU message', () => {
      const msg = svc.buildORU(baseReport)
      expect(msg).toContain('MSH|')
      expect(msg).toContain('PID|')
      expect(msg).toContain('OBR|')
      expect(msg).toContain('OBX|')
      expect(msg).toContain('ORU^R01')
      expect(msg).toContain('G005_RIS')
    })

    it('includes RADS category when provided', () => {
      const msg = svc.buildORU({ ...baseReport, radsCategory: 'Lung-RADS 1' })
      expect(msg).toContain('RADS')
    })

    it('handles female patient', () => {
      const msg = svc.buildORU({ ...baseReport, patientSex: 'F' })
      expect(msg).toContain('|||F')
    })

    it('handles patientBirthDate', () => {
      const msg = svc.buildORU({ ...baseReport, patientBirthDate: '19900101' })
      expect(msg).toContain('19900101')
    })
  })

  describe('buildORM', () => {
    const order: OrmOrder = {
      patientId: 'P001',
      patientName: '李四',
      patientSex: 'M',
      accessionNumber: 'ACC002',
      modality: 'MR',
      bodyPart: '头部',
      orderNumber: 'ORD001',
      orderingDoctor: '王医师',
    }

    it('returns valid HL7 ORM message', () => {
      const msg = svc.buildORM(order)
      expect(msg).toContain('MSH|')
      expect(msg).toContain('PID|')
      expect(msg).toContain('ORC|')
      expect(msg).toContain('OBR|')
      expect(msg).toContain('ORM^O01')
    })

    it('includes optional fields', () => {
      const msg = svc.buildORM({ ...order, patientBirthDate: '19851212', studyDate: '20240615', studyTime: '100000' })
      expect(msg).toContain('19851212')
    })
  })

  describe('buildDFT', () => {
    const txn: DftTransaction = {
      patientId: 'P001',
      patientName: '王五',
      invoiceNumber: 'INV001',
      totalAmount: '500.00',
      chargeCode: 'C001',
      chargeName: 'CT检查',
    }

    it('returns valid HL7 DFT message', () => {
      const msg = svc.buildDFT(txn)
      expect(msg).toContain('MSH|')
      expect(msg).toContain('PID|')
      expect(msg).toContain('FT1|')
      expect(msg).toContain('DFT^P03')
    })

    it('includes paidAmount when provided', () => {
      const msg = svc.buildDFT({ ...txn, paidAmount: '300.00' })
      expect(msg).toContain('500.00')
    })
  })

  describe('escapeText', () => {
    it('escapes HL7 special characters', () => {
      const escaped = (svc as any).escapeText('A|B^C~D\\E')
      expect(escaped).toContain('\\F\\')
      expect(escaped).toContain('\\S\\')
      expect(escaped).toContain('\\R\\')
      expect(escaped).toContain('\\E\\')
    })

    it('replaces newlines', () => {
      const escaped = (svc as any).escapeText('line1\nline2')
      expect(escaped).toContain('\\.br\\')
    })
  })

  afterAll(() => {
    svc.stopMllpListener()
  })
})
