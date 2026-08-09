/**
 * [G005 Wave1B P1] Templates snippets 扩展 spec — 模板派生 + 内存 CRUD
 */
import { TemplatesService } from '../src/templates/templates.service'

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

describe('Wave1B Templates snippets', () => {
  it('listSnippets: DB 失败时回退确定性 seed', async () => {
    const svc = new TemplatesService(failingPrisma())
    const snippets = await svc.listSnippets()
    expect(snippets.length).toBeGreaterThan(0)
    expect(snippets.every((s) => s.name && s.content)).toBe(true)
  })

  it('listSnippets: DB 有模板时派生片段', async () => {
    const prisma: any = {
      reportTemplate: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'T1', name: '正常胸部', body: '双肺纹理清晰', category: 'CT', tags: ['ct-normal'], updatedAt: new Date() },
        ]),
      },
    }
    const svc = new TemplatesService(prisma)
    const snippets = await svc.listSnippets()
    expect(snippets.some((s) => s.id.startsWith('SN-DB-'))).toBe(true)
    expect(snippets.find((s) => s.name === '正常胸部')?.content).toBe('双肺纹理清晰')
  })

  it('createSnippet / deleteSnippet: 内存 CRUD + NotFound', async () => {
    const svc = new TemplatesService(failingPrisma())
    const created = svc.createSnippet({ name: '新片段', content: '内容', category: 'CT' })
    expect(created.id).toBeTruthy()
    const list = await svc.listSnippets()
    expect(list.some((s) => s.id === created.id)).toBe(true)
    svc.deleteSnippet(created.id)
    const after = await svc.listSnippets()
    expect(after.some((s) => s.id === created.id)).toBe(false)
    expect(() => svc.deleteSnippet('not-exist')).toThrow()
  })

  it('listSnippets: category 过滤', async () => {
    const svc = new TemplatesService(failingPrisma())
    const ct = await svc.listSnippets({ category: 'CT' })
    expect(ct.every((s) => s.category === 'CT')).toBe(true)
    expect(ct.length).toBeGreaterThan(0)
  })
})
