/**
 * [v3.0.6.11-101 Wave 2C] SegmentationV2 服务 spec
 *
 * 验证要点:
 * - Otsu 阈值正确性 (双峰数据阈值落在两峰之间)
 * - 区域生长连通性 (种子 → 仅本连通域, 不跨接隔离区域)
 * - RLE 编解码往返一致
 * - K-means 4 类确定性 / Canny 边缘检出 / 活动轮廓孔洞填充
 * - 结果管理 CRUD / 标注 / 历史 (含删除保留) / NotFound
 * - 孤儿模块模式: 无 DB/无真实数据 → 合成回退 + seed 演示数据
 * - 测量联动: 分割体积 → 等效球直径 → 病灶追踪测量
 */
import { NotFoundException } from '@nestjs/common'
import { VolumeService, type RealVolume } from '../volume/volume.service'
import { SegmentationV2Service, type SegmentationV2Segment } from './segmentation-v2.service'
import { countVoxels, decodeRle, encodeRle, fillSliceHoles, otsuThreshold, runKmeans, type AlgorithmParams } from './segmentation-v2.algorithms'

function makeVolume(fill: (x: number, y: number, z: number) => number, W = 64, H = 64, D = 16): RealVolume {
  const data = new Int16Array(W * H * D)
  let min = Infinity
  let max = -Infinity
  for (let z = 0; z < D; z++) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = fill(x, y, z)
        const idx = z * (W * H) + y * W + x
        data[idx] = v
        if (v < min) min = v
        if (v > max) max = v
      }
    }
  }
  return {
    width: W,
    height: H,
    depth: D,
    data,
    min,
    max,
    windowWidth: 400,
    windowLevel: 40,
    rescaleSlope: 1,
    rescaleIntercept: 0,
    pixelSpacing: [0.7, 0.7],
    sliceThickness: 5,
    modality: 'CT',
  }
}

const inSphere = (x: number, y: number, z: number, cx: number, cy: number, cz: number, r: number): boolean =>
  (x - cx) ** 2 + (y - cy) ** 2 + (z - cz) ** 2 <= r * r

/** 双峰数据: 左低强度球 3..7, 右高强度球 23..27 (两峰间距 16), 背景 0 (球体不贴边界) */
function bimodalVolume(W = 64, H = 64, D = 16): RealVolume {
  return makeVolume((x, y, z) => {
    if (inSphere(x, y, z, 16, 32, 8, 12)) return 3 + ((x + y + z) % 5)
    if (inSphere(x, y, z, 48, 32, 8, 12)) return 23 + ((x + y + z) % 5)
    return 0
  }, W, H, D)
}

function makeService(
  volume: RealVolume | null,
  opts?: { lesionTracking?: Record<string, jest.Mock>; dbDown?: boolean },
) {
  const storedFeatures: any[] = []
  const prisma = {
    dicomInstance: { findMany: jest.fn().mockRejectedValue(new Error('no db')) },
    radiomicsFeature: opts?.dbDown
      ? {
          findMany: jest.fn().mockRejectedValue(new Error('no db')),
          createMany: jest.fn().mockRejectedValue(new Error('no db')),
        }
      : {
          findMany: jest.fn().mockImplementation(async (args: any) => {
            const where = args?.where ?? {}
            if (where.instanceUid) return storedFeatures.filter((f: any) => f.instanceUid === where.instanceUid)
            return storedFeatures
          }),
          createMany: jest.fn().mockImplementation(async (args: any) => {
            for (const row of args.data) storedFeatures.push({ id: `f${storedFeatures.length}`, createdAt: new Date(), ...row })
          }),
          deleteMany: jest.fn().mockImplementation(async (args: any) => {
            const where = args?.where ?? {}
            for (let i = storedFeatures.length - 1; i >= 0; i--) {
              const f = storedFeatures[i] as any
              if (where.roiId && f.roiId === where.roiId) storedFeatures.splice(i, 1)
              else if (where.instanceUid && f.instanceUid === where.instanceUid) storedFeatures.splice(i, 1)
            }
          }),
        },
  }
  const volumeService = {
    loadRealVolume: jest.fn().mockResolvedValue(volume ? { real: volume, jobId: 'job-1' } : null),
  } as unknown as VolumeService
  ;(prisma as any).__storedFeatures = storedFeatures
  const service = new SegmentationV2Service(
    prisma as never,
    volumeService,
    opts?.lesionTracking as never,
  )
  return { service, prisma, volumeService }
}

