/**
 * [G005 Wave1B P1] OLAP 4 扩展 spec — cubes / drill-down / chart / export-csv
 */
import { OlapService } from '../src/modules/olap/olap.service'

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

describe('Wave1B OLAP extensions', () => {
  it('cubes: 预定义立方体列表 (6 个)', () => {
    const svc = new OlapService(failingPrisma())
    const cubes = svc.listCubes()
    expect(cubes.length).toBeGreaterThanOrEqual(6)
    expect(cubes.every((c) => c.id && c.dimensions.length > 0 && c.measures.length > 0)).toBe(true)
  })

  it('drill-down: 追加维度过滤后执行查询 (字符串 orderBy 兼容)', async () => {
    const prisma: any = {
      $queryRaw: jest.fn().mockResolvedValue([
        { modality: 'CT', exam_count: 10 },
        { modality: 'MR', exam_count: 5 },
      ]),
    }
    const svc = new OlapService(prisma)
    const res = await svc.drillDown({ cube: 'exam', dimension: 'modality', value: 'CT', measures: ['exam_count'] })
    expect(res.drillDown.dimension).toBe('modality')
    expect(res.rows).toHaveLength(2)
    expect(res.columns.some((c) => c.key === 'exam_count')).toBe(true)
  })

  it('chart: labels + datasets 形状 (首维度为标签)', async () => {
    const prisma: any = {
      $queryRaw: jest.fn().mockResolvedValue([
        { modality: 'CT', exam_count: 10 },
        { modality: 'MR', exam_count: 5 },
      ]),
    }
    const svc = new OlapService(prisma)
    const res = await svc.chartData({ dimensions: ['modality'], measures: ['exam_count'] })
    expect(res.labels).toEqual(['CT', 'MR'])
    expect(res.datasets).toHaveLength(1)
    expect(res.datasets[0]!.values).toEqual([10, 5])
    expect(res.datasets[0]!.label).toBe('检查量')
  })

  it('export-csv: CSV 输出含 BOM 与表头', async () => {
    const prisma: any = {
      $queryRaw: jest.fn().mockResolvedValue([
        { modality: 'CT', exam_count: 10 },
      ]),
    }
    const svc = new OlapService(prisma)
    const csv = await svc.exportCsv({ dimensions: ['modality'], measures: ['exam_count'] })
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('modality,exam_count')
    expect(csv).toContain('CT,10')
  })
})
