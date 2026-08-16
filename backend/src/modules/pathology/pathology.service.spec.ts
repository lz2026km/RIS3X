/**
 * G005 RIS v3.0.6.11-101 Wave 2B - 病理切片 WSI spec
 *
 * - tile 尺寸正确性: PNG 魔数 / IHDR 宽高 (中间瓦片 = tileSize, 边缘瓦片按剩余裁切) /
 *   层级 tilesX×tilesY 与元数据一致 / 确定性 (相同输入相同字节)
 * - 标注 CRUD HTTP 200: 创建/列表/更新/删除全链路 2xx, 校验 400, 未知资源 404
 * - 无 DB 启动: patient.findMany 拒绝时切片列表仍返回内置 seed
 */
import { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { PrismaService } from '../../prisma/prisma.service'
import request from 'supertest'
import { PathologyController } from './pathology.controller'
import { PathologyService, DEFAULT_TILE_SIZE } from './pathology.service'

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

// jest 沙箱无 JIT, 确定性瓦片生成在沙箱内耗时更高, 放宽默认超时
jest.setTimeout(30000)

function makePrisma(overrides: Record<string, unknown> = {}) {
  return {
    patient: { findMany: jest.fn().mockRejectedValue(new Error('no db')) },
    ...overrides,
  } as never
}

async function createApp(prisma: unknown): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    controllers: [PathologyController],
    providers: [PathologyService, { provide: PrismaService, useValue: prisma }],
  }).compile()
  const app = moduleRef.createNestApplication()
  await app.init()
  return app
}

