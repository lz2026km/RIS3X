/**
 * G005 RIS v3.0.6.11-101 Wave 2B - 病理切片 WSI (全切片图像) 服务
 *
 * - 孤儿模块: 不依赖任何其他业务模块, 可无 DB 启动 (Prisma 连接失败 → seed 回退)。
 * - 模型派生: pathologySlide 从现有 patient 表 (patientId/patientName) 派生,
 *   无 DB 时回退内置 seed; pathologyCase 摘要由切片聚合生成。
 * - tile 端点: level/x/y 瓦片返回确定性生成的 PNG (H&E 模拟组织学图案),
 *   相同输入永远产出相同字节 (缓存于内存)。
 * - 标注 CRUD: 坐标(level-0 空间)/标签/分类/置信度, 内存存储 +
 *   可选 Prisma pathologyAnnotation 模型桥接 (模型不存在时自动回退内存)。
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { deflateSync } from 'node:zlib'
import { PrismaService } from '../../prisma/prisma.service'

export const DEFAULT_TILE_SIZE = 256

// ────────────────────────────────────────────────────────────────────────────
// DTO 类型
// ────────────────────────────────────────────────────────────────────────────

export interface PathologyLevelMeta {
  level: number
  width: number
  height: number
  tilesX: number
  tilesY: number
  tileSize: number
}

export interface PathologyCaseSummary {
  id: string
  patientId: string
  patientName: string
  specimen: string
  diagnosis: string
  status: 'pending' | 'reviewed' | 'reported'
  reportedAt?: string
  slideCount: number
  accessionNumber: string
}

export interface PathologySlideSummary {
  id: string
  caseId: string
  patientId: string
  patientName: string
  stain: string
  stainLabel: string
  magnification: number
  institution: string
  levels: number
  width: number
  height: number
  tileSize: number
  scannedAt: string
  caseStatus: string
}

export interface PathologySlideDetail extends PathologySlideSummary {
  levelsMeta: PathologyLevelMeta[]
  case: PathologyCaseSummary
}

export type AnnotationKind = 'rect' | 'circle' | 'polygon'

export interface PathologyAnnotation {
  id: string
  slideId: string
  kind: AnnotationKind
  /** level-0 全分辨率坐标系: rect=[x1,y1,x2,y2]; circle=[cx,cy,r]; polygon=[x1,y1,x2,y2,...] */
  points: number[]
  label: string
  category: string
  color: string
  confidence?: number
  /** 绘制时所在金字塔层级 (坐标已归一化到 level-0 空间) */
  level: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

export interface CreateAnnotationDto {
  kind: AnnotationKind
  points: number[]
  label: string
  category?: string
  color?: string
  confidence?: number
  level?: number
}

// ────────────────────────────────────────────────────────────────────────────
// Seed: 内置病理切片 (无 DB 时的回退数据源)
// ────────────────────────────────────────────────────────────────────────────

interface SlideSeed {
  id: string
  patientId: string
  patientName: string
  stain: string
  stainLabel: string
  magnification: number
  institution: string
  levels: number
  width: number
  height: number
  specimen: string
  diagnosis: string
  status: PathologyCaseSummary['status']
  accessionNumber: string
}

