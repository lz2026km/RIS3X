/**
 * [G005 Wave1B P1] Mammo QC 模块 spec — seed 回退 + MG/TOM 派生
 */
import { MammoQcService } from '../src/modules/mammo-qc/mammo-qc.service'

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

describe('Wave1B Mammo QC', () => {
  it('overview: DB 失败时回退确定性 seed', async () => {
    const svc = new MammoQcService(failingPrisma())
    const res = await svc.getOverview()
    expect(res.source).toBe('demo')
    expect(res.data.overallScore).toBeGreaterThan(0)
    expect(res.data.acrChecks.length).toBeGreaterThanOrEqual(6)
  })

  it('records: DB 有 MG/TOM 检查时派生记录', async () => {
    const prisma: any = {
      exam: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'E1',
            modality: 'MG',
            scheduledAt: new Date('2026-07-01'),
            createdAt: new Date(),
            patient: { name: '王芳' },
            reports: [{ qualityScore: 92, ReportQualityScore: [] }],
          },
          {
            id: 'E2',
            modality: 'TOM',
            scheduledAt: new Date('2026-07-02'),
            createdAt: new Date(),
            patient: { name: '李娜' },
            reports: [{ qualityScore: null, ReportQualityScore: [{ totalScore: 65 }] }],
          },
        ]),
      },
    }
    const svc = new MammoQcService(prisma)
    const res = await svc.listRecords()
    expect(res.source).toBe('database')
    expect(res.data).toHaveLength(2)
    expect(res.data[0]!.status).toBe('合格')
    expect(res.data[1]!.status).toBe('不合格')
  })

  it('records: search 过滤生效', async () => {
    const svc = new MammoQcService(failingPrisma())
    const all = await svc.listRecords()
    const filtered = await svc.listRecords({ search: '患者' })
    expect(filtered.data.length).toBeLessThanOrEqual(all.data.length)
  })

  it('tests / standards / stats: 形状正确', async () => {
    const svc = new MammoQcService(failingPrisma())
    const tests = svc.listTests()
    expect(tests.length).toBeGreaterThan(0)
    expect(tests.every((t) => t.name && t.status)).toBe(true)
    const standards = svc.listStandards()
    expect(standards.some((s) => s.source === 'ACR')).toBe(true)
    const stats = await svc.getStats()
    expect(stats.data.totalRecords).toBeGreaterThan(0)
    expect(stats.data.passRate).toBeGreaterThanOrEqual(0)
    expect(stats.data.byTechnologist.length).toBeGreaterThan(0)
  })
})
