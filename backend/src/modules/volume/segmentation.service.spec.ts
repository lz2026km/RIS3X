/**
 * G005 RIS - 3D 分割与定量 spec
 *
 * 使用 backend/dicom-samples 真实 CT 样本:
 *   - CT_HEAD  (512x512x20): 颅骨 600-1100 HU / 脑实质 30-40 HU
 *   - CT_CHEST (512x512x15): 肺 -860~-735 HU / 软组织 40 HU / 脊柱 700 HU
 */
import * as path from 'node:path'
import { NotFoundException } from '@nestjs/common'
import { VolumeService } from './volume.service'
import { SegmentationService, type SegmentationStats } from './segmentation.service'

const HEAD_UID = '1.2.826.0.1.3680043.10.155.3.0.6.11.CT.S.1'
const CHEST_UID = '1.2.826.0.1.3680043.10.155.3.0.6.11.CT.S.2'

function makePrisma(overrides: Record<string, unknown> = {}) {
  const storedFeatures: any[] = []
  const base = {
    dicomInstance: {
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
    },
    radiomicsFeature: {
      findMany: jest.fn().mockResolvedValue([]),
      createMany: jest.fn().mockImplementation(async (args: any) => {
        for (const row of args.data) storedFeatures.push({ id: `f${storedFeatures.length}`, createdAt: new Date(), ...row })
      }),
    },
  }
  return { ...base, ...overrides, __storedFeatures: storedFeatures } as never
}

function makeSamples(seriesUID: string, dir: string, prefix: string, count: number, modality = 'CT') {
  return Array.from({ length: count }, (_, i) => ({
    id: `${dir}-${i}`,
    sopInstanceUid: `${seriesUID}.I.${i}`,
    seriesInstanceUid: seriesUID,
    modality,
    storagePath: path.resolve(__dirname, '../../../dicom-samples', dir, `${prefix}_${String(i + 1).padStart(3, '0')}.dcm`),
  }))
}

function makeService(seriesUID: string, samples: any[]) {
  const prisma = makePrisma({
    dicomInstance: { findMany: jest.fn().mockResolvedValue(samples) },
    radiomicsFeature: {
      findMany: jest.fn().mockImplementation(async (args: any) => {
        const where = args?.where ?? {}
        if (where.instanceUid) {
          return (prisma as any).__storedFeatures.filter((f: any) => f.instanceUid === where.instanceUid)
        }
        return (prisma as any).__storedFeatures
      }),
      createMany: jest.fn().mockImplementation(async (args: any) => {
        for (const row of args.data) (prisma as any).__storedFeatures.push({ id: `f${(prisma as any).__storedFeatures.length}`, createdAt: new Date(), ...row })
      }),
    },
  })
  const volume = new VolumeService(prisma)
  const service = new SegmentationService(prisma, volume)
  return { service, prisma, volume }
}

const headSamples = makeSamples(HEAD_UID, 'CT_HEAD', 'CT_HEAD', 20)
const chestSamples = makeSamples(CHEST_UID, 'CT_CHEST', 'CT_CHEST', 15)

function statKey(stats: SegmentationStats) {
  const { segId, createdAt, jobId, ...rest } = stats
  void segId
  void createdAt
  void jobId
  return rest
}