const SEED_SLIDES: SlideSeed[] = [
  { id: 'SL-2026-001', patientId: 'P00001', patientName: '张伟', stain: 'HE', stainLabel: '苏木精-伊红', magnification: 40, institution: '汉东省人民医院 · 病理科', levels: 5, width: 8192, height: 6144, specimen: '胃窦活检', diagnosis: '低分化腺癌', status: 'reported', accessionNumber: 'ACC-20260701-001' },
  { id: 'SL-2026-002', patientId: 'P00002', patientName: '李娜', stain: 'HE', stainLabel: '苏木精-伊红', magnification: 20, institution: '汉东省人民医院 · 病理科', levels: 4, width: 4096, height: 3000, specimen: '乳腺穿刺', diagnosis: '浸润性导管癌', status: 'reported', accessionNumber: 'ACC-20260702-018' },
  { id: 'SL-2026-003', patientId: 'P00003', patientName: '王芳', stain: 'IHC', stainLabel: '免疫组化 CK', magnification: 40, institution: '汉东省肿瘤医院 · 病理科', levels: 6, width: 16384, height: 12288, specimen: '结肠切除', diagnosis: '腺癌 CK 阳性', status: 'reviewed', accessionNumber: 'ACC-20260703-033' },
  { id: 'SL-2026-004', patientId: 'P00004', patientName: '赵敏', stain: 'HE', stainLabel: '苏木精-伊红', magnification: 40, institution: '汉东省人民医院 · 病理科', levels: 5, width: 8192, height: 6144, specimen: '肺楔形切除', diagnosis: '鳞状细胞癌', status: 'pending', accessionNumber: 'ACC-20260704-052' },
  { id: 'SL-2026-005', patientId: 'P00005', patientName: '陈杰', stain: 'SS', stainLabel: '特殊染色 阿辛蓝-PAS', magnification: 20, institution: '汉东省人民医院 · 病理科', levels: 4, width: 5120, height: 4096, specimen: '胃窦黏膜', diagnosis: '肠上皮化生', status: 'reported', accessionNumber: 'ACC-20260705-007' },
  { id: 'SL-2026-006', patientId: 'P00006', patientName: '刘洋', stain: 'FISH', stainLabel: 'FISH HER2', magnification: 40, institution: '汉东省肿瘤医院 · 病理科', levels: 5, width: 10240, height: 8192, specimen: '乳腺肿块', diagnosis: 'HER2 基因扩增', status: 'reviewed', accessionNumber: 'ACC-20260706-021' },
  { id: 'SL-2026-007', patientId: 'P00007', patientName: '孙丽', stain: 'HE', stainLabel: '苏木精-伊红', magnification: 20, institution: '汉东省人民医院 · 病理科', levels: 4, width: 4096, height: 3072, specimen: '淋巴结活检', diagnosis: '反应性增生', status: 'pending', accessionNumber: 'ACC-20260707-044' },
  { id: 'SL-2026-008', patientId: 'P00008', patientName: '周强', stain: 'HE', stainLabel: '苏木精-伊红', magnification: 10, institution: '汉东省人民医院 · 病理科', levels: 3, width: 2048, height: 2048, specimen: '皮肤肿物', diagnosis: '基底细胞癌', status: 'reported', accessionNumber: 'ACC-20260708-012' },
]

// ────────────────────────────────────────────────────────────────────────────
// 确定性 PNG 编码 (标准 libpng 流程, zlib deflate; 无第三方图像库)
// ────────────────────────────────────────────────────────────────────────────

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const CRC_TABLE = ((): Uint32Array => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]!) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePng(width: number, height: number, rgb: Buffer): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: RGB
  const stride = width * 3
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filter: None
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride)
  }
  const idat = deflateSync(raw, { level: 9 })
  return Buffer.concat([PNG_SIGNATURE, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))])
}

