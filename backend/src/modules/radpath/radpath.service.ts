import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { getCurrentTenantId } from '../../common/interceptors/tenant-context.interceptor'

export interface CreateRadPathDto {
  reportId: string
  pathologyId: string
  radFinding: string
  pathResult: string
  consistency: 'concordant' | 'discordant' | 'pending'
  notes?: string
}

export interface UpdateConsistencyDto {
  id: string
  consistency: 'concordant' | 'discordant' | 'pending'
  notes?: string
}

@Injectable()
export class RadPathService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateRadPathDto) {
    return this.prisma.radPathRecord.create({
      data: {
        reportId: dto.reportId,
        pathologyId: dto.pathologyId,
        radFinding: dto.radFinding,
        pathResult: dto.pathResult,
        consistency: dto.consistency,
        notes: dto.notes,
        tenantId: getCurrentTenantId(),
      },
      include: { report: true },
    })
  }

  async findByReport(reportId: string) {
    const record = await this.prisma.radPathRecord.findFirst({
      where: { reportId },
      include: { report: { include: { patient: true, exam: true } } },
    })
    if (!record) throw new NotFoundException(`RadPath record for report ${reportId} not found`)
    return record
  }

  async findByPathology(pathologyId: string) {
    const record = await this.prisma.radPathRecord.findFirst({
      where: { pathologyId },
      include: { report: { include: { patient: true, exam: true } } },
    })
    if (!record) throw new NotFoundException(`RadPath record for pathology ${pathologyId} not found`)
    return record
  }

  async updateConsistency(dto: UpdateConsistencyDto) {
    const existing = await this.prisma.radPathRecord.findUnique({ where: { id: dto.id } })
    if (!existing) throw new NotFoundException(`RadPath record ${dto.id} not found`)
    return this.prisma.radPathRecord.update({
      where: { id: dto.id },
      data: { consistency: dto.consistency, notes: dto.notes },
      include: { report: true },
    })
  }

  async getStats() {
    const tenantId = getCurrentTenantId()
    const where = { tenantId }
    const total = await this.prisma.radPathRecord.count({ where })
    const concordant = await this.prisma.radPathRecord.count({ where: { ...where, consistency: 'concordant' } })
    const discordant = await this.prisma.radPathRecord.count({ where: { ...where, consistency: 'discordant' } })
    const pending = await this.prisma.radPathRecord.count({ where: { ...where, consistency: 'pending' } })
    const positiveConsistency = total > 0 ? concordant / total : 0

    const records = await this.prisma.radPathRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, consistency: true },
    })

    const trendMap = new Map<string, { total: number; concordant: number }>()
    for (const r of records) {
      const month = r.createdAt.toISOString().slice(0, 7)
      const entry = trendMap.get(month) ?? { total: 0, concordant: 0 }
      entry.total++
      if (r.consistency === 'concordant') entry.concordant++
      trendMap.set(month, entry)
    }
    const trend = Array.from(trendMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, v]) => ({ month, rate: v.total > 0 ? +(v.concordant / v.total * 100).toFixed(1) : 0 }))

    return { total, concordant, discordant, pending, positiveConsistency: +(positiveConsistency * 100).toFixed(1), trend }
  }
}
