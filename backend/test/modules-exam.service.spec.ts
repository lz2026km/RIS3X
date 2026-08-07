import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { ExamService } from '../src/modules/exam/exam.service'
import { PrismaService } from '../src/prisma/prisma.service'
import { SystemConfigService } from '../src/system-storage/system-config.service'

describe('ExamService (modules)', () => {
  let svc: ExamService
  let prisma: any

  const mockExam = { id: 'e1', tenantId: 't1', patientId: 'p1', accessionNumber: 'ACC001', modality: 'CT', bodyPart: '头部', state: 'SCHEDULED', version: 1, createdAt: new Date() }

  const mockPrisma = {
    exam: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ExamService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: SystemConfigService, useValue: { getNumber: jest.fn().mockResolvedValue(20), getString: jest.fn() } },
      ],
    }).compile()
    svc = module.get(ExamService)
    prisma = module.get(PrismaService)
  })

  beforeEach(() => jest.clearAllMocks())

  describe('list', () => {
    it('returns items and total', async () => {
      mockPrisma.exam.findMany.mockResolvedValue([mockExam])
      mockPrisma.exam.count.mockResolvedValue(1)
      const result = await svc.list({ skip: 0, take: 50 })
      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('filters by patient and modality', async () => {
      mockPrisma.exam.findMany.mockResolvedValue([])
      mockPrisma.exam.count.mockResolvedValue(0)
      await svc.list({ patientId: 'p1', modality: 'CT' })
      expect(mockPrisma.exam.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ patientId: 'p1', modality: 'CT', tenantId: 'default' }) })
      )
    })
  })

  describe('get', () => {
    it('returns exam', async () => {
      mockPrisma.exam.findFirst.mockResolvedValue(mockExam)
      const result = await svc.get('e1')
      expect(result.accessionNumber).toBe('ACC001')
      expect(mockPrisma.exam.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'e1', tenantId: 'default' } })
      )
    })

    it('throws on missing', async () => {
      mockPrisma.exam.findFirst.mockResolvedValue(null)
      await expect(svc.get('x')).rejects.toThrow(NotFoundException)
    })
  })

  describe('create', () => {
    it('creates exam', async () => {
      mockPrisma.exam.create.mockResolvedValue(mockExam)
      const result = await svc.create({ patientId: 'p1', accessionNumber: 'ACC001', modality: 'CT', bodyPart: '头部' })
      expect(result.id).toBe('e1')
    })
  })

  describe('update', () => {
    it('updates exam', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue(mockExam)
      mockPrisma.exam.update.mockResolvedValue({ ...mockExam, state: 'COMPLETED' })
      const result = await svc.update('e1', { state: 'COMPLETED' })
      expect(result.state).toBe('COMPLETED')
    })

    it('throws on missing', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue(null)
      await expect(svc.update('x', { state: 'x' })).rejects.toThrow(NotFoundException)
    })
  })

  describe('delete', () => {
    it('deletes exam', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue(mockExam)
      mockPrisma.exam.delete.mockResolvedValue(mockExam)
      const result = await svc.delete('e1')
      expect(result.ok).toBe(true)
    })

    it('throws on missing', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue(null)
      await expect(svc.delete('x')).rejects.toThrow(NotFoundException)
    })
  })
})
