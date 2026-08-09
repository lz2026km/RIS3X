/**
 * [G005 Wave1A] P0 验证 spec
 * 1. triage: batchScore + getStats (aiTriageApi 对齐)
 * 2. audit: aggregation (AuditCompliancePage)
 * 3. stats: top-devices / top-modalities / export.csv
 */
import { TriageService } from '../src/modules/triage/triage.service'
import { AuditService } from '../src/modules/audit/audit.service'
import { StatsService } from '../src/modules/stats/stats.service'

const makeCache = () => ({
  get: jest.fn().mockResolvedValue(undefined),
  set: jest.fn().mockResolvedValue(undefined),
  reset: jest.fn().mockResolvedValue(undefined),
})

const baseTriage = {
  examId: 'E1',
  patientId: 'P1',
  patientName: '张三',
  examType: 'CT头+CTA',
}

describe('Wave1A P0 — triage batchScore/getStats', () => {
  const makePrisma = (overrides: Record<string, unknown> = {}) => ({
    triageRecord: {
      findFirst: jest.fn().mockRejectedValue(new Error('no db')),
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      findUnique: jest.fn().mockRejectedValue(new Error('no db')),
      create: jest.fn().mockRejectedValue(new Error('no db')),
      update: jest.fn().mockRejectedValue(new Error('no db')),
      ...(overrides.triageRecord ?? {}),
    },
  })

  it('batchScore 逐条评分并返回 aiConfidence/reasoning/status', async () => {
    const svc = new TriageService(makePrisma() as never)
    const results = await svc.batchScore([
      { ...baseTriage, symptoms: '突发胸痛, 主动脉夹层待排' },
      { ...baseTriage, examId: 'E2', examType: 'MR腰椎', symptoms: '' },
    ])
    expect(results).toHaveLength(2)
    expect(results[0]!.score).toBeGreaterThan(results[1]!.score)
    expect(results[0]!.aiConfidence).toBeGreaterThan(0.7)
    expect(results[0]!.reasoning).toContain('综合得分')
    expect(results[0]!.status).toBe('PENDING')
    expect(results[1]!.level).toBeDefined()
  })

  it('getStats 从 DB 聚合 (byLevel/avgScore)', async () => {
    const svc = new TriageService(makePrisma({
      triageRecord: {
        findMany: jest.fn().mockResolvedValue([
          { score: 20, status: 'PENDING' },
          { score: 8, status: 'ASSIGNED' },
        ]),
      },
    }) as never)
    const stats = await svc.getStats()
    expect(stats.total).toBe(2)
    expect(stats.byLevel).toEqual({ CRITICAL: 1, SEMI_URGENT: 1 })
    expect(stats.avgScore).toBe(14)
    expect(stats.accuracy).toBe(95)
  })

  it('getStats DB 空时回退确定性 seed', async () => {
    const svc = new TriageService(makePrisma({
      triageRecord: { findMany: jest.fn().mockResolvedValue([]) },
    }) as never)
    const a = await svc.getStats()
    const b = await svc.getStats()
    expect(a).toEqual(b)
    expect(a.total).toBeGreaterThan(0)
    expect(a.byLevel.CRITICAL).toBeGreaterThan(0)
  })

  it('getStats DB 异常且无内存记录时回退 seed', async () => {
    const svc = new TriageService(makePrisma() as never)
    const stats = await svc.getStats()
    expect(stats.total).toBe(120)
    expect(stats.accuracy).toBe(95)
  })
})

describe('Wave1A P0 — audit aggregation', () => {
  const makePrisma = (overrides: Record<string, unknown> = {}) => ({
    auditLog: {
      count: jest.fn().mockResolvedValue(0),
      findMany: jest.fn().mockResolvedValue([]),
      ...(overrides.auditLog ?? {}),
    },
  })

  it('按 action/resource/user 聚合, 含 total/last24h/denied', async () => {
    const now = new Date()
    const prisma = makePrisma({
      auditLog: {
        count: jest
          .fn()
          .mockResolvedValueOnce(5) // total
          .mockResolvedValueOnce(2) // last24h
          .mockResolvedValueOnce(1), // denied
        findMany: jest.fn().mockResolvedValue([
          { action: 'CREATE', resource: 'reports', userId: 'u1' },
          { action: 'CREATE', resource: 'reports', userId: 'u1' },
          { action: 'LOGIN', resource: 'auth', userId: 'u2' },
          { action: 'DELETE', resource: 'reports', userId: 'u2', success: false },
          { action: 'UPDATE', resource: 'patients', userId: null },
        ]),
      },
    })
    const svc = new AuditService(prisma as never)
    const agg = await svc.aggregation()
    expect(agg.total).toBe(5)
    expect(agg.last24h).toBe(2)
    expect(agg.denied).toBe(1)
    expect(agg.byAction).toEqual({ CREATE: 2, LOGIN: 1, DELETE: 1, UPDATE: 1 })
    expect(agg.byResource).toEqual({ reports: 3, auth: 1, patients: 1 })
    expect(agg.byUser).toEqual([
      { userId: 'u1', count: 2 },
      { userId: 'u2', count: 2 },
      { userId: 'system', count: 1 },
    ])
    void now
  })
})