function ihdrDims(buf: Buffer): { width: number; height: number } {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

describe('PathologyService / PathologyController (WSI v3.0.6.11-101 Wave 2B)', () => {
  describe('切片列表与层级元数据 (seed 回退)', () => {
    it('无 DB 时返回内置 seed 切片列表', async () => {
      const app = await createApp(makePrisma())
      const res = await request(app.getHttpServer()).get('/pathology/slides').expect(200)
      expect(res.body.success).toBe(true)
      const slides = res.body.data as Array<{ id: string; levels: number; width: number; height: number }>
      expect(slides.length).toBeGreaterThanOrEqual(8)
      expect(slides[0]).toMatchObject({ id: 'SL-2026-001', width: 8192, height: 6144, levels: 5 })
      await app.close()
    })

    it('切片详情包含金字塔 level 元数据 (每层宽高/tileSize/tilesX×tilesY)', async () => {
      const app = await createApp(makePrisma())
      const res = await request(app.getHttpServer()).get('/pathology/slides/SL-2026-002').expect(200)
      const detail = res.body.data
      expect(detail.levelsMeta).toHaveLength(detail.levels)
      const level0 = detail.levelsMeta[0]
      const level1 = detail.levelsMeta[1]
      expect(level0).toMatchObject({ level: 0, width: 4096, height: 3000, tileSize: DEFAULT_TILE_SIZE })
      expect(level0.tilesX).toBe(Math.ceil(4096 / 256))
      expect(level0.tilesY).toBe(Math.ceil(3000 / 256)) // 12, 末行瓦片被裁切
      expect(level1).toMatchObject({ level: 1, width: 2048, height: 1500 })
      expect(detail.case).toMatchObject({ specimen: '乳腺穿刺', status: 'reported' })
      await app.close()
    })

    it('病例摘要列表返回聚合 slideCount', async () => {
      const app = await createApp(makePrisma())
      const res = await request(app.getHttpServer()).get('/pathology/cases').expect(200)
      const cases = res.body.data as Array<{ id: string; slideCount: number }>
      expect(cases.length).toBeGreaterThanOrEqual(8)
      expect(cases.every((c) => c.slideCount >= 1)).toBe(true)
      await app.close()
    })

    it('未知切片 → 404', async () => {
      const app = await createApp(makePrisma())
      await request(app.getHttpServer()).get('/pathology/slides/SL-UNKNOWN').expect(404)
      await app.close()
    })
  })

  describe('tile 端点: 尺寸正确性与确定性', () => {
    it('level0 (0,0) 返回合法 PNG 且尺寸 = tileSize×tileSize', async () => {
      const app = await createApp(makePrisma())
      const res = await request(app.getHttpServer()).get('/pathology/slides/SL-2026-001/tile/0/0/0').expect(200)
      expect(res.headers['content-type']).toContain('image/png')
      const body = res.body as Buffer
      expect(Array.from(body.subarray(0, 8))).toEqual(PNG_MAGIC)
      expect(ihdrDims(body)).toEqual({ width: DEFAULT_TILE_SIZE, height: DEFAULT_TILE_SIZE })
      await app.close()
    })

    it('边缘瓦片按剩余像素裁切 (SL-2026-002 level0 末行: 3000 = 11*256 + 184)', async () => {
      const app = await createApp(makePrisma())
      const full = await request(app.getHttpServer()).get('/pathology/slides/SL-2026-002/tile/0/0/0').expect(200)
      expect(ihdrDims(full.body as Buffer)).toEqual({ width: 256, height: 256 })
      const edge = await request(app.getHttpServer()).get('/pathology/slides/SL-2026-002/tile/0/15/11').expect(200)
      expect(ihdrDims(edge.body as Buffer)).toEqual({ width: 256, height: 184 })
      await app.close()
    })

    it('层级缩放: level1 宽高为 level0 的一半', async () => {
      const app = await createApp(makePrisma())
      const res = await request(app.getHttpServer()).get('/pathology/slides/SL-2026-001/tile/1/0/0').expect(200)
      const body = res.body as Buffer
      expect(Array.from(body.subarray(0, 8))).toEqual(PNG_MAGIC)
      expect(ihdrDims(body)).toEqual({ width: 256, height: 256 })
      const detail = await request(app.getHttpServer()).get('/pathology/slides/SL-2026-001').expect(200)
      expect(detail.body.data.levelsMeta[1].width).toBe(4096)
      await app.close()
    })

    it('确定性: 相同 slideId/level/x/y 两次请求字节完全一致', async () => {
      const app = await createApp(makePrisma())
      const a = await request(app.getHttpServer()).get('/pathology/slides/SL-2026-003/tile/2/5/3').expect(200)
      const b = await request(app.getHttpServer()).get('/pathology/slides/SL-2026-003/tile/2/5/3').expect(200)
      expect((a.body as Buffer).equals(b.body as Buffer)).toBe(true)
      await app.close()
    })

    it('越界瓦片 (x ≥ tilesX) → 404; 越界层级 → 404', async () => {
      const app = await createApp(makePrisma())
      await request(app.getHttpServer()).get('/pathology/slides/SL-2026-001/tile/0/32/0').expect(404)
      await request(app.getHttpServer()).get('/pathology/slides/SL-2026-001/tile/99/0/0').expect(404)
      await app.close()
    })
  })

  describe('标注 CRUD (HTTP 200 全链路)', () => {
    const payload = {
      kind: 'rect',
      points: [1024, 2048, 1536, 2560],
      label: '可疑浸润灶',
      category: 'suspicious',
      color: '#faad14',
      confidence: 0.87,
      level: 0,
    }

    it('创建 → 200 且回显字段; 列表 → 200 包含该标注', async () => {
      const app = await createApp(makePrisma())
      const created = await request(app.getHttpServer())
        .post('/pathology/slides/SL-2026-001/annotations')
        .send(payload)
        .expect(200)
      expect(created.body.success).toBe(true)
      const ann = created.body.data
      expect(ann.id).toMatch(/^ant-/)
      expect(ann.slideId).toBe('SL-2026-001')
      expect(ann.label).toBe('可疑浸润灶')
      expect(ann.category).toBe('suspicious')
      expect(ann.confidence).toBe(0.87)
      expect(ann.points).toEqual([1024, 2048, 1536, 2560])

      const list = await request(app.getHttpServer()).get('/pathology/slides/SL-2026-001/annotations').expect(200)
      expect(list.body.data.some((a: { id: string }) => a.id === ann.id)).toBe(true)
      await app.close()
    })

    it('circle / polygon 类型均可创建; 不同切片不串数据', async () => {
      const app = await createApp(makePrisma())
      await request(app.getHttpServer())
        .post('/pathology/slides/SL-2026-002/annotations')
        .send({ kind: 'circle', points: [512, 512, 128], label: '核周空晕', category: 'benign', color: '#52c41a', confidence: 0.9, level: 1 })
        .expect(200)
      await request(app.getHttpServer())
        .post('/pathology/slides/SL-2026-002/annotations')
        .send({ kind: 'polygon', points: [0, 0, 100, 0, 100, 100, 0, 100], label: '坏死区', category: 'necrosis', color: '#722ed1' })
        .expect(200)
      const list = await request(app.getHttpServer()).get('/pathology/slides/SL-2026-002/annotations').expect(200)
      expect(list.body.data).toHaveLength(2)
      const other = await request(app.getHttpServer()).get('/pathology/slides/SL-2026-001/annotations').expect(200)
      expect(other.body.data).toHaveLength(0)
      await app.close()
    })

    it('更新 → 200 (label/category/confidence 变更); 未知 id → 404', async () => {
      const app = await createApp(makePrisma())
      const created = await request(app.getHttpServer()).post('/pathology/slides/SL-2026-001/annotations').send(payload).expect(200)
      const id = created.body.data.id as string

      const updated = await request(app.getHttpServer())
        .put(`/pathology/annotations/${id}`)
        .send({ label: '浸润性癌巢', category: 'malignant', confidence: 0.95 })
        .expect(200)
      expect(updated.body.data.label).toBe('浸润性癌巢')
      expect(updated.body.data.category).toBe('malignant')
      expect(updated.body.data.confidence).toBe(0.95)
      expect(updated.body.data.kind).toBe('rect')

      await request(app.getHttpServer()).put('/pathology/annotations/ant-nope').send({ label: 'x' }).expect(404)
      await app.close()
    })

    it('删除 → 200 {deleted:true}; 列表清空; 重复删除 → 404', async () => {
      const app = await createApp(makePrisma())
      const created = await request(app.getHttpServer()).post('/pathology/slides/SL-2026-003/annotations').send(payload).expect(200)
      const id = created.body.data.id as string

      const del = await request(app.getHttpServer()).delete(`/pathology/annotations/${id}`).expect(200)
      expect(del.body.data.deleted).toBe(true)

      const list = await request(app.getHttpServer()).get('/pathology/slides/SL-2026-003/annotations').expect(200)
      expect(list.body.data).toHaveLength(0)

      await request(app.getHttpServer()).delete(`/pathology/annotations/${id}`).expect(404)
      await app.close()
    })

    it('校验失败 → 400 (非法 kind / points 过短)', async () => {
      const app = await createApp(makePrisma())
      await request(app.getHttpServer())
        .post('/pathology/slides/SL-2026-001/annotations')
        .send({ ...payload, kind: 'triangle' })
        .expect(400)
      await request(app.getHttpServer())
        .post('/pathology/slides/SL-2026-001/annotations')
        .send({ ...payload, points: [1, 2] })
        .expect(400)
      await request(app.getHttpServer())
        .post('/pathology/slides/SL-2026-001/annotations')
        .send({ kind: 'rect', points: [0, 0, 1, 1], label: '' })
        .expect(400)
      await app.close()
    })

    it('不存在切片的标注创建 → 404', async () => {
      const app = await createApp(makePrisma())
      await request(app.getHttpServer()).post('/pathology/slides/SL-UNKNOWN/annotations').send(payload).expect(404)
      await app.close()
    })
  })

  describe('服务级: 无 DB 回退与确定性', () => {
    it('DB 拒绝时列表/瓦片/标注仍可用', async () => {
      const service = new PathologyService(makePrisma())
      expect(service.listSlides().length).toBeGreaterThanOrEqual(8)
      const tile = service.getTile('SL-2026-001', 0, 0, 0)
      expect(Array.from(tile.subarray(0, 8))).toEqual(PNG_MAGIC)
      expect(service.getAnnotationSync('SL-2026-001')).toHaveLength(0)
      const ann = await service.createAnnotation('SL-2026-001', {
        kind: 'rect',
        points: [1, 2, 3, 4],
        label: '测试',
        category: 'test',
      })
      expect(service.getAnnotationSync('SL-2026-001').map((a) => a.id)).toContain(ann.id)
    })

    it('tile 确定性: 服务级两次调用 Buffer 相等', () => {
      const a = new PathologyService(makePrisma())
      const b = new PathologyService(makePrisma())
      expect(a.getTile('SL-2026-005', 3, 2, 1).equals(b.getTile('SL-2026-005', 3, 2, 1))).toBe(true)
    })
  })
})
