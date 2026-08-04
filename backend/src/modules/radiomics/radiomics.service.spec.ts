import { NotFoundException } from '@nestjs/common'
import { RadiomicsService } from './radiomics.service'

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const base = {
    radiomicsFeature: {
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      createMany: jest.fn().mockRejectedValue(new Error('no db')),
    },
  }
  return { ...base, ...overrides } as never
}

const roi = { instanceId: 'inst-1', type: 'ellipse' as const, coordinates: [10, 10, 100, 80] }

describe('RadiomicsService', () => {
  describe('确定性特征', () => {
    it('同一 (instanceId, roi) extract 两次特征完全一致 (无随机)', async () => {
      const prisma = makePrisma({ radiomicsFeature: { findMany: jest.fn().mockRejectedValue(new Error('no db')), createMany: jest.fn().mockResolvedValue({ count: 20 }) } })
      const service = new RadiomicsService(prisma)
      const a = await service.extract({ instanceId: 'inst-1', roi })
      const b = await service.extract({ instanceId: 'inst-1', roi })
      expect(a.features).toEqual(b.features)
      expect(a.features.length).toBeGreaterThan(15)
    })

    it('不同 roi 生成不同特征值', async () => {
      const prisma = makePrisma({ radiomicsFeature: { findMany: jest.fn().mockRejectedValue(new Error('no db')), createMany: jest.fn().mockResolvedValue({ count: 20 }) } })
      const service = new RadiomicsService(prisma)
      const a = await service.extract({ instanceId: 'inst-1', roi: { ...roi, coordinates: [5, 5, 50, 40] } })
      const b = await service.extract({ instanceId: 'inst-1', roi })
      expect(a.features).not.toEqual(b.features)
    })

    it('extract 成功落库 createMany 且 simulated 未标注', async () => {
      const createMany = jest.fn().mockResolvedValue({ count: 20 })
      const prisma = makePrisma({ radiomicsFeature: { findMany: jest.fn().mockRejectedValue(new Error('no db')), createMany } })
      const service = new RadiomicsService(prisma)
      const result = await service.extract({ instanceId: 'inst-2', roi })
      expect(createMany).toHaveBeenCalled()
      expect(createMany.mock.calls[0][0].data[0].instanceUid).toBe('inst-2')
      expect(result.simulated).toBeUndefined()
    })

    it('DB 异常时 extract 回退内存并标注 simulated=true, getFeatures 可读回', async () => {
      const service = new RadiomicsService(makePrisma())
      const result = await service.extract({ instanceId: 'inst-3', roi })
      expect(result.simulated).toBe(true)
      const read = await service.getFeatures('inst-3')
      expect(read.features).toEqual(result.features)
      expect(read.simulated).toBe(true)
    })

    it('getFeatures 读取已落库特征', async () => {
      const prisma = makePrisma({
        radiomicsFeature: {
          findMany: jest.fn().mockResolvedValue([
            { instanceUid: 'inst-4', category: 'Shape', featureName: 'Volume', value: 120.5, unit: 'mm³' },
            { instanceUid: 'inst-4', category: 'FirstOrder', featureName: 'Mean', value: 88.1, unit: 'HU' },
          ]),
          createMany: jest.fn().mockRejectedValue(new Error('no db')),
        },
      })
      const service = new RadiomicsService(prisma)
      const result = await service.getFeatures('inst-4')
      expect(result.features).toHaveLength(2)
      expect(result.features[0]).toEqual({ category: 'Shape', name: 'Volume', value: 120.5, unit: 'mm³' })
      expect(result.simulated).toBeUndefined()
    })

    it('compare 确定性: 同一输入两次结果一致且每个实例落库', async () => {
      const createMany = jest.fn().mockResolvedValue({ count: 20 })
      const prisma = makePrisma({ radiomicsFeature: { findMany: jest.fn().mockRejectedValue(new Error('no db')), createMany } })
      const service = new RadiomicsService(prisma)
      const req = { instanceIds: ['c-1', 'c-2'], rois: [roi, { ...roi, type: 'rectangle' as const }] }
      const a = await service.compare(req)
      const b = await service.compare(req)
      expect(a).toEqual(b)
      expect(createMany).toHaveBeenCalled()
      const calledUids = createMany.mock.calls.map((c) => c[0].data[0].instanceUid)
      expect(calledUids).toContain('c-1')
      expect(calledUids).toContain('c-2')
    })

    it('getFeatures 无数据时抛 NotFound', async () => {
      const prisma = makePrisma({ radiomicsFeature: { findMany: jest.fn().mockResolvedValue([]), createMany: jest.fn().mockRejectedValue(new Error('no db')) } })
      const service = new RadiomicsService(prisma)
      await expect(service.getFeatures('none-1')).rejects.toBeInstanceOf(NotFoundException)
    })
  })
})
