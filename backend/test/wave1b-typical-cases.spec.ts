/**
 * [G005 Wave1B P1] Typical Cases 模块 spec — seed 回退 + DB 派生 + 内存 CRUD
 */
import { TypicalCasesService } from '../src/modules/typical-cases/typical-cases.service'

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

describe('Wave1B Typical Cases', () => {
  it('list: DB 失败时回退确定性 seed (demo 信封)', async () => {
    const svc = new TypicalCasesService(failingPrisma())
    const res = await svc.list()
    expect(res.source).toBe('demo')
    expect(res.data.length).toBeGreaterThan(0)
    expect(res.data.every((c) => c.id && c.patientName && c.disease)).toBe(true)
  })

  it('list: DB 有阳性报告时派生病例 (database 信封)', async () => {
    const prisma: any = {
      report: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'R1',
            findings: '右肺上叶磨玻璃结节',
            diagnosis: '肺结节',
            impression: '建议随访',
            isCritical: false,
            createdAt: new Date('2026-07-01'),
            exam: { modality: 'CT', bodyPart: '胸部' },
            patient: { name: '张三', gender: 'MALE', birthDate: null },
          },
        ]),
      },
    }
    const svc = new TypicalCasesService(prisma)
    const res = await svc.list()
    expect(res.source).toBe('database')
    expect(res.data[0]!.id.startsWith('tc-db-')).toBe(true)
    expect(res.data[0]!.patientName).toBe('张三')
  })

  it('stats: 汇总形状正确', async () => {
    const svc = new TypicalCasesService(failingPrisma())
    const stats = await svc.stats()
    expect(stats.data.total).toBeGreaterThan(0)
    expect(stats.data.teaching).toBeGreaterThan(0)
    expect(stats.data.views).toBeGreaterThan(0)
    expect(stats.data.likes).toBeGreaterThan(0)
  })

  it('categories: 按检查名称分组', async () => {
    const svc = new TypicalCasesService(failingPrisma())
    const cats = svc.categories()
    expect(cats.length).toBeGreaterThan(0)
    expect(cats.every((c) => c.count > 0)).toBe(true)
  })

  it('CRUD: 内存创建/更新/删除 + NotFound', async () => {
    const svc = new TypicalCasesService(failingPrisma())
    const created = svc.create({ patientName: '测试患者', examType: 'CT' })
    const got = await svc.get(created.id)
    expect(got.id).toBe(created.id)
    const updated = svc.update(created.id, { disease: '测试病种' })
    expect(updated.disease).toBe('测试病种')
    svc.delete(created.id)
    await expect(svc.get(created.id)).rejects.toThrow()
  })
})
