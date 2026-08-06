import { StatsService } from './stats.service'

const makeCache = () => ({
  get: jest.fn().mockResolvedValue(undefined),
  set: jest.fn().mockResolvedValue(undefined),
  reset: jest.fn().mockResolvedValue(undefined),
})

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const prisma: Record<string, unknown> = {
    exam: {
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      count: jest.fn().mockRejectedValue(new Error('no db')),
      groupBy: jest.fn().mockRejectedValue(new Error('no db')),
    },
    report: {
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      count: jest.fn().mockRejectedValue(new Error('no db')),
    },
    criticalValue: {
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      count: jest.fn().mockRejectedValue(new Error('no db')),
    },
    reportQualityScore: {
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
    },
    patient: { count: jest.fn().mockRejectedValue(new Error('no db')) },
    device: { count: jest.fn().mockRejectedValue(new Error('no db')) },
    user: { count: jest.fn().mockRejectedValue(new Error('no db')) },
    ...overrides,
  }
  return prisma as never
}

const base = (overrides: Partial<{ minutes: number; hours: number }> = {}) => {
  const now = new Date()
  const createdAt = new Date(now.getTime() - (overrides.minutes ?? 0) * 60000)
  const signedAt = new Date(createdAt.getTime() + (overrides.hours ?? 1) * 3600000)
  return { createdAt, signedAt }
}

