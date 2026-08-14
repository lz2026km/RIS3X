import { Test } from '@nestjs/testing'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { TemplatesService } from '../src/templates/templates.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('TemplatesService', () => {
  let svc: TemplatesService
  let prisma: any

  const mockTemplate: any = { id: 't1', tenantId: 't1', name: '胸部CT模板', category: 'CT', modality: 'CT', bodyPart: '胸部', body: '检查所见：...', version: 1, tags: ['routine'], createdById: 'u1', status: 'approved', approvedBy: 'u-admin', approvedAt: new Date(), rejectReason: null, createdAt: new Date(), updatedAt: new Date() }

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

    // [v3.0.6.11-98 Wave2A P1] 审批状态过滤 (书写页仅取 approved)
    it('filters by status (approved for write page)', async () => {
      mockPrisma.reportTemplate.findMany.mockResolvedValue([mockTemplate])
      await svc.list({ status: 'approved' })
      const where = mockPrisma.reportTemplate.findMany.mock.calls[0]![0]!.where
      expect(where.status).toBe('approved')
    })

    // [v3.0.6.11-98 Wave2A P1] 医生个人模板库: personal 按 createdById 过滤
    it('filters by userId (personal template library)', async () => {
      mockPrisma.reportTemplate.findMany.mockResolvedValue([mockTemplate])
      await svc.list({ userId: 'u1' })
      const where = mockPrisma.reportTemplate.findMany.mock.calls[0]![0]!.where
      expect(where.createdById).toBe('u1')
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

  // [v3.0.6.11-98 Wave2A P1] 模板审批流: draft → pending → approved / rejected
  describe('approval flow', () => {
    const draftTemplate: any = { ...mockTemplate, status: 'draft', approvedBy: null, approvedAt: null, rejectReason: null }
    const pendingTemplate: any = { ...mockTemplate, status: 'pending', approvedBy: null, approvedAt: null, rejectReason: null }

    it('submit sets status to pending', async () => {
      mockPrisma.reportTemplate.findUnique.mockResolvedValue(draftTemplate)
      mockPrisma.reportTemplate.update.mockResolvedValue({ ...pendingTemplate, version: 2 })
      const result = await svc.submit('t1')
      expect(result.status).toBe('pending')
      expect(mockPrisma.reportTemplate.update.mock.calls[0]![0]!.data.status).toBe('pending')
    })

    it('submit is a no-op for already pending template', async () => {
      mockPrisma.reportTemplate.findUnique.mockResolvedValue(pendingTemplate)
      const result = await svc.submit('t1')
      expect(result.status).toBe('pending')
      expect(mockPrisma.reportTemplate.update).not.toHaveBeenCalled()
    })

    it('submit rejects approved template', async () => {
      mockPrisma.reportTemplate.findUnique.mockResolvedValue(mockTemplate)
      await expect(svc.submit('t1')).rejects.toThrow(BadRequestException)
    })

    it('approve sets approved + approvedBy/approvedAt', async () => {
      mockPrisma.reportTemplate.findUnique.mockResolvedValue(pendingTemplate)
      mockPrisma.reportTemplate.update.mockResolvedValue({ ...pendingTemplate, status: 'approved', approvedBy: 'u-admin', approvedAt: new Date() })
      const result = await svc.approve('t1', 'u-admin')
      expect(result.status).toBe('approved')
      const data = mockPrisma.reportTemplate.update.mock.calls[0]![0]!.data
      expect(data.approvedBy).toBe('u-admin')
      expect(data.approvedAt).toBeInstanceOf(Date)
    })

    it('approve throws when template is not pending', async () => {
      mockPrisma.reportTemplate.findUnique.mockResolvedValue(draftTemplate)
      await expect(svc.approve('t1', 'u-admin')).rejects.toThrow(BadRequestException)
    })

    it('reject sets rejected + reason', async () => {
      mockPrisma.reportTemplate.findUnique.mockResolvedValue(pendingTemplate)
      mockPrisma.reportTemplate.update.mockResolvedValue({ ...pendingTemplate, status: 'rejected', rejectReason: '时相不完整' })
      const result = await svc.reject('t1', '时相不完整')
      expect(result.status).toBe('rejected')
      expect(mockPrisma.reportTemplate.update.mock.calls[0]![0]!.data.rejectReason).toBe('时相不完整')
    })

    it('reject throws when template is not pending', async () => {
      mockPrisma.reportTemplate.findUnique.mockResolvedValue(mockTemplate)
      await expect(svc.reject('t1', 'x')).rejects.toThrow(BadRequestException)
    })

    it('create defaults new template to draft', async () => {
      mockPrisma.reportTemplate.create.mockResolvedValue({ ...mockTemplate, status: 'draft' })
      await svc.create({ name: '新模板', category: 'CT', bodyPart: '胸部', body: '...', createdById: 'u1' })
      expect(mockPrisma.reportTemplate.create.mock.calls[0]![0]!.data.status).toBe('draft')
    })

    it('clone resets clone to draft', async () => {
      mockPrisma.reportTemplate.findUnique.mockResolvedValue(mockTemplate)
      mockPrisma.reportTemplate.create.mockResolvedValue({ ...mockTemplate, id: 't2', status: 'draft' })
      const result = await svc.clone('t1')
      expect(result.status).toBe('draft')
      expect(mockPrisma.reportTemplate.create.mock.calls[0]![0]!.data.status).toBe('draft')
    })
  })

  // [v3.0.6.11-96 Wave3B P1] 模板分类管理 (内存 + seed: name/description/sortOrder)
  describe('categories', () => {
    it('listCategories returns seeded categories sorted by sortOrder', () => {
      const res = svc.listCategories()
      expect(res.length).toBeGreaterThanOrEqual(6)
      expect(res[0]!.name).toBe('CT')
      expect(res[0]!.sortOrder).toBe(1)
      expect(res.every((c) => c.name && typeof c.sortOrder === 'number')).toBe(true)
    })

    it('createCategory adds new category', () => {
      const created = svc.createCategory({ name: '口腔', description: '牙科影像模板', sortOrder: 99 })
      expect(created.id).toBeTruthy()
      expect(created.name).toBe('口腔')
      expect(svc.listCategories().some((c) => c.id === created.id)).toBe(true)
    })

    it('createCategory rejects duplicate name', () => {
      expect(() => svc.createCategory({ name: 'CT' })).toThrow()
    })

    it('createCategory rejects empty name', () => {
      expect(() => svc.createCategory({ name: '  ' })).toThrow()
    })

    it('updateCategory updates name/description/sortOrder', () => {
      const created = svc.createCategory({ name: 'PETCT', sortOrder: 7 })
      const updated = svc.updateCategory(created.id, { name: 'PET/CT', sortOrder: 8 })
      expect(updated.name).toBe('PET/CT')
      expect(updated.sortOrder).toBe(8)
    })

    it('updateCategory supports seed category', () => {
      const updated = svc.updateCategory('TC-001', { description: '更新后的CT模板说明' })
      expect(updated.description).toContain('更新后')
    })

    it('updateCategory throws on missing', () => {
      expect(() => svc.updateCategory('TC-GONE', { name: 'x' })).toThrow(NotFoundException)
    })

    it('deleteCategory removes memory category', () => {
      const created = svc.createCategory({ name: '临时分类' })
      const res = svc.deleteCategory(created.id)
      expect(res.ok).toBe(true)
      expect(svc.listCategories().some((c) => c.id === created.id)).toBe(false)
    })

    it('deleteCategory marks seed category deleted', () => {
      const res = svc.deleteCategory('TC-002')
      expect(res.ok).toBe(true)
      expect(svc.isSeedCategoryDeleted('TC-002')).toBe(true)
      expect(svc.listCategories().some((c) => c.id === 'TC-002')).toBe(false)
    })

    it('deleteCategory throws on missing', () => {
      expect(() => svc.deleteCategory('TC-GONE')).toThrow(NotFoundException)
    })
  })
})
