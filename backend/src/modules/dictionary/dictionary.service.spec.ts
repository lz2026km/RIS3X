import { DictionaryService } from './dictionary.service'
import { BadRequestException, NotFoundException } from '@nestjs/common'

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const prisma: Record<string, unknown> = {
    dictEntry: {
      groupBy: jest.fn().mockRejectedValue(new Error('no db')),
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      findUnique: jest.fn().mockRejectedValue(new Error('no db')),
      create: jest.fn().mockRejectedValue(new Error('no db')),
      update: jest.fn().mockRejectedValue(new Error('no db')),
      deleteMany: jest.fn().mockRejectedValue(new Error('no db')),
    },
    ...overrides,
  }
  return prisma as never
}

describe('DictionaryService', () => {
  describe('listCategories', () => {
    it('merges total/active counts per category', async () => {
      const groupBy = jest.fn()
        .mockResolvedValueOnce([
          { category: 'CT检查项目', _count: { _all: 3 } },
          { category: 'MRI序列', _count: { _all: 2 } },
        ])
        .mockResolvedValueOnce([
          { category: 'CT检查项目', _count: { _all: 2 } },
        ])
      const prisma = makePrisma({ dictEntry: { groupBy } })
      const service = new DictionaryService(prisma)
      const res = await service.listCategories()
      expect(res).toHaveLength(2)
      const ct = res.find((c) => c.category === 'CT检查项目')
      expect(ct?.count).toBe(3)
      expect(ct?.activeCount).toBe(2)
    })
  })

  describe('create', () => {
    it('rejects empty key/value', async () => {
      const service = new DictionaryService(makePrisma({}))
      await expect(service.create('CT检查项目', { key: '', value: 'x' })).rejects.toBeInstanceOf(BadRequestException)
      await expect(service.create('', { key: 'CT-1', value: 'x' })).rejects.toBeInstanceOf(BadRequestException)
      await expect(service.create('CT检查项目', { key: 'CT-1', value: '  ' })).rejects.toBeInstanceOf(BadRequestException)
    })

    it('throws 400 when key already exists', async () => {
      const findUnique = jest.fn().mockResolvedValue({ id: 'e1' })
      const prisma = makePrisma({ dictEntry: { findUnique } })
      const service = new DictionaryService(prisma)
      await expect(service.create('CT检查项目', { key: 'CT-1', value: '颅脑CT平扫' })).rejects.toBeInstanceOf(BadRequestException)
    })

    it('creates entry with defaults', async () => {
      const create = jest.fn().mockResolvedValue({ id: 'e1' })
      const prisma = makePrisma({ dictEntry: { findUnique: jest.fn().mockResolvedValue(null), create } })
      const service = new DictionaryService(prisma)
      const res = await service.create('CT检查项目', { key: 'CT-1', value: '颅脑CT平扫' })
      expect(res.id).toBe('e1')
      expect(create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          category: 'CT检查项目',
          key: 'CT-1',
          value: '颅脑CT平扫',
          sort: 0,
          active: true,
          tenantId: expect.any(String),
        }),
      }))
    })
  })

  describe('update', () => {
    it('throws 404 when entry missing', async () => {
      const prisma = makePrisma({ dictEntry: { findUnique: jest.fn().mockResolvedValue(null) } })
      const service = new DictionaryService(prisma)
      await expect(service.update('CT检查项目', 'CT-1', { value: 'x' })).rejects.toBeInstanceOf(NotFoundException)
    })

    it('updates value/sort/active', async () => {
      const update = jest.fn().mockResolvedValue({ id: 'e1' })
      const prisma = makePrisma({
        dictEntry: {
          findUnique: jest.fn().mockResolvedValueOnce({ id: 'e1' }),
          update,
        },
      })
      const service = new DictionaryService(prisma)
      await service.update('CT检查项目', 'CT-1', { value: '颅脑CT增强', sort: 5, active: false })
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ value: '颅脑CT增强', sort: 5, active: false }),
      }))
    })
  })

  describe('remove', () => {
    it('returns success and 404 on missing', async () => {
      const deleteMany = jest.fn()
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 })
      const prisma = makePrisma({ dictEntry: { deleteMany } })
      const service = new DictionaryService(prisma)
      await expect(service.remove('CT检查项目', 'CT-1')).resolves.toEqual({ success: true, deletedKey: 'CT-1' })
      await expect(service.remove('CT检查项目', 'CT-NO')).rejects.toBeInstanceOf(NotFoundException)
    })
  })
})
