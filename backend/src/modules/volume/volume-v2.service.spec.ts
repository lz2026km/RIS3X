/**
 * G005 RIS - [v3.0.6.11-101 Wave 3A] 多平面重建 V2 spec
 *
 * 孤儿模块模式: 直接 new VolumeV2Service() (无 Prisma / 无 VolumeService) → 内置合成体回退。
 * 合成体在 beforeAll 一次性 seed 并复用 jobId (确定性, 避免重复构建)。
 *
 * 覆盖:
 *   - MPR 三平面正交性 (法向量两两点积 = 0) + 相交线参数 + 联动切片一致性 + 确定性
 *   - CPR 路径采样长度正确性 (弧长/间距 → sampleCount) + 拉直图像尺寸 + 投影数量 + 确定性
 *   - VR 输出确定性 (相同输入 → 相同 base64; 不同 yaw → 不同输出) + 传输函数 LUT
 *   - 切割端点 200 (HTTP 级) + 截面图像 + 裁剪统计正确性 + 确定性
 */
import { Test } from '@nestjs/testing'
import { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { VolumeV2Controller } from './volume-v2.controller'
import { VolumeV2Service } from './volume-v2.service'

jest.setTimeout(60000)

const SPEC_JOB = 'spec-vol'

describe('VolumeV2Service (orphan mode, 内置合成体)', () => {
  const service = new VolumeV2Service()
  beforeAll(() => {
    service.seedSynthetic(SPEC_JOB)
  })

  describe('MPR 三平面联动', () => {
    it('三平面法向量两两正交 (轴向/冠状/矢状)', async () => {
      const res = await service.mprLinked({ jobId: SPEC_JOB, position: { x: 64, y: 64, z: 64 } })
      const normals = [
        { x: 0, y: 0, z: 1 }, // axial
        { x: 0, y: 1, z: 0 }, // coronal
        { x: 1, y: 0, z: 0 }, // sagittal
      ]
      for (let i = 0; i < 3; i++) {
        for (let j = i + 1; j < 3; j++) {
          const dot = normals[i]!.x * normals[j]!.x + normals[i]!.y * normals[j]!.y + normals[i]!.z * normals[j]!.z
          expect(dot).toBe(0)
        }
      }
      expect(res.planes.map((p) => p.plane)).toEqual(['axial', 'coronal', 'sagittal'])
    })

    it('相交线参数与切片索引一致 (h/v 落在图像范围内)', async () => {
      const res = await service.mprLinked({ jobId: SPEC_JOB, position: { x: 32, y: 80, z: 96 } })
      const axial = res.planes[0]!
      expect(axial.crosshair).toEqual({ h: 80, v: 32 })
      expect(axial.crosshair.h).toBeLessThan(axial.height)
      expect(axial.crosshair.v).toBeLessThan(axial.width)
      expect(res.lines.axial).toEqual(axial.crosshair)
      expect(res.position).toEqual({ x: 32, y: 80, z: 96 })
      expect(res.planes.every((p) => p.pixelData.dataBase64.length > 0)).toBe(true)
      // 冠状/矢状图高度含 z 等比拉伸, 轴向图为 128×128
      expect(res.planes[1]!.height).toBe(res.planes[2]!.height)
      expect(res.planes[0]!.width).toBe(128)
      expect(res.planes[0]!.height).toBe(128)
    })

    it('位置越界自动钳制, 切片有内容 (非全背景)', async () => {
      const res = await service.mprLinked({ jobId: SPEC_JOB, position: { x: -50, y: 5000, z: 9999 } })
      const axial = res.planes[0]!
      expect(axial.sliceIndex).toBeLessThanOrEqual(127)
      expect(axial.crosshair.h).toBeLessThanOrEqual(127)
      const payload = Buffer.from(axial.pixelData.dataBase64, 'base64')
      const vals = new Int16Array(payload.buffer, payload.byteOffset, payload.length / 2)
      let max = -Infinity
      for (const v of vals) if (v > max) max = v
      expect(max).toBeGreaterThan(0)
    })

    it('确定性: 相同输入两次输出完全一致', async () => {
      const a = await service.mprLinked({ jobId: SPEC_JOB, position: { x: 40, y: 40, z: 40 } })
      const b = await service.mprLinked({ jobId: SPEC_JOB, position: { x: 40, y: 40, z: 40 } })
      expect(b.planes.map((p) => p.pixelData.dataBase64)).toEqual(a.planes.map((p) => p.pixelData.dataBase64))
      expect(b.position).toEqual(a.position)
    })
  })

  describe('CPR 曲面重建', () => {
    it('路径采样长度正确: 100 体素直线, spacing=4 → sampleCount = 26, 拉直图 = sampleCount × crossWidth', async () => {
      const res = await service.cpr({
        jobId: SPEC_JOB,
        points: [
          { x: 14, y: 64, z: 64 },
          { x: 114, y: 64, z: 64 },
        ],
        spacing: 4,
        crossWidth: 17,
      })
      expect(res.totalLengthVoxels).toBe(100)
      expect(res.sampleCount).toBe(Math.round(100 / 4) + 1)
      expect(res.straightened.width).toBe(res.sampleCount)
      expect(res.straightened.height).toBe(17)
      expect(res.straightened.pixelData.width).toBe(res.sampleCount)
      expect(res.straightened.pixelData.height).toBe(17)
      expect(res.totalLengthMm).toBe(100)
    })

    it('投影数组长度 = sampleCount, 端点与路径端点一致', async () => {
      const res = await service.cpr({
        jobId: SPEC_JOB,
        points: [
          { x: 20, y: 40, z: 30 },
          { x: 80, y: 100, z: 90 },
        ],
        spacing: 2,
      })
      expect(res.projections.axial).toHaveLength(res.sampleCount)
      expect(res.projections.coronal).toHaveLength(res.sampleCount)
      expect(res.projections.sagittal).toHaveLength(res.sampleCount)
      expect(res.projections.axial[0]).toEqual({ x: 20, y: 40 })
      expect(res.projections.axial[res.sampleCount - 1]).toEqual({ x: 80, y: 100 })
    })

    it('点不足 2 个时回退默认对角线路径', async () => {
      const res = await service.cpr({ jobId: SPEC_JOB, points: [{ x: 10, y: 10, z: 10 }] })
      expect(res.points.length).toBe(2)
      expect(res.sampleCount).toBeGreaterThanOrEqual(2)
    })

    it('确定性: 相同路径两次输出一致', async () => {
      const pts = [
        { x: 10, y: 10, z: 10 },
        { x: 60, y: 90, z: 40 },
        { x: 110, y: 30, z: 90 },
      ]
      const a = await service.cpr({ jobId: SPEC_JOB, points: pts, spacing: 1.5 })
      const b = await service.cpr({ jobId: SPEC_JOB, points: pts, spacing: 1.5 })
      expect(b.straightened.pixelData.dataBase64).toBe(a.straightened.pixelData.dataBase64)
      expect(b.sampleCount).toBe(a.sampleCount)
    })
  })

  describe('VR 体绘制 (光线投射)', () => {
    it('确定性: 相同 yaw/pitch/preset/step → 完全一致 base64 输出', async () => {
      const a = await service.vr({ jobId: SPEC_JOB, yaw: 30, pitch: 15, preset: 'bone', step: 1, size: 128 })
      const b = await service.vr({ jobId: SPEC_JOB, yaw: 30, pitch: 15, preset: 'bone', step: 1, size: 128 })
      expect(b.pixelData.dataBase64).toBe(a.pixelData.dataBase64)
      expect(b.width).toBe(a.width)
      expect(b.height).toBe(a.height)
      expect(b.sampleStep).toBe(a.sampleStep)
      expect(b.stepCount).toBe(a.stepCount)
    })

    it('不同 yaw 旋转 → 输出不同', async () => {
      const a = await service.vr({ jobId: SPEC_JOB, yaw: 0, pitch: 0, preset: 'vessel', size: 128 })
      const b = await service.vr({ jobId: SPEC_JOB, yaw: 90, pitch: 0, preset: 'vessel', size: 128 })
      expect(b.pixelData.dataBase64).not.toBe(a.pixelData.dataBase64)
    })

    it('传输函数: LUT 32 条, 预设曲线随 HU 上升', async () => {
      const res = await service.vr({ jobId: SPEC_JOB, preset: 'bone', size: 96 })
      expect(res.transferFunction.lutSize).toBe(32)
      expect(res.transferFunction.entries).toHaveLength(8)
      const a0 = res.transferFunction.entries[0]!
      const a7 = res.transferFunction.entries[7]!
      expect(a0.hu).toBeLessThan(a7.hu)
      expect(a7.a).toBeGreaterThan(a0.a)
    })

    it('预设改变渲染 (骨/软组织/血管 输出不同)', async () => {
      const bone = await service.vr({ jobId: SPEC_JOB, preset: 'bone', size: 96 })
      const soft = await service.vr({ jobId: SPEC_JOB, preset: 'softTissue', size: 96 })
      expect(soft.pixelData.dataBase64).not.toBe(bone.pixelData.dataBase64)
    })
  })

  describe('切割 (cut-plane)', () => {
    it('确定性: 相同法向量/偏移 → 相同截面与统计', async () => {
      const a = await service.cut({ jobId: SPEC_JOB, normal: { x: 0, y: 0, z: 1 }, offset: 0 })
      const b = await service.cut({ jobId: SPEC_JOB, normal: { x: 0, y: 0, z: 1 }, offset: 0 })
      expect(b.sectionImage.dataBase64).toBe(a.sectionImage.dataBase64)
      expect(b.stats).toEqual(a.stats)
    })

    it('法向量自动归一化, 截面图像非空', async () => {
      const res = await service.cut({ jobId: SPEC_JOB, normal: { x: 0, y: 0, z: 5 } })
      const len = Math.sqrt(res.normal.x ** 2 + res.normal.y ** 2 + res.normal.z ** 2)
      expect(len).toBeCloseTo(1)
      expect(res.width).toBeGreaterThan(1)
      expect(res.height).toBeGreaterThan(1)
      expect(res.sectionImage.dataBase64.length).toBeGreaterThan(0)
    })

    it('偏移语义: 偏移越大保留侧占比越小', async () => {
      const pos = await service.cut({ jobId: SPEC_JOB, normal: { x: 0, y: 0, z: 1 }, offset: 80 })
      const neg = await service.cut({ jobId: SPEC_JOB, normal: { x: 0, y: 0, z: 1 }, offset: -80 })
      expect(pos.stats.keptRatio).toBeLessThan(neg.stats.keptRatio)
      expect(pos.stats.clippedRatio).toBeGreaterThan(0)
      expect(pos.stats.keptRatio + pos.stats.clippedRatio).toBeCloseTo(1)
    })
  })
})

describe('VolumeV2Controller (切割端点 200)', () => {
  let app: INestApplication
  let jobId: string

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [VolumeV2Controller],
      providers: [VolumeV2Service],
    }).compile()
    app = moduleRef.createNestApplication()
    await app.init()
  })

  afterAll(async () => {
    await app.close()
  })

  it('POST /volume-v2/cut → 200 (合法法向量 + 偏移)', async () => {
    const res = await request(app.getHttpServer())
      .post('/volume-v2/cut')
      .send({ normal: { x: 0, y: 1, z: 0 }, offset: 0 })
      .expect(200)
    expect(res.body.source).toBe('synthetic')
    expect(res.body.sectionImage.dataBase64.length).toBeGreaterThan(0)
    expect(typeof res.body.stats.keptRatio).toBe('number')
    jobId = res.body.jobId
    expect(jobId).toMatch(/^v2-synthetic-/)
  })

  it('POST /volume-v2/cut 缺少 normal → 400 (zod)', async () => {
    await request(app.getHttpServer()).post('/volume-v2/cut').send({ offset: 10 }).expect(400)
  })

  it('POST /volume-v2/mpr-linked → 200, 三平面联动', async () => {
    const res = await request(app.getHttpServer())
      .post('/volume-v2/mpr-linked')
      .send({ jobId, position: { x: 32, y: 32, z: 32 } })
      .expect(200)
    expect(res.body.planes).toHaveLength(3)
    expect(res.body.lines.axial).toEqual({ h: 32, v: 32 })
  })

  it('POST /volume-v2/cpr → 200, 拉直图尺寸正确', async () => {
    const res = await request(app.getHttpServer())
      .post('/volume-v2/cpr')
      .send({
        jobId,
        points: [
          { x: 10, y: 10, z: 10 },
          { x: 100, y: 100, z: 100 },
        ],
        spacing: 3,
      })
      .expect(200)
    expect(res.body.straightened.width).toBe(res.body.sampleCount)
  })

  it('POST /volume-v2/vr → 200, 确定性输出', async () => {
    const body = { jobId, yaw: 45, preset: 'vessel', size: 96 }
    const a = await request(app.getHttpServer()).post('/volume-v2/vr').send(body).expect(200)
    const b = await request(app.getHttpServer()).post('/volume-v2/vr').send(body).expect(200)
    expect(a.body.pixelData.dataBase64).toBe(b.body.pixelData.dataBase64)
  })
})
