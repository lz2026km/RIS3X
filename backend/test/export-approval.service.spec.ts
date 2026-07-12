import { Test } from '@nestjs/testing'
import { ForbiddenException } from '@nestjs/common'
import { ExportApprovalService } from '../src/modules/export-approval/export-approval.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('ExportApprovalService', () => {
  let svc: ExportApprovalService
  let prisma: any

  const mockItem = { id: 'ea1', requesterId: 'u1', resource: 'report', resourceId: 'r1', reason: '科研用途', status: 'PENDING', createdAt: new Date() }

  const mockPrisma = {
    exportApproval: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [ExportApprovalService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile()
    svc = module.get(ExportApprovalService)
    prisma = module.get(PrismaService)
  })

  beforeEach(() => jest.clearAllMocks())

  describe('request', () => {
    it('creates approval request', async () => {
      mockPrisma.exportApproval.create.mockResolvedValue(mockItem)
      const result = await svc.request({ requesterId: 'u1', resource: 'report', reason: '科研' })
      expect(result.id).toBe('ea1')
    })
  })

  describe('approve', () => {
    it('approves pending request', async () => {
      mockPrisma.exportApproval.findUnique.mockResolvedValue(mockItem)
      mockPrisma.exportApproval.update.mockResolvedValue({ ...mockItem, status: 'APPROVED' })
      const result = await svc.approve('ea1', 'admin')
      expect(result.status).toBe('APPROVED')
    })

    it('throws on missing request', async () => {
      mockPrisma.exportApproval.findUnique.mockResolvedValue(null)
      await expect(svc.approve('x', 'admin')).rejects.toThrow(ForbiddenException)
    })

    it('throws on already processed request', async () => {
      mockPrisma.exportApproval.findUnique.mockResolvedValue({ ...mockItem, status: 'APPROVED' })
      await expect(svc.approve('ea1', 'admin')).rejects.toThrow(ForbiddenException)
    })
  })

  describe('reject', () => {
    it('rejects pending request', async () => {
      mockPrisma.exportApproval.findUnique.mockResolvedValue(mockItem)
      mockPrisma.exportApproval.update.mockResolvedValue({ ...mockItem, status: 'REJECTED' })
      const result = await svc.reject('ea1', 'admin', '理由不充分')
      expect(result.status).toBe('REJECTED')
    })
  })

  describe('list', () => {
    it('returns items', async () => {
      mockPrisma.exportApproval.findMany.mockResolvedValue([mockItem])
      mockPrisma.exportApproval.count.mockResolvedValue(1)
      const result = await svc.list({ page: 1, pageSize: 20 })
      expect(result.items).toHaveLength(1)
    })
  })
})
