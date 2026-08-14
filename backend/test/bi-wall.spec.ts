// [v3.0.6.11-99 Wave 5B] BI 大屏模板库 + 医生绩效 spec
// 覆盖: wall-templates CRUD (6+ 用例) + physician-performance (4 用例)
import { BiService } from '../src/modules/bi/bi.service'

const makeCache = () => ({
  get: jest.fn().mockResolvedValue(undefined),
  set: jest.fn().mockResolvedValue(undefined),
})

const makeSystemConfig = (values: Record<string, unknown> = {}) => ({
  getNumber: jest.fn(async (key: string, fb: number) => {
    const v = values[key]
    return typeof v === 'number' ? v : fb
  }),
  getString: jest.fn(async (key: string, fb: string) => (typeof values[key] === 'string' ? values[key] : fb)),
  get: jest.fn(),
  invalidate: jest.fn(),
} as never)

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const prisma: Record<string, unknown> = {
    exam: { count: jest.fn().mockRejectedValue(new Error('no db')), findMany: jest.fn().mockRejectedValue(new Error('no db')) },
    report: {
      count: jest.fn().mockRejectedValue(new Error('no db')),
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
    },
    criticalValue: { findMany: jest.fn().mockRejectedValue(new Error('no db')) },
    oeeRecord: { findMany: jest.fn().mockRejectedValue(new Error('no db')) },
    device: { findMany: jest.fn().mockRejectedValue(new Error('no db')) },
    ...overrides,
  }
  return prisma as never
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000)

