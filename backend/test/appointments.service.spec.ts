import { Test } from '@nestjs/testing'
import { ConflictException, NotFoundException } from '@nestjs/common'
import { AppointmentsService } from '../src/appointments/appointments.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('AppointmentsService', () => {
  let svc: AppointmentsService
  let prisma: any

  const mockAppointment = {
    id: 'a1',
    patientId: 'p1',
    modality: 'CT',
    deviceId: 'd1',
    scheduledAt: new Date('2026-07-13T10:00:00Z'),
    state: 'SCHEDULED',
    version: 1,
    createdAt: new Date(),
  }

  function createTxMock(): any {
    return {
      appointment: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      patient: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      device: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      exam: {
        create: jest.fn(),
      },
    }
  }

  const mockPrismaService: any = {
    $transaction: jest.fn(),
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AppointmentsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile()
    svc = module.get(AppointmentsService)
    prisma = module.get(PrismaService)
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('list', () => {
    it('returns items and total', async () => {
      const tx = createTxMock()
      mockPrismaService.appointment = tx.appointment
      mockPrismaService.appointment.findMany.mockResolvedValue([mockAppointment])
      mockPrismaService.appointment.count.mockResolvedValue(1)
      const result = await svc.list({ skip: 0, take: 50 })
      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('filters by state and deviceId', async () => {
      const tx = createTxMock()
      mockPrismaService.appointment = tx.appointment
      mockPrismaService.appointment.findMany.mockResolvedValue([])
      mockPrismaService.appointment.count.mockResolvedValue(0)
      await svc.list({ state: 'SCHEDULED', deviceId: 'd1' })
      expect(mockPrismaService.appointment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { state: 'SCHEDULED', deviceId: 'd1' },
        }),
      )
    })

    it('filters by date range', async () => {
      const tx = createTxMock()
      mockPrismaService.appointment = tx.appointment
      mockPrismaService.appointment.findMany.mockResolvedValue([])
      mockPrismaService.appointment.count.mockResolvedValue(0)
      await svc.list({ dateFrom: '2026-07-13', dateTo: '2026-07-14' })
      const call = mockPrismaService.appointment.findMany.mock.calls[0][0]
      expect(call.where.scheduledAt).toBeDefined()
      expect(call.where.scheduledAt.gte).toBeInstanceOf(Date)
      expect(call.where.scheduledAt.lte).toBeInstanceOf(Date)
    })
  })

  describe('get', () => {
    it('returns appointment when found', async () => {
      const tx = createTxMock()
      mockPrismaService.appointment = tx.appointment
      mockPrismaService.appointment.findUnique.mockResolvedValue(mockAppointment)
      const result = await svc.get('a1')
      expect(result.id).toBe('a1')
    })

    it('throws when not found', async () => {
      const tx = createTxMock()
      mockPrismaService.appointment = tx.appointment
      mockPrismaService.appointment.findUnique.mockResolvedValue(null)
      await expect(svc.get('x')).rejects.toThrow(NotFoundException)
    })
  })

  describe('create', () => {
    const dto = {
      patientName: '张三',
      patientId: 'p1',
      modality: 'CT',
      startAt: '2026-07-13T10:00:00Z',
      endAt: '2026-07-13T10:30:00Z',
      deviceId: 'd1',
      deviceName: 'CT-1',
      createdById: 'u1',
    }

    it('creates appointment when no overlap', async () => {
      const tx = createTxMock()
      tx.patient.findUnique.mockResolvedValue({ id: 'p1', name: '张三' })
      tx.device.findUnique.mockResolvedValue({ id: 'd1' })
      tx.appointment.findFirst.mockResolvedValue(null)
      tx.appointment.create.mockResolvedValue(mockAppointment)
      tx.exam.create.mockResolvedValue({ id: 'e1' })
      mockPrismaService.$transaction.mockImplementation((cb: any) => cb(tx))
      const result = await svc.create(dto)
      expect(result.id).toBe('a1')
      // P0: 联动创建 Exam (SCHEDULED), 工作列表可见
      expect(tx.exam.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ state: 'SCHEDULED', patientId: 'p1' }),
        }),
      )
    })

    it('creates patient automatically when patientId unknown', async () => {
      const tx = createTxMock()
      tx.patient.findUnique.mockResolvedValue(null)
      tx.patient.findFirst.mockResolvedValue(null)
      tx.patient.create.mockResolvedValue({ id: 'p-new', name: dto.patientName })
      tx.device.findUnique.mockResolvedValue({ id: 'd1' })
      tx.appointment.findFirst.mockResolvedValue(null)
      tx.appointment.create.mockResolvedValue(mockAppointment)
      tx.exam.create.mockResolvedValue({ id: 'e1' })
      mockPrismaService.$transaction.mockImplementation((cb: any) => cb(tx))
      const result = await svc.create(dto)
      expect(result.id).toBe('a1')
      expect(tx.patient.create).toHaveBeenCalled()
    })

    it('throws ConflictException on overlap', async () => {
      const tx = createTxMock()
      tx.patient.findUnique.mockResolvedValue({ id: 'p1', name: '张三' })
      tx.device.findUnique.mockResolvedValue({ id: 'd1' })
      tx.appointment.findFirst.mockResolvedValue(mockAppointment)
      mockPrismaService.$transaction.mockImplementation((cb: any) => cb(tx))
      await expect(svc.create(dto)).rejects.toThrow(ConflictException)
      expect(tx.exam.create).not.toHaveBeenCalled()
    })
  })

  describe('update', () => {
    const dto = { state: 'CONFIRMED' as any, startAt: '2026-07-13T11:00:00Z' }

    it('updates appointment when no conflict', async () => {
      const tx = createTxMock()
      tx.appointment.findUnique.mockResolvedValue(mockAppointment)
      tx.appointment.findFirst.mockResolvedValue(null)
      tx.appointment.update.mockResolvedValue({ ...mockAppointment, state: 'CONFIRMED' })
      mockPrismaService.$transaction.mockImplementation((cb: any) => cb(tx))
      const result = await svc.update('a1', dto)
      expect(result.state).toBe('CONFIRMED')
    })

    it('throws NotFoundException when missing', async () => {
      const tx = createTxMock()
      tx.appointment.findUnique.mockResolvedValue(null)
      mockPrismaService.$transaction.mockImplementation((cb: any) => cb(tx))
      await expect(svc.update('x', dto)).rejects.toThrow(NotFoundException)
    })

    it('throws ConflictException on version conflict', async () => {
      const tx = createTxMock()
      tx.appointment.findUnique.mockResolvedValue(mockAppointment)
      tx.appointment.findFirst.mockResolvedValue(null)
      tx.appointment.update.mockRejectedValue({ code: 'P2025' })
      mockPrismaService.$transaction.mockImplementation((cb: any) => cb(tx))
      await expect(svc.update('a1', dto)).rejects.toThrow(ConflictException)
    })
  })

  describe('cancel', () => {
    it('cancels appointment', async () => {
      const tx = createTxMock()
      mockPrismaService.appointment = tx.appointment
      tx.appointment.update.mockResolvedValue({ ...mockAppointment, state: 'CANCELLED' })
      const result = await svc.cancel('a1')
      expect(result.state).toBe('CANCELLED')
    })
  })
})
