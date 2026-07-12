import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { TemplatesService } from '../src/templates/templates.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('TemplatesService', () => {
  let svc: TemplatesService
  let prisma: any

  const mockTemplate = { id: 't1', tenantId: 't1', name: '胸部CT模板', category: 'CT', bodyPart: '胸部', body: '检查所见：...', version: 1, tags: ['routine'], createdById: 'u1', createdAt: new Date(), updatedAt: new Date() }

  const mockPrisma = {
    reportTemplate: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [TemplatesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile()
    svc = module.get(TemplatesService)
    prisma = module.get(PrismaService)
  })

  beforeEach(() => jest.clearAllMocks())

  describe('list', () => {
    it('returns templates', async () => {
      mockPrisma.reportTemplate.findMany.mockResolvedValue([mockTemplate])
      const result = await svc.list({ category: 'CT' })
      expect(result).toHaveLength(1)
    })

    it('filters by keyword', async () => {
      mockPrisma.reportTemplate.findMany.mockResolvedValue([])
      await svc.list({ keyword: '胸部' })
      expect(mockPrisma.reportTemplate.findMany).toHaveBeenCalled()
    })
  })

  describe('get', () => {
    it('returns template', async () => {
      mockPrisma.reportTemplate.findUnique.mockResolvedValue(mockTemplate)
      const result = await svc.get('t1')
      expect(result.name).toBe('胸部CT模板')
    })

    it('throws on missing', async () => {
      mockPrisma.reportTemplate.findUnique.mockResolvedValue(null)
      await expect(svc.get('x')).rejects.toThrow(NotFoundException)
    })
  })

  describe('create', () => {
    it('creates template', async () => {
      mockPrisma.reportTemplate.create.mockResolvedValue(mockTemplate)
      const result = await svc.create({ name: '胸部CT模板', category: 'CT', bodyPart: '胸部', body: '...', createdById: 'u1' })
      expect(result.id).toBe('t1')
    })
  })

  describe('update', () => {
    it('updates template', async () => {
      mockPrisma.reportTemplate.findUnique.mockResolvedValue(mockTemplate)
      mockPrisma.reportTemplate.update.mockResolvedValue({ ...mockTemplate, name: 'updated' })
      const result = await svc.update('t1', { name: 'updated' })
      expect(result.name).toBe('updated')
    })

    it('throws on missing', async () => {
      mockPrisma.reportTemplate.findUnique.mockResolvedValue(null)
      await expect(svc.update('x', { name: 'x' })).rejects.toThrow(NotFoundException)
    })
  })

  describe('delete', () => {
    it('deletes template', async () => {
      mockPrisma.reportTemplate.findUnique.mockResolvedValue(mockTemplate)
      mockPrisma.reportTemplate.delete.mockResolvedValue(mockTemplate)
      const result = await svc.delete('t1')
      expect(result.ok).toBe(true)
    })

    it('throws on missing', async () => {
      mockPrisma.reportTemplate.findUnique.mockResolvedValue(null)
      await expect(svc.delete('x')).rejects.toThrow(NotFoundException)
    })
  })

  describe('clone', () => {
    it('clones template', async () => {
      mockPrisma.reportTemplate.findUnique.mockResolvedValue(mockTemplate)
      mockPrisma.reportTemplate.create.mockResolvedValue({ ...mockTemplate, id: 't2', name: '胸部CT模板 (副本)' })
      const result = await svc.clone('t1')
      expect(result.name).toContain('副本')
    })

    it('throws on missing original', async () => {
      mockPrisma.reportTemplate.findUnique.mockResolvedValue(null)
      await expect(svc.clone('x')).rejects.toThrow(NotFoundException)
    })
  })
})
