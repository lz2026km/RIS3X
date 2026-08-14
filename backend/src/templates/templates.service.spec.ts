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

  // [v3.0.6.11-99 Wave2B P1] 模板结构化内容 (模板设计器段落块)
  describe('template structure', () => {
    it('normalizeStructure filters invalid blocks and defaults type to text', () => {
      const service = new TemplatesService(makePrisma({}))
      const normalized = service.normalizeStructure([
        { type: 'text', content: '检查所见:' },
        { type: 'variable', content: '{{patientName}}', variable: 'patientName' },
        { type: 'field', content: '{{field:RECIST}}', fieldKey: 'RECIST' },
        { type: 'bogus', content: 'x' },
        { type: 'text', content: '' },
        null,
      ])
      expect(normalized).toHaveLength(4)
      expect(normalized?.[0]?.type).toBe('text')
      expect(normalized?.[1]?.type).toBe('variable')
      expect(normalized?.[2]?.fieldKey).toBe('RECIST')
      expect(normalized?.[3]?.type).toBe('text')
      expect(service.normalizeStructure(null)).toBeNull()
      expect(service.normalizeStructure([])).toBeNull()
    })

    it('getStructure returns stored blocks and body', async () => {
      const structure = [{ type: 'text', content: '双肺纹理清晰' }]
      const findUnique = jest.fn().mockResolvedValue({ id: 'tpl-x', body: '双肺纹理清晰', structure })
      const service = new TemplatesService(makePrisma({ reportTemplate: { findUnique } }))
      const res = await service.getStructure('tpl-x')
      expect(res.structure).toHaveLength(1)
      expect(res.body).toBe('双肺纹理清晰')
    })

    it('saveStructure persists normalized blocks and updates body + version', async () => {
      const update = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'tpl-x', ...data, body: data.body ?? 'old' }))
      const findUnique = jest.fn().mockResolvedValue({ id: 'tpl-x', body: 'old', structure: null })
      const service = new TemplatesService(makePrisma({ reportTemplate: { findUnique, update } }))
      const res = await service.saveStructure('tpl-x', [
        { type: 'variable', content: '{{patientName}}', variable: 'patientName' },
        { type: 'text', content: '未见异常' },
      ], '{{patientName}}未见异常')
      expect(res.structure).toHaveLength(2)
      expect(res.body).toBe('{{patientName}}未见异常')
      const callData = (update as jest.Mock).mock.calls[0][0].data
      expect(callData.version.increment).toBe(1)
      expect(callData.structure).toHaveLength(2)
    })

    it('saveStructure throws NotFound for missing template', async () => {
      const findUnique = jest.fn().mockResolvedValue(null)
      const service = new TemplatesService(makePrisma({ reportTemplate: { findUnique } }))
      await expect(service.saveStructure('missing', [])).rejects.toThrow('not found')
    })
  })
})
