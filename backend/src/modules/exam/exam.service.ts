import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { currentTenantId } from '../../common/tenant/tenant-utils'
import { SystemConfigService } from '../../system-storage/system-config.service'
import type { Exam } from '@prisma/client'

export interface CreateExamDto {
  patientId: string
  accessionNumber: string
  modality: string
  bodyPart: string
  scheduledAt?: string
  deviceId?: string
}

export interface UpdateExamDto {
  state?: string
  startedAt?: string
  completedAt?: string
  deviceId?: string
}

// [G005 Wave4B] G-18 检查合并/拆分
export interface MergeExamsDto {
  targetId: string
  sourceIds: string[]
}

export interface MergeExamsResult {
  targetId: string
  patientId: string
  mergedSourceCount: number
  removedSourceIds: string[]
  retainedSourceIds: string[]
  movedReports: number
  mergedAt: string
}

export interface SplitExamDto {
  reportIds: string[]
}

export interface SplitExamResult {
  sourceExamId: string
  patientId: string
  created: { id: string; accessionNumber: string; reportCount: number }[]
  splitAt: string
}

@Injectable()
export class ExamService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly systemConfig: SystemConfigService,
  ) {}

  async list(params: { skip?: number; take?: number; patientId?: string; modality?: string; state?: string; dateFrom?: string; dateTo?: string }) {
    const where: any = { tenantId: currentTenantId() }
    if (params.patientId) where.patientId = params.patientId
    if (params.modality) where.modality = params.modality
    if (params.state) where.state = params.state
    if (params.dateFrom || params.dateTo) {
      where.scheduledAt = {}
      if (params.dateFrom) where.scheduledAt.gte = new Date(params.dateFrom)
      if (params.dateTo) where.scheduledAt.lte = new Date(params.dateTo)
    }
    // [v3.0.6.11-79] 默认分页大小读取 admin config default_page_size, 未配置回退 20
    const take = params.take ?? (await this.systemConfig.getNumber('default_page_size', 20))
    const [items, total] = await Promise.all([
      this.prisma.exam.findMany({
        where,
        skip: params.skip ?? 0,
        take,
        orderBy: { createdAt: 'desc' },
        include: { patient: true, device: true, reports: true },
      }),
      this.prisma.exam.count({ where }),
    ])
    return { items, total }
  }

  async get(id: string): Promise<Exam> {
    const e = await this.prisma.exam.findFirst({
      where: { id, tenantId: currentTenantId() },
      include: { patient: true, device: true, reports: true },
    })
    if (!e) throw new NotFoundException(`Exam ${id} not found`)
    return e
  }

  async create(dto: CreateExamDto): Promise<Exam> {
    return this.prisma.exam.create({
      data: {
        patientId: dto.patientId,
        accessionNumber: dto.accessionNumber,
        modality: dto.modality,
        bodyPart: dto.bodyPart,
        scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : null,
        deviceId: dto.deviceId,
        state: 'SCHEDULED',
        tenantId: currentTenantId(),
      },
    })
  }

  async update(id: string, dto: UpdateExamDto): Promise<Exam> {
    const existing = await this.prisma.exam.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Exam ${id} not found`)
    const data: any = { ...dto }
    if (dto.startedAt) data.startedAt = new Date(dto.startedAt)
    if (dto.completedAt) data.completedAt = new Date(dto.completedAt)
    return this.prisma.exam.update({ where: { id }, data })
  }

  async delete(id: string): Promise<{ ok: true }> {
    const existing = await this.prisma.exam.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Exam ${id} not found`)
    try {
      await this.prisma.exam.delete({ where: { id } })
    } catch (e: any) {
      if (e?.code === 'P2003') {
        throw new BadRequestException('检查存在关联检查/报告数据，请先处理关联数据')
      }
      throw e
    }
    return { ok: true }
  }

  // [W4-A] 批量导入: 患者不存在则报错列出 (含行号), accessionNumber 重复则跳过
  async importMany(rows: CreateExamDto[]): Promise<{ imported: number; skipped: number; errors: { index: number; message: string }[] }> {
    const tenantId = currentTenantId()
    const result: { imported: number; skipped: number; errors: { index: number; message: string }[] } = { imported: 0, skipped: 0, errors: [] }
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        if (!row || typeof row !== 'object') {
          result.errors.push({ index: i, message: '第 ' + (i + 1) + ' 行数据为空' })
          continue
        }
        if (!row.patientId || !(row.accessionNumber ?? '').trim() || !(row.modality ?? '').trim() || !(row.bodyPart ?? '').trim()) {
          result.errors.push({ index: i, message: '第 ' + (i + 1) + ' 行: patientId/accessionNumber/modality/bodyPart 为必填' })
          continue
        }
        const patient = await this.prisma.patient.findFirst({
          where: { id: row.patientId, tenantId, deletedAt: null },
          select: { id: true },
        })
        if (!patient) {
          result.errors.push({ index: i, message: '第 ' + (i + 1) + ' 行: 患者不存在 ' + row.patientId })
          continue
        }
        const existing = await this.prisma.exam.findUnique({
          where: { accessionNumber: row.accessionNumber.trim() },
          select: { id: true },
        })
        if (existing) {
          result.skipped++
          continue
        }
        await this.prisma.exam.create({
          data: {
            patientId: row.patientId,
            accessionNumber: row.accessionNumber.trim(),
            modality: row.modality.trim(),
            bodyPart: row.bodyPart.trim(),
            scheduledAt: row.scheduledAt ? new Date(row.scheduledAt) : null,
            deviceId: row.deviceId,
            state: 'SCHEDULED',
            tenantId,
          },
        })
        result.imported++
      } catch (e: any) {
        result.errors.push({ index: i, message: '第 ' + (i + 1) + ' 行: ' + (e?.message ?? String(e)) })
      }
    }
    return result
  }

  // [G005 Wave4B] G-18 检查合并: 同患者多检查 → 目标检查 (报告归属迁移到目标)
  async merge(dto: MergeExamsDto): Promise<MergeExamsResult> {
    const tenantId = currentTenantId()
    const ids = [dto.targetId, ...dto.sourceIds]
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('目标检查不能同时作为源检查')
    }
    const exams = await this.prisma.exam.findMany({
      where: { id: { in: ids }, tenantId },
      include: { patient: { select: { id: true } }, reports: { select: { id: true } } },
    })
    if (exams.length !== ids.length) {
      const missing = ids.filter((i) => !exams.some((e) => e.id === i))
      throw new NotFoundException(`检查不存在: ${missing.join(', ')}`)
    }
    const patientIds = new Set(exams.map((e) => e.patientId))
    if (patientIds.size > 1) {
      throw new BadRequestException('仅同一患者的多个检查可以合并')
    }
    const target = exams.find((e) => e.id === dto.targetId)!
    const sources = exams.filter((e) => e.id !== dto.targetId)

    let movedReports = 0
    for (const src of sources) {
      if (src.reports.length > 0) {
        const res = await this.prisma.report.updateMany({
          where: { id: { in: src.reports.map((r) => r.id) } },
          data: { examId: target.id },
        })
        movedReports += res.count
      }
    }
    // 源检查删除; 存在关联数据(危急值等)时保留
    const removedSourceIds: string[] = []
    const retainedSourceIds: string[] = []
    for (const src of sources) {
      try {
        await this.prisma.exam.delete({ where: { id: src.id } })
        removedSourceIds.push(src.id)
      } catch {
        retainedSourceIds.push(src.id)
      }
    }
    return {
      targetId: target.id,
      patientId: target.patientId,
      mergedSourceCount: sources.length,
      removedSourceIds,
      retainedSourceIds,
      movedReports,
      mergedAt: new Date().toISOString(),
    }
  }

  // [G005 Wave4B] G-18 检查拆分: 按报告归属拆分 (每份报告独立成新检查, 患者/检查属性继承)
  async split(id: string, dto: SplitExamDto): Promise<SplitExamResult> {
    const exam = await this.prisma.exam.findFirst({
      where: { id, tenantId: currentTenantId() },
      include: { reports: { select: { id: true } } },
    })
    if (!exam) throw new NotFoundException(`Exam ${id} not found`)
    const ids = [...new Set(dto.reportIds)]
    if (ids.length < 2) {
      throw new BadRequestException('至少选择 2 份报告才能拆分')
    }
    const reports = await this.prisma.report.findMany({
      where: { id: { in: ids }, examId: exam.id },
      select: { id: true },
    })
    if (reports.length !== ids.length) {
      const missing = ids.filter((i) => !reports.some((r) => r.id === i))
      throw new BadRequestException(`报告不属于该检查: ${missing.join(', ')}`)
    }
    const stamp = Date.now().toString(36)
    const created: SplitExamResult['created'] = []
    for (let i = 0; i < reports.length; i++) {
      const newExam = await this.prisma.exam.create({
        data: {
          tenantId: exam.tenantId,
          patientId: exam.patientId,
          accessionNumber: `${exam.accessionNumber}-S${stamp}-${i + 1}`,
          modality: exam.modality,
          bodyPart: exam.bodyPart,
          scheduledAt: exam.scheduledAt,
          deviceId: exam.deviceId,
          state: exam.state,
        },
      })
      await this.prisma.report.updateMany({
        where: { id: reports[i]!.id },
        data: { examId: newExam.id },
      })
      created.push({ id: newExam.id, accessionNumber: newExam.accessionNumber, reportCount: 1 })
    }
    return { sourceExamId: exam.id, patientId: exam.patientId, created, splitAt: new Date().toISOString() }
  }

  // [W4-A] CSV 导出 (按 patientId/modality/state/日期筛选)
  async exportCsv(params: { patientId?: string; modality?: string; state?: string; dateFrom?: string; dateTo?: string } = {}): Promise<{ filename: string; content: string; count: number }> {
    const where: any = { tenantId: currentTenantId() }
    if (params.patientId) where.patientId = params.patientId
    if (params.modality) where.modality = params.modality
    if (params.state) where.state = params.state
    if (params.dateFrom || params.dateTo) {
      where.scheduledAt = {}
      if (params.dateFrom) where.scheduledAt.gte = new Date(params.dateFrom)
      if (params.dateTo) where.scheduledAt.lte = new Date(params.dateTo)
    }
    const items = await this.prisma.exam.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { patient: { select: { name: true } } },
    })
    const header = ['id', 'accessionNumber', 'patientId', 'patientName', 'modality', 'bodyPart', 'state', 'scheduledAt', 'deviceId', 'createdAt']
    const esc = (v: unknown) => {
      const s = String(v ?? '')
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
    }
    const lines = [header.join(',')]
    for (const e of items) {
      const row: Record<string, unknown> = {
        id: e.id,
        accessionNumber: e.accessionNumber,
        patientId: e.patientId,
        patientName: (e as any).patient?.name ?? '',
        modality: e.modality,
        bodyPart: e.bodyPart,
        state: e.state,
        scheduledAt: e.scheduledAt?.toISOString() ?? '',
        deviceId: e.deviceId ?? '',
        createdAt: e.createdAt?.toISOString() ?? '',
      }
      lines.push(header.map((h) => esc(row[h])).join(','))
    }
    const date = new Date().toISOString().slice(0, 10)
    return { filename: `exams_${date}.csv`, content: '\ufeff' + lines.join('\n'), count: items.length }
  }
}