describe('Wave1A P0 — stats top-devices/top-modalities/export.csv', () => {
  const makePrisma = (overrides: Record<string, unknown> = {}) => {
    const prisma: Record<string, unknown> = {
      exam: {
        findMany: jest.fn().mockRejectedValue(new Error('no db')),
        groupBy: jest.fn().mockRejectedValue(new Error('no db')),
        count: jest.fn().mockRejectedValue(new Error('no db')),
      },
      report: { findMany: jest.fn().mockRejectedValue(new Error('no db')), count: jest.fn().mockRejectedValue(new Error('no db')) },
      criticalValue: { findMany: jest.fn().mockRejectedValue(new Error('no db')), count: jest.fn().mockRejectedValue(new Error('no db')) },
      reportQualityScore: { findMany: jest.fn().mockRejectedValue(new Error('no db')) },
      patient: { count: jest.fn().mockRejectedValue(new Error('no db')) },
      device: { count: jest.fn().mockRejectedValue(new Error('no db')), findMany: jest.fn().mockRejectedValue(new Error('no db')) },
      user: { count: jest.fn().mockRejectedValue(new Error('no db')) },
      ...overrides,
    }
    return prisma as never
  }

  it('top-devices 按 Exam 分组 (deviceId/count), DB 空时回退确定性 seed', async () => {
    const svc = new StatsService(makeCache() as never, makePrisma({
      exam: {
        groupBy: jest.fn().mockResolvedValue([
          { deviceId: 'D1', _count: { deviceId: 30 } },
          { deviceId: 'D2', _count: { deviceId: 12 } },
        ]),
      },
      device: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'D1', name: 'CT-1', modality: 'CT' },
        ]),
      },
    }))
    const rows = await svc.getTopDevices(10)
    expect(rows[0]).toMatchObject({ deviceId: 'D1', deviceName: 'CT-1', modality: 'CT', count: 30 })
    expect(rows[1]).toMatchObject({ deviceId: 'D2', count: 12 })

    const emptySvc = new StatsService(makeCache() as never, makePrisma())
    const seed = await emptySvc.getTopDevices(10)
    expect(seed.length).toBeGreaterThan(0)
    expect(seed.every((r) => r.deviceId && typeof r.count === 'number')).toBe(true)
  })

  it('top-modalities 按 modality 分组, 空数据回退 seed (确定性)', async () => {
    const svc = new StatsService(makeCache() as never, makePrisma({
      exam: {
        groupBy: jest.fn().mockResolvedValue([
          { modality: 'CT', _count: { modality: 40 } },
          { modality: 'MR', _count: { modality: 10 } },
        ]),
      },
    }))
    const rows = await svc.getTopModalities(10)
    expect(rows).toEqual([
      { modality: 'CT', count: 40 },
      { modality: 'MR', count: 10 },
    ])

    const emptySvc = new StatsService(makeCache() as never, makePrisma())
    const a = await emptySvc.getTopModalities(10)
    const b = await emptySvc.getTopModalities(10)
    expect(a).toEqual(b)
    expect(a.length).toBeGreaterThan(0)
  })

  it('export.csv 复用 daily/trend 数据生成 CSV (含 BOM/表头)', async () => {
    const svc = new StatsService(makeCache() as never, makePrisma())
    const csv = await svc.exportCsv()
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('date,examCount,reportCount,criticalCount,cosignCount,avgTAT,defectCount,qcAvgScore')
    const lines = csv.split('\r\n')
    expect(lines.length).toBeGreaterThan(30) // 30 天趋势 + 今日 daily 汇总
  })
})