describe('StatsService', () => {
  describe('getDaily — 真实聚合', () => {
    it('从 Exam/Report/CriticalValue/ReportQualityScore 聚合今日数据', async () => {
      const [r1, r2] = [base({ hours: 0.5 }), base({ hours: 1.5 })]
      const prisma = makePrisma({
        exam: {
          findMany: jest.fn().mockResolvedValue([
            { modality: 'CT' },
            { modality: 'CT' },
            { modality: 'DR' },
          ]),
        },
        report: {
          findMany: jest.fn().mockResolvedValue([
            { ...r1, coSignedAt: r1.signedAt, rectificationCount: 0 },
            { ...r2, coSignedAt: null, rectificationCount: 2 },
          ]),
        },
        criticalValue: {
          findMany: jest.fn().mockResolvedValue([{ id: 'C1' }, { id: 'C2' }]),
        },
        reportQualityScore: {
          findMany: jest.fn().mockResolvedValue([{ totalScore: 90 }, { totalScore: 70 }]),
        },
      })
      const service = new StatsService(makeCache() as never, prisma)
      const res = await service.getDaily()
      expect(res.source).toBe('database')
      expect(res.data.examCount).toBe(3)
      expect(res.data.reportCount).toBe(2)
      expect(res.data.criticalCount).toBe(2)
      expect(res.data.cosignCount).toBe(1)
      expect(res.data.defectCount).toBe(1)
      expect(res.data.qcAvgScore).toBe(80)
      expect(res.data.avgTAT).toBe(1)
      expect(res.data.byModality).toEqual({ CT: 2, DR: 1 })
      expect(res.data.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    it('空数据时回退确定性 seed 并标注 source: seed (两次结果一致, 无随机)', async () => {
      const prisma = makePrisma({
        exam: { findMany: jest.fn().mockResolvedValue([]) },
        report: { findMany: jest.fn().mockResolvedValue([]) },
        criticalValue: { findMany: jest.fn().mockResolvedValue([]) },
        reportQualityScore: { findMany: jest.fn().mockResolvedValue([]) },
      })
      const service = new StatsService(makeCache() as never, prisma)
      const a = await service.getDaily()
      const b = await service.getDaily()
      expect(a.source).toBe('seed')
      expect(a.data).toEqual(b.data)
      expect(a.data.examCount).toBeGreaterThan(0)
    })
  })

  describe('getWeekly — 近 7 天', () => {
    it('按天分桶聚合并计算总数', async () => {
      const now = new Date()
      const prisma = makePrisma({
        exam: {
          findMany: jest.fn().mockResolvedValue([
            { createdAt: new Date(now.getTime() - 0 * 86400000) },
            { createdAt: new Date(now.getTime() - 1 * 86400000) },
            { createdAt: new Date(now.getTime() - 1 * 86400000) },
            { createdAt: new Date(now.getTime() - 8 * 86400000) },
          ]),
        },
        report: { findMany: jest.fn().mockResolvedValue([{ id: 'R1' }, { id: 'R2' }]) },
        criticalValue: { findMany: jest.fn().mockResolvedValue([{ id: 'C1' }]) },
      })
      const service = new StatsService(makeCache() as never, prisma)
      const res = await service.getWeekly()
      expect(res.source).toBe('database')
      expect(res.data.daily).toHaveLength(7)
      // 窗口外(8天前)的检查不进入桶内, totalExams 取桶内汇总
      expect(res.data.totalExams).toBe(3)
      expect(res.data.totalReports).toBe(2)
      expect(res.data.totalCritical).toBe(1)
      expect(res.data.daily[6]!.count).toBe(1)
      expect(res.data.daily[5]!.count).toBe(2)
    })

    it('空数据回退 seed (确定性)', async () => {
      const prisma = makePrisma({
        exam: { findMany: jest.fn().mockResolvedValue([]) },
        report: { findMany: jest.fn().mockResolvedValue([]) },
        criticalValue: { findMany: jest.fn().mockResolvedValue([]) },
      })
      const service = new StatsService(makeCache() as never, prisma)
      const a = await service.getWeekly()
      const b = await service.getWeekly()
      expect(a.source).toBe('seed')
      expect(a.data).toEqual(b.data)
      expect(a.data.daily).toHaveLength(7)
      expect(a.data.daily.every((d) => d.count > 0)).toBe(true)
    })
  })

  describe('getWorkload — 医生工作量', () => {
    it('按 radiologistId 分组并计算报告数/检查数/平均耗时/评分', async () => {
      const r1 = base({ minutes: 0, hours: 1 })
      const r2 = base({ minutes: 10, hours: 3 })
      const prisma = makePrisma({
        report: {
          findMany: jest.fn().mockResolvedValue([
            {
              radiologistId: 'D001', examId: 'E1', ...r1, qualityScore: 90,
              radiologist: { fullName: '张医生', department: '放射科' },
            },
            {
              radiologistId: 'D001', examId: 'E2', ...r2, qualityScore: 80,
              radiologist: { fullName: '张医生', department: '放射科' },
            },
            {
              radiologistId: 'D002', examId: null, ...r1, qualityScore: 70,
              radiologist: { fullName: '李医生', department: '放射科' },
            },
          ]),
        },
      })
      const service = new StatsService(makeCache() as never, prisma)
      const res = await service.getWorkload()
      expect(res.source).toBe('database')
      expect(res.data).toHaveLength(2)
      const zh = res.data.find((d) => d.doctorId === 'D001')!
      expect(zh.doctorName).toBe('张医生')
      expect(zh.reportCount).toBe(2)
      expect(zh.examCount).toBe(2)
      expect(zh.avgTime).toBe(120)
      expect(zh.score).toBe(85)
      expect(res.data[0]!.reportCount).toBeGreaterThanOrEqual(res.data[1]!.reportCount)
    })

    it('空数据回退 seed (确定性, 无 Math.random)', async () => {
      const prisma = makePrisma({ report: { findMany: jest.fn().mockResolvedValue([]) } })
      const service = new StatsService(makeCache() as never, prisma)
      const a = await service.getWorkload()
      const b = await service.getWorkload()
      expect(a.source).toBe('seed')
      expect(a.data).toEqual(b.data)
      expect(a.data.length).toBeGreaterThan(0)
    })
  })

  describe('getQuality — 质控指标', () => {
    it('聚合平均分/分级分布/按医生/按模态/缺陷率', async () => {
      const prisma = makePrisma({
        reportQualityScore: {
          findMany: jest.fn().mockResolvedValue([
            { totalScore: 90, grade: '优秀', report: { radiologist: { fullName: '张医生' }, exam: { modality: 'CT' } } },
            { totalScore: 80, grade: '优秀', report: { radiologist: { fullName: '张医生' }, exam: { modality: 'CT' } } },
            { totalScore: 70, grade: '良好', report: { radiologist: { fullName: '李医生' }, exam: { modality: 'DR' } } },
            { totalScore: 100, grade: '优秀', report: { radiologist: null, exam: { modality: 'DR' } } },
          ]),
        },
        report: {
          findMany: jest.fn().mockResolvedValue([
            { rectificationCount: 1 },
            { rectificationCount: 0 },
            { rectificationCount: 0 },
            { rectificationCount: 2 },
          ]),
        },
      })
      const service = new StatsService(makeCache() as never, prisma)
      const res = await service.getQuality()
      expect(res.source).toBe('database')
      expect(res.data.averageScore).toBe(85)
      expect(res.data.totalScored).toBe(4)
      expect(res.data.totalReports).toBe(4)
      expect(res.data.defectRate).toBe(50)
      expect(res.data.gradeDistribution).toEqual({ 优秀: 3, 良好: 1 })
      expect(res.data.byDoctor).toHaveLength(3)
      const zhang = res.data.byDoctor.find((d) => d.doctorName === '张医生')!
      expect(zhang.score).toBe(85)
      expect(zhang.count).toBe(2)
      const dr = res.data.byModality.find((m) => m.modality === 'DR')!
      expect(dr.score).toBe(85)
    })

    it('空数据回退 seed', async () => {
      const prisma = makePrisma({
        reportQualityScore: { findMany: jest.fn().mockResolvedValue([]) },
        report: { findMany: jest.fn().mockResolvedValue([]) },
      })
      const service = new StatsService(makeCache() as never, prisma)
      const res = await service.getQuality()
      expect(res.source).toBe('seed')
      expect(res.data.averageScore).toBeGreaterThan(0)
    })
  })

  describe('getByModality — 按模态统计', () => {
    it('按模态聚合 total/days/avg', async () => {
      const prisma = makePrisma({
        exam: {
          findMany: jest.fn().mockResolvedValue([
            { modality: 'CT', createdAt: new Date(2026, 7, 6, 10, 0) },
            { modality: 'CT', createdAt: new Date(2026, 7, 6, 11, 0) },
            { modality: 'CT', createdAt: new Date(2026, 7, 5, 10, 0) },
            { modality: 'DR', createdAt: new Date(2026, 7, 5, 10, 0) },
          ]),
        },
      })
      const service = new StatsService(makeCache() as never, prisma)
      const res = await service.getByModality()
      expect(res.source).toBe('database')
      expect(res.data['CT']).toEqual({ total: 3, days: 2, avg: expect.any(Number) })
      expect(res.data['DR']).toEqual({ total: 1, days: 1, avg: expect.any(Number) })
    })
  })

  describe('getTrend — N 天趋势', () => {
    it('按 days 参数聚合逐日检查/报告/危急值', async () => {
      const now = new Date()
      const prisma = makePrisma({
        exam: {
          findMany: jest.fn().mockResolvedValue([
            { createdAt: new Date(now.getTime() - 1 * 86400000) },
          ]),
        },
        report: {
          findMany: jest.fn().mockResolvedValue([
            { createdAt: new Date(now.getTime() - 1 * 86400000), coSignedAt: now },
          ]),
        },
        criticalValue: {
          findMany: jest.fn().mockResolvedValue([
            { createdAt: new Date(now.getTime() - 1 * 86400000) },
          ]),
        },
      })
      const service = new StatsService(makeCache() as never, prisma)
      const res = await service.getTrend(3)
      expect(res.source).toBe('database')
      expect(res.data).toHaveLength(3)
      const point = res.data[1]!
      expect(point.examCount).toBe(1)
      expect(point.reportCount).toBe(1)
      expect(point.cosignCount).toBe(1)
      expect(point.criticalCount).toBe(1)
    })

    it('days 参数被限制在 1-90, 空数据回退确定性 seed', async () => {
      const prisma = makePrisma({
        exam: { findMany: jest.fn().mockResolvedValue([]) },
        report: { findMany: jest.fn().mockResolvedValue([]) },
        criticalValue: { findMany: jest.fn().mockResolvedValue([]) },
      })
      const service = new StatsService(makeCache() as never, prisma)
      const res = await service.getTrend(999)
      expect(res.source).toBe('seed')
      expect(res.data).toHaveLength(90)
      expect(res.data.every((p) => p.date)).toBe(true)
    })
  })

  describe('getDashboardData — 真实聚合 (无 Math.random)', () => {
    it('DB 有数据时返回 database 源真实汇总', async () => {
      const prisma = makePrisma({
        exam: { count: jest.fn().mockResolvedValue(100) },
        report: { count: jest.fn().mockResolvedValue(60) },
        criticalValue: { count: jest.fn().mockResolvedValue(5) },
        patient: { count: jest.fn().mockResolvedValue(80) },
        device: { count: jest.fn().mockResolvedValue(10) },
        user: { count: jest.fn().mockResolvedValue(6) },
      })
      const service = new StatsService(makeCache() as never, prisma)
      const res = await service.getDashboardData()
      expect(res.source).toBe('database')
      expect(res.data.totals).toEqual({ exams: 100, patients: 80, criticalEvents: 5 })
      expect(res.data.today.exams).toBe(100)
      expect(res.data.alerts.doctorsActive).toBe(6)
    })

    it('DB 空时回退确定性 seed, 两次调用结果一致', async () => {
      const prisma = makePrisma({
        exam: { count: jest.fn().mockResolvedValue(0) },
        report: { count: jest.fn().mockResolvedValue(0) },
        criticalValue: { count: jest.fn().mockResolvedValue(0) },
        patient: { count: jest.fn().mockResolvedValue(0) },
        device: { count: jest.fn().mockResolvedValue(0) },
        user: { count: jest.fn().mockResolvedValue(0) },
      })
      const service = new StatsService(makeCache() as never, prisma)
      const a = await service.getDashboardData()
      const b = await service.getDashboardData()
      expect(a.source).toBe('seed')
      expect(a.data).toEqual(b.data)
    })
  })

  describe('缓存', () => {
    it('命中缓存时直接返回, 不再查询 DB', async () => {
      const cached = { source: 'database' as const, generatedAt: 'x', data: { examCount: 42, reportCount: 7, criticalCount: 1, cosignCount: 0, avgTAT: 1, defectCount: 0, qcAvgScore: 90, date: '2026-08-06', byModality: {} } }
      const cache = makeCache()
      cache.get.mockResolvedValue(cached)
      const findMany = jest.fn().mockRejectedValue(new Error('should not be called'))
      const prisma = makePrisma({
        exam: { findMany },
        report: { findMany },
        criticalValue: { findMany },
        reportQualityScore: { findMany },
      })
      const service = new StatsService(cache as never, prisma)
      const res = await service.getDaily()
      expect(res).toEqual(cached)
      expect(findMany).not.toHaveBeenCalled()
    })
  })
})
