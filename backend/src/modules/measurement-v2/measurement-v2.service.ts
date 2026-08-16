/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 3B (影像测量 V2 + 标注 V2 双向同步)
 *
 * 孤儿模块: 不依赖其他业务模块, 可无 DB 启动 (Prisma 桥接失败 → 内存 seed 回退)。
 *
 * 测量类型 (8 种, 每类型确定性计算 + 单位 + 确定性声明):
 *   - line           直线长度   (mm,   两点距离 × pixelSpacing)
 *   - angle          角度       (°,    三点夹角 atan2)
 *   - ellipseArea    椭圆面积   (mm²,  π·a·b)
 *   - rectangleArea  矩形面积   (mm²,  宽×高)
 *   - polygonArea    多边形面积 (mm²,  鞋带公式)
 *   - polyline       折线长度   (mm,   Σ 线段)
 *   - cobb           Cobb 角    (°,    两条线夹角取锐角)
 *   - calciumScore   钙化评分   (AU,   Agatston 简化: Σ 面积×HU 权重)
 *
 * 标注同步: 标注对象 CRUD + 像素/世界坐标序列化换算 + 与测量关联 + 历史版本。
 * 历史版本: 每次更新快照 version+1, 可回滚到任意历史版本。
 */
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

// ────────────────────────────────────────────────────────────────────────────
// 类型定义
// ────────────────────────────────────────────────────────────────────────────

export type MeasurementV2Type =
  | 'line'
  | 'angle'
  | 'ellipseArea'
  | 'rectangleArea'
  | 'polygonArea'
  | 'polyline'
  | 'cobb'
  | 'calciumScore'

export interface Point2D {
  x: number
  y: number
}

export interface MeasurementTypeMeta {
  type: MeasurementV2Type
  label: string
  unit: string
  /** 最小取点数 (画布交互提示) */
  minPoints: number
  /** 取点数固定时为固定值, 可变 (折线/多边形/钙化) 为 0 */
  fixedPoints: number
  deterministic: boolean
  formula: string
  precision: number
}

export interface ComputeInput {
  type: MeasurementV2Type
  /** 像素坐标 */
  points: Point2D[]
  /** mm/像素, 默认 [1, 1] */
  pixelSpacing?: [number, number]
  /** 钙化评分: 逐像素 HU 值 (与 points 一一对应) */
  huValues?: number[]
  /** 钙化评分: HU 阈值, 默认 130 */
  huThreshold?: number
}

export interface ComputeResult {
  type: MeasurementV2Type
  value: number
  unit: string
  formula: string
  /** 确定性计算: 同输入恒同输出 */
  deterministic: boolean
  precision: number
  /** 参与计算的中间量 (调试/展示) */
  detail?: Record<string, number>
}

export interface MeasurementV2Version {
  version: number
  value: number
  unit: string
  points: Point2D[]
  worldPoints: Point2D[]
  label: string
  color: string
  note: string
  createdAt: string
}

export interface MeasurementV2Record {
  id: string
  studyUid: string
  seriesUid: string
  type: MeasurementV2Type
  /** 像素坐标 */
  points: Point2D[]
  /** 世界坐标 (mm, 由 pixelSpacing 换算) */
  worldPoints: Point2D[]
  value: number
  unit: string
  label: string
  color: string
  visible: boolean
  formula: string
  deterministic: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
  version: number
  versions: MeasurementV2Version[]
  annotationId: string | null
}

export interface AnnotationV2Version {
  version: number
  type: AnnotationV2Type
  pixelPoints: Point2D[]
  worldPoints: Point2D[]
  text: string
  color: string
  fontSize: number
  note: string
  createdAt: string
}

export type AnnotationV2Type = 'text' | 'arrow' | 'rect' | 'ellipse' | 'freehand'

export interface AnnotationV2Record {
  id: string
  studyUid: string
  seriesUid: string
  type: AnnotationV2Type
  /** 像素坐标 */
  pixelPoints: Point2D[]
  /** 世界坐标 (mm) */
  worldPoints: Point2D[]
  text: string
  color: string
  fontSize: number
  visible: boolean
  locked: boolean
  measurementId: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  version: number
  versions: AnnotationV2Version[]
}

export interface CreateMeasurementDto {
  studyUid: string
  seriesUid?: string
  type: MeasurementV2Type
  points: Point2D[]
  pixelSpacing?: [number, number]
  huValues?: number[]
  huThreshold?: number
  label?: string
  color?: string
  visible?: boolean
  createdBy?: string
}

export interface CreateAnnotationDto {
  studyUid: string
  seriesUid?: string
  type: AnnotationV2Type
  pixelPoints: Point2D[]
  pixelSpacing?: [number, number]
  text?: string
  color?: string
  fontSize?: number
  visible?: boolean
  locked?: boolean
  measurementId?: string
  createdBy?: string
}

export interface ConvertCoordinatesInput {
  points: Point2D[]
  pixelSpacing: [number, number]
  direction: 'pixelToWorld' | 'worldToPixel'
}

