import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { CriticalsService } from '../src/criticals/criticals.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('CriticalsService', () => {
  let svc: CriticalsService
  let prisma: any

  const mockCritical = {
    id: 'c1', examId: null, description: '危急值测试', severity: 'HIGH',
    method: 'SYSTEM', state: 'FOUND', tenantId: 't1',
    createdAt: new Date(), updatedAt: new Date(),
  }

  const mockPrisma = {
    criticalValue: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    criticalValueNotification: {
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CriticalsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()
    svc = module.get(CriticalsService)
    prisma = module.get(PrismaService)
  })

  beforeEach(() => jest.clearAllMocks())

  describe('list', () => {
    it('returns paginated criticals with total', async () => {
      mockPrisma.criticalValue.findMany.mockResolvedValue([mockCritical])
      mockPrisma.criticalValue.count.mockResolvedValue(1)
      const result = await svc.list({ skip: 0, take: 20 })
      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('filters by state', async () => {
      mockPrisma.criticalValue.findMany.mockResolvedValue([])
      mockPrisma.criticalValue.count.mockResolvedValue(0)
      await svc.list({ state: 'NOTIFIED' })
      expect(mockPrisma.criticalValue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { state: 'NOTIFIED' } })
      )
    })

    it('filters by severity', async () => {
      await svc.list({ severity: 'URGENT' })
      expect(mockPrisma.criticalValue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { severity: 'URGENT' } })
      )
    })

    it('filters by date range', async () => {
      await svc.list({ dateFrom: '2026-01-01', dateTo: '2026-12-31' })
      expect(mockPrisma.criticalValue.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        })
      )
    })
  })

  describe('get', () => {
    it('returns critical value when found', async () => {
      mockPrisma.criticalValue.findUnique.mockResolvedValue(mockCritical)
      const result = await svc.get('c1')
      expect(result.id).toBe('c1')
    })

    it('throws NotFoundException when missing', async () => {
      mockPrisma.criticalValue.findUnique.mockResolvedValue(null)
      await expect(svc.get('x')).rejects.toThrow(NotFoundException)
    })
  })

  describe('create', () => {
    it('creates critical with FOUND state', async () => {
      mockPrisma.criticalValue.create.mockResolvedValue(mockCritical)
      const result = await svc.create({
        description: '危急值测试', severity: 'HIGH', method: 'SYSTEM',
      })
      expect(result.state).toBe('FOUND')
    })
  })

  describe('update', () => {
    it('updates critical fields and sets ackedAt when ackedBy provided', async () => {
      mockPrisma.criticalValue.findUnique.mockResolvedValue(mockCritical)
      mockPrisma.criticalValue.update.mockResolvedValue({ ...mockCritical, description: 'updated' })
      const result = await svc.update('c1', { description: 'updated', ackedBy: 'd1' })
      expect(result.description).toBe('updated')
      expect(mockPrisma.criticalValue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ ackedAt: expect.any(Date) }),
        })
      )
    })

    it('sets resolvedAt when resolvedBy provided', async () => {
      mockPrisma.criticalValue.findUnique.mockResolvedValue(mockCritical)
      mockPrisma.criticalValue.update.mockResolvedValue({ ...mockCritical, state: 'RESOLVED' })
      await svc.update('c1', { resolvedBy: 'd1' })
      expect(mockPrisma.criticalValue.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ resolvedAt: expect.any(Date) }),
        })
      )
    })

    it('throws NotFoundException when missing', async () => {
      mockPrisma.criticalValue.findUnique.mockResolvedValue(null)
      await expect(svc.update('x', { description: 'x' })).rejects.toThrow(NotFoundException)
    })
  })

  describe('voiceCall', () => {
    it('updates state to VOICE_CALLED', async () => {
      mockPrisma.criticalValue.findUnique.mockResolvedValue(mockCritical)
      mockPrisma.criticalValue.update.mockResolvedValue({ ...mockCritical, state: 'VOICE_CALLED' })
      const result = await svc.voiceCall('c1', { calledBy: 'd1', phoneNumber: '13800138000' })
      expect(result.state).toBe('VOICE_CALLED')
    })

    it('throws NotFoundException when missing', async () => {
      mockPrisma.criticalValue.findUnique.mockResolvedValue(null)
      await expect(svc.voiceCall('x', { calledBy: 'd1', phoneNumber: '13800138000' })).rejects.toThrow(NotFoundException)
    })
  })

  describe('clinicalReceipt', () => {
    it('updates state to RECEIPTED with confirmation', async () => {
      mockPrisma.criticalValue.findUnique.mockResolvedValue(mockCritical)
      mockPrisma.criticalValue.update.mockResolvedValue({ ...mockCritical, state: 'RECEIPTED' })
      const result = await svc.clinicalReceipt('c1', { confirmedBy: 'd1', comment: '已确认' })
      expect(result.state).toBe('RECEIPTED')
    })

    it('throws NotFoundException when missing', async () => {
      mockPrisma.criticalValue.findUnique.mockResolvedValue(null)
      await expect(svc.clinicalReceipt('x', { confirmedBy: 'd1' })).rejects.toThrow(NotFoundException)
    })
  })

  describe('delete', () => {
    it('deletes critical value', async () => {
      mockPrisma.criticalValue.findUnique.mockResolvedValue(mockCritical)
      mockPrisma.criticalValue.delete.mockResolvedValue(mockCritical)
      const result = await svc.delete('c1')
      expect(result.ok).toBe(true)
    })

    it('throws NotFoundException when missing', async () => {
      mockPrisma.criticalValue.findUnique.mockResolvedValue(null)
      await expect(svc.delete('x')).rejects.toThrow(NotFoundException)
    })
  })

  describe('notify', () => {
    it('creates notification records for each channel', async () => {
      mockPrisma.criticalValueNotification.createMany.mockResolvedValue({ count: 3 })
      const result = await svc.notify({
        criticalId: 'c1', patientName: '张三', patientId: 'p1',
        category: 'LIFE_THREATENING', finding: '危急值', channels: ['SMS', 'WECHAT', 'PHONE'],
        recipientName: '李四', recipientDept: '急诊科', recipientPhone: '13800138000',
      })
      expect(result.count).toBe(3)
    })
  })

  describe('escalate', () => {
    it('creates escalation records for each recipient', async () => {
      mockPrisma.criticalValueNotification.createMany.mockResolvedValue({ count: 6 })
      const result = await svc.escalate({
        criticalId: 'c1', reason: '未响应',
        newRecipients: [{ name: '王五', dept: 'ICU', phone: '13900139000' }],
      })
      expect(result.count).toBe(6)
    })
  })

  describe('listHistory', () => {
    it('returns notifications for critical value', async () => {
      mockPrisma.criticalValueNotification.findMany.mockResolvedValue([{ id: 'n1' }])
      const result = await svc.listHistory('c1')
      expect(result).toHaveLength(1)
    })
  })
})
