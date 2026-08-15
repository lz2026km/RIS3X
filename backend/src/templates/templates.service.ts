import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { getCurrentTenantId } from '../common/interceptors/tenant-context.interceptor'

export interface CreateTemplateDto {
  name: string
  category: string
  // [v3.0.6.11-98 Wave2A P1] 模态 (CT/MR/DR/...), 用于模板库自动匹配推荐
  modality?: string
  bodyPart: string
  // [v3.0.6.11-100 Wave2C P2] 模板类型: FULL=全文模板 / SECTION=段落模板 / PHRASE=短语模板 (默认 SECTION)
  templateType?: 'FULL' | 'SECTION' | 'PHRASE'
  body: string
  // [v3.0.6.11-99 Wave2B P1] 结构化段落块数组 (模板设计器可视化保存), 兼容纯文本 body
  structure?: TemplateStructureBlock[]
  parentId?: string
  radsCategory?: string
  tags?: string[]
  createdById: string
}

// [v3.0.6.11-99 Wave2B (模板设计器 P1)] 结构化段落块
// type: text=普通文本段落 / field=结构化字段占位 {{field:KEY}} / variable=变量占位 {{key}} / structured=RADS 等结构段标记
export interface TemplateStructureBlock {
  type: 'text' | 'field' | 'variable' | 'structured'
  content: string
  fieldKey?: string
  variable?: string
}

export type TemplateStructure = TemplateStructureBlock[]

// [v3.0.6.11-98 Wave2A P1] 模板审批状态
export type TemplateApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected'

// [v3.0.6.11-100 Wave2C P2] 模板类型: FULL=全文模板 / SECTION=段落模板 / PHRASE=短语模板
export type TemplateType = 'FULL' | 'SECTION' | 'PHRASE'

// [v3.0.6.11-100 Wave2C P2] 内存兼容: 归一化模板类型 (旧数据无字段时回退 SECTION)
function normalizeTemplateType(v: unknown): TemplateType {
  if (v === 'FULL' || v === 'SECTION' || v === 'PHRASE') return v
  return 'SECTION'
}

// [G005 Wave1B P1] 智能片段 (templates/snippets) — 模板派生 + 进程内存
export interface SnippetDto {
  id: string
  name: string
  content: string
  category: string
  shortcuts?: string
  createdAt?: string
  updatedAt?: string
}