// ────────────────────────────────────────────────────────────────────────────
// 类型元数据 (单位 + 确定性 + 公式)
// ────────────────────────────────────────────────────────────────────────────

export const MEASUREMENT_TYPE_META: Record<MeasurementV2Type, MeasurementTypeMeta> = {
  line: { type: 'line', label: '直线长度', unit: 'mm', minPoints: 2, fixedPoints: 2, deterministic: true, formula: '√(dx²+dy²)×spacing', precision: 2 },
  angle: { type: 'angle', label: '角度', unit: '°', minPoints: 3, fixedPoints: 3, deterministic: true, formula: 'atan2 三点夹角', precision: 2 },
  ellipseArea: { type: 'ellipseArea', label: '椭圆面积', unit: 'mm²', minPoints: 2, fixedPoints: 2, deterministic: true, formula: 'π·a·b', precision: 2 },
  rectangleArea: { type: 'rectangleArea', label: '矩形面积', unit: 'mm²', minPoints: 2, fixedPoints: 2, deterministic: true, formula: '宽×高', precision: 2 },
  polygonArea: { type: 'polygonArea', label: '多边形面积', unit: 'mm²', minPoints: 3, fixedPoints: 0, deterministic: true, formula: '鞋带公式', precision: 2 },
  polyline: { type: 'polyline', label: '折线长度', unit: 'mm', minPoints: 2, fixedPoints: 0, deterministic: true, formula: 'Σ 线段距离', precision: 2 },
  cobb: { type: 'cobb', label: 'Cobb角', unit: '°', minPoints: 4, fixedPoints: 4, deterministic: true, formula: '两条线夹角 (锐角)', precision: 2 },
  calciumScore: { type: 'calciumScore', label: '钙化评分', unit: 'AU', minPoints: 1, fixedPoints: 0, deterministic: true, formula: 'Agatston 简化: Σ 面积×HU权重', precision: 1 },
}

// ────────────────────────────────────────────────────────────────────────────
// 确定性计算 (纯函数, 无 Math.random)
// ────────────────────────────────────────────────────────────────────────────

const round = (v: number, precision: number) => {
  const factor = 10 ** precision
  return Math.round(v * factor) / factor
}

export function pixelToWorld(points: Point2D[], spacing: [number, number]): Point2D[] {
  return points.map((p) => ({ x: round(p.x * spacing[0], 4), y: round(p.y * spacing[1], 4) }))
}

export function worldToPixel(points: Point2D[], spacing: [number, number]): Point2D[] {
  return points.map((p) => ({ x: round(p.x / spacing[0], 4), y: round(p.y / spacing[1], 4) }))
}

function dist(a: Point2D, b: Point2D): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function lineAngleDeg(a: Point2D, b: Point2D): number {
  return Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI)
}

/** 直线长度: 两点像素距离 × pixelSpacing */
export function computeLineLength(points: Point2D[], spacing: [number, number], precision = 2): number {
  if (points.length < 2) return 0
  return round(dist(points[0]!, points[1]!) * spacing[0], precision)
}

/** 角度: 三点 (端点, 顶点, 端点) atan2 夹角, [0, 180] */
export function computeAngle(points: Point2D[], precision = 2): number {
  if (points.length < 3) return 0
  const [p1, vertex, p2] = points
  const a1 = lineAngleDeg(vertex!, p1!)
  const a2 = lineAngleDeg(vertex!, p2!)
  let deg = Math.abs(a2 - a1)
  if (deg > 180) deg = 360 - deg
  return round(deg, precision)
}

/** 椭圆面积: π·rx·ry (半轴经 pixelSpacing 换算为 mm) */
export function computeEllipseArea(points: Point2D[], spacing: [number, number], precision = 2): number {
  if (points.length < 2) return 0
  const [p1, p2] = points
  const rx = (Math.abs(p2!.x - p1!.x) / 2) * spacing[0]
  const ry = (Math.abs(p2!.y - p1!.y) / 2) * spacing[1]
  return round(Math.PI * rx * ry, precision)
}

/** 矩形面积: 宽×高 (mm²) */
export function computeRectangleArea(points: Point2D[], spacing: [number, number], precision = 2): number {
  if (points.length < 2) return 0
  const [p1, p2] = points
  return round(Math.abs(p2!.x - p1!.x) * spacing[0] * Math.abs(p2!.y - p1!.y) * spacing[1], precision)
}

/** 多边形面积: 鞋带公式 (mm²) */
export function computePolygonArea(points: Point2D[], spacing: [number, number], precision = 2): number {
  if (points.length < 3) return 0
  let sum = 0
  for (let i = 0; i < points.length; i++) {
    const cur = points[i]!
    const nxt = points[(i + 1) % points.length]!
    sum += cur.x * nxt.y - nxt.x * cur.y
  }
  return round((Math.abs(sum) / 2) * spacing[0] * spacing[1], precision)
}

/** 折线长度: Σ 线段距离 (mm) */
export function computePolylineLength(points: Point2D[], spacing: [number, number], precision = 2): number {
  let total = 0
  for (let i = 1; i < points.length; i++) total += dist(points[i - 1]!, points[i]!)
  return round(total * spacing[0], precision)
}