describe('BiService wall templates (Wave 5B-A)', () => {
  let service: BiService

  beforeEach(() => {
    service = new BiService(makePrisma(), makeCache() as never, makeSystemConfig())
  })

  it('listWallTemplates returns 5 seeded templates covering all layouts', () => {
    const res = service.listWallTemplates()
    expect(res.source).toBe('database')
    expect(res.data.length).toBeGreaterThanOrEqual(5)
    const layouts = new Set(res.data.map((t) => t.layout))
    expect(layouts).toEqual(new Set(['overview', 'equipment', 'quality', 'finance', 'mixed']))
    expect(res.data.some((t) => t.active)).toBe(true)
  })

  it('createWallTemplate adds a template with generated id and config', () => {
    const created = service.createWallTemplate({
      name: '急诊夜班看板',
      layout: 'mixed',
      config: { blocks: ['kpi', 'critical', 'occupancy'], autoRotateMs: 8000 },
      active: true,
    })
    expect(created.id).toMatch(/^wall-/)
    expect(created.name).toBe('急诊夜班看板')
    expect(created.layout).toBe('mixed')
    expect(created.config.autoRotateMs).toBe(8000)
    const found = service.getWallTemplate(created.id)
    expect(found?.name).toBe('急诊夜班看板')
    expect(service.listWallTemplates().data.length).toBeGreaterThanOrEqual(6)
  })

  it('createWallTemplate rejects empty name / invalid layout', () => {
    expect(() => service.createWallTemplate({ name: '', layout: 'overview' })).toThrow()
    expect(() => service.createWallTemplate({ name: 'x', layout: 'bad' as never })).toThrow()
  })

  it('updateWallTemplate modifies name/layout/config and bumps updatedAt', () => {
    const created = service.createWallTemplate({ name: '旧名', layout: 'quality' })
    const updated = service.updateWallTemplate(created.id, { name: '质控重点', layout: 'finance', active: true })
    expect(updated?.name).toBe('质控重点')
    expect(updated?.layout).toBe('finance')
    expect(updated?.active).toBe(true)
    expect(new Date(updated!.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(created.updatedAt).getTime())
  })

  it('updateWallTemplate returns null for unknown id and rejects empty name', () => {
    expect(service.updateWallTemplate('wall-nope', { name: 'x' })).toBeNull()
    const created = service.createWallTemplate({ name: 'ok', layout: 'overview' })
    expect(() => service.updateWallTemplate(created.id, { name: ' ' })).toThrow()
  })

  it('deleteWallTemplate removes the template', () => {
    const created = service.createWallTemplate({ name: '待删', layout: 'overview' })
    const before = service.listWallTemplates().data.length
    const res = service.deleteWallTemplate(created.id)
    expect(res.deleted).toBe(true)
    expect(service.listWallTemplates().data.length).toBe(before - 1)
    expect(service.getWallTemplate(created.id)).toBeNull()
    expect(service.deleteWallTemplate('wall-nope').deleted).toBe(false)
  })

  it('getWallTemplate returns null for unknown id', () => {
    expect(service.getWallTemplate('wall-404')).toBeNull()
  })
})

describe('BiService physician performance (Wave 5B-B)', () => {
  it('demo fallback returns rules + rows with bonus = rvu × unitPrice × coefficient', async () => {
    const service = new BiService(makePrisma(), makeCache() as never, makeSystemConfig({ rvu_unit_price: 10 }))
    const res = await service.getPhysicianPerformance()
    expect(res.source).toBe('demo')
    expect(res.data.byPhysician.length).toBeGreaterThan(0)
    expect(res.data.rules.rvuUnitPrice).toBe(10)
    for (const p of res.data.byPhysician) {
      const expected = Math.round(p.rvu * 10 * p.qualityCoefficient * 100) / 100
      expect(p.bonus).toBeCloseTo(expected, 1)
    }
    expect(res.data.totalRvu).toBeGreaterThan(0)
    expect(res.data.bonus).toBeGreaterThan(0)
    expect(res.data.accuracyScore).toBeGreaterThanOrEqual(0)
  })

  it('database path derives bonus from reports + ReportQualityScore', async () => {
    const prisma = makePrisma({
      report: {
        count: jest.fn().mockRejectedValue(new Error('no db')),
        findMany: jest.fn().mockResolvedValue([
          {
            createdAt: hoursAgo(2),
            signedAt: hoursAgo(1.5),
            radiologist: { fullName: '张三' },
            exam: { modality: 'CT' },
            ReportQualityScore: [{ totalScore: 96, dimensions: { accuracy: 95 } }],
          },
          {
            createdAt: hoursAgo(1),
            signedAt: hoursAgo(0.5),
            radiologist: { fullName: '李四' },
            exam: { modality: 'DR' },
            ReportQualityScore: [{ totalScore: 80, dimensions: { accuracy: 78 } }],
          },
        ]),
      },
    })
    const service = new BiService(prisma, makeCache() as never, makeSystemConfig({ rvu_unit_price: 12 }))
    const res = await service.getPhysicianPerformance()
    expect(res.source).toBe('database')
    const zhang = res.data.byPhysician.find((p) => p.doctorName === '张三')!
    expect(zhang.reportCount).toBe(1)
    expect(zhang.rvu).toBe(3.5) // CT
    expect(zhang.qualityScore).toBe(96)
    expect(zhang.accuracyScore).toBe(95)
    expect(zhang.qualityCoefficient).toBe(1.15)
    expect(zhang.bonus).toBeCloseTo(3.5 * 12 * 1.15, 1) // 48.3
    const li = res.data.byPhysician.find((p) => p.doctorName === '李四')!
    expect(li.qualityCoefficient).toBe(0.9)
    expect(li.bonus).toBeCloseTo(1 * 12 * 0.9, 1) // DR rvu=1 → 10.8
    expect(res.data.reportCount).toBe(2)
    expect(res.data.totalRvu).toBeCloseTo(4.5, 1)
    expect(res.data.bonus).toBeCloseTo(48.3 + 10.8, 1)
  })

  it('database path with no reports falls back to demo source', async () => {
    const prisma = makePrisma({
      report: { count: jest.fn().mockRejectedValue(new Error('no db')), findMany: jest.fn().mockResolvedValue([]) },
    })
    const service = new BiService(prisma, makeCache() as never, makeSystemConfig())
    const res = await service.getPhysicianPerformance()
    expect(res.source).toBe('demo')
  })

  it('aggregates avgTurnaround weighted by report count', async () => {
    const prisma = makePrisma({
      report: {
        count: jest.fn().mockRejectedValue(new Error('no db')),
        findMany: jest.fn().mockResolvedValue([
          { createdAt: hoursAgo(2), signedAt: hoursAgo(1), radiologist: { fullName: '王五' }, exam: { modality: 'US' }, ReportQualityScore: [] },
          { createdAt: hoursAgo(1), signedAt: hoursAgo(0.5), radiologist: { fullName: '王五' }, exam: { modality: 'US' }, ReportQualityScore: [] },
        ]),
      },
    })
    const service = new BiService(prisma, makeCache() as never, makeSystemConfig())
    const res = await service.getPhysicianPerformance()
    const wang = res.data.byPhysician.find((p) => p.doctorName === '王五')!
    expect(wang.reportCount).toBe(2)
    expect(wang.avgTurnaround).toBeCloseTo(45, 0) // (60+30)/2
    expect(res.data.avgTurnaround).toBeCloseTo(45, 0)
  })
})
