import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { DeviceService } from '../src/modules/device/device.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('DeviceService (modules)', () => {
  let svc: DeviceService
  let prisma: any

  const mockDevice = { id: 'd1', code: 'CT-001', name: 'CT扫描仪', modality: 'CT', manufacturer: 'Siemens', location: '放射科', state: 'IDLE', todayExams: 0, todayUsageMin: 0, version: 1, createdAt: new Date(), updatedAt: new Date() }

  const mockPrisma = {
    device: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    exam: { count: jest.fn() },
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [DeviceService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile()
    svc = module.get(DeviceService)
    prisma = module.get(PrismaService)
  })

  beforeEach(() => jest.clearAllMocks())

  describe('list', () => {
    it('returns items and total', async () => {
      mockPrisma.device.findMany.mockResolvedValue([mockDevice])
      mockPrisma.device.count.mockResolvedValue(1)
      const result = await svc.list({ skip: 0, take: 50 })
      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('filters by modality and state', async () => {
      mockPrisma.device.findMany.mockResolvedValue([])
      mockPrisma.device.count.mockResolvedValue(0)
      await svc.list({ modality: 'CT', state: 'IDLE' })
      expect(mockPrisma.device.findMany).toHaveBeenCalled()
    })
  })

  describe('get', () => {
    it('returns device', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(mockDevice)
      const result = await svc.get('d1')
      expect(result.code).toBe('CT-001')
    })

    it('throws on missing', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(null)
      await expect(svc.get('x')).rejects.toThrow(NotFoundException)
    })
  })

  describe('create', () => {
    it('creates device', async () => {
      mockPrisma.device.create.mockResolvedValue(mockDevice)
      const result = await svc.create({ code: 'CT-001', name: 'CT扫描仪', modality: 'CT' })
      expect(result.id).toBe('d1')
    })
  })

  describe('update', () => {
    it('updates device', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(mockDevice)
      mockPrisma.device.update.mockResolvedValue({ ...mockDevice, name: 'CT-2' })
      const result = await svc.update('d1', { name: 'CT-2' })
      expect(result.name).toBe('CT-2')
    })

    it('throws on missing', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(null)
      await expect(svc.update('x', { name: 'x' })).rejects.toThrow(NotFoundException)
    })
  })

  describe('delete', () => {
    it('deletes device', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(mockDevice)
      mockPrisma.device.delete.mockResolvedValue(mockDevice)
      const result = await svc.delete('d1')
      expect(result.ok).toBe(true)
    })

    it('throws on missing', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(null)
      await expect(svc.delete('x')).rejects.toThrow(NotFoundException)
    })
  })

  describe('getStats', () => {
    it('returns device stats', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(mockDevice)
      mockPrisma.exam.count.mockResolvedValue(5)
      const result = await svc.getStats('d1')
      expect(result.todayExams).toBe(5)
    })

    it('throws on missing', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(null)
      await expect(svc.getStats('x')).rejects.toThrow(NotFoundException)
    })
  })
})
