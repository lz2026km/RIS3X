import { Injectable, Logger, NotFoundException } from '@nestjs/common'
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

// [G005 W3-BackendParity] GET /radpath/records 无 DB 回退种子
const SEED_RADPATH_RECORDS = [
  {
    id: 'RP-000', reportId: 'RPT001', pathologyId: 'PATH001',
    radFinding: '右肺上叶磨玻璃结节，约 6mm，边界清晰', pathResult: '微浸润性肺腺癌',
    consistency: 'concordant', notes: '影像与病理一致', createdAt: '2026-07-20T09:00:00.000Z',
    report: { id: 'RPT001', findings: '右肺上叶磨玻璃结节，约 6mm', conclusion: '肺结节，建议随访或手术评估', signedAt: '2026-07-20T08:30:00.000Z', patient: { name: '张伟', gender: '男', birthDate: '1962-05-10' }, exam: { modality: 'CT', bodyPart: '胸部', accessionNumber: 'ACC001' } },
  },
  {
    id: 'RP-001', reportId: 'RPT202607001', pathologyId: 'PATH202607001',
    radFinding: '左乳腺外上象限结节伴钙化', pathResult: '纤维腺瘤',
    consistency: 'discordant', notes: '影像可疑 BI-RADS 4A，病理良性', createdAt: '2026-07-12T10:15:00.000Z',
    report: { id: 'RPT202607001', findings: '左乳腺结节伴钙化', conclusion: 'BI-RADS 4A，建议穿刺活检', signedAt: '2026-07-12T09:45:00.000Z', patient: { name: '李娜', gender: '女', birthDate: '1975-03-22' }, exam: { modality: 'MG', bodyPart: '乳腺', accessionNumber: 'ACC202607002' } },
  },
  {
    id: 'RP-002', reportId: 'RPT202607003', pathologyId: 'PATH202607003',
    radFinding: '肝脏右叶低密度灶', pathResult: '',
    consistency: 'pending', notes: '待病理回报', createdAt: '2026-07-10T14:00:00.000Z',
    report: { id: 'RPT202607003', findings: '肝右叶低密度灶，增强扫描呈快进快出', conclusion: '肝细胞癌可能', signedAt: '2026-07-10T13:30:00.000Z', patient: { name: '王磊', gender: '男', birthDate: '1958-11-02' }, exam: { modality: 'MR', bodyPart: '腹部', accessionNumber: 'ACC202607003' } },
  },
]

@Injectable()
export class RadPathService {
  private readonly logger = new Logger(RadPathService.name)

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

  /** [G005 W3-BackendParity] GET /radpath/records — 全部影像-病理一致性记录 (DB 不可用回退种子) */
  async listRecords() {
    try {
      const rows = await this.prisma.radPathRecord.findMany({
        include: { report: { include: { patient: true, exam: true } } },
        orderBy: { createdAt: 'desc' },
      })
      return rows.length > 0 ? rows : SEED_RADPATH_RECORDS
    } catch (err) {
      this.logger.warn(`[RadPath] listRecords DB failed, fallback seed: ${(err as Error).message}`)
      return SEED_RADPATH_RECORDS
    }
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