async function runOnce(service: SegmentationV2Service, algorithm: string, params?: AlgorithmParams, seriesUID = 'SER-1') {
  return service.run({ seriesUID, algorithm: algorithm as never, params })
}

describe('SegmentationV2Service (Wave 2C 影像分割深化)', () => {
  describe('Otsu 自动阈值 (双峰数据正确性)', () => {
    it('双峰分布: 阈值落在两峰间隙, 分割选中高强度球', async () => {
      const vol = bimodalVolume()
      const t = otsuThreshold(vol.data, vol.min, vol.max)
      expect(t).toBeGreaterThanOrEqual(5)
      expect(t).toBeLessThanOrEqual(22)
      const { service } = makeService(vol)
      const res = await runOnce(service, 'threshold', { thresholdMode: 'otsu' })
      expect(res.stats.voxelCount).toBeGreaterThan(0)
      expect(res.stats.meanIntensity).toBeGreaterThanOrEqual(20)
      expect(res.stats.minIntensity).toBeGreaterThanOrEqual(20)
      expect(res.stats.bbox.x).toBeGreaterThanOrEqual(36)
      expect(res.stats.bbox.x + res.stats.bbox.w).toBeLessThanOrEqual(61)
    })

    it('Otsu 双峰确定性与阈值范围: 两轮一致', async () => {
      const vol = bimodalVolume()
      const a = otsuThreshold(vol.data, vol.min, vol.max)
      const b = otsuThreshold(vol.data, vol.min, vol.max)
      expect(a).toBe(b)
    })

    it('手动双阈值: 掩码仅含指定强度范围', async () => {
      const vol = bimodalVolume()
      const { service } = makeService(vol)
      const res = await runOnce(service, 'threshold', { thresholdMode: 'manual', thresholdLo: 3, thresholdHi: 7 })
      expect(res.stats.voxelCount).toBeGreaterThan(0)
      expect(res.stats.maxIntensity).toBeLessThanOrEqual(7)
      expect(res.stats.meanIntensity).toBeLessThanOrEqual(7)
    })
  })

  describe('区域生长连通性', () => {
    const blobVolume = (): RealVolume => makeVolume((x, y, z) => {
      if (inSphere(x, y, z, 20, 32, 8, 6)) return 100
      if (inSphere(x, y, z, 44, 32, 8, 6)) return 100
      return 0
    })

    it('种子 → 仅生长本连通域 (不跨接隔离病灶)', async () => {
      const { service } = makeService(blobVolume())
      const res = await runOnce(service, 'region_grow', { thresholdLo: 90, thresholdHi: 110, seed: { x: 20, y: 32, z: 8 } })
      expect(res.usedFallback).toBe(false)
      expect(res.stats.voxelCount).toBeGreaterThan(0)
      expect(res.stats.meanIntensity).toBe(100)
      expect(res.stats.bbox.x + res.stats.bbox.w).toBeLessThanOrEqual(32)
      expect(res.stats.bbox.x).toBeGreaterThanOrEqual(14)
      const mask = decodeRle(res.rle3d, res.dims.width * res.dims.height * res.dims.depth)
      expect(countVoxels(mask)).toBe(res.stats.voxelCount)
    })

    it('无种子 / 种子越界 → seed 回退阈值最大内部连通域 (usedFallback=true)', async () => {
      const { service } = makeService(blobVolume())
      const noSeed = await runOnce(service, 'region_grow', { thresholdLo: 90, thresholdHi: 110 })
      expect(noSeed.usedFallback).toBe(true)
      expect(noSeed.stats.voxelCount).toBeGreaterThan(0)
      const badSeed = await runOnce(service, 'region_grow', { thresholdLo: 90, thresholdHi: 110, seed: { x: 0, y: 0, z: 0 } })
      expect(badSeed.usedFallback).toBe(true)
      expect(badSeed.stats.voxelCount).toBeGreaterThan(0)
    })

    it('区域生长确定性: 两次运行统计一致', async () => {
      const { service } = makeService(blobVolume())
      const a = await runOnce(service, 'region_grow', { thresholdLo: 90, thresholdHi: 110, seed: { x: 20, y: 32, z: 8 } })
      const b = await runOnce(service, 'region_grow', { thresholdLo: 90, thresholdHi: 110, seed: { x: 20, y: 32, z: 8 } })
      expect(b.stats.voxelCount).toBe(a.stats.voxelCount)
      expect(b.stats.meanIntensity).toBe(a.stats.meanIntensity)
      expect(b.stats.boundaryPointCount).toBe(a.stats.boundaryPointCount)
      expect(b.rle3d).toEqual(a.rle3d)
    })
  })

  describe('K-means 4 类聚类', () => {
    it('4 类聚类: 选类收敛到目标强度类, 确定性一致', async () => {
      const vol = bimodalVolume()
      const { service } = makeService(vol)
      const res = await runOnce(service, 'kmeans', { thresholdLo: 20, thresholdHi: 30 })
      expect(res.stats.voxelCount).toBeGreaterThan(0)
      expect(res.stats.meanIntensity).toBeGreaterThanOrEqual(20)
      const res2 = await runOnce(service, 'kmeans', { thresholdLo: 20, thresholdHi: 30 })
      expect(res2.stats.voxelCount).toBe(res.stats.voxelCount)
      expect(res2.rle3d).toEqual(res.rle3d)
    })

    it('纯函数 kmeansClasses: 质心数=4 且确定性初始化', () => {
      const vol = bimodalVolume()
      const a = runKmeans(vol, {})
      expect(a.extra.k).toBe(4)
      expect(a.extra.classCentroids).toHaveLength(4)
      const b = runKmeans(vol, {})
      expect(b.extra.classCentroids).toEqual(a.extra.classCentroids)
    })
  })

  describe('Canny 边缘检测', () => {
    const edgeVolume = (): RealVolume => makeVolume((x) => (x < 32 ? 0 : 100))

    it('检出强度阶跃边缘 (边界点 > 0, 仅边缘带)', async () => {
      const { service } = makeService(edgeVolume())
      const res = await runOnce(service, 'edge_canny', { sigma: 1 })
      expect(res.stats.boundaryPointCount).toBeGreaterThan(0)
      expect(res.stats.voxelCount).toBeGreaterThan(0)
      expect(res.stats.bbox.x).toBeGreaterThanOrEqual(28)
      expect(res.stats.bbox.x + res.stats.bbox.w).toBeLessThanOrEqual(36)
    })

    it('Canny 确定性: 两次一致', async () => {
      const { service } = makeService(edgeVolume())
      const a = await runOnce(service, 'edge_canny', { sigma: 2 })
      const b = await runOnce(service, 'edge_canny', { sigma: 2 })
      expect(b.stats.voxelCount).toBe(a.stats.voxelCount)
      expect(b.rle3d).toEqual(a.rle3d)
    })
  })

  describe('活动轮廓简化版', () => {
    /** 空心圆柱: 每层圆盘中心 1 体素孔洞, 柱体避开 z 极面 */
    const hollowCylinder = (): RealVolume => makeVolume((x, y, z) => {
      if (z < 1 || z > 14) return 0
      if (x === 32 && y === 32) return 0
      return inSphere(x, y, z, 32, 32, 8, 8) ? 60 : 0
    })

    it('蛇形平滑: 闭运算 + 孔洞填充 → 中心孔洞被填充', async () => {
      const { service } = makeService(hollowCylinder())
      const contour = await runOnce(service, 'active_contour', { thresholdLo: 50, thresholdHi: 70, iterations: 2 })
      expect(contour.stats.voxelCount).toBeGreaterThan(0)
      const mask = decodeRle(contour.rle3d, contour.dims.width * contour.dims.height * contour.dims.depth)
      // 中间层 (z=8) 中心孔洞 (32,32) 已被孔洞填充
      expect(mask[8 * (64 * 64) + 32 * 64 + 32]).toBe(1)
      // 掩码主体仍为 60 HU 实体
      expect(contour.stats.meanIntensity).toBeGreaterThan(50)
      expect(contour.stats.meanIntensity).toBeLessThanOrEqual(60)
      // 外部强度约束: 掩码内不允许出现范围外强度 (孔洞除外)
      expect(contour.stats.maxIntensity).toBe(60)
    })

    it('fillSliceHoles 单元级: 圆盘中心孔洞被填充', () => {
      const W = 64
      const H = 64
      const mask = new Uint8Array(W * H)
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if ((x - 32) ** 2 + (y - 32) ** 2 <= 64) mask[y * W + x] = 1
        }
      }
      mask[32 * W + 32] = 0
      const filled = fillSliceHoles(mask, W, H)
      expect(filled[32 * W + 32]).toBe(1)
      expect(countVoxels(filled)).toBe(countVoxels(mask) + 1)
    })

    it('活动轮廓确定性', async () => {
      const { service } = makeService(hollowCylinder())
      const a = await runOnce(service, 'active_contour', { thresholdLo: 50, thresholdHi: 70 })
      const b = await runOnce(service, 'active_contour', { thresholdLo: 50, thresholdHi: 70 })
      expect(b.stats.voxelCount).toBe(a.stats.voxelCount)
      expect(b.rle3d).toEqual(a.rle3d)
    })
  })

  describe('RLE 编码与统计', () => {
    it('RLE 往返一致 + 统计字段齐备', async () => {
      const vol = bimodalVolume()
      const { service } = makeService(vol)
      const res = await runOnce(service, 'threshold', { thresholdMode: 'otsu' })
      expect(res.rle3d.length).toBeGreaterThan(0)
      const decoded = decodeRle(res.rle3d, res.dims.width * res.dims.height * res.dims.depth)
      expect(countVoxels(decoded)).toBe(res.stats.voxelCount)
      expect(res.slices.length).toBeGreaterThan(0)
      expect(res.slices[0]!.width).toBe(64)
      expect(res.slices[0]!.height).toBe(64)
      expect(res.stats.volumeCm3).toBeGreaterThan(0)
      expect(res.stats.areaCm2).toBeGreaterThan(0)
      expect(res.stats.boundaryPointCount).toBeGreaterThan(0)
      expect(res.stats.maxIntensity).toBeGreaterThanOrEqual(res.stats.minIntensity)
    })
  })

  describe('分割结果管理 (列表/详情/标注/删除/历史)', () => {
    it('run → list/get → annotate → delete → 历史保留, 不存在 404', async () => {
      const { service } = makeService(bimodalVolume())
      const seg = await runOnce(service, 'kmeans', { thresholdLo: 20, thresholdHi: 30 })
      const list = await service.list('SER-1')
      expect(list).toHaveLength(1)
      expect(list[0]!.id).toBe(seg.id)
      expect(list[0]!.algorithm).toBe('kmeans')

      const detail = await service.get(seg.id)
      expect(detail.rle3d.length).toBeGreaterThan(0)
      expect(detail.slices.length).toBeGreaterThan(0)
      expect(detail.dims.depth).toBe(16)
      expect(detail.source).toBe('real')

      const annotated = await service.annotate(seg.id, { label: '右肺上叶结节', color: '#ff4d4f', organClass: '结节' })
      expect(annotated.label).toBe('右肺上叶结节')
      expect(annotated.color).toBe('#ff4d4f')
      expect(annotated.organClass).toBe('结节')

      const history = await service.history('SER-1')
      expect(history).toHaveLength(1)
      expect(history[0]!.status).toBe('active')

      const del = await service.remove(seg.id)
      expect(del.deleted).toBe(true)
      expect(await service.list('SER-1')).toHaveLength(0)
      await expect(service.get(seg.id)).rejects.toBeInstanceOf(NotFoundException)
      await expect(service.remove(seg.id)).rejects.toBeInstanceOf(NotFoundException)
      const historyAfter = await service.history('SER-1')
      expect(historyAfter[0]!.status).toBe('deleted')
    })

    it('RadiomicsFeature 落库: 统计特征写入', async () => {
      const { service, prisma } = makeService(bimodalVolume())
      await runOnce(service, 'threshold', { thresholdMode: 'otsu' })
      expect((prisma as any).radiomicsFeature.createMany).toHaveBeenCalled()
      const stored = (prisma as any).__storedFeatures ?? []
      const names = stored.filter((f: any) => f.category === 'segv2').map((f: any) => f.featureName)
      expect(names).toEqual(expect.arrayContaining(['volume', 'area', 'voxelCount', 'meanIntensity', 'boundaryPointCount']))
    })
  })

  describe('孤儿模块模式: 无 DB / 无真实数据 → seed 回退', () => {
    it('体数据不可用 → 合成回退 (source=synthetic) + 结果仍完整', async () => {
      const { service } = makeService(null, { dbDown: true })
      const res = await runOnce(service, 'threshold', { thresholdMode: 'manual', thresholdLo: 300, thresholdHi: 3071 })
      expect(res.source).toBe('synthetic')
      expect(res.usedFallback).toBe(true)
      expect(res.stats.voxelCount).toBeGreaterThan(0)
      expect(res.stats.volumeCm3).toBeGreaterThan(0)
      expect(res.slices.length).toBeGreaterThan(0)
      // 历史可读 (内存回退)
      const history = await service.history('SER-1')
      expect(history.length).toBe(1)
    })

    it('seed 演示数据: demo-segv2 内置 2 条确定性结果', async () => {
      const { service } = makeService(null, { dbDown: true })
      const list = await service.list('demo-segv2')
      expect(list.length).toBe(2)
      expect(list.map((s) => s.algorithm).sort()).toEqual(['kmeans', 'threshold'])
      expect(list[0]!.source).toBe('synthetic')
    })

    it('DB 不可用 → 内存回退仍可落库读取', async () => {
      const { service } = makeService(null, { dbDown: true })
      const seg = await runOnce(service, 'threshold', { thresholdMode: 'manual', thresholdLo: 40, thresholdHi: 160 })
      expect(seg.id).toMatch(/^segv2-/)
      const list = await service.list('SER-1')
      expect(list.some((s) => s.id === seg.id)).toBe(true)
    })
  })

  describe('测量联动 (体积 → 等效球直径 → 病灶追踪)', () => {
    const lesionMock = {
      addMeasurement: jest.fn().mockResolvedValue({ id: 'LT99', measurements: [{ id: 'm-1' }] }),
      create: jest.fn().mockResolvedValue({ id: 'LT100', measurements: [{ id: 'm-2' }] }),
    }

    it('已有病灶: 追加测量, sizeMm=等效球直径', async () => {
      const { service } = makeService(bimodalVolume(), { lesionTracking: lesionMock })
      const seg = await runOnce(service, 'threshold', { thresholdMode: 'otsu' })
      const linked = await service.linkMeasurement(seg.id, { lesionId: 'LT99' })
      expect(linked.linkedMeasurement).not.toBeNull()
      expect(linked.linkedMeasurement!.lesionId).toBe('LT99')
      expect(linked.linkedMeasurement!.diameterMm).toBeGreaterThan(0)
      expect(linked.linkedMeasurement!.measurementId).toBe('m-1')
      expect(lesionMock.addMeasurement).toHaveBeenCalledWith('LT99', expect.objectContaining({ sizeMm: linked.linkedMeasurement!.diameterMm, studyId: 'SER-1' }))
    })

    it('无病灶: 自动建档 (patientId → create)', async () => {
      const { service } = makeService(bimodalVolume(), { lesionTracking: lesionMock })
      const seg = await runOnce(service, 'kmeans', { thresholdLo: 20, thresholdHi: 30 })
      const linked = await service.linkMeasurement(seg.id, { patientId: 'P1' })
      expect(linked.linkedMeasurement!.lesionId).toBe('LT100')
      expect(lesionMock.create).toHaveBeenCalledWith(expect.objectContaining({ patientId: 'P1', initialSizeMm: linked.linkedMeasurement!.diameterMm }))
    })

    it('无病灶追踪服务 → 本地联动记录 (孤儿可用)', async () => {
      const { service } = makeService(bimodalVolume())
      const seg = await runOnce(service, 'threshold', { thresholdMode: 'otsu' })
      const linked = await service.linkMeasurement(seg.id, { patientId: 'P1' })
      expect(linked.linkedMeasurement!.lesionId).toBeNull()
      expect(linked.linkedMeasurement!.diameterMm).toBeGreaterThan(0)
    })

    it('空分割结果 → 无法联动 (404)', async () => {
      const vol = makeVolume(() => 0)
      const { service } = makeService(vol)
      const seg = await runOnce(service, 'threshold', { thresholdMode: 'manual', thresholdLo: 300, thresholdHi: 400 })
      expect(seg.stats.voxelCount).toBe(0)
      await expect(service.linkMeasurement(seg.id, { patientId: 'P1' })).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('分割端点执行 (服务层)', () => {
    it('5 算法均可执行且返回确定性结果结构', async () => {
      const vol = bimodalVolume()
      const { service } = makeService(vol)
      const results: SegmentationV2Segment[] = []
      results.push(await runOnce(service, 'region_grow', { thresholdLo: 20, thresholdHi: 30, seed: { x: 40, y: 32, z: 8 } }))
      results.push(await runOnce(service, 'threshold', { thresholdMode: 'otsu' }))
      results.push(await runOnce(service, 'edge_canny', {}))
      results.push(await runOnce(service, 'kmeans', {}))
      results.push(await runOnce(service, 'active_contour', { thresholdLo: 0, thresholdHi: 30 }))
      for (const r of results) {
        expect(r.id).toMatch(/^segv2-/)
        expect(r.algorithmLabel.length).toBeGreaterThan(0)
        expect(r.color).toMatch(/^#/)
        expect(Array.isArray(r.rle3d)).toBe(true)
        expect(r.createdAt).toBeTruthy()
      }
      expect(results.map((r) => r.algorithm).sort()).toEqual(['active_contour', 'edge_canny', 'kmeans', 'region_grow', 'threshold'])
    })
  })
})
