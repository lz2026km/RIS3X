/**
 * [G005 Wave1A W9] /terms 术语库 spec — TermEntryService (DictEntry 派生 + seed 回退 + 内存 CRUD)
 */
import { TermEntryService } from '../src/modules/terminology/term-entry.service'

function failingPrisma(): any {
  return new Proxy(
    {},
    {
      get: () => () => {
        throw new Error('no db (verification stub)')
      },
    },
  )
}

describe('Wave1A Terms (termApi 真实后端)', () => {
  const svc = new TermEntryService(failingPrisma() as never)

  it('list: 返回术语列表且字段契约完整', async () => {
    const all = await svc.list()
    expect(all.length).toBeGreaterThan(10)
    const first = all[0]!
    expect(typeof first.id).toBe('string')
    expect(typeof first.term).toBe('string')
    expect(typeof first.pinyin).toBe('string')
    expect(typeof first.category).toBe('string')
    expect(Array.isArray(first.synonyms)).toBe(true)
  })

  it('list: category / search 过滤生效', async () => {
    const all = await svc.list()
    const cat = all.find((t) => t.category === 'finding')
    if (cat) {
      const byCat = await svc.list({ category: 'finding' })
      expect(byCat.every((t) => t.category === 'finding')).toBe(true)
    }
    const bySearch = await svc.list({ search: all[0]!.term.slice(0, 2) })
    expect(bySearch.length).toBeGreaterThan(0)
  })

  it('getById / search / suggestions / synonymRelations / translations / extractedTerms / categoryTree', async () => {
    const all = await svc.list()
    const target = all[0]!
    const detail = await svc.getById(target.id)
    expect(detail.id).toBe(target.id)

    const found = await svc.search(target.term.slice(0, 2))
    expect(found.length).toBeGreaterThan(0)

    const suggestions = await svc.suggestions({})
    expect(suggestions.length).toBeGreaterThan(0)
    expect(typeof suggestions[0]!.term).toBe('string')

    const rels = await svc.synonymRelations()
    expect(Array.isArray(rels)).toBe(true)
    expect(rels[0] ? ['synonym', 'broader', 'narrower', 'related'].includes(rels[0]!.type) : true).toBe(true)

    const trans = await svc.translations()
    expect(trans.length).toBeGreaterThan(0)
    expect(trans[0]!.termId).toBeTruthy()

    const extracted = await svc.extractedTerms()
    expect(extracted.length).toBeGreaterThan(0)
    expect(['pending', 'approved', 'rejected']).toContain(extracted[0]!.status)

    const tree = await svc.categoryTree()
    expect(tree.length).toBeGreaterThan(0)
    expect(tree[0]!.children).toEqual([])
    expect(typeof tree[0]!.count).toBe('number')
  })

  it('create / update / delete: 内存 CRUD 生效', async () => {
    const created = await svc.create({ term: 'Wave1A测试术语', pinyin: 'ceshi', category: 'finding' })
    expect(created.id).toBeTruthy()
    expect(created.term).toBe('Wave1A测试术语')

    const updated = await svc.update(created.id, { definition: '更新定义' })
    expect(updated.definition).toBe('更新定义')

    const del = await svc.delete(created.id)
    expect(del.deleted).toBe(true)
    await expect(svc.getById(created.id)).rejects.toThrow()
  })

  it('delete: seed 术语删除后从列表移除', async () => {
    const before = await svc.list()
    const target = before[0]!
    await svc.delete(target.id)
    const after = await svc.list()
    expect(after.some((t) => t.id === target.id)).toBe(false)
  })
})
