import { NotFoundException } from '@nestjs/common'
import { VnaService, VnaObjectDto } from '../src/modules/vna/vna.service'

// [v3.0.6.11-99 Wave 10E-3] vna 扩展端点: overview / storage-trend / by-tier / verify / duplicate-analysis
describe('VnaService Wave10E-3 (overview/storage-trend/by-tier/verify/duplicate-analysis)', () => {
  const objectRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'vna-obj-1',
    tenantId: 't1',
    patientId: 'P001',
    studyUid: null,
    objectType: 'document',
    name: '检查申请单.pdf',
    description: '',
    mimeType: 'application/pdf',
    size: 102400,
    storagePath: null,
    wormLocked: false,
    createdAt: new Date(),
    ...overrides,
  })

  const makePrisma = (overrides: Record<string, unknown> = {}) => ({
    vnaObject: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
    },
    dicomInstance: { findMany: jest.fn(), count: jest.fn().mockResolvedValue(0) },
    ...overrides,
  })

  let svc: VnaService
  let mockPrisma: any

  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma = makePrisma()
    mockPrisma.vnaObject.findMany.mockRejectedValue(new Error('no db'))
    mockPrisma.vnaObject.count.mockRejectedValue(new Error('no db'))
    mockPrisma.vnaObject.aggregate.mockRejectedValue(new Error('no db'))
    mockPrisma.dicomInstance.findMany.mockRejectedValue(new Error('no db'))
    svc = new VnaService(mockPrisma)
  })

  describe('getOverview', () => {
    it('aggregates totals/tiers/growth from DB stats + objects', async () => {
      const today = new Date()
      mockPrisma.vnaObject.count.mockResolvedValueOnce(6).mockResolvedValueOnce(1).mockResolvedValueOnce(5)
      mockPrisma.vnaObject.aggregate.mockResolvedValue({ _sum: { size: 600000 } })
      mockPrisma.vnaObject.findMany.mockResolvedValue([
        objectRow({ id: 'o1', name: 'a.pdf', size: 100000, createdAt: today }),
        objectRow({ id: 'o2', name: 'b.pdf', size: 200000, createdAt: new Date(Date.now() - 40 * 86400000) }),
        objectRow({ id: 'o3', name: 'c.png', objectType: 'image', size: 300000, createdAt: today, wormLocked: true }),
      ])
      const r = await svc.getOverview()
      expect(r.storageSource).toBe('database')
      expect(r.seeded).toBe(false)
      expect(r.totalObjects).toBe(6)
      expect(r.totalSizeBytes).toBe(600000)
      expect(r.wormLockedCount).toBe(1)
      expect(r.last30dNewObjects).toBe(2)
      expect(r.growthRate).toBe(33.3)
      expect(r.byTier).toHaveLength(3)
      expect(r.byTier[0]).toMatchObject({ tier: 'hot', count: 3 })
    })

    it('falls back gracefully when DB is down (memory source)', async () => {
      const r = await svc.getOverview()
      expect(r.storageSource).toBe('memory')
      expect(r.totalObjects).toBe(0)
      expect(r.totalSizeBytes).toBe(0)
      expect(r.byTier).toHaveLength(3)
    })
  })

  describe('getStorageTrend', () => {
    it('buckets daily additions with cumulative total from DB', async () => {
      const today = new Date()
      today.setHours(10, 0, 0, 0)
      const yesterday = new Date(today.getTime() - 86400000)
      mockPrisma.vnaObject.findMany.mockResolvedValue([
        objectRow({ id: 'old', size: 1000000, createdAt: new Date(today.getTime() - 10 * 86400000) }),
        objectRow({ id: 'y1', size: 1000, createdAt: yesterday }),
        objectRow({ id: 'y2', size: 2000, createdAt: yesterday }),
        objectRow({ id: 't1', size: 4000, createdAt: today }),
      ])
      const r = await svc.getStorageTrend(7)
      expect(r).toHaveLength(7)
      expect(r.every((p) => p.seeded === false)).toBe(true)
      const y = r.find((p) => vnaLabelOf(yesterday) === p.label)!
      expect(y.newObjects).toBe(2)
      expect(y.addedBytes).toBe(3000)
      const t = r[r.length - 1]!
      expect(t.newObjects).toBe(1)
      expect(t.totalSizeBytes).toBe(1000000 + 3000 + 4000)
    })

    it('returns deterministic seed curve when no data', async () => {
      const r = await svc.getStorageTrend(30)
      expect(r).toHaveLength(30)
      expect(r.every((p) => p.seeded)).toBe(true)
      expect(r[0].totalSizeBytes).toBeGreaterThan(0)
      for (let i = 1; i < r.length; i++) {
        expect(r[i]!.totalSizeBytes).toBeGreaterThan(r[i - 1]!.totalSizeBytes)
      }
      const again = await svc.getStorageTrend(30)
      expect(again).toEqual(r)
    })
  })

  describe('getByTier', () => {
    it('groups objects into hot/warm/cold with type split', async () => {
      mockPrisma.vnaObject.findMany.mockResolvedValue([
        objectRow({ id: 'o1', objectType: 'document' }),
        objectRow({ id: 'o2', objectType: 'image' }),
        objectRow({ id: 'o3', objectType: 'document' }),
      ])
      const r = await svc.getByTier()
      expect(r).toHaveLength(3)
      expect(r[0]).toMatchObject({ tier: 'hot', tierZh: '热层', count: 3 })
      expect(r[0].documents).toBe(2)
      expect(r[0].images).toBe(1)
      expect(r[0].percent).toBe(100)
      // 迁移一个到 warm 后再次统计
      mockPrisma.vnaObject.findFirst.mockResolvedValue(objectRow({ id: 'o2', objectType: 'image' }))
      await svc.migrateObject('o2', 'warm', 'test')
      const r2 = await svc.getByTier()
      expect(r2.find((t) => t.tier === 'warm')!.count).toBe(1)
      expect(r2.find((t) => t.tier === 'hot')!.count).toBe(2)
    })
  })

  describe('verifyObject', () => {
    it('returns integrity-ok when stored content matches size', async () => {
      const buffer = Buffer.from('hello vna')
      mockPrisma.vnaObject.findFirst.mockResolvedValue(objectRow({ id: 'v1', name: 'note.txt', mimeType: 'text/plain', size: buffer.length, storagePath: null }))
      mockPrisma.vnaObject.findMany.mockRejectedValue(new Error('no db'))
      svc = new VnaService(mockPrisma)
      const mem: any = (svc as any).memory
      mem.set('v1', { id: 'v1', tenantId: 't1', patientId: null, studyUid: null, objectType: 'document', name: 'note.txt', description: '', mimeType: 'text/plain', size: buffer.length, storagePath: null, wormLocked: false, createdAt: new Date(), buffer })
      const r = await svc.verifyObject('v1')
      expect(r.status).toBe('integrity-ok')
      expect(r.sizeMatch).toBe(true)
      expect(r.checksum).toMatch(/^[0-9a-f]{16}$/)
      expect(r.sizeBytes).toBe(buffer.length)
    })

    it('reports content-missing when object has no content', async () => {
      mockPrisma.vnaObject.findFirst.mockResolvedValue(objectRow({ id: 'v2', name: 'empty.pdf', storagePath: null }))
      mockPrisma.vnaObject.findMany.mockRejectedValue(new Error('no db'))
      mockPrisma.vnaObject.count.mockRejectedValue(new Error('no db'))
      const r = await svc.verifyObject('v2')
      // getObjectContent 回退返回元数据 JSON, 尺寸不匹配 → size-mismatch
      expect(r.status).toBe('size-mismatch')
      expect(r.sizeMatch).toBe(false)
    })

    it('throws NotFoundException for unknown object', async () => {
      mockPrisma.vnaObject.findFirst.mockResolvedValue(null)
      await expect(svc.verifyObject('nope')).rejects.toThrow(NotFoundException)
    })
  })

  describe('getDuplicateAnalysis', () => {
    it('groups duplicates by name+size with wasted bytes from DB', async () => {
      mockPrisma.vnaObject.findMany.mockResolvedValue([
        objectRow({ id: 'd1', name: '报告.pdf', size: 1000, createdAt: new Date('2026-01-01') }),
        objectRow({ id: 'd2', name: '报告.pdf', size: 1000, createdAt: new Date('2026-02-01') }),
        objectRow({ id: 'd3', name: '报告.pdf', size: 1000, createdAt: new Date('2026-03-01') }),
        objectRow({ id: 'd4', name: 'unique.png', objectType: 'image', size: 5000, createdAt: new Date('2026-04-01') }),
      ])
      const r = await svc.getDuplicateAnalysis()
      expect(r.seeded).toBe(false)
      expect(r.totalDuplicates).toBe(1)
      expect(r.groups[0]).toMatchObject({ name: '报告.pdf', size: 1000, count: 3, wastedBytes: 2000 })
      expect(r.groups[0].objectIds).toHaveLength(3)
      expect(r.wastedBytes).toBe(2000)
    })

    it('returns deterministic seed duplicates when archive empty', async () => {
      const r = await svc.getDuplicateAnalysis()
      expect(r.seeded).toBe(true)
      expect(r.totalDuplicates).toBe(3)
      expect(r.groups[0].name).toBe('CT 平扫影像打包.zip')
      expect(r.wastedBytes).toBeGreaterThan(0)
      const again = await svc.getDuplicateAnalysis()
      expect(again).toEqual(r)
    })
  })

  // 辅助: 提取趋势点 label (yyyy-mm-dd → mm-dd)
  const vnaLabelOf = (d: Date) => {
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${m}-${day}`
  }
})
