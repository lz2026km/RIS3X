import { OeeService } from './oee.service'

const deviceIds = ['CT-01', 'MR-01', 'DR-01', 'DR-02', 'CT-02', 'MG-01', 'DSA-01']

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const reject = jest.fn().mockRejectedValue(new Error('no db'))
  const base = {
    oeeRecord: {
      findMany: reject,
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
    exam: {
      count: reject,
      findMany: reject,
    },
  }
  return { ...base, ...overrides } as never
}

const completedExam = (startedAt: Date, completedAt: Date) => ({
  scheduledAt: startedAt,
  startedAt,
  completedAt,
})

describe('OeeService', () => {
  describe('确定性（DB 不可用 → derived）', () => {
    it('同输入两次 getList 输出完全一致，source=derived', async () => {
      const prisma = makePrisma()
      const service = new OeeService(prisma)
      const a = await service.getList()
      const b = await service.getList()
      expect(a).toEqual(b)
      expect(a.length).toBe(7)
      expect(a.every(d => d.source === 'derived')).toBe(true)
      expect(a.every(d => d.oee > 0 && d.oee <= 100)).toBe(true)
    })

    it('getTrend 两次输出完全一致，source=derived，且不写库', async () => {
      const prisma = makePrisma()
      const service = new OeeService(prisma)
      const a = await service.getTrend('CT-01')
      const b = await service.getTrend('CT-01')
      expect(a).toEqual(b)
      expect(a.length).toBe(12)
      expect(a.every(p => p.source === 'derived')).toBe(true)
      expect((prisma as never as { oeeRecord: { createMany: jest.Mock } }).oeeRecord.createMany).not.toHaveBeenCalled()
    })

    it('不同 deviceId 的派生序列互不相同', async () => {
      const prisma = makePrisma()
      const service = new OeeService(prisma)
      const a = await service.getTrend('CT-01')
      const b = await service.getTrend('MR-01')
      expect(a.map(p => p.oee)).not.toEqual(b.map(p => p.oee))
    })

    it('getDetail 两次一致，loss 字段在合理区间', async () => {
      const prisma = makePrisma()
      const service = new OeeService(prisma)
      const a = await service.getDetail('CT-01')
      const b = await service.getDetail('CT-01')
      expect(a).toEqual(b)
      expect(a?.breakdownLoss).toBeGreaterThanOrEqual(1)
      expect(a?.breakdownLoss).toBeLessThanOrEqual(8)
    })
  })

  describe('真实数据（Exam 统计 → actual）', () => {
    it('从 Exam 表推导指标并仅写入确定性结果', async () => {
      const now = Date.now()
      const prisma = makePrisma({
        oeeRecord: { findMany: jest.fn().mockResolvedValue([]), createMany: jest.fn().mockResolvedValue({ count: 7 }) },
        exam: {
          count: jest.fn().mockResolvedValue(10),
          findMany: jest.fn().mockResolvedValue([
            completedExam(new Date(now - 5 * 60000), new Date(now)),
            completedExam(new Date(now - 10 * 60000), new Date(now - 5 * 60000)),
            completedExam(new Date(now - 15 * 60000), new Date(now - 10 * 60000)),
          ]),
        },
      })
      const service = new OeeService(prisma)
      const list = await service.getList()
      expect(list.length).toBe(7)
      expect(list.every(d => d.source === 'actual')).toBe(true)
      // 3 个按时完成 / 10 个计划 → performance=30；15 分钟使用/720 → availability≈2.1；quality=100
      expect(list[0].performance).toBe(30)
      expect(list[0].quality).toBe(100)
      expect(list[0].availability).toBeCloseTo(2.1, 1)
      expect(list[0].oee).toBeCloseTo((2.1 * 30 * 100) / 10000, 1)

      // 写库数据与返回结果一致（确定性，无随机）
      const created = (prisma as never as { oeeRecord: { createMany: jest.Mock } }).oeeRecord.createMany.mock.calls[0][0].data as Array<Record<string, unknown>>
      expect(created).toHaveLength(7)
      expect(created[0].oee).toBe(list[0].oee)
      expect(created[0].availability).toBe(list[0].availability)
    })

    it('有历史记录时 getList 返回记录且不再写库', async () => {
      const record = {
        id: 'r1',
        deviceId: 'CT-01',
        date: '2026-08-03',
        modality: 'CT',
        availability: 95,
        performance: 92,
        quality: 98,
        oee: 85.7,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      const prisma = makePrisma({
        oeeRecord: { findMany: jest.fn().mockResolvedValue([record]), createMany: jest.fn().mockResolvedValue({ count: 0 }) },
      })
      const service = new OeeService(prisma)
      const list = await service.getList()
      expect(list).toHaveLength(1)
      expect(list[0].id).toBe('CT-01')
      expect(list[0].oee).toBe(85.7)
      expect(list[0].source).toBe('actual')
      expect((prisma as never as { oeeRecord: { createMany: jest.Mock } }).oeeRecord.createMany).not.toHaveBeenCalled()
    })

    it('getTrend 有真实记录时返回记录 source=actual', async () => {
      const prisma = makePrisma({
        oeeRecord: {
          findMany: jest.fn().mockResolvedValue([
            { deviceId: 'CT-01', date: '2026-08-02', modality: 'CT', availability: 90, performance: 88, quality: 95, oee: 75.2 },
            { deviceId: 'CT-01', date: '2026-08-03', modality: 'CT', availability: 91, performance: 89, quality: 96, oee: 77.8 },
          ]),
          createMany: jest.fn(),
        },
      })
      const service = new OeeService(prisma)
      const trend = await service.getTrend('CT-01')
      expect(trend).toHaveLength(2)
      expect(trend.map(p => p.source)).toEqual(['actual', 'actual'])
      expect(trend[1].oee).toBe(77.8)
    })
  })
})
