import { FindingLibraryService } from './finding-library.service'

describe('FindingLibraryService', () => {
  const service = new FindingLibraryService()

  describe('list', () => {
    it('returns grouped categories with items', () => {
      const res = service.list()
      expect(Array.isArray(res)).toBe(true)
      expect(res.length).toBeGreaterThan(0)
      for (const cat of res) {
        expect(cat.category).toBeTruthy()
        expect(Array.isArray(cat.items)).toBe(true)
        for (const item of cat.items) {
          expect(item.id).toBeTruthy()
          expect(item.name).toBeTruthy()
          expect(item.description).toBeTruthy()
          expect(Array.isArray(item.keywords)).toBe(true)
        }
      }
    })

    it('covers all major body-part categories', () => {
      const cats = service.list().map((c) => c.category)
      for (const expected of ['头部', '胸部', '腹部', '脊柱', '四肢', '血管', '骨骼肌肉', '心血管', '五官科']) {
        expect(cats).toContain(expected)
      }
    })
  })

  describe('search', () => {
    it('returns all groups when q is empty', () => {
      const res = service.search('')
      expect(res.length).toBe(service.list().length)
    })

    it('finds items by name', () => {
      const res = service.search('毛刺征')
      const names = res.flatMap((c) => c.items.map((i) => i.name))
      expect(names).toContain('毛刺征')
    })

    it('finds items by keyword', () => {
      const res = service.search('急症')
      expect(res.flatMap((c) => c.items).length).toBeGreaterThan(0)
    })

    it('finds items by description content', () => {
      const res = service.search('新月形')
      expect(res.flatMap((c) => c.items).some((i) => i.name === '硬膜下血肿')).toBe(true)
    })

    it('returns empty list for no match', () => {
      const res = service.search('不存在的征象xyz')
      expect(res).toEqual([])
    })

    it('preserves category grouping in search results', () => {
      const res = service.search('结节')
      for (const cat of res) {
        expect(cat.items.length).toBeGreaterThan(0)
        expect(cat.category).toBeTruthy()
      }
    })
  })
})
