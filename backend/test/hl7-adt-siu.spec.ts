import { Hl7Service } from '../src/hl7/hl7.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('Hl7Service - ADT/SIU parsing', () => {
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
    svc = new Hl7Service(mockPrisma as PrismaService, {} as never)
  })

  beforeEach(() => jest.clearAllMocks())

  describe('handleAdtMessage', () => {
    const adt = ['MSH|^~\\&|HIS|HOSPITAL|G005|RAD|20260712120000||ADT^A04|CTL001|P|2.5.1', 'EVN|A04|20260712120000', 'PID|||P001||张三||19800101|M|||北京市朝阳区||13800001111', 'PV1||O|RAD^CT-1^^^HOSPITAL|||||DR.李']

    it('parses ADT^A04 and creates patient', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null)
      mockPrisma.patient.create.mockResolvedValue({ id: 'p1' })
      await (svc as any).handleAdtMessage(adt, 'ADT^A04')
      expect(mockPrisma.patient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: '张三' }),
        }),
      )
    })

    it('parses ADT^A04 and updates existing patient', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({ id: 'p1' })
      mockPrisma.patient.update.mockResolvedValue({})
      await (svc as any).handleAdtMessage(adt, 'ADT^A04')
      expect(mockPrisma.patient.update).toHaveBeenCalled()
    })
  })

  describe('handleOrmMessage', () => {
    const orm = ['MSH|^~\\&|HIS|HOSPITAL|G005|RAD|20260712120000||ORM^O01|CTL002|P|2.5.1', 'PID|||P001||李四||19850615|F', 'ORC|NW|ORD001', 'OBR|1|ORD001||CT头部^CT^头部^^^|Routine|20260712120000|||||||头部']

    it('creates exam from ORM', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null)
      mockPrisma.patient.create.mockResolvedValue({ id: 'p1' })
      mockPrisma.exam.findUnique.mockResolvedValue(null)
      mockPrisma.exam.create.mockResolvedValue({})
      await (svc as any).handleOrmMessage(orm)
      expect(mockPrisma.exam.create).toHaveBeenCalled()
    })
  })

  describe('handleDftMessage', () => {
    const dft = ['MSH|^~\\&|HIS|HOSPITAL|G005|RAD|20260712120000||DFT^P03|CTL003|P|2.5.1', 'PID|||P001||王五||19700310|M', 'FT1|||C001|CT检查^CT Head||500.00']

    it('processes DFT message', async () => {
      mockPrisma.hl7MessageArchive.create.mockResolvedValue({})
      await expect((svc as any).handleDftMessage(dft)).resolves.not.toThrow()
    })
  })

  describe('handleSiuMessage', () => {
    const siu = ['MSH|^~\\&|HIS|HOSPITAL|G005|RAD|20260712120000||SIU^S12|CTL004|P|2.5.1', 'SCH|||CT-001||预约CT检查|||||20260713100000', 'PID|||P001||赵六||19901220|F']

    it('creates appointment from SIU', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue({ id: 'p1' })
      mockPrisma.appointment.create.mockResolvedValue({})
      await (svc as any).handleSiuMessage(siu)
      expect(mockPrisma.appointment.create).toHaveBeenCalled()
    })
  })

  afterAll(() => {
    svc.stopMllpListener()
  })
})