/** Cobb 角: 两条线 (点0-1, 点2-3) 夹角取锐角 */
export function computeCobbAngle(points: Point2D[], precision = 2): number {
  if (points.length < 4) return 0
  const a1 = lineAngleDeg(points[0]!, points[1]!)
  const a2 = lineAngleDeg(points[2]!, points[3]!)
  let diff = Math.abs(a2 - a1) % 180
  if (diff > 90) diff = 180 - diff
  return round(diff, precision)
}

/**
 * 钙化评分 (Agatston 简化):
 *   逐像素 (或逐 ROI 单元) HU > 阈值 (默认 130) 计入;
 *   权重按 HU 分段: [130,200)=1, [200,300)=2, [300,400)=3, ≥400=4;
 *   评分 = Σ (面积 mm² × 权重)。面积 = spacingX × spacingY (单像素)。
 */
export function computeCalciumScore(
  points: Point2D[],
  spacing: [number, number],
  huValues: number[],
  huThreshold = 130,
  precision = 1,
): number {
  if (points.length === 0) return 0
  const voxelArea = spacing[0] * spacing[1]
  let score = 0
  let count = 0
  const n = Math.min(points.length, huValues.length)
  for (let i = 0; i < n; i++) {
    const hu = huValues[i]!
    if (hu < huThreshold) continue
    count += 1
    let weight = 1
    if (hu >= 400) weight = 4
    else if (hu >= 300) weight = 3
    else if (hu >= 200) weight = 2
    score += voxelArea * weight
  }
  return round(score, precision)
}