describe('SegmentationService (real DICOM samples)', () => {
  describe('CT_HEAD 颅骨分割 (HU>300)', () => {
    let ctx: ReturnType<typeof makeService>

    beforeAll(() => {
      ctx = makeService(HEAD_UID, headSamples)
    })

    it('检出颅骨: voxelCount>10000, volume>0, meanHu>300, source=real', async () => {
      const res = await ctx.service.segment({ seriesUID: HEAD_UID, target: 'bone' })
      expect(res.source).toBe('real')
      expect(res.voxelCount).toBeGreaterThan(10000)
      expect(res.volumeCm3).toBeGreaterThan(0)
      expect(res.meanHu).toBeGreaterThan(300)
      expect(res.minHu).toBeGreaterThanOrEqual(300)
      expect(res.maxHu).toBeLessThanOrEqual(3071)
      expect(res.surfaceAreaCm2).toBeGreaterThan(0)
      expect(res.density).toBe(res.meanHu)
      expect(res.bbox.w).toBeGreaterThan(0)
      expect(res.bbox.h).toBeGreaterThan(0)
      expect(res.bbox.d).toBeGreaterThan(0)
    })

    it('确定性: 相同输入两次分割统计完全一致', async () => {
      const a = await ctx.service.segment({ seriesUID: HEAD_UID, target: 'bone' })
      const b = await ctx.service.segment({ seriesUID: HEAD_UID, target: 'bone' })
      expect(statKey(b)).toEqual(statKey(a))
    })

    it('掩码输出: 每 8 层轴向切片 + 中心三平面 (bit 打包 base64)', async () => {
      const res = await ctx.service.segment({ seriesUID: HEAD_UID, target: 'bone' })
      expect(res.maskSlices.length).toBe(Math.ceil(20 / 8))
      expect(res.maskSlices[0]).toMatchObject({ plane: 'axial', width: 512, height: 512 })
      expect(res.maskSlices[0]!.dataBase64.length).toBeGreaterThan(0)
      expect(res.centerSlices.map((s) => s.plane)).toEqual(['axial', 'sagittal', 'coronal'])
    })
  })

  describe('CT_CHEST 肺分割 (HU<-500, 排除体外空气)', () => {
    it('检出肺实质且不包含贴边界背景', async () => {
      const ctx = makeService(CHEST_UID, chestSamples)
      const res = await ctx.service.segment({ seriesUID: CHEST_UID, target: 'lung' })
      expect(res.voxelCount).toBeGreaterThan(1000)
      expect(res.volumeCm3).toBeGreaterThan(0)
      expect(res.maxHu).toBeLessThan(-500)
      expect(res.minHu).toBeGreaterThanOrEqual(-1024)
      expect(res.bbox.x).toBeGreaterThan(0)
      expect(res.bbox.y).toBeGreaterThan(0)
      expect(res.bbox.z).toBeGreaterThanOrEqual(0)
      expect(res.bbox.d).toBeGreaterThan(0)
    })
  })

  describe('结节阈值分割 (候选连通域)', () => {
    it('CT_CHEST 软组织区间确定性分割', async () => {
      const ctx = makeService(CHEST_UID, chestSamples)
      const a = await ctx.service.segment({ seriesUID: CHEST_UID, target: 'nodule', thresholdMin: -100, thresholdMax: 100 })
      const b = await ctx.service.segment({ seriesUID: CHEST_UID, target: 'nodule', thresholdMin: -100, thresholdMax: 100 })
      expect(a.voxelCount).toBeGreaterThan(0)
      expect(b.voxelCount).toBe(a.voxelCount)
      expect(b.meanHu).toBe(a.meanHu)
      expect(b.bbox).toEqual(a.bbox)
    })
  })

  describe('结节区域生长 (种子点)', () => {
    it('CT_HEAD 脑实质种子 (HU -100~100) 生长为脑区', async () => {
      const ctx = makeService(HEAD_UID, headSamples)
      const res = await ctx.service.segment({
        seriesUID: HEAD_UID,
        target: 'nodule',
        thresholdMin: -100,
        thresholdMax: 100,
        seed: { x: 256, y: 256, z: 10 },
      })
      expect(res.voxelCount).toBeGreaterThan(100000)
      expect(res.voxelCount).toBeLessThan(512 * 512 * 20)
      // 形态学膨胀 1 层会吸收相邻颅骨壳 → maxHu 可超过阈值上限, 但 minHu 不下降
      expect(res.minHu).toBeGreaterThanOrEqual(-100)
    })

    it('种子落在范围外 → 空结果 (voxelCount=0)', async () => {
      const ctx = makeService(HEAD_UID, headSamples)
      const res = await ctx.service.segment({
        seriesUID: HEAD_UID,
        target: 'nodule',
        thresholdMin: 5000,
        thresholdMax: 6000,
        seed: { x: 256, y: 256, z: 10 },
      })
      expect(res.voxelCount).toBe(0)
      expect(res.volumeCm3).toBe(0)
    })
  })

  describe('定量: HU 直方图', () => {
    it('桶数=24 且桶计数和=体素数', async () => {
      const ctx = makeService(HEAD_UID, headSamples)
      const res = await ctx.service.segment({ seriesUID: HEAD_UID, target: 'bone' })
      const q = await ctx.service.quantify(res.segId)
      expect(q.binCount).toBe(24)
      expect(q.bins).toHaveLength(24)
      const total = q.bins.reduce((acc, b) => acc + b.count, 0)
      expect(total).toBe(res.voxelCount)
    })

    it('未知 segId 抛 NotFoundException', async () => {
      const ctx = makeService(HEAD_UID, headSamples)
      await expect(ctx.service.quantify('seg-unknown')).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('RadiomicsFeature 落库 + 历史 + 确认', () => {
    it('分割后写入特征 (volume/meanHu/maxHu/minHu...) 且历史可读', async () => {
      const ctx = makeService(HEAD_UID, headSamples)
      await ctx.service.segment({ seriesUID: HEAD_UID, target: 'bone' })
      const prisma = ctx.prisma as any
      expect(prisma.radiomicsFeature.createMany).toHaveBeenCalled()
      const history = await ctx.service.listSegmentations(HEAD_UID)
      expect(history.length).toBeGreaterThan(0)
      const item = history[0]!
      expect(item.target).toBe('bone')
      expect(item.voxelCount).toBeGreaterThan(10000)
      expect(item.volumeCm3).toBeGreaterThan(0)
      const names = item.features.map((f) => f.name)
      expect(names).toEqual(expect.arrayContaining(['volume', 'meanHu', 'maxHu', 'minHu', 'voxelCount', 'surfaceArea', 'density']))
      expect(item.approved).toBe(false)
    })

    it('approve 后历史 approved=true', async () => {
      const ctx = makeService(HEAD_UID, headSamples)
      const res = await ctx.service.segment({ seriesUID: HEAD_UID, target: 'bone' })
      const approved = await ctx.service.approve(res.segId)
      expect(approved.approved).toBe(true)
      const history = await ctx.service.listSegmentations(HEAD_UID)
      const item = history.find((h) => h.id === res.segId)
      expect(item?.approved).toBe(true)
    })

    it('DB 不可用回退内存: 历史仍可读', async () => {
      const prisma = makePrisma({
        dicomInstance: { findMany: jest.fn().mockResolvedValue(headSamples) },
        radiomicsFeature: {
          findMany: jest.fn().mockRejectedValue(new Error('no db')),
          createMany: jest.fn().mockRejectedValue(new Error('no db')),
        },
      })
      const volume = new VolumeService(prisma)
      const service = new SegmentationService(prisma, volume)
      await service.segment({ seriesUID: HEAD_UID, target: 'bone' })
      const history = await service.listSegmentations(HEAD_UID)
      expect(history.length).toBeGreaterThan(0)
      expect(history[0]!.features.map((f) => f.name)).toContain('volume')
    })
  })
})
