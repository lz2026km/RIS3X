import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { getCurrentTenantId } from '../common/interceptors/tenant-context.interceptor'

export interface CreateTemplateDto {
  name: string
  category: string
  // [v3.0.6.11-98 Wave2A P1] 模态 (CT/MR/DR/...), 用于模板库自动匹配推荐
  modality?: string
  bodyPart: string
  body: string
  parentId?: string
  radsCategory?: string
  tags?: string[]
  createdById: string
}

// [v3.0.6.11-98 Wave2A P1] 模板审批状态
export type TemplateApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected'

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

  async list(filter?: { category?: string; bodyPart?: string; keyword?: string; status?: string; userId?: string }) {
    const where: any = {}
    if (filter?.category) where.category = filter.category
    if (filter?.bodyPart) where.bodyPart = filter.bodyPart
    // [v3.0.6.11-98 Wave2A P1] 审批状态过滤 (pending/approved/...), 书写页仅取 approved
    if (filter?.status) where.status = filter.status
    // [v3.0.6.11-98 Wave2A P1] 医生个人模板库: personal=true 按 createdById 过滤
    if (filter?.userId) where.createdById = filter.userId
    if (filter?.keyword) {
      where.OR = [
        { name: { contains: filter.keyword, mode: 'insensitive' } },
        { body: { contains: filter.keyword, mode: 'insensitive' } },
      ]
    }
    return this.prisma.reportTemplate.findMany({ where, orderBy: { updatedAt: 'desc' }, take: 100 })
  }

  async get(id: string) {
    const t = await this.prisma.reportTemplate.findUnique({ where: { id } })
    if (!t) throw new NotFoundException(`Template ${id} not found`)
    return t
  }

  async create(dto: CreateTemplateDto) {
    // [v3.0.6.11-98 Wave2A P1] 新模板默认 draft, 提交审批后进入 pending
    return this.prisma.reportTemplate.create({ data: { ...dto, status: 'draft', tenantId: getCurrentTenantId() } })
  }

  async update(id: string, dto: { name?: string; category?: string; modality?: string; bodyPart?: string; body?: string; tags?: string[] }) {
    const existing = await this.prisma.reportTemplate.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Template ${id} not found`)
    return this.prisma.reportTemplate.update({ where: { id }, data: { ...dto, version: { increment: 1 } } })
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
        body: original.body,
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
