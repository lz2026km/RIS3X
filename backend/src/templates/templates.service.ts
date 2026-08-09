import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { getCurrentTenantId } from '../common/interceptors/tenant-context.interceptor'

export interface CreateTemplateDto {
  name: string
  category: string
  bodyPart: string
  body: string
  parentId?: string
  radsCategory?: string
  tags?: string[]
  createdById: string
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

const SEED_SNIPPETS: SnippetDto[] = [
  { id: 'SN-001', name: '正常胸部CT', content: '双肺纹理清晰，未见实质性病变。纵隔未见明显肿大淋巴结。心影大小形态正常。', category: 'CT', shortcuts: 'ct-normal' },
  { id: 'SN-002', name: '正常头颅MR', content: '脑实质内未见明显异常信号灶，脑室系统未见明显异常，脑沟脑裂未见增宽加深。', category: 'MR', shortcuts: 'mr-normal' },
  { id: 'SN-003', name: '正常腹部超声', content: '肝胆胰脾肾未见明显异常。', category: 'US', shortcuts: 'us-abd' },
  { id: 'SN-004', name: '肺结节描述', content: '右肺上叶可见磨玻璃结节影，大小约{size}，边界清晰，建议随访复查。', category: 'CT', shortcuts: 'nodule' },
]

const memSnippets: SnippetDto[] = []

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

  async list(filter?: { category?: string; bodyPart?: string; keyword?: string }) {
    const where: any = {}
    if (filter?.category) where.category = filter.category
    if (filter?.bodyPart) where.bodyPart = filter.bodyPart
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
    return this.prisma.reportTemplate.create({ data: { ...dto, tenantId: getCurrentTenantId() } })
  }

  async update(id: string, dto: { name?: string; category?: string; bodyPart?: string; body?: string; tags?: string[] }) {
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
        bodyPart: original.bodyPart,
        body: original.body,
        parentId: original.parentId ?? original.id,
        radsCategory: original.radsCategory,
        tags: original.tags,
        createdById: original.createdById,
        version: 1,
        tenantId: getCurrentTenantId(),
      },
    })
  }
}
