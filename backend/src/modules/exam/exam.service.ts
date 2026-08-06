import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { currentTenantId } from '../../common/tenant/tenant-utils'
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

@Injectable()
export class ExamService {
  constructor(private readonly prisma: PrismaService) {}

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
    const [items, total] = await Promise.all([
      this.prisma.exam.findMany({
        where,
        skip: params.skip ?? 0,
        take: params.take ?? 50,
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
}