// [v3.0.6.11-96 Wave3B P1] 模板分类 (templates/categories) — 进程内存 + seed
export interface TemplateCategoryDto {
  id: string
  name: string
  description?: string
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

const SEED_CATEGORIES: TemplateCategoryDto[] = [
  { id: 'TC-001', name: 'CT', description: 'CT 各类检查的标准化报告模板', sortOrder: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'TC-002', name: 'MR', description: 'MR 各类检查的标准化报告模板', sortOrder: 2, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'TC-003', name: 'MG', description: '乳腺钼靶/断层 (MG/DBT) 检查模板', sortOrder: 3, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'TC-004', name: 'DR', description: 'DR 数字化X线检查模板', sortOrder: 4, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'TC-005', name: 'US', description: '超声检查模板', sortOrder: 5, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
  { id: 'TC-006', name: '特殊检查', description: 'PET-CT / DSA / 胃肠造影等特殊检查', sortOrder: 6, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' },
]

const memCategories: TemplateCategoryDto[] = []
const deletedSeedCategoryIds = new Set<string>()

function allCategories(): TemplateCategoryDto[] {
  const seeds = SEED_CATEGORIES.filter((c) => !deletedSeedCategoryIds.has(c.id))
  const merged = [...memCategories, ...seeds]
  return merged.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
}

const SEED_SNIPPETS: SnippetDto[] = [
  { id: 'SN-001', name: '正常胸部CT', content: '双肺纹理清晰，未见实质性病变。纵隔未见明显肿大淋巴结。心影大小形态正常。', category: 'CT', shortcuts: 'ct-normal' },
  { id: 'SN-002', name: '正常头颅MR', content: '脑实质内未见明显异常信号灶，脑室系统未见明显异常，脑沟脑裂未见增宽加深。', category: 'MR', shortcuts: 'mr-normal' },
  { id: 'SN-003', name: '正常腹部超声', content: '肝胆胰脾肾未见明显异常。', category: 'US', shortcuts: 'us-abd' },
  { id: 'SN-004', name: '肺结节描述', content: '右肺上叶可见磨玻璃结节影，大小约{size}，边界清晰，建议随访复查。', category: 'CT', shortcuts: 'nodule' },
]

const memSnippets: SnippetDto[] = []

// [v3.0.6.11-98 Wave2B (报告 P1)] 模板收藏服务端化 (内存 + seed, 按用户)
//   POST /templates/:id/favorite (toggle) / GET /templates/favorites
export interface TemplateFavoritesDto {
  ids: string[]
  templates: Array<Record<string, unknown>>
}

const SEED_FAVORITE_IDS = ['tpl-chest-ct-v2', 'tpl-abd-mr-v1', 'tpl-spine-ct-v1']

const memFavorites = new Map<string, Set<string>>()

function favoriteKey(userId: string): string {
  return userId || 'u-001'
}

function getFavoriteSet(userId: string): Set<string> {
  const key = favoriteKey(userId)
  let set = memFavorites.get(key)
  if (!set) {
    set = new Set(SEED_FAVORITE_IDS)
    memFavorites.set(key, set)
  }
  return set
}

@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name)

  constructor(private readonly prisma: PrismaService) {}

  // [Wave1B] GET /templates/snippets — ReportTemplate 派生片段 + 内存 + seed
  async listSnippets(filter?: { category?: string }): Promise<SnippetDto[]> {
    const derived: SnippetDto[] = []
    try {
      const rows = await this.prisma.reportTemplate.findMany({
        where: { ...(filter?.category ? { category: filter.category } : {}) },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      })
      derived.push(...rows.map((t) => ({
        id: `SN-DB-${t.id.slice(-8)}`,
        name: t.name,
        content: t.body,
        category: t.category,
        shortcuts: t.tags?.[0],
        updatedAt: t.updatedAt.toISOString(),
      })))
    } catch (err) {
      this.logger.warn(`[Templates] snippets DB query failed, fallback to seed: ${(err as Error).message}`)
    }
    const merged = [...memSnippets, ...derived]
    const filtered = filter?.category
      ? [...memSnippets.filter((s) => s.category === filter.category), ...derived.filter((s) => s.category === filter.category)]
      : merged
    return filtered.length > 0 ? filtered : SEED_SNIPPETS.filter((s) => !filter?.category || s.category === filter.category)
  }

  createSnippet(dto: { name: string; content: string; category: string; shortcuts?: string }): SnippetDto {
    const snippet: SnippetDto = {
      id: `SN-${Date.now().toString(36)}`,
      name: dto.name,
      content: dto.content,
      category: dto.category ?? '通用',
      shortcuts: dto.shortcuts,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    memSnippets.unshift(snippet)
    return snippet
  }

  deleteSnippet(id: string): void {
    const idx = memSnippets.findIndex((s) => s.id === id)
    if (idx !== -1) {
      memSnippets.splice(idx, 1)
      return
    }
    if (!SEED_SNIPPETS.some((s) => s.id === id)) {
      throw new NotFoundException(`Snippet ${id} not found`)
    }
    this.deletedSeedIds.add(id)
  }

  private readonly deletedSeedIds = new Set<string>()

  isSeedSnippetDeleted(id: string): boolean {
    return this.deletedSeedIds.has(id)
  }

  async list(filter?: { category?: string; bodyPart?: string; keyword?: string; status?: string; userId?: string; templateType?: TemplateType }) {
    const where: any = {}
    if (filter?.category) where.category = filter.category
    if (filter?.bodyPart) where.bodyPart = filter.bodyPart
    // [v3.0.6.11-98 Wave2A P1] 审批状态过滤 (pending/approved/...), 书写页仅取 approved
    if (filter?.status) where.status = filter.status
    // [v3.0.6.11-98 Wave2A P1] 医生个人模板库: personal=true 按 createdById 过滤
    if (filter?.userId) where.createdById = filter.userId
    // [v3.0.6.11-100 Wave2C P2] 模板类型过滤 (FULL/SECTION/PHRASE)
    if (filter?.templateType) where.templateType = filter.templateType
    if (filter?.keyword) {
      where.OR = [
        { name: { contains: filter.keyword, mode: 'insensitive' } },
        { body: { contains: filter.keyword, mode: 'insensitive' } },
      ]
    }
    // [v3.0.6.11-100 Wave2C P2] 内存兼容: 旧数据无 templateType 字段时回退 SECTION
    return this.prisma.reportTemplate.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 100 })
      .then((rows) => rows.map((r) => ({ ...r, templateType: normalizeTemplateType((r as any).templateType) })))
  }

