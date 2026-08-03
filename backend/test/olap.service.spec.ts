import { Test } from '@nestjs/testing'
import { OlapService } from '../src/modules/olap/olap.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('OlapService', () => {
  let svc: OlapService
  let prisma: any

  const mockPrisma = { $queryRaw: jest.fn() }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [OlapService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile()
    svc = module.get(OlapService)
    prisma = module.get(PrismaService)
  })

  beforeEach(() => jest.clearAllMocks())

  const lastSql = () => {
    const calls = mockPrisma.$queryRaw.mock.calls
    return calls[calls.length - 1][0]
  }

  it('getMetadata exposes metrics and dimensions', () => {
    const m = svc.getMetadata()
    expect(m.metrics.length).toBeGreaterThanOrEqual(30)
    expect(m.dimensions).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'date' }),
      expect.objectContaining({ id: 'modality' }),
    ]))
  })

  it('executeQuery returns columns, rows and total', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ date: '2026-07-01', exam_count: 3 }])
    const r = (await svc.executeQuery({ dimensions: ['date', 'modality'], measures: ['exam_count'], granularity: 'daily' })) as any
    expect(r.rows).toHaveLength(1)
    expect(r.total).toBe(1)
    expect(r.columns).toEqual([
      { key: 'date', name: '日期', type: 'dimension' },
      { key: 'modality', name: '检查类型', type: 'dimension' },
      { key: 'exam_count', name: '检查量', type: 'measure' },
    ])
    const sql = lastSql()
    expect(sql.text).toContain('FROM "exams" e')
    expect(sql.text).toContain('TO_CHAR')
    expect(sql.text).toContain('GROUP BY')
  })

  it('caches identical queries within TTL', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ exam_count: 1 }])
    const q = { dimensions: [], measures: ['exam_count'] }
    await svc.executeQuery(q)
    await svc.executeQuery(q)
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1)
  })

  it('supports granularity variants and unknown dimensions are skipped', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([])
    for (const granularity of ['yearly', 'quarterly', 'monthly', 'weekly', 'daily', 'hourly']) {
      await svc.executeQuery({ dimensions: ['date'], measures: ['report_count'], granularity })
    }
    await svc.executeQuery({ dimensions: ['unknown_dim'], measures: ['unknown_measure'] })
    const sql = lastSql()
    expect(sql.text).toContain('NULL')
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(7)
  })

  it('builds comparison filters', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([])
    await svc.executeQuery({ dimensions: [], measures: ['exam_count'], filters: [
      { dimension: 'modality', operator: 'eq', value: 'CT' },
      { dimension: 'date', operator: 'gte', value: '2026-01-01' },
      { dimension: 'device', operator: 'lt', value: 'z' },
      { dimension: 'gender', operator: 'ne', value: 'M' },
    ] })
    const sql = lastSql()
    expect(sql.text).toContain('=')
    expect(sql.text).toContain('>=')
    expect(sql.text).toContain('<')
    expect(sql.text).toContain('<>')
  })

  it('builds in, like and between filters', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([])
    await svc.executeQuery({ dimensions: [], measures: ['exam_count'], filters: [
      { dimension: 'modality', operator: 'in', value: ['CT', 'MR'] },
      { dimension: 'doctor', operator: 'like', value: '王' },
      { dimension: 'date', operator: 'between', value: ['2026-01-01', '2026-12-31'] },
    ] })
    const sql = lastSql()
    expect(sql.text).toContain('IN (')
    expect(sql.text).toContain('LIKE')
    expect(sql.text).toContain('::timestamp')
  })

  it('skips invalid or empty filters and sorts with limit/offset', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([])
    await svc.executeQuery({
      dimensions: ['modality', 'date'],
      measures: ['exam_count'],
      granularity: 'monthly',
      filters: [
        { dimension: 'modality', operator: 'unsupported', value: 'x' },
        { dimension: 'unknown', operator: 'eq', value: 'x' },
        { dimension: 'modality', operator: 'in', value: [] },
      ],
      orderBy: [{ dimension: 'date', direction: 'DESC' }, { dimension: 'unknown', direction: 'ASC' }],
      limit: 10,
      offset: 20,
    })
    const sql = lastSql()
    expect(sql.text).toContain('ORDER BY')
    expect(sql.text).toContain('LIMIT $')
    expect(sql.text).toContain('OFFSET $')
    expect(sql.values).toEqual(expect.arrayContaining([10, 20]))
  })

  it('uses plain date expression when no granularity and raw operators map to symbols', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([])
    await svc.executeQuery({
      dimensions: ['date'],
      measures: ['exam_count'],
      filters: [
        { dimension: 'modality', operator: '=', value: 'MR' },
        { dimension: 'date', operator: '>', value: '2026-01-01' },
      ],
    })
    const sql = lastSql()
    expect(sql.text).toContain("TO_CHAR")
    expect(sql.text).toContain('e.modality = ')
    expect(sql.text).toContain('e.completed_at >')
  })
})