// 确定性哈希 (FNV-1a 变体, 纯整数运算, 跨平台稳定)
function fnv1a(str: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

// seed → fnv1a 结果缓存 (同一张瓦片内种子固定, 避免逐像素重复字符串哈希;
// jest 沙箱下无 JIT, 该缓存可将瓦片生成耗时降低一个数量级)
const SEED_HASH_CACHE = new Map<string, number>()

function seedHash(seed: string): number {
  let h = SEED_HASH_CACHE.get(seed)
  if (h === undefined) {
    h = fnv1a(seed)
    if (SEED_HASH_CACHE.size > 8192) SEED_HASH_CACHE.clear()
    SEED_HASH_CACHE.set(seed, h)
  }
  return h
}

function hashAt(seed: string, x: number, y: number): number {
  let h = seedHash(seed)
  h ^= (x | 0) + 0x9e3779b9 + (h << 6) + (h >>> 2)
  h = Math.imul(h, 0x85ebca6b)
  h ^= (y | 0) + 0x9e3779b9 + (h << 6) + (h >>> 2)
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

function unitNoise(seed: string, x: number, y: number): number {
  return (hashAt(seed, x, y) % 1000) / 1000
}

/** 平滑值噪声 (双线性插值 + smoothstep), 用于组织学图案 */
function smoothNoise(seed: string, x: number, y: number): number {
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const fx = x - x0
  const fy = y - y0
  const v00 = unitNoise(seed, x0, y0)
  const v10 = unitNoise(seed, x0 + 1, y0)
  const v01 = unitNoise(seed, x0, y0 + 1)
  const v11 = unitNoise(seed, x0 + 1, y0 + 1)
  const sx = fx * fx * (3 - 2 * fx)
  const sy = fy * fy * (3 - 2 * fy)
  const a = v00 + (v10 - v00) * sx
  const b = v01 + (v11 - v01) * sx
  return a + (b - a) * sy
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

@Injectable()
export class PathologyService {
  private readonly logger = new Logger(PathologyService.name)
  private readonly tileCache = new Map<string, Buffer>()
  private readonly annotations = new Map<string, PathologyAnnotation[]>()
  private annotationSeq = 1

  private slides: PathologySlideSummary[] = []
  private cases: PathologyCaseSummary[] = []
  private patientNameById = new Map<string, string>()

  constructor(private readonly prisma: PrismaService) {
    this.initSeed()
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 初始化 / seed 派生
  // ────────────────────────────────────────────────────────────────────────────

  /**
   * 从现有 patient 表派生患者姓名, 失败/无 DB 时回退内置 seed。
   * 同步初始化以保证内存数据就绪 (服务构造阶段即可查询)。
   */
  private initSeed(): void {
    const base = SEED_SLIDES.map((s) => ({ ...s }))
    const model = (this.prisma as any).patient
    let derived = false
    this.patientNameById = new Map(base.map((s) => [s.patientId, s.patientName]))
    // 异步尝试真实患者派生 (不阻塞构造; 成功后刷新列表)
    if (model?.findMany) {
      model
        .findMany({ take: 24, select: { id: true, name: true } })
        .then((rows: Array<{ id: string; name: string }>) => {
          if (Array.isArray(rows) && rows.length > 0) {
            derived = true
            const names = rows.map((r) => r.name)
            base.forEach((s, i) => {
              const name = names[i % names.length]!
              s.patientName = name
              this.patientNameById.set(s.patientId, name)
            })
          }
        })
        .catch(() => {
          /* 无 DB: 保持内置 seed */
        })
        .finally(() => {
          if (derived) {
            this.slides = base.map((s) => this.toSummary(s))
            this.cases = this.buildCases(base)
            this.logger.log(`pathology seed derived from patient table (${this.slides.length} slides)`)
          }
        })
    }
    this.slides = base.map((s) => this.toSummary(s))
    this.cases = this.buildCases(base)
  }

  private toSummary(s: SlideSeed): PathologySlideSummary {
    return {
      id: s.id,
      caseId: `PC-${s.id.replace('SL-', '')}`,
      patientId: s.patientId,
      patientName: this.patientNameById.get(s.patientId) ?? s.patientName,
      stain: s.stain,
      stainLabel: s.stainLabel,
      magnification: s.magnification,
      institution: s.institution,
      levels: s.levels,
      width: s.width,
      height: s.height,
      tileSize: DEFAULT_TILE_SIZE,
      scannedAt: `2026-07-${String(1 + SEED_SLIDES.indexOf(s)).padStart(2, '0')}T09:30:00.000Z`,
      caseStatus: s.status,
    }
  }

  private buildCases(seeds: SlideSeed[]): PathologyCaseSummary[] {
    const byCase = new Map<string, { seed: SlideSeed; count: number }>()
    for (const s of seeds) {
      const key = `PC-${s.id.replace('SL-', '')}`
      const entry = byCase.get(key) ?? { seed: s, count: 0 }
      entry.count++
      byCase.set(key, entry)
    }
    return Array.from(byCase.values()).map(({ seed, count }) => ({
      id: `PC-${seed.id.replace('SL-', '')}`,
      patientId: seed.patientId,
      patientName: this.patientNameById.get(seed.patientId) ?? seed.patientName,
      specimen: seed.specimen,
      diagnosis: seed.diagnosis,
      status: seed.status,
      reportedAt: seed.status === 'reported' ? `2026-07-${String(1 + SEED_SLIDES.indexOf(seed)).padStart(2, '0')}T14:00:00.000Z` : undefined,
      slideCount: count,
      accessionNumber: seed.accessionNumber,
    }))
  }

  private findSeed(id: string): SlideSeed | undefined {
    return SEED_SLIDES.find((s) => s.id === id)
  }

  private buildLevelsMeta(width: number, height: number, levels: number, tileSize: number): PathologyLevelMeta[] {
    const out: PathologyLevelMeta[] = []
    for (let level = 0; level < levels; level++) {
      const w = Math.max(1, Math.ceil(width / Math.pow(2, level)))
      const h = Math.max(1, Math.ceil(height / Math.pow(2, level)))
      out.push({ level, width: w, height: h, tilesX: Math.ceil(w / tileSize), tilesY: Math.ceil(h / tileSize), tileSize })
    }
    return out
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 列表 / 详情 / 病例摘要
  // ────────────────────────────────────────────────────────────────────────────

  listSlides(filter?: { patientId?: string; stain?: string }): PathologySlideSummary[] {
    let out = this.slides
    if (filter?.patientId) out = out.filter((s) => s.patientId === filter.patientId)
    if (filter?.stain) out = out.filter((s) => s.stain === filter.stain)
    return out
  }

  listCases(): PathologyCaseSummary[] {
    return this.cases
  }

  getSlide(id: string): PathologySlideDetail {
    const seed = this.findSeed(id)
    if (!seed) throw new NotFoundException(`病理切片不存在: ${id}`)
    const summary = this.slides.find((s) => s.id === id) ?? this.toSummary(seed)
    return {
      ...summary,
      levelsMeta: this.buildLevelsMeta(seed.width, seed.height, seed.levels, DEFAULT_TILE_SIZE),
      case: this.cases.find((c) => c.id === `PC-${seed.id.replace('SL-', '')}`) ?? this.buildCases([seed])[0]!,
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 金字塔瓦片 (确定性 PNG)
  // ────────────────────────────────────────────────────────────────────────────

  getLevelMeta(slideId: string, level: number): { meta: PathologyLevelMeta; seed: SlideSeed } {
    const seed = this.findSeed(slideId)
    if (!seed) throw new NotFoundException(`病理切片不存在: ${slideId}`)
    const metas = this.buildLevelsMeta(seed.width, seed.height, seed.levels, DEFAULT_TILE_SIZE)
    const meta = metas[level]
    if (!meta) throw new NotFoundException(`层级不存在: ${slideId}@${level} (共 ${seed.levels} 层)`)
    return { meta, seed }
  }

  /**
   * 瓦片尺寸正确性: 边缘瓦片按剩余像素裁切 (宽/高 = min(tileSize, 剩余)),
   * 中间瓦片恒为 tileSize×tileSize; 结果以 PNG 二进制返回, 内容完全确定。
   */
  getTile(slideId: string, level: number, x: number, y: number): Buffer {
    const key = `${slideId}:${level}:${x}:${y}`
    const cached = this.tileCache.get(key)
    if (cached) return cached

    const { meta } = this.getLevelMeta(slideId, level)
    if (x < 0 || y < 0 || x >= meta.tilesX || y >= meta.tilesY) {
      throw new NotFoundException(`瓦片越界: ${slideId}@${level} (${x},${y}) 超出 ${meta.tilesX}x${meta.tilesY}`)
    }
    const tw = Math.min(meta.tileSize, meta.width - x * meta.tileSize)
    const th = Math.min(meta.tileSize, meta.height - y * meta.tileSize)
    const rgb = Buffer.alloc(tw * th * 3)
    // 噪声种子只绑定 slide+level (不绑定 x/y): 图案锚定全局坐标, 跨瓦片无缝连续
    const tileSeed = `${slideId}:${level}`
    // 每个噪声通道的种子字符串在整张瓦片内固定, 提前算好避免逐像素拼接
    const noiseSeeds = {
      t: `${tileSeed}:t`,
      s: `${tileSeed}:s`,
      e: `${tileSeed}:e`,
      n: `${tileSeed}:n`,
    }
    let p = 0
    for (let py = 0; py < th; py++) {
      for (let px = 0; px < tw; px++) {
        const [r, g, b] = this.tilePixel(noiseSeeds, x * meta.tileSize + px, y * meta.tileSize + py)
        rgb[p++] = r
        rgb[p++] = g
        rgb[p++] = b
      }
    }
    const png = encodePng(tw, th, rgb)
    if (this.tileCache.size > 4096) this.tileCache.clear()
    this.tileCache.set(key, png)
    return png
  }

  /**
   * H&E 模拟组织学图案 (确定性):
   * - 空白背景 (无组织区域)
   * - 组织区: 基质浅粉 + 上皮紫红 + 细胞核深紫点状聚集
   * @param seeds 各噪声通道种子 (整张瓦片内固定, 由调用方预计算)
   */
  private tilePixel(seeds: { t: string; s: string; e: string; n: string }, gx: number, gy: number): [number, number, number] {
    const tissue = smoothNoise(seeds.t, gx / 180, gy / 180)
    const inTissue = tissue > 0.42
    let r = 252
    let g = 249
    let b = 245
    if (inTissue) {
      const stroma = smoothNoise(seeds.s, gx / 36, gy / 36)
      r = 238 + Math.round((stroma - 0.5) * 40)
      g = 215 + Math.round((stroma - 0.5) * 34)
      b = 198 + Math.round((stroma - 0.5) * 30)
      // 上皮/腺体带 (紫红)
      const epi = smoothNoise(seeds.e, gx / 14, gy / 14)
      if (epi > 0.72) {
        const t = Math.min(1, (epi - 0.72) / 0.28)
        r = lerp(r, 226, t * 0.9)
        g = lerp(g, 182, t * 0.9)
        b = lerp(b, 196, t * 0.9)
      }
      // 细胞核 (深紫蓝点状)
      const nuc = smoothNoise(seeds.n, gx / 5.5, gy / 5.5)
      if (nuc > 0.78) {
        const t = clamp01((nuc - 0.78) / 0.22)
        r = lerp(r, 92, t)
        g = lerp(g, 58, t)
        b = lerp(b, 112, t)
      }
    }
    return [Math.round(clamp01(r / 255) * 255), Math.round(clamp01(g / 255) * 255), Math.round(clamp01(b / 255) * 255)]
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 标注 CRUD (内存 + 可选 Prisma 桥接)
  // ────────────────────────────────────────────────────────────────────────────

  private modelAvailable(): boolean {
    const model = (this.prisma as any).pathologyAnnotation
    return Boolean(model?.findMany && model?.create && model?.update && model?.delete)
  }

  private async withPrisma<T>(fn: (model: any) => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    if (this.modelAvailable()) {
      try {
        return await fn((this.prisma as any).pathologyAnnotation)
      } catch (e) {
        this.logger.debug(`pathologyAnnotation prisma failed, fallback to memory: ${(e as Error).message}`)
      }
    }
    return fallback()
  }

  async listAnnotations(slideId: string): Promise<PathologyAnnotation[]> {
    return this.withPrisma(
      async (model) => {
        const rows = await model.findMany({ where: { slideId }, orderBy: { createdAt: 'asc' } })
        return rows.map((r: any) => this.normalizeAnnotationRow(r))
      },
      async () => [...(this.annotations.get(slideId) ?? [])],
    )
  }

  async createAnnotation(slideId: string, dto: CreateAnnotationDto): Promise<PathologyAnnotation> {
    const seed = this.findSeed(slideId)
    if (!seed) throw new NotFoundException(`病理切片不存在: ${slideId}`)
    const record: PathologyAnnotation = {
      id: `ant-${Date.now().toString(36)}-${this.annotationSeq++}`,
      slideId,
      kind: dto.kind,
      points: dto.points,
      label: dto.label,
      category: dto.category ?? 'uncategorized',
      color: dto.color ?? '#ff4d4f',
      confidence: dto.confidence,
      level: dto.level ?? 0,
      createdBy: 'wsi-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    return this.withPrisma(
      async (model) => {
        const row = await model.create({
          data: {
            slideId,
            kind: record.kind,
            points: record.points,
            label: record.label,
            category: record.category,
            color: record.color,
            confidence: record.confidence ?? null,
            level: record.level,
            createdBy: record.createdBy,
          },
        })
        return this.normalizeAnnotationRow(row)
      },
      async () => {
        const list = this.annotations.get(slideId) ?? []
        list.push(record)
        this.annotations.set(slideId, list)
        return record
      },
    )
  }

  async updateAnnotation(id: string, dto: Partial<CreateAnnotationDto>): Promise<PathologyAnnotation> {
    return this.withPrisma(
      async (model) => {
        const existing = await model.findUnique({ where: { id } })
        if (!existing) throw new NotFoundException(`标注不存在: ${id}`)
        const data: Record<string, unknown> = {}
        if (dto.kind !== undefined) data.kind = dto.kind
        if (dto.points !== undefined) data.points = dto.points
        if (dto.label !== undefined) data.label = dto.label
        if (dto.category !== undefined) data.category = dto.category
        if (dto.color !== undefined) data.color = dto.color
        if (dto.confidence !== undefined) data.confidence = dto.confidence
        if (dto.level !== undefined) data.level = dto.level
        const row = await model.update({ where: { id }, data })
        return this.normalizeAnnotationRow(row)
      },
      async () => {
        for (const list of this.annotations.values()) {
          const idx = list.findIndex((a) => a.id === id)
          if (idx >= 0) {
            const prev = list[idx]!
            const next: PathologyAnnotation = {
              ...prev,
              kind: dto.kind ?? prev.kind,
              points: dto.points ?? prev.points,
              label: dto.label ?? prev.label,
              category: dto.category ?? prev.category,
              color: dto.color ?? prev.color,
              confidence: dto.confidence ?? prev.confidence,
              level: dto.level ?? prev.level,
              updatedAt: new Date().toISOString(),
            }
            list[idx] = next
            return next
          }
        }
        throw new NotFoundException(`标注不存在: ${id}`)
      },
    )
  }

  async deleteAnnotation(id: string): Promise<{ deleted: boolean; id: string }> {
    return this.withPrisma(
      async (model) => {
        const existing = await model.findUnique({ where: { id } })
        if (!existing) throw new NotFoundException(`标注不存在: ${id}`)
        await model.delete({ where: { id } })
        return { deleted: true, id }
      },
      async () => {
        for (const [slideId, list] of this.annotations.entries()) {
          const idx = list.findIndex((a) => a.id === id)
          if (idx >= 0) {
            list.splice(idx, 1)
            if (list.length === 0) this.annotations.delete(slideId)
            return { deleted: true, id }
          }
        }
        throw new NotFoundException(`标注不存在: ${id}`)
      },
    )
  }

  /** 仅内存快速查找 (供渲染层读取, 不经过 DB) */
  getAnnotationSync(slideId: string): PathologyAnnotation[] {
    return [...(this.annotations.get(slideId) ?? [])]
  }

  private normalizeAnnotationRow(row: any): PathologyAnnotation {
    const points: number[] = Array.isArray(row.points) ? row.points.map(Number) : []
    return {
      id: row.id,
      slideId: row.slideId,
      kind: (row.kind as AnnotationKind) ?? 'rect',
      points,
      label: row.label ?? '',
      category: row.category ?? 'uncategorized',
      color: row.color ?? '#ff4d4f',
      confidence: row.confidence != null ? Number(row.confidence) : undefined,
      level: Number(row.level ?? 0),
      createdBy: row.createdBy ?? '',
      createdAt: new Date(row.createdAt ?? Date.now()).toISOString(),
      updatedAt: new Date(row.updatedAt ?? Date.now()).toISOString(),
    }
  }
}
