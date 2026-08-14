import { TemplatesService } from './templates.service'

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const prisma: Record<string, unknown> = {
    reportTemplate: {
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      findUnique: jest.fn().mockRejectedValue(new Error('no db')),
      create: jest.fn().mockRejectedValue(new Error('no db')),
      update: jest.fn().mockRejectedValue(new Error('no db')),
      delete: jest.fn().mockRejectedValue(new Error('no db')),
    },
    ...overrides,
  }
  return prisma as never
}

describe('TemplatesService favorites', () => {
  describe('toggleFavorite', () => {
    it('adds id when absent and returns updated ids', () => {
      const service = new TemplatesService(makePrisma({}))
      const first = service.toggleFavorite('tpl-x', 'u-test')
      expect(first.favorite).toBe(true)
      expect(first.ids).toContain('tpl-x')
      const second = service.toggleFavorite('tpl-x', 'u-test')
      expect(second.favorite).toBe(false)
      expect(second.ids).not.toContain('tpl-x')
    })

    it('seeds default favorites for a new user', () => {
      const service = new TemplatesService(makePrisma({}))
      const ids = service.getFavoriteIds('u-fresh')
      expect(ids).toContain('tpl-chest-ct-v2')
    })

    it('isolates favorites per user', () => {
      const service = new TemplatesService(makePrisma({}))
      service.toggleFavorite('tpl-personal', 'u-a')
      expect(service.getFavoriteIds('u-a')).toContain('tpl-personal')
      expect(service.getFavoriteIds('u-b')).not.toContain('tpl-personal')
    })
  })

  describe('listFavorites', () => {
    it('returns ids and resolved templates from DB', async () => {
      const findMany = jest.fn().mockResolvedValue([
        { id: 'tpl-chest-ct-v2', name: '胸部CT模板', category: 'CT', bodyPart: '胸部', body: '双肺纹理清晰', tags: ['胸'], radsCategory: null, version: 1 },
      ])
      const service = new TemplatesService(makePrisma({ reportTemplate: { findMany } }))
      const res = await service.listFavorites('u-list')
      expect(res.ids).toContain('tpl-chest-ct-v2')
      expect(res.templates.length).toBeGreaterThan(0)
      expect(res.templates[0]?.name).toBe('胸部CT模板')
    })

    it('falls back to empty templates when DB query fails', async () => {
      const service = new TemplatesService(makePrisma({}))
      const res = await service.listFavorites('u-db-down')
      expect(res.ids).toContain('tpl-chest-ct-v2')
      expect(res.templates).toEqual([])
    })
  })
})
