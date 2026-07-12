import { Injectable, NotFoundException } from '@nestjs/common'
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

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

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