  async get(id: string) {
    const t = await this.prisma.reportTemplate.findUnique({ where: { id } })
    if (!t) throw new NotFoundException(`Template ${id} not found`)
    return t
  }

  async create(dto: CreateTemplateDto) {
    // [v3.0.6.11-98 Wave2A P1] 新模板默认 draft, 提交审批后进入 pending
    // [v3.0.6.11-99 Wave2B P1] structure 可选, 兼容纯文本 body 模板
    // [v3.0.6.11-100 Wave2C P2] templateType 可选, 默认 SECTION (段落模板)
    const data: any = {
      ...dto,
      templateType: normalizeTemplateType(dto.templateType),
      structure: dto.structure ? (dto.structure as unknown as Prisma.InputJsonValue) : undefined,
      status: 'draft',
      tenantId: getCurrentTenantId(),
    }
    return this.prisma.reportTemplate.create({ data }).then((t) => ({ ...t, templateType: (t as any).templateType ?? 'SECTION' }))
  }

  async update(id: string, dto: { name?: string; category?: string; modality?: string; bodyPart?: string; body?: string; tags?: string[]; structure?: TemplateStructure; templateType?: TemplateType }) {
    const existing = await this.prisma.reportTemplate.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Template ${id} not found`)
    const data: any = {
      ...dto,
      structure: dto.structure ? (dto.structure as unknown as Prisma.InputJsonValue) : undefined,
      version: { increment: 1 },
    }
    if (dto.templateType !== undefined) data.templateType = normalizeTemplateType(dto.templateType)
    return this.prisma.reportTemplate.update({
      where: { id },
      data,
    }).then((t) => ({ ...t, templateType: (t as any).templateType ?? 'SECTION' }))
  }

  // ══════════════════════════════════════════════════════════════════════
  // [v3.0.6.11-99 Wave2B (模板设计器 P1)] 结构化内容读取/保存
  // GET/PATCH /templates/:id/structure — 段落块数组, 与 body 纯文本双向兼容
  // ══════════════════════════════════════════════════════════════════════
  normalizeStructure(structure: unknown): TemplateStructure | null {
    if (!Array.isArray(structure) || structure.length === 0) return null
    const blocks: TemplateStructure = []
    for (const raw of structure) {
      if (!raw || typeof raw !== 'object') continue
      const b = raw as Record<string, unknown>
      const type = typeof b.type === 'string' && ['text', 'field', 'variable', 'structured'].includes(b.type) ? (b.type as TemplateStructureBlock['type']) : 'text'
      const content = typeof b.content === 'string' ? b.content : ''
      if (content === '' && type === 'text') continue
      const block: TemplateStructureBlock = { type, content }
      if (typeof b.fieldKey === 'string') block.fieldKey = b.fieldKey
      if (typeof b.variable === 'string') block.variable = b.variable
      blocks.push(block)
    }
    return blocks.length > 0 ? blocks : null
  }

  async getStructure(id: string): Promise<{ structure: TemplateStructure | null; body: string }> {
    const existing = await this.get(id)
    const structure = Array.isArray(existing.structure) ? (existing.structure as unknown as TemplateStructure) : null
    return { structure, body: existing.body }
  }

  async saveStructure(id: string, structure: unknown, body?: string): Promise<{ id: string; structure: TemplateStructure | null; body: string }> {
    const existing = await this.get(id)
    const normalized = this.normalizeStructure(structure)
    const updated = await this.prisma.reportTemplate.update({
      where: { id },
      data: {
        structure: normalized as unknown as Prisma.InputJsonValue,
        ...(typeof body === 'string' && body.trim() !== '' ? { body } : {}),
        version: { increment: 1 },
      },
    })
    return {
      id: updated.id,
      structure: Array.isArray(updated.structure) ? (updated.structure as unknown as TemplateStructure) : normalized,
      body: updated.body,
    }
  }

  async delete(id: string) {
    const existing = await this.prisma.reportTemplate.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Template ${id} not found`)
    await this.prisma.reportTemplate.delete({ where: { id } })
    return { ok: true }
  }

  async clone(id: string) {
    const original = await this.prisma.reportTemplate.findUnique({ where: { id } })
    if (!original) throw new NotFoundException(`Template ${id} not found`)
    return this.prisma.reportTemplate.create({
      data: {
        name: `${original.name} (副本)`,
        category: original.category,
        modality: original.modality,
        bodyPart: original.bodyPart,
        // [v3.0.6.11-100 Wave2C P2] 克隆保留模板类型
        templateType: normalizeTemplateType((original as any).templateType) as any,
        body: original.body,
        // [v3.0.6.11-99 Wave2B P1] 克隆保留结构化段落块
        structure: Array.isArray(original.structure) ? (original.structure as unknown as Prisma.InputJsonValue) : undefined,
        parentId: original.parentId ?? original.id,
        radsCategory: original.radsCategory,
        tags: original.tags,
        createdById: original.createdById,
        // [v3.0.6.11-98 Wave2A P1] 克隆为草稿, 需重新提交审批
        status: 'draft',
        version: 1,
        tenantId: getCurrentTenantId(),
      },
    })
  }

  // ══════════════════════════════════════════════════════════════════════
  // [v3.0.6.11-98 Wave2A P1] 模板审批流: draft → pending → approved / rejected
  // ══════════════════════════════════════════════════════════════════════
  async submit(id: string) {
    const existing = await this.get(id)
    if (existing.status === 'approved') throw new BadRequestException('已批准模板无需再次提交')
    if (existing.status === 'pending') return existing
    return this.prisma.reportTemplate.update({
      where: { id },
      data: { status: 'pending', approvedBy: null, approvedAt: null, rejectReason: null, version: { increment: 1 } },
    })
  }

  async approve(id: string, approvedBy: string) {
    const existing = await this.get(id)
    if (existing.status !== 'pending') throw new BadRequestException('仅待审批模板可批准')
    return this.prisma.reportTemplate.update({
      where: { id },
      data: { status: 'approved', approvedBy: approvedBy || existing.createdById, approvedAt: new Date(), rejectReason: null, version: { increment: 1 } },
    })
  }

  async reject(id: string, reason: string) {
    const existing = await this.get(id)
    if (existing.status !== 'pending') throw new BadRequestException('仅待审批模板可驳回')
    return this.prisma.reportTemplate.update({
      where: { id },
      data: { status: 'rejected', rejectReason: reason?.trim() || '未填写原因', version: { increment: 1 } },
    })
  }

  // ══════════════════════════════════════════════════════════════════════
  // [v3.0.6.11-96 Wave3B P1] 模板分类管理 (GET/POST/PATCH/DELETE /templates/categories)
  // 进程内存 + seed (name/description/sortOrder), TemplateCategoryPage 树渲染/CRUD 使用
  // ══════════════════════════════════════════════════════════════════════
  listCategories(): TemplateCategoryDto[] {
    return allCategories()
  }

  createCategory(dto: { name: string; description?: string; sortOrder?: number }): TemplateCategoryDto {
    if (!dto.name?.trim()) throw new BadRequestException('Category name is required')
    if (allCategories().some((c) => c.name.toLowerCase() === dto.name.trim().toLowerCase())) {
      throw new BadRequestException(`Category ${dto.name} already exists`)
    }
    const category: TemplateCategoryDto = {
      id: `TC-${Date.now().toString(36)}`,
      name: dto.name.trim(),
      description: dto.description,
      sortOrder: dto.sortOrder ?? allCategories().length + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    memCategories.unshift(category)
    return category
  }

  updateCategory(id: string, dto: { name?: string; description?: string; sortOrder?: number }): TemplateCategoryDto {
    const idx = memCategories.findIndex((c) => c.id === id)
    if (idx !== -1) {
      memCategories[idx] = { ...memCategories[idx]!, ...dto, id, updatedAt: new Date().toISOString() }
      return memCategories[idx]!
    }
    const seedIdx = SEED_CATEGORIES.findIndex((c) => c.id === id)
    if (seedIdx === -1) throw new NotFoundException(`Category ${id} not found`)
    const overlay = { ...SEED_CATEGORIES[seedIdx]!, ...dto, id, updatedAt: new Date().toISOString() }
    SEED_CATEGORIES[seedIdx] = overlay
    return overlay
  }

  deleteCategory(id: string): { ok: boolean; id: string } {
    const idx = memCategories.findIndex((c) => c.id === id)
    if (idx !== -1) {
      memCategories.splice(idx, 1)
      return { ok: true, id }
    }
    if (!SEED_CATEGORIES.some((c) => c.id === id)) throw new NotFoundException(`Category ${id} not found`)
    deletedSeedCategoryIds.add(id)
    return { ok: true, id }
  }

  isSeedCategoryDeleted(id: string): boolean {
    return deletedSeedCategoryIds.has(id)
  }

  // ══════════════════════════════════════════════════════════════════════
  // [v3.0.6.11-98 Wave2B (报告 P1)] 模板收藏服务端化
  // 内存 + seed (按用户), DB 可查时返回模板明细, 查询失败/空时前端回退 localStorage
  // ══════════════════════════════════════════════════════════════════════
  toggleFavorite(id: string, userId: string): { favorite: boolean; ids: string[] } {
    const set = getFavoriteSet(userId)
    const favorite = set.has(id)
    if (favorite) set.delete(id)
    else set.add(id)
    return { favorite: !favorite, ids: Array.from(set) }
  }

  getFavoriteIds(userId: string): string[] {
    return Array.from(getFavoriteSet(userId))
  }

  async listFavorites(userId: string): Promise<TemplateFavoritesDto> {
    const ids = this.getFavoriteIds(userId)
    let templates: Array<Record<string, unknown>> = []
    if (ids.length > 0) {
      try {
        const rows = await this.prisma.reportTemplate.findMany({ where: { id: { in: ids } } })
        templates = rows.map((t) => ({
          id: t.id,
          name: t.name,
          category: t.category,
          bodyPart: t.bodyPart,
          body: t.body,
          tags: t.tags,
          radsCategory: t.radsCategory,
          version: t.version,
        }))
      } catch (err) {
        this.logger.warn(`[Templates] favorites DB query failed: ${(err as Error).message}`)
        templates = []
      }
    }
    return { ids, templates }
  }
}
