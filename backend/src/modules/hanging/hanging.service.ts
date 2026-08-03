import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface HangingLayout {
  rows: number
  cols: number
  seriesOrder: string[]
}

export interface HangingProtocolEntity {
  id: string
  name: string
  modality: string
  bodyPart: string
  layout: HangingLayout
  priority: number
  description: string
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}

export interface CreateHangingProtocolDto {
  name: string
  modality: string
  bodyPart: string
  layout: HangingLayout
  priority?: number
  description?: string
  enabled?: boolean
}

export interface MatchSeriesInput {
  description?: string
  modality?: string
  seriesNumber?: number
  images?: number
}

export interface MatchHangingInput {
  modality: string
  bodyPart?: string
  seriesCount?: number
  series?: MatchSeriesInput[]
}

export interface HangingMatchResult {
  protocol: HangingProtocolEntity | null
  layout: HangingLayout
  score: number
  reasons: string[]
  cells: { index: number; series?: string; empty: boolean }[]
  candidates: { id: string; name: string; score: number }[]
}

interface SeedProtocol {
  name: string
  modality: string
  bodyPart: string
  layout: HangingLayout
  priority: number
  description: string
}

const DEFAULT_SEEDS: SeedProtocol[] = [
  { name: 'CT 头颅 轴位标准', modality: 'CT', bodyPart: 'HEAD', layout: { rows: 1, cols: 1, seriesOrder: ['轴位'] }, priority: 100, description: 'CT 头颅常规: 单视野轴位' },
  { name: 'CT 胸部 肺窗+纵隔窗', modality: 'CT', bodyPart: 'CHEST', layout: { rows: 2, cols: 2, seriesOrder: ['轴位-肺窗', '轴位-纵隔窗', '冠状位', '矢状位'] }, priority: 100, description: 'CT 胸部常规: 肺窗/纵隔窗双窗 2×2' },
  { name: 'MR 头颅 多序列', modality: 'MR', bodyPart: 'HEAD', layout: { rows: 2, cols: 3, seriesOrder: ['T1', 'T2', 'FLAIR', 'DWI', 'T1增强', 'SWI'] }, priority: 100, description: 'MR 头颅: T1/T2/FLAIR/DWI 六序列 2×3' },
  { name: 'DR 胸部 正侧位', modality: 'DR', bodyPart: 'CHEST', layout: { rows: 1, cols: 2, seriesOrder: ['正位', '侧位'] }, priority: 95, description: 'DR 胸部: 正位+侧位 1×2' },
  { name: 'CT 腹部 平扫+增强', modality: 'CT', bodyPart: 'ABDOMEN', layout: { rows: 2, cols: 2, seriesOrder: ['平扫', '动脉期', '门脉期', '延迟期'] }, priority: 90, description: 'CT 腹部: 四期对比 2×2' },
  { name: 'MR 脊柱 矢冠轴', modality: 'MR', bodyPart: 'SPINE', layout: { rows: 1, cols: 3, seriesOrder: ['矢状位', '冠状位', '轴位'] }, priority: 90, description: 'MR 脊柱: 矢状+冠状+轴位 1×3' },
  { name: 'CT 颈椎 骨窗+软窗', modality: 'CT', bodyPart: 'NECK', layout: { rows: 1, cols: 2, seriesOrder: ['骨窗', '软组织窗'] }, priority: 85, description: 'CT 颈椎: 双窗对比 1×2' },
  { name: 'MR 膝关节 多序列', modality: 'MR', bodyPart: 'KNEE', layout: { rows: 2, cols: 2, seriesOrder: ['矢状位 PD', '矢状位 T1', '冠状位 PD', '轴位 PD'] }, priority: 80, description: 'MR 膝关节: 矢冠轴四序列 2×2' },
]

function normalizeLayout(layout: unknown): HangingLayout {
  const raw = (layout ?? {}) as Record<string, unknown>
  const rows = Number(raw['rows'])
  const cols = Number(raw['cols'])
  const seriesOrder = Array.isArray(raw['seriesOrder'])
    ? (raw['seriesOrder'] as unknown[]).map(String)
    : []
  return {
    rows: Number.isInteger(rows) && rows >= 1 ? rows : 1,
    cols: Number.isInteger(cols) && cols >= 1 ? cols : 1,
    seriesOrder,
  }
}

