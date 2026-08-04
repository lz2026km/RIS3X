import { NotFoundException } from '@nestjs/common'
import { Dicom4dService } from './dicom-4d.service'

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const base = {
    dicomInstance: { findMany: jest.fn().mockRejectedValue(new Error('no db')) },
    dicom4dJob: {
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      findUnique: jest.fn().mockRejectedValue(new Error('no db')),
      upsert: jest.fn().mockRejectedValue(new Error('no db')),
    },
  }
  return { ...base, ...overrides } as never
}

const instance = (seriesUid: string, i: number, modality = 'CT') => ({
  id: `inst-${i}`,
  seriesInstanceUid: seriesUid,
  studyInstanceUid: `study-${seriesUid}`,
  modality,
  createdAt: new Date(Date.UTC(2026, 6, 1, 0, i)),
})

describe('Dicom4dService', () => {
  describe('真实系列查询 (DB 可用)', () => {
    let service: Dicom4dService

    beforeEach(() => {
      const prisma = makePrisma({
        dicomInstance: {
          findMany: jest.fn().mockResolvedValue([
            instance('1.2.3.4', 0),
            instance('1.2.3.4', 1),
            instance('1.2.3.4', 2),
            instance('1.2.3.5', 3, 'MR'),
            instance('1.2.3.5', 4, 'MR'),
          ]),
        },
        dicom4dJob: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null), upsert: jest.fn().mockResolvedValue({}) },
      })
      service = new Dicom4dService(prisma)
    })

    it('list 从 dicomInstance 按 series 聚合真实 4D 系列 (frameCount=实例数, simulated 未标注)', async () => {
      const list = await service.list()
      expect(list).toHaveLength(2)
      const ct = list.find((s) => s.seriesUid === '1.2.3.4')
      expect(ct?.frameCount).toBe(3)
      expect(ct?.modality).toBe('CT')
      expect(ct?.simulated).toBeUndefined()
      const mr = list.find((s) => s.seriesUid === '1.2.3.5')
      expect(mr?.modality).toBe('MR')
      expect(mr?.dimensions).toEqual({ width: 256, height: 256 })
    })

    it('getFrames 返回真实实例数量帧且 phase 单调递增', async () => {
      const frames = await service.getFrames('1.2.3.4')
      expect(frames).toHaveLength(3)
      expect(frames[0]?.frameIndex).toBe(0)
      expect(frames[0]?.phase).toBe(0)
      expect(frames[0]?.phase).toBeLessThan(frames[1]?.phase as number)
      expect(frames[1]?.phase).toBeLessThan(frames[2]?.phase as number)
      expect(frames[2]?.phase).toBeLessThanOrEqual(100)
    })

    it('getPhase 相位确定性: 同一系列两次调用结果一致', async () => {
      const a = await service.getPhase('1.2.3.4')
      const b = await service.getPhase('1.2.3.4')
      expect(a).toEqual(b)
      expect(a.frameCount).toBe(3)
    })

    it('未知系列抛 NotFound', async () => {
      await expect(service.getFrames('9.9.9.9')).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('回退 (DB 不可用)', () => {
    it('list 回退 MOCK_SERIES seed 并标注 simulated=true', async () => {
      const service = new Dicom4dService(makePrisma())
      const list = await service.list()
      expect(list.length).toBeGreaterThan(0)
      expect(list[0]?.simulated).toBe(true)
    })

    it('getFrames 回退 mock 目录生成帧', async () => {
      const service = new Dicom4dService(makePrisma())
      const frames = await service.getFrames('1.2.840.113619.2.55.3.6047.1.2.1.1')
      expect(frames).toHaveLength(80)
    })
  })
})
