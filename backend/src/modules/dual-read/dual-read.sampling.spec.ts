/**
 * [G005 W9-QC] dual-read 抽查抽样 + 双盲 + 一致性 (kappa) spec
 */
import { DualReadService, computeKappa } from './dual-read.service'

const prisma = {
  report: { findFirst: jest.fn().mockRejectedValue(new Error('no db')) },
  dualReadAssignment: {
    findMany: jest.fn().mockRejectedValue(new Error('no db')),
    count: jest.fn().mockRejectedValue(new Error('no db')),
    create: jest.fn().mockRejectedValue(new Error('no db')),
    update: jest.fn().mockRejectedValue(new Error('no db')),
  },
} as never

describe('DualReadService 抽查 + 双盲 + kappa', () => {
  it('createSamplingBatch: 三种抽样方法均产出确定条目数', () => {
    const service = new DualReadService(prisma)
    const random = service.createSamplingBatch({ method: 'random', size: 15 })
    const low = service.createSamplingBatch({ method: 'low_yield', size: 10 })
    const strat = service.createSamplingBatch({ method: 'stratified', size: 12, modality: undefined })
    expect(random.items).toHaveLength(15)
    expect(low.items).toHaveLength(10)
    expect(low.items.every((i) => i.yielder === 'low')).toBe(true)
    expect(strat.items.length).toBe(12)
    expect(new Set(strat.items.map((i) => i.stratum)).size).toBeGreaterThan(1)
  })

  it('抽样确定性: 同参数两次 random 结果一致', () => {
    const service = new DualReadService(prisma)
    const a = service.createSamplingBatch({ method: 'random', size: 8 })
    const b = service.createSamplingBatch({ method: 'random', size: 8 })
    expect(a.items.map((i) => i.reportId)).toEqual(b.items.map((i) => i.reportId))
  })

  it('双盲: 未解盲隐藏患者名与对侧结果', () => {
    const service = new DualReadService(prisma)
    const batch = service.createSamplingBatch({ method: 'random', size: 3, blind: true })
    const item = batch.items[0]!
    service.recordSamplingReading(batch.id, item.itemId, { readerSlot: 1, readerId: 'D1', readerName: '张医生', result: 'positive' })
    service.recordSamplingReading(batch.id, item.itemId, { readerSlot: 2, readerId: 'D2', readerName: '李医生', result: 'positive' })
    const view = service.getSamplingBatch(batch.id)
    expect(view.items[0]!.patientName).toBe('***')
    expect(view.items[0]!.readings.map((r) => r.readerLabel)).toEqual(['阅片医师一', '阅片医师二'])
    expect(view.items[0]!.readings.every((r) => r.result === null)).toBe(true)
    const unblind = service.getSamplingBatch(batch.id, true)
    expect(unblind.items[0]!.readings[0]!.result).toBe('positive')
  })

  it('agreement: 完全一致 kappa=1', () => {
    const service = new DualReadService(prisma)
    const batch = service.createSamplingBatch({ method: 'random', size: 4, blind: false })
    for (const item of batch.items) {
      service.recordSamplingReading(batch.id, item.itemId, { readerSlot: 1, readerId: 'D1', readerName: 'A', result: 'positive' })
      service.recordSamplingReading(batch.id, item.itemId, { readerSlot: 2, readerId: 'D2', readerName: 'B', result: 'positive' })
    }
    const agreement = service.agreement(batch.id)
    expect(agreement.evaluatedItems).toBe(4)
    expect(agreement.kappa).toBe(1)
    expect(agreement.agreementRate).toBe(100)
  })

  it('computeKappa: 无一致性时 kappa<1', () => {
    const result = computeKappa([
      { a: 'positive', b: 'negative' },
      { a: 'negative', b: 'positive' },
      { a: 'positive', b: 'positive' },
      { a: 'negative', b: 'negative' },
    ])
    expect(result.evaluatedItems).toBe(4)
    expect(result.kappa).toBeLessThan(1)
  })

  it('record 覆盖同一 slot + 批次统计', () => {
    const service = new DualReadService(prisma)
    const batch = service.createSamplingBatch({ method: 'random', size: 5 })
    const item = batch.items[0]!
    service.recordSamplingReading(batch.id, item.itemId, { readerSlot: 1, readerId: 'D1', readerName: 'A', result: 'negative' })
    service.recordSamplingReading(batch.id, item.itemId, { readerSlot: 1, readerId: 'D1', readerName: 'A', result: 'positive' })
    const view = service.getSamplingBatch(batch.id, true)
    expect(view.items[0]!.readings.filter((r) => r.readerSlot === 1)).toHaveLength(1)
    const stats = service.getSamplingStats()
    expect(stats.batchCount).toBe(1)
    expect(stats.itemCount).toBe(5)
    expect(stats.byModality.length).toBeGreaterThan(0)
  })

  it('close + 关闭后不可录入', () => {
    const service = new DualReadService(prisma)
    const batch = service.createSamplingBatch({ method: 'random', size: 2 })
    service.closeSamplingBatch(batch.id)
    expect(() =>
      service.recordSamplingReading(batch.id, batch.items[0]!.itemId, { readerSlot: 1, readerId: 'D1', readerName: 'A', result: 'positive' }),
    ).toThrow()
  })
})
