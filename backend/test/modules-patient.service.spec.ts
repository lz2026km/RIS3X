import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { PatientService } from '../src/modules/patient/patient.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('PatientService (modules)', () => {
  let svc: PatientService
  let prisma: any

  const mockPatient = { id: 'p1', tenantId: 't1', name: '张三', gender: 'MALE', birthDate: new Date('1990-01-01'), idCard: '110101199001010000', phone: '13800001111', type: 'OUTPATIENT', state: 'registered', deletedAt: null, version: 1, createdAt: new Date(), updatedAt: new Date() }

  const mockPrisma = {
    patient: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    report: { findMany: jest.fn() },
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [PatientService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile()
    svc = module.get(PatientService)
    prisma = module.get(PrismaService)
  })

  beforeEach(() => jest.clearAllMocks())

  describe('list', () => {
    it('returns items and total', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([mockPatient])
      mockPrisma.patient.count.mockResolvedValue(1)
      const result = await svc.list({ skip: 0, take: 50 })
      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('filters by name and phone', async () => {
      mockPrisma.patient.findMany.mockResolvedValue([])
      mockPrisma.patient.count.mockResolvedValue(0)
      await svc.list({ name: '张三', phone: '138' })
      expect(mockPrisma.patient.findMany).toHaveBeenCalled()
    })
  })

  describe('get', () => {
    it('returns patient', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(mockPatient)
      const result = await svc.get('p1')
      expect(result.name).toBe('张三')
    })

    it('throws on missing', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null)
      await expect(svc.get('x')).rejects.toThrow(NotFoundException)
    })
  })

  describe('create', () => {
    it('creates patient', async () => {
      mockPrisma.patient.create.mockResolvedValue(mockPatient)
      const result = await svc.create({ name: '张三', gender: 'MALE' })
      expect(result.name).toBe('张三')
    })
  })

  describe('update', () => {
    it('updates patient', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(mockPatient)
      mockPrisma.patient.update.mockResolvedValue({ ...mockPatient, name: '李四' })
      const result = await svc.update('p1', { name: '李四' })
      expect(result.name).toBe('李四')
    })

    it('throws on missing', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null)
      await expect(svc.update('x', { name: 'x' })).rejects.toThrow(NotFoundException)
    })
  })

  describe('delete (soft delete)', () => {
    it('soft-deletes patient instead of physical delete', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(mockPatient)
      mockPrisma.patient.update.mockResolvedValue({ ...mockPatient, deletedAt: new Date() })
      const result = await svc.delete('p1')
      expect(result.ok).toBe(true)
      expect(mockPrisma.patient.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'p1' },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }))
      expect(mockPrisma.patient.delete).not.toHaveBeenCalled()
    })

    it('throws on missing', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null)
      await expect(svc.delete('x')).rejects.toThrow(NotFoundException)
    })
  })

  describe('getReports', () => {
    it('returns reports for patient', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(mockPatient)
      mockPrisma.report.findMany.mockResolvedValue([])
      const result = await svc.getReports('p1')
      expect(result).toEqual([])
    })

    it('throws on missing patient', async () => {
      mockPrisma.patient.findFirst.mockResolvedValue(null)
      await expect(svc.getReports('x')).rejects.toThrow(NotFoundException)
    })
  })
})
