// [W4-A v3.0.6.11-79] 数据字典服务 (DictEntry: category/key/value 三级 CRUD)
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { currentTenantId } from '../../common/tenant/tenant-utils'
import type { DictEntry } from '@prisma/client'

export interface CreateDictEntryDto {
  key: string
  value: string
  sort?: number
  active?: boolean
  extra?: Record<string, unknown>
}

export interface UpdateDictEntryDto extends Partial<CreateDictEntryDto> {}

export interface CategorySummary {
  category: string
  count: number
  activeCount: number
}

@Injectable()
export class DictionaryService {
  constructor(private readonly prisma: PrismaService) {}

  /** 分类列表: 每分类条目数 + 启用数, 按分类名排序 */
  async listCategories(): Promise<CategorySummary[]> {
    const rows = await this.prisma.dictEntry.groupBy({
      by: ['category'],
      where: { tenantId: currentTenantId() },
      _count: { _all: true },
    })
    const activeRows = await this.prisma.dictEntry.groupBy({
      by: ['category'],
      where: { tenantId: currentTenantId(), active: true },
      _count: { _all: true },
    })
    const activeMap = new Map(activeRows.map((r) => [r.category, r._count._all]))
    return rows
      .map((r) => ({
        category: r.category,
        count: r._count._all,
        activeCount: activeMap.get(r.category) ?? 0,
      }))
      .sort((a, b) => a.category.localeCompare(b.category, 'zh-CN'))
  }

  /** 分类条目列表: sort asc, createdAt asc */
  async listEntries(category: string): Promise<DictEntry[]> {
    const categoryName = this.normalizeCategory(category)
    return this.prisma.dictEntry.findMany({
      where: { tenantId: currentTenantId(), category: categoryName },
      orderBy: [{ sort: 'asc' }, { createdAt: 'asc' }],
    })
  }

  async create(category: string, dto: CreateDictEntryDto): Promise<DictEntry> {
    const categoryName = this.normalizeCategory(category)
    const key = (dto.key ?? '').trim()
    const value = (dto.value ?? '').trim()
    if (!key) throw new BadRequestException('编码不能为空')
    if (!value) throw new BadRequestException('名称不能为空')
    const existing = await this.prisma.dictEntry.findUnique({
      where: { tenantId_category_key: { tenantId: currentTenantId(), category: categoryName, key } },
    })
    if (existing) throw new BadRequestException(`字典项已存在: ${categoryName}/${key}`)
    return this.prisma.dictEntry.create({
      data: {
        tenantId: currentTenantId(),
        category: categoryName,
        key,
        value,
        sort: dto.sort ?? 0,
        active: dto.active ?? true,
        extra: (dto.extra ?? {}) as never,
      },
    })
  }

  async update(category: string, key: string, dto: UpdateDictEntryDto): Promise<DictEntry> {
    const categoryName = this.normalizeCategory(category)
    const tenantId = currentTenantId()
    const existing = await this.prisma.dictEntry.findUnique({
      where: { tenantId_category_key: { tenantId, category: categoryName, key } },
    })
    if (!existing) throw new NotFoundException(`字典项不存在: ${categoryName}/${key}`)
    const data: {
      key?: string
      value?: string
      sort?: number
      active?: boolean
      extra?: never
    } = {}
    if (dto.key !== undefined) {
      const newKey = dto.key.trim()
      if (!newKey) throw new BadRequestException('编码不能为空')
      if (newKey !== key) {
        const clash = await this.prisma.dictEntry.findUnique({
          where: { tenantId_category_key: { tenantId, category: categoryName, key: newKey } },
        })
        if (clash) throw new BadRequestException(`字典项已存在: ${categoryName}/${newKey}`)
      }
      data.key = newKey
    }
    if (dto.value !== undefined) {
      const newValue = dto.value.trim()
      if (!newValue) throw new BadRequestException('名称不能为空')
      data.value = newValue
    }
    if (dto.sort !== undefined) data.sort = dto.sort
    if (dto.active !== undefined) data.active = dto.active
    if (dto.extra !== undefined) data.extra = (dto.extra ?? {}) as never
    return this.prisma.dictEntry.update({
      where: { tenantId_category_key: { tenantId, category: categoryName, key } },
      data,
    })
  }

  async remove(category: string, key: string): Promise<{ success: boolean; deletedKey: string }> {
    const categoryName = this.normalizeCategory(category)
    const deleted = await this.prisma.dictEntry.deleteMany({
      where: { tenantId: currentTenantId(), category: categoryName, key },
    })
    if (deleted.count === 0) throw new NotFoundException(`字典项不存在: ${categoryName}/${key}`)
    return { success: true, deletedKey: key }
  }

  private normalizeCategory(category: string): string {
    const name = (category ?? '').trim()
    if (!name) throw new BadRequestException('分类不能为空')
    return name
  }
}