/** 统一计算入口: 返回 数值 + 单位 + 公式 + 确定性 */
export function computeMeasurement(input: ComputeInput): ComputeResult {
  const spacing: [number, number] = input.pixelSpacing ?? [1, 1]
  const meta = MEASUREMENT_TYPE_META[input.type]
  const huValues = Array.isArray(input.huValues) ? input.huValues : []
  let value = 0
  let detail: Record<string, number> | undefined
  switch (input.type) {
    case 'line':
      value = computeLineLength(input.points, spacing, meta.precision)
      detail = { pixelDistance: dist(input.points[0] ?? { x: 0, y: 0 }, input.points[1] ?? { x: 0, y: 0 }), spacingX: spacing[0] }
      break
    case 'angle':
      value = computeAngle(input.points, meta.precision)
      break
    case 'ellipseArea':
      value = computeEllipseArea(input.points, spacing, meta.precision)
      if (input.points.length >= 2) {
        const [p1, p2] = input.points
        detail = { rxMm: (Math.abs(p2!.x - p1!.x) / 2) * spacing[0], ryMm: (Math.abs(p2!.y - p1!.y) / 2) * spacing[1] }
      }
      break
    case 'rectangleArea':
      value = computeRectangleArea(input.points, spacing, meta.precision)
      break
    case 'polygonArea':
      value = computePolygonArea(input.points, spacing, meta.precision)
      break
    case 'polyline':
      value = computePolylineLength(input.points, spacing, meta.precision)
      break
    case 'cobb':
      value = computeCobbAngle(input.points, meta.precision)
      break
    case 'calciumScore':
      value = computeCalciumScore(input.points, spacing, huValues, input.huThreshold ?? 130, meta.precision)
      detail = { voxelAreaMm2: spacing[0] * spacing[1], threshold: input.huThreshold ?? 130, countedVoxels: huValues.filter((v) => v >= (input.huThreshold ?? 130)).length }
      break
  }
  return {
    type: input.type,
    value,
    unit: meta.unit,
    formula: meta.formula,
    deterministic: true,
    precision: meta.precision,
    detail,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// Seed 数据 (无 DB 时回退; 覆盖阅片器常用 studyUid)
// ────────────────────────────────────────────────────────────────────────────

const SEED_STUDY_UIDS = [
  '1.2.826.0.1.3680043.10.155.3.0.6.11.CT.1',
  '1.2.826.0.1.3680043.10.155.3.0.6.11.CT.2',
  '1.2.826.0.1.3680043.10.155.3.0.6.11.MR.1',
]

interface SeedMeasurement {
  id: string
  studyUid: string
  type: MeasurementV2Type
  points: Point2D[]
  value: number
  unit: string
  label: string
  color: string
  huValues?: number[]
}

const SEED_MEASUREMENTS: SeedMeasurement[] = [
  { id: 'mv2-seed-001', studyUid: SEED_STUDY_UIDS[0]!, type: 'line', points: [{ x: 120, y: 240 }, { x: 180, y: 240 }], value: 20.4, unit: 'mm', label: '右肺中叶结节长径', color: '#22c55e' },
  { id: 'mv2-seed-002', studyUid: SEED_STUDY_UIDS[0]!, type: 'ellipseArea', points: [{ x: 200, y: 180 }, { x: 260, y: 220 }], value: 141.4, unit: 'mm²', label: '左肺上叶磨玻璃影', color: '#3b82f6' },
  { id: 'mv2-seed-003', studyUid: SEED_STUDY_UIDS[0]!, type: 'cobb', points: [{ x: 100, y: 100 }, { x: 140, y: 130 }, { x: 100, y: 260 }, { x: 140, y: 300 }], value: 18.4, unit: '°', label: '胸椎 Cobb 角', color: '#f59e0b' },
  { id: 'mv2-seed-004', studyUid: SEED_STUDY_UIDS[1]!, type: 'rectangleArea', points: [{ x: 300, y: 200 }, { x: 360, y: 260 }], value: 504.0, unit: 'mm²', label: '肝右叶低密度灶', color: '#ef4444' },
  { id: 'mv2-seed-005', studyUid: SEED_STUDY_UIDS[1]!, type: 'calciumScore', points: [{ x: 256, y: 256 }, { x: 300, y: 256 }], value: 18.8, unit: 'AU', label: '前降支钙化', color: '#8b5cf6', huValues: [150, 250] },
  { id: 'mv2-seed-006', studyUid: SEED_STUDY_UIDS[2]!, type: 'angle', points: [{ x: 200, y: 300 }, { x: 200, y: 200 }, { x: 300, y: 200 }], value: 90, unit: '°', label: '膝关节角度', color: '#06b6d4' },
]

interface SeedAnnotation {
  id: string
  studyUid: string
  type: AnnotationV2Type
  pixelPoints: Point2D[]
  text: string
  color: string
  measurementId?: string
}

const SEED_ANNOTATIONS: SeedAnnotation[] = [
  { id: 'av2-seed-001', studyUid: SEED_STUDY_UIDS[0]!, type: 'arrow', pixelPoints: [{ x: 150, y: 240 }, { x: 150, y: 190 }], text: '右肺中叶结节', color: '#ff4d4f' },
  { id: 'av2-seed-002', studyUid: SEED_STUDY_UIDS[0]!, type: 'text', pixelPoints: [{ x: 230, y: 200 }], text: 'GGN 8mm', color: '#faad14' },
  { id: 'av2-seed-003', studyUid: SEED_STUDY_UIDS[1]!, type: 'ellipse', pixelPoints: [{ x: 300, y: 200 }, { x: 360, y: 260 }], text: '肝右叶低密度灶', color: '#ef4444', measurementId: 'mv2-seed-004' },
  { id: 'av2-seed-004', studyUid: SEED_STUDY_UIDS[1]!, type: 'rect', pixelPoints: [{ x: 40, y: 40 }, { x: 120, y: 120 }], text: '钙化区域', color: '#8b5cf6' },
]

// ────────────────────────────────────────────────────────────────────────────
// 服务
// ────────────────────────────────────────────────────────────────────────────

@Injectable()
export class MeasurementV2Service {
  private readonly logger = new Logger(MeasurementV2Service.name)
  private measurements = new Map<string, MeasurementV2Record>()
  private annotations = new Map<string, AnnotationV2Record>()
  private seq = 1

  constructor(private readonly prisma: PrismaService) {
    this.initSeeds()
  }

  // ── seed 初始化 (孤儿模块回退) ──

  private initSeeds(): void {
    const now = new Date().toISOString()
    for (const s of SEED_MEASUREMENTS) {
      const meta = MEASUREMENT_TYPE_META[s.type]
      const world = pixelToWorld(s.points, [0.68, 0.68])
      this.measurements.set(s.id, {
        id: s.id,
        studyUid: s.studyUid,
        seriesUid: '',
        type: s.type,
        points: [...s.points],
        worldPoints: world,
        value: s.value,
        unit: s.unit,
        label: s.label,
        color: s.color,
        visible: true,
        formula: meta.formula,
        deterministic: true,
        createdBy: 'seed',
        createdAt: now,
        updatedAt: now,
        version: 1,
        versions: [{
          version: 1,
          value: s.value,
          unit: s.unit,
          points: [...s.points],
          worldPoints: world,
          label: s.label,
          color: s.color,
          note: '初始 (seed)',
          createdAt: now,
        }],
        annotationId: null,
      })
    }
    for (const a of SEED_ANNOTATIONS) {
      this.annotations.set(a.id, {
        id: a.id,
        studyUid: a.studyUid,
        seriesUid: '',
        type: a.type,
        pixelPoints: [...a.pixelPoints],
        worldPoints: pixelToWorld(a.pixelPoints, [0.68, 0.68]),
        text: a.text,
        color: a.color,
        fontSize: 16,
        visible: true,
        locked: false,
        measurementId: a.measurementId ?? null,
        createdBy: 'seed',
        createdAt: now,
        updatedAt: now,
        version: 1,
        versions: [{
          version: 1,
          type: a.type,
          pixelPoints: [...a.pixelPoints],
          worldPoints: pixelToWorld(a.pixelPoints, [0.68, 0.68]),
          text: a.text,
          color: a.color,
          fontSize: 16,
          note: '初始 (seed)',
          createdAt: now,
        }],
      })
    }
    this.logger.log(`measurement-v2 seed ready: ${this.measurements.size} measurements, ${this.annotations.size} annotations`)
  }

  // ── Prisma 桥接 (可选, 模型缺失自动回退内存) ──

  private modelAvailable(name: string): boolean {
    const model = (this.prisma as any)[name]
    return Boolean(model?.findMany && model?.create && model?.update && model?.delete)
  }

  private async withPrisma<T>(name: string, fn: (model: any) => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    if (this.modelAvailable(name)) {
      try {
        return await fn((this.prisma as any)[name])
      } catch (e) {
        this.logger.debug(`${name} prisma failed, fallback to memory: ${(e as Error).message}`)
      }
    }
    return fallback()
  }

  // ── 计算 ──

  compute(input: ComputeInput): ComputeResult {
    return computeMeasurement(input)
  }

  // ── 类型元数据 ──

  listTypes(): MeasurementTypeMeta[] {
    return Object.values(MEASUREMENT_TYPE_META)
  }

  seedStudyUids(): string[] {
    return [...SEED_STUDY_UIDS]
  }

  // ── 坐标序列化换算 ──

  convertCoordinates(input: ConvertCoordinatesInput): { points: Point2D[]; pixelSpacing: [number, number]; direction: string } {
    const spacing: [number, number] = [input.pixelSpacing[0], input.pixelSpacing[1]]
    const points =
      input.direction === 'pixelToWorld'
        ? pixelToWorld(input.points, spacing)
        : worldToPixel(input.points, spacing)
    return { points, pixelSpacing: spacing, direction: input.direction }
  }

  // ── 测量 CRUD ──

  async listMeasurements(studyUid: string): Promise<MeasurementV2Record[]> {
    return this.withPrisma(
      'measurementV2',
      async (model) => {
        const rows = await model.findMany({ where: { studyUid }, orderBy: { createdAt: 'asc' } })
        return rows.map((r: any) => this.normalizeMeasurementRow(r))
      },
      async () => Array.from(this.measurements.values()).filter((m) => m.studyUid === studyUid),
    )
  }

  async createMeasurement(dto: CreateMeasurementDto): Promise<MeasurementV2Record> {
    const studyUid = String(dto.studyUid ?? '').trim()
    if (!studyUid) throw new BadRequestException('studyUid 必填')
    if (!dto.points || dto.points.length === 0) throw new BadRequestException('points 至少 1 个点')
    const spacing: [number, number] = dto.pixelSpacing ?? [0.68, 0.68]
    const result = computeMeasurement({
      type: dto.type,
      points: dto.points,
      pixelSpacing: spacing,
      huValues: dto.huValues,
      huThreshold: dto.huThreshold,
    })
    const now = new Date().toISOString()
    const world = pixelToWorld(dto.points, spacing)
    const label = (dto.label && String(dto.label).trim()) || `${MEASUREMENT_TYPE_META[dto.type].label} ${result.value} ${result.unit}`
    const record: MeasurementV2Record = {
      id: `mv2-${Date.now().toString(36)}-${this.seq++}`,
      studyUid,
      seriesUid: String(dto.seriesUid ?? '').trim(),
      type: dto.type,
      points: dto.points.map((p) => ({ ...p })),
      worldPoints: world,
      value: result.value,
      unit: result.unit,
      label,
      color: dto.color ?? '#22c55e',
      visible: dto.visible ?? true,
      formula: result.formula,
      deterministic: true,
      createdBy: dto.createdBy ?? 'viewer-user',
      createdAt: now,
      updatedAt: now,
      version: 1,
      versions: [{
        version: 1,
        value: result.value,
        unit: result.unit,
        points: dto.points.map((p) => ({ ...p })),
        worldPoints: world,
        label,
        color: dto.color ?? '#22c55e',
        note: '创建',
        createdAt: now,
      }],
      annotationId: null,
    }
    return this.withPrisma(
      'measurementV2',
      async (model) => {
        const row = await model.create({
          data: {
            id: record.id,
            studyUid: record.studyUid,
            seriesUid: record.seriesUid,
            type: record.type,
            points: record.points,
            worldPoints: record.worldPoints,
            value: record.value,
            unit: record.unit,
            label: record.label,
            color: record.color,
            visible: record.visible,
            formula: record.formula,
            deterministic: record.deterministic,
            createdBy: record.createdBy,
            version: 1,
          },
        })
        return this.normalizeMeasurementRow(row)
      },
      async () => {
        this.measurements.set(record.id, record)
        return this.cloneMeasurement(record)
      },
    )
  }

  async updateMeasurement(id: string, patch: Partial<CreateMeasurementDto> & { label?: string; color?: string; visible?: boolean }): Promise<MeasurementV2Record> {
    return this.withPrisma(
      'measurementV2',
      async (model) => {
        const existing = await model.findUnique({ where: { id } })
        if (!existing) throw new NotFoundException(`测量不存在: ${id}`)
        const data: Record<string, unknown> = {}
        if (patch.points !== undefined) data.points = patch.points
        if (patch.label !== undefined) data.label = patch.label
        if (patch.color !== undefined) data.color = patch.color
        if (patch.visible !== undefined) data.visible = patch.visible
        const row = await model.update({ where: { id }, data })
        return this.normalizeMeasurementRow(row)
      },
      async () => {
        const hit = this.measurements.get(id)
        if (!hit) throw new NotFoundException(`测量不存在: ${id}`)
        const prev = this.cloneMeasurement(hit)
        const spacing: [number, number] = [0.68, 0.68]
        if (patch.points !== undefined && Array.isArray(patch.points) && patch.points.length > 0) {
          const result = computeMeasurement({ type: hit.type, points: patch.points, pixelSpacing: spacing, huValues: patch.huValues })
          hit.points = patch.points.map((p) => ({ ...p }))
          hit.worldPoints = pixelToWorld(patch.points, spacing)
          hit.value = result.value
          hit.unit = result.unit
        }
        if (patch.label !== undefined) hit.label = String(patch.label).trim() || hit.label
        if (patch.color !== undefined) hit.color = patch.color
        if (patch.visible !== undefined) hit.visible = patch.visible
        const now = new Date().toISOString()
        hit.updatedAt = now
        hit.version += 1
        hit.versions.push({
          version: hit.version,
          value: hit.value,
          unit: hit.unit,
          points: hit.points.map((p) => ({ ...p })),
          worldPoints: hit.worldPoints.map((p) => ({ ...p })),
          label: hit.label,
          color: hit.color,
          note: `更新 (v${hit.version})`,
          createdAt: now,
        })
        return this.cloneMeasurement(hit)
      },
    )
  }

  async removeMeasurement(id: string): Promise<{ deleted: boolean; id: string }> {
    return this.withPrisma(
      'measurementV2',
      async (model) => {
        const existing = await model.findUnique({ where: { id } })
        if (!existing) throw new NotFoundException(`测量不存在: ${id}`)
        await model.delete({ where: { id } })
        return { deleted: true, id }
      },
      async () => {
        if (!this.measurements.delete(id)) throw new NotFoundException(`测量不存在: ${id}`)
        return { deleted: true, id }
      },
    )
  }

  async getMeasurementVersions(id: string): Promise<MeasurementV2Version[]> {
    const hit = this.measurements.get(id)
    if (!hit) throw new NotFoundException(`测量不存在: ${id}`)
    return hit.versions.map((v) => ({ ...v, points: v.points.map((p) => ({ ...p })) }))
  }

  async rollbackMeasurement(id: string, version: number): Promise<MeasurementV2Record> {
    const hit = this.measurements.get(id)
    if (!hit) throw new NotFoundException(`测量不存在: ${id}`)
    const target = hit.versions.find((v) => v.version === version)
    if (!target) throw new NotFoundException(`版本不存在: ${id}@v${version}`)
    const now = new Date().toISOString()
    hit.points = target.points.map((p) => ({ ...p }))
    hit.worldPoints = target.worldPoints.map((p) => ({ ...p }))
    hit.value = target.value
    hit.unit = target.unit
    hit.label = target.label
    hit.color = target.color
    hit.updatedAt = now
    hit.version += 1
    hit.versions.push({
      version: hit.version,
      value: hit.value,
      unit: hit.unit,
      points: hit.points.map((p) => ({ ...p })),
      worldPoints: hit.worldPoints.map((p) => ({ ...p })),
      label: hit.label,
      color: hit.color,
      note: `回滚到 v${version}`,
      createdAt: now,
    })
    return this.cloneMeasurement(hit)
  }

  // ── 标注 CRUD ──

  async listAnnotations(studyUid: string): Promise<AnnotationV2Record[]> {
    return this.withPrisma(
      'annotationV2',
      async (model) => {
        const rows = await model.findMany({ where: { studyUid }, orderBy: { createdAt: 'asc' } })
        return rows.map((r: any) => this.normalizeAnnotationRow(r))
      },
      async () => Array.from(this.annotations.values()).filter((a) => a.studyUid === studyUid),
    )
  }

  async createAnnotation(dto: CreateAnnotationDto): Promise<AnnotationV2Record> {
    const studyUid = String(dto.studyUid ?? '').trim()
    if (!studyUid) throw new BadRequestException('studyUid 必填')
    if (!dto.pixelPoints || dto.pixelPoints.length === 0) throw new BadRequestException('pixelPoints 至少 1 个点')
    const spacing: [number, number] = dto.pixelSpacing ?? [0.68, 0.68]
    const now = new Date().toISOString()
    const record: AnnotationV2Record = {
      id: `av2-${Date.now().toString(36)}-${this.seq++}`,
      studyUid,
      seriesUid: String(dto.seriesUid ?? '').trim(),
      type: dto.type,
      pixelPoints: dto.pixelPoints.map((p) => ({ ...p })),
      worldPoints: pixelToWorld(dto.pixelPoints, spacing),
      text: String(dto.text ?? '').trim(),
      color: dto.color ?? '#ff4d4f',
      fontSize: dto.fontSize ?? 16,
      visible: dto.visible ?? true,
      locked: dto.locked ?? false,
      measurementId: dto.measurementId ?? null,
      createdBy: dto.createdBy ?? 'viewer-user',
      createdAt: now,
      updatedAt: now,
      version: 1,
      versions: [{
        version: 1,
        type: dto.type,
        pixelPoints: dto.pixelPoints.map((p) => ({ ...p })),
        worldPoints: pixelToWorld(dto.pixelPoints, spacing),
        text: String(dto.text ?? '').trim(),
        color: dto.color ?? '#ff4d4f',
        fontSize: dto.fontSize ?? 16,
        note: '创建',
        createdAt: now,
      }],
    }
    return this.withPrisma(
      'annotationV2',
      async (model) => {
        const row = await model.create({
          data: {
            id: record.id,
            studyUid: record.studyUid,
            seriesUid: record.seriesUid,
            type: record.type,
            pixelPoints: record.pixelPoints,
            worldPoints: record.worldPoints,
            text: record.text,
            color: record.color,
            fontSize: record.fontSize,
            visible: record.visible,
            locked: record.locked,
            measurementId: record.measurementId,
            createdBy: record.createdBy,
            version: 1,
          },
        })
        return this.normalizeAnnotationRow(row)
      },
      async () => {
        this.annotations.set(record.id, record)
        return this.cloneAnnotation(record)
      },
    )
  }

  async updateAnnotation(id: string, patch: Partial<CreateAnnotationDto> & { text?: string; color?: string; fontSize?: number; visible?: boolean; locked?: boolean }): Promise<AnnotationV2Record> {
    return this.withPrisma(
      'annotationV2',
      async (model) => {
        const existing = await model.findUnique({ where: { id } })
        if (!existing) throw new NotFoundException(`标注不存在: ${id}`)
        const data: Record<string, unknown> = {}
        if (patch.pixelPoints !== undefined) data.pixelPoints = patch.pixelPoints
        if (patch.text !== undefined) data.text = patch.text
        if (patch.color !== undefined) data.color = patch.color
        if (patch.fontSize !== undefined) data.fontSize = patch.fontSize
        if (patch.visible !== undefined) data.visible = patch.visible
        if (patch.locked !== undefined) data.locked = patch.locked
        if (patch.measurementId !== undefined) data.measurementId = patch.measurementId
        const row = await model.update({ where: { id }, data })
        return this.normalizeAnnotationRow(row)
      },
      async () => {
        const hit = this.annotations.get(id)
        if (!hit) throw new NotFoundException(`标注不存在: ${id}`)
        const spacing: [number, number] = [0.68, 0.68]
        if (patch.pixelPoints !== undefined && Array.isArray(patch.pixelPoints) && patch.pixelPoints.length > 0) {
          hit.pixelPoints = patch.pixelPoints.map((p) => ({ ...p }))
          hit.worldPoints = pixelToWorld(patch.pixelPoints, spacing)
        }
        if (patch.text !== undefined) hit.text = String(patch.text).trim()
        if (patch.color !== undefined) hit.color = patch.color
        if (patch.fontSize !== undefined) hit.fontSize = patch.fontSize
        if (patch.visible !== undefined) hit.visible = patch.visible
        if (patch.locked !== undefined) hit.locked = patch.locked
        if (patch.measurementId !== undefined) hit.measurementId = patch.measurementId
        const now = new Date().toISOString()
        hit.updatedAt = now
        hit.version += 1
        hit.versions.push({
          version: hit.version,
          type: hit.type,
          pixelPoints: hit.pixelPoints.map((p) => ({ ...p })),
          worldPoints: hit.worldPoints.map((p) => ({ ...p })),
          text: hit.text,
          color: hit.color,
          fontSize: hit.fontSize,
          note: `更新 (v${hit.version})`,
          createdAt: now,
        })
        return this.cloneAnnotation(hit)
      },
    )
  }

  async removeAnnotation(id: string): Promise<{ deleted: boolean; id: string }> {
    return this.withPrisma(
      'annotationV2',
      async (model) => {
        const existing = await model.findUnique({ where: { id } })
        if (!existing) throw new NotFoundException(`标注不存在: ${id}`)
        await model.delete({ where: { id } })
        return { deleted: true, id }
      },
      async () => {
        if (!this.annotations.delete(id)) throw new NotFoundException(`标注不存在: ${id}`)
        return { deleted: true, id }
      },
    )
  }

  async getAnnotationVersions(id: string): Promise<AnnotationV2Version[]> {
    const hit = this.annotations.get(id)
    if (!hit) throw new NotFoundException(`标注不存在: ${id}`)
    return hit.versions.map((v) => ({ ...v, pixelPoints: v.pixelPoints.map((p) => ({ ...p })) }))
  }

  async rollbackAnnotation(id: string, version: number): Promise<AnnotationV2Record> {
    const hit = this.annotations.get(id)
    if (!hit) throw new NotFoundException(`标注不存在: ${id}`)
    const target = hit.versions.find((v) => v.version === version)
    if (!target) throw new NotFoundException(`版本不存在: ${id}@v${version}`)
    const now = new Date().toISOString()
    hit.type = target.type
    hit.pixelPoints = target.pixelPoints.map((p) => ({ ...p }))
    hit.worldPoints = target.worldPoints.map((p) => ({ ...p }))
    hit.text = target.text
    hit.color = target.color
    hit.fontSize = target.fontSize
    hit.updatedAt = now
    hit.version += 1
    hit.versions.push({
      version: hit.version,
      type: hit.type,
      pixelPoints: hit.pixelPoints.map((p) => ({ ...p })),
      worldPoints: hit.worldPoints.map((p) => ({ ...p })),
      text: hit.text,
      color: hit.color,
      fontSize: hit.fontSize,
      note: `回滚到 v${version}`,
      createdAt: now,
    })
    return this.cloneAnnotation(hit)
  }

  // ── 标注 ↔ 测量 关联 ──

  async linkAnnotation(measurementId: string, annotationId: string): Promise<{ measurement: MeasurementV2Record; annotation: AnnotationV2Record }> {
    const measurement = this.measurements.get(measurementId)
    if (!measurement) throw new NotFoundException(`测量不存在: ${measurementId}`)
    const annotation = this.annotations.get(annotationId)
    if (!annotation) throw new NotFoundException(`标注不存在: ${annotationId}`)
    if (measurement.studyUid !== annotation.studyUid) {
      throw new BadRequestException('测量与标注必须属于同一 study')
    }
    annotation.measurementId = measurementId
    measurement.annotationId = annotationId
    annotation.updatedAt = new Date().toISOString()
    measurement.updatedAt = annotation.updatedAt
    return { measurement: this.cloneMeasurement(measurement), annotation: this.cloneAnnotation(annotation) }
  }

  // ── 内部工具 ──

  private cloneMeasurement(m: MeasurementV2Record): MeasurementV2Record {
    return {
      ...m,
      points: m.points.map((p) => ({ ...p })),
      worldPoints: m.worldPoints.map((p) => ({ ...p })),
      versions: m.versions.map((v) => ({ ...v, points: v.points.map((p) => ({ ...p })), worldPoints: v.worldPoints.map((p) => ({ ...p })) })),
    }
  }

  private cloneAnnotation(a: AnnotationV2Record): AnnotationV2Record {
    return {
      ...a,
      pixelPoints: a.pixelPoints.map((p) => ({ ...p })),
      worldPoints: a.worldPoints.map((p) => ({ ...p })),
      versions: a.versions.map((v) => ({ ...v, pixelPoints: v.pixelPoints.map((p) => ({ ...p })), worldPoints: v.worldPoints.map((p) => ({ ...p })) })),
    }
  }

  private normalizeMeasurementRow(row: any): MeasurementV2Record {
    const points: Point2D[] = Array.isArray(row.points) ? row.points.map((p: any) => ({ x: Number(p.x ?? 0), y: Number(p.y ?? 0) })) : []
    const worldPoints: Point2D[] = Array.isArray(row.worldPoints) ? row.worldPoints.map((p: any) => ({ x: Number(p.x ?? 0), y: Number(p.y ?? 0) })) : []
    return {
      id: row.id,
      studyUid: row.studyUid,
      seriesUid: row.seriesUid ?? '',
      type: (row.type as MeasurementV2Type) ?? 'line',
      points,
      worldPoints,
      value: Number(row.value ?? 0),
      unit: row.unit ?? 'mm',
      label: row.label ?? '',
      color: row.color ?? '#22c55e',
      visible: row.visible !== false,
      formula: row.formula ?? '',
      deterministic: row.deterministic !== false,
      createdBy: row.createdBy ?? '',
      createdAt: new Date(row.createdAt ?? Date.now()).toISOString(),
      updatedAt: new Date(row.updatedAt ?? Date.now()).toISOString(),
      version: Number(row.version ?? 1),
      versions: [],
      annotationId: row.annotationId ?? null,
    }
  }

  private normalizeAnnotationRow(row: any): AnnotationV2Record {
    const pixelPoints: Point2D[] = Array.isArray(row.pixelPoints) ? row.pixelPoints.map((p: any) => ({ x: Number(p.x ?? 0), y: Number(p.y ?? 0) })) : []
    const worldPoints: Point2D[] = Array.isArray(row.worldPoints) ? row.worldPoints.map((p: any) => ({ x: Number(p.x ?? 0), y: Number(p.y ?? 0) })) : []
    return {
      id: row.id,
      studyUid: row.studyUid,
      seriesUid: row.seriesUid ?? '',
      type: (row.type as AnnotationV2Type) ?? 'text',
      pixelPoints,
      worldPoints,
      text: row.text ?? '',
      color: row.color ?? '#ff4d4f',
      fontSize: Number(row.fontSize ?? 16),
      visible: row.visible !== false,
      locked: row.locked === true,
      measurementId: row.measurementId ?? null,
      createdBy: row.createdBy ?? '',
      createdAt: new Date(row.createdAt ?? Date.now()).toISOString(),
      updatedAt: new Date(row.updatedAt ?? Date.now()).toISOString(),
      version: Number(row.version ?? 1),
      versions: [],
    }
  }
}
