/**
 * [G005 Wave1B P1] Terminology 模块 spec — DictEntry 派生 + seed 回退 + 内存 CRUD
 */
import { TerminologyService } from '../src/modules/terminology/terminology.service'

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

describe('Wave1B Terminology', () => {
  it('mappings: DB 失败时回退确定性 seed', async () => {
    const svc = new TerminologyService(failingPrisma())
    const mappings = await svc.listMappings()
    expect(mappings.length).toBeGreaterThan(0)
    expect(mappings.every((m) => m.id && m.source && m.target)).toBe(true)
  })

  it('mappings: DB 有字典条目时派生映射', async () => {
    const prisma: any = {
      dictEntry: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'D1', category: 'diagnosis', key: 'M-123', value: '肺结节', active: true, updatedAt: new Date() },
          { id: 'D2', category: 'bodyPart', key: 'B-1', value: '胸部', active: false, updatedAt: new Date() },
        ]),
      },
    }
    const svc = new TerminologyService(prisma)
    const mappings = await svc.listMappings()
    expect(mappings.some((m) => m.id.startsWith('TM-DB-'))).toBe(true)
    expect(mappings.find((m) => m.source === '胸部')?.status).toBe('retired')
  })

  it('createMapping / deleteMapping: 内存 CRUD + NotFound', async () => {
    const svc = new TerminologyService(failingPrisma())
    const created = svc.createMapping({ source: '新术语', target: 'New term' })
    expect((await svc.listMappings()).some((m) => m.id === created.id)).toBe(true)
    svc.deleteMapping(created.id)
    expect((await svc.listMappings()).some((m) => m.id === created.id)).toBe(false)
    expect(() => svc.deleteMapping('not-exist')).toThrow()
  })

  it('systems / stats: 形状正确', async () => {
    const svc = new TerminologyService(failingPrisma())
    const systems = svc.listSystems()
    expect(systems.some((s) => s.system === 'SNOMED CT')).toBe(true)
    const stats = await svc.getStats()
    expect(stats.systems).toBe(systems.length)
    expect(stats.totalMappings).toBeGreaterThan(0)
    expect(stats.activeMappings).toBeGreaterThan(0)
    expect(stats.onlineSystems).toBeGreaterThan(0)
  })
})