function toEntity(row: {
  id: string
  name: string
  modality: string
  bodyPart: string
  layout: unknown
  priority: number
  description: string
  enabled: boolean
  createdAt: Date
  updatedAt: Date
}): HangingProtocolEntity {
  return {
    id: row.id,
    name: row.name,
    modality: row.modality,
    bodyPart: row.bodyPart,
    layout: normalizeLayout(row.layout),
    priority: row.priority,
    description: row.description,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

@Injectable()
export class HangingService {
  private memStore = new Map<string, HangingProtocolEntity>()

  constructor(private readonly prisma: PrismaService) {
    this.seedMemory()
  }

  private seedMemory(): void {
    for (const s of DEFAULT_SEEDS) {
      this.memStore.set(this.seedId(s), {
        id: this.seedId(s),
        name: s.name,
        modality: s.modality,
        bodyPart: s.bodyPart,
        layout: { ...s.layout },
        priority: s.priority,
        description: s.description,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    }
  }

  private seedId(s: SeedProtocol): string {
    return `seed-${s.modality.toLowerCase()}-${s.bodyPart.toLowerCase()}`
  }

  private async ensureSeeded(): Promise<void> {
    try {
      const count = await this.prisma.hangingProtocol.count()
      if (count > 0) return
      for (const s of DEFAULT_SEEDS) {
        const existing = await this.prisma.hangingProtocol.findFirst({
          where: { name: s.name },
        })
        if (existing) continue
        await this.prisma.hangingProtocol.create({
          data: {
            name: s.name,
            modality: s.modality,
            bodyPart: s.bodyPart,
            layout: s.layout as object,
            priority: s.priority,
            description: s.description,
            enabled: true,
            tenantId: 'default',
          },
        })
      }
    } catch {
      // DB 不可用时回退到内存 store (jest/离线环境)
    }
  }

  async list(modality?: string, bodyPart?: string): Promise<HangingProtocolEntity[]> {
    await this.ensureSeeded()
    try {
      const rows = await this.prisma.hangingProtocol.findMany({
        where: {
          ...(modality ? { modality } : {}),
          ...(bodyPart ? { bodyPart } : {}),
        },
        orderBy: [{ priority: 'desc' }, { name: 'asc' }],
      })
      return rows.map(toEntity)
    } catch {
      let items = Array.from(this.memStore.values())
      if (modality) items = items.filter((i) => i.modality === modality)
      if (bodyPart) items = items.filter((i) => i.bodyPart === bodyPart)
      return items.sort((a, b) => b.priority - a.priority || a.name.localeCompare(b.name))
    }
  }

  async getById(id: string): Promise<HangingProtocolEntity | null> {
    await this.ensureSeeded()
    try {
      const row = await this.prisma.hangingProtocol.findUnique({ where: { id } })
      return row ? toEntity(row) : null
    } catch {
      return this.memStore.get(id) ?? null
    }
  }

  async create(dto: CreateHangingProtocolDto): Promise<HangingProtocolEntity> {
    const layout = normalizeLayout(dto.layout)
    try {
      const row = await this.prisma.hangingProtocol.create({
        data: {
          name: dto.name,
          modality: dto.modality,
          bodyPart: dto.bodyPart,
          layout: layout as object,
          priority: dto.priority ?? 0,
          description: dto.description ?? '',
          enabled: dto.enabled ?? true,
          tenantId: 'default',
        },
      })
      return toEntity(row)
    } catch {
      const entity: HangingProtocolEntity = {
        id: `mem-${Date.now()}`,
        name: dto.name,
        modality: dto.modality,
        bodyPart: dto.bodyPart,
        layout,
        priority: dto.priority ?? 0,
        description: dto.description ?? '',
        enabled: dto.enabled ?? true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      this.memStore.set(entity.id, entity)
      return entity
    }
  }

  async update(id: string, dto: Partial<CreateHangingProtocolDto>): Promise<HangingProtocolEntity> {
    const layout = dto.layout ? normalizeLayout(dto.layout) : undefined
    try {
      const existing = await this.prisma.hangingProtocol.findUnique({ where: { id } })
      if (!existing) throw new NotFoundException(`Hanging protocol ${id} not found`)
      const row = await this.prisma.hangingProtocol.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.modality !== undefined ? { modality: dto.modality } : {}),
          ...(dto.bodyPart !== undefined ? { bodyPart: dto.bodyPart } : {}),
          ...(layout !== undefined ? { layout: layout as object } : {}),
          ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
        },
      })
      return toEntity(row)
    } catch (err) {
      if (err instanceof NotFoundException) throw err
      const existing = this.memStore.get(id)
      if (!existing) throw new NotFoundException(`Hanging protocol ${id} not found`)
      const next: HangingProtocolEntity = {
        ...existing,
        name: dto.name ?? existing.name,
        modality: dto.modality ?? existing.modality,
        bodyPart: dto.bodyPart ?? existing.bodyPart,
        layout: layout ?? existing.layout,
        priority: dto.priority ?? existing.priority,
        description: dto.description ?? existing.description,
        enabled: dto.enabled ?? existing.enabled,
        updatedAt: new Date(),
      }
      this.memStore.set(id, next)
      return next
    }
  }

  async remove(id: string): Promise<void> {
    try {
      await this.prisma.hangingProtocol.delete({ where: { id } })
    } catch {
      if (!this.memStore.delete(id)) {
        throw new NotFoundException(`Hanging protocol ${id} not found`)
      }
    }
  }

  match(input: MatchHangingInput): HangingMatchResult {
    const all = Array.from(this.memStore.values()).filter((p) => p.enabled)
    const modality = (input.modality ?? '').toUpperCase()
    const bodyPart = (input.bodyPart ?? '').toUpperCase()
    const series = Array.isArray(input.series) ? input.series : []
    const seriesCount = Math.max(
      input.seriesCount ?? series.length,
      series.length,
    )

    const scored = all
      .map((p) => {
        const capacity = p.layout.rows * p.layout.cols
        let score = 0
        const reasons: string[] = []
        if (p.modality.toUpperCase() === modality && p.bodyPart.toUpperCase() === bodyPart) {
          score += 100
          reasons.push(`模态+部位完全匹配 (${p.modality}/${p.bodyPart})`)
        } else if (p.modality.toUpperCase() === modality) {
          score += 50
          reasons.push(`模态匹配 (${p.modality})`)
        } else if (p.bodyPart.toUpperCase() === bodyPart) {
          score += 40
          reasons.push(`部位匹配 (${p.bodyPart})`)
        } else {
          score += 5
          reasons.push('通用兜底协议')
        }
        if (seriesCount === 0 || seriesCount <= capacity) {
          score += 20
          reasons.push(`序列数 ${seriesCount} 适配 ${capacity} 格布局`)
        } else {
          score -= 10
          reasons.push(`序列数 ${seriesCount} 超出布局 ${capacity} 格, 需翻页`)
        }
        score += p.priority
        return { protocol: p, score, reasons }
      })
      .sort((a, b) => b.score - a.score)

    const best = scored[0]
    if (!best) {
      return {
        protocol: null,
        layout: { rows: 1, cols: 1, seriesOrder: [] },
        score: 0,
        reasons: ['无可用协议'],
        cells: [],
        candidates: [],
      }
    }

    const capacity = best.protocol.layout.rows * best.protocol.layout.cols
    const names = series.slice(0, capacity).map((s) => s.description ?? s.modality ?? `序列${s.seriesNumber ?? ''}`)
    const order = best.protocol.layout.seriesOrder.length > 0
      ? best.protocol.layout.seriesOrder
      : names
    const cells = Array.from({ length: capacity }, (_, index) => ({
      index,
      series: order[index] ?? names[index],
      empty: !order[index] && !names[index],
    }))

    return {
      protocol: best.protocol,
      layout: best.protocol.layout,
      score: best.score,
      reasons: best.reasons,
      cells,
      candidates: scored.slice(0, 3).map((c) => ({ id: c.protocol.id, name: c.protocol.name, score: c.score })),
    }
  }
}
