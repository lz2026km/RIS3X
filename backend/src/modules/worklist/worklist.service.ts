import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { currentTenantId } from '../../common/tenant/tenant-utils'

export const WORKLIST_STATES = ['SCHEDULED', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const
export type WorklistState = (typeof WORKLIST_STATES)[number]

export interface WorklistListParams {
  page?: number
  pageSize?: number
  status?: WorklistState
  modality?: string
  patientId?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

export interface AssignDto {
  doctorId?: string
  deviceId?: string
}

@Injectable()
export class WorklistService {
  constructor(private readonly prisma: PrismaService) {}

  private async getExam(id: string) {
    const exam = await this.prisma.exam.findUnique({ where: { id }, include: { patient: true } })
    if (!exam) throw new NotFoundException(`Exam ${id} not found`)
    return exam
  }

  private async assertDoctor(doctorId: string) {
    const doctor = await this.prisma.user.findUnique({ where: { id: doctorId } })
    if (!doctor) throw new BadRequestException(`Doctor ${doctorId} not found`)
    return doctor
  }

  private async assertDevice(deviceId: string) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } })
    if (!device) throw new BadRequestException(`Device ${deviceId} not found`)
    return device
  }

  private async assignDoctorToExam(exam: { id: string; patientId: string; tenantId: string }, doctorId: string) {
    const report = await this.prisma.report.findFirst({
      where: { examId: exam.id, tenantId: currentTenantId() },
      orderBy: { createdAt: 'asc' },
    })
    if (report) {
      await this.prisma.report.update({ where: { id: report.id }, data: { radiologistId: doctorId } })
    } else {
      await this.prisma.report.create({
        data: {
          patientId: exam.patientId,
          examId: exam.id,
          radiologistId: doctorId,
          state: 'PENDING_ASSIGNMENT',
          tenantId: exam.tenantId,
        },
      })
    }
  }

  async list(params: WorklistListParams) {
    const page = params.page ?? 1
    const pageSize = params.pageSize ?? 50
    const where: any = { tenantId: currentTenantId() }
    if (params.status) where.state = params.status
    if (params.modality) where.modality = params.modality
    if (params.patientId) where.patientId = params.patientId
    if (params.dateFrom || params.dateTo) {
      where.scheduledAt = {}
      if (params.dateFrom) where.scheduledAt.gte = new Date(params.dateFrom)
      if (params.dateTo) where.scheduledAt.lte = new Date(params.dateTo)
    }
    if (params.search) {
      where.OR = [
        { accessionNumber: { contains: params.search } },
        { bodyPart: { contains: params.search } },
        { patient: { name: { contains: params.search } } },
      ]
    }
    const [items, total] = await Promise.all([
      this.prisma.exam.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { patient: true, device: true },
        orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
      }),
      this.prisma.exam.count({ where }),
    ])
    return { items, total, page, pageSize }
  }

  async getById(id: string) {
    const exam = await this.prisma.exam.findFirst({
      where: { id, tenantId: currentTenantId() },
      include: {
        patient: true,
        device: true,
        reports: {
          select: {
            id: true,
            state: true,
            radiologistId: true,
            radiologist: { select: { id: true, fullName: true, role: true } },
          },
        },
      },
    })
    if (!exam) throw new NotFoundException(`Exam ${id} not found`)
    return exam
  }

  async update(id: string, dto: { state?: WorklistState; deviceId?: string | null; bodyPart?: string; modality?: string; scheduledAt?: string | null }) {
    await this.getExam(id)
    const data: any = {}
    if (dto.state !== undefined) data.state = dto.state
    if (dto.deviceId !== undefined) data.deviceId = dto.deviceId
    if (dto.bodyPart !== undefined) data.bodyPart = dto.bodyPart
    if (dto.modality !== undefined) data.modality = dto.modality
    if (dto.scheduledAt !== undefined) data.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null
    return this.prisma.exam.update({ where: { id }, data, include: { patient: true, device: true } })
  }

  async getStats() {
    const where = { tenantId: currentTenantId() }
    const [grouped, total] = await Promise.all([
      this.prisma.exam.groupBy({ by: ['state'], where, _count: { _all: true } }),
      this.prisma.exam.count({ where }),
    ])
    const byStatus: Record<string, number> = { SCHEDULED: 0, ARRIVED: 0, IN_PROGRESS: 0, COMPLETED: 0, CANCELLED: 0 }
    for (const g of grouped) byStatus[g.state] = g._count._all
    return { total, byStatus }
  }

  async assign(id: string, dto: AssignDto) {
    if (!dto.doctorId && !dto.deviceId) throw new BadRequestException('doctorId or deviceId is required')
    const exam = await this.getExam(id)
    const data: any = {}
    if (dto.deviceId) {
      await this.assertDevice(dto.deviceId)
      data.deviceId = dto.deviceId
    }
    if (dto.doctorId) {
      await this.assertDoctor(dto.doctorId)
      await this.assignDoctorToExam(exam, dto.doctorId)
    }
    return this.prisma.exam.update({ where: { id }, data, include: { patient: true, device: true } })
  }

  async batchAssign(ids: string[], dto: AssignDto) {
    if (!dto.doctorId && !dto.deviceId) throw new BadRequestException('doctorId or deviceId is required')
    const where = { id: { in: ids }, tenantId: currentTenantId() }
    if (dto.deviceId) {
      await this.assertDevice(dto.deviceId)
      await this.prisma.exam.updateMany({ where, data: { deviceId: dto.deviceId } })
    }
    if (dto.doctorId) {
      await this.assertDoctor(dto.doctorId)
      const exams = await this.prisma.exam.findMany({ where, select: { id: true, patientId: true, tenantId: true } })
      await Promise.all(exams.map((e) => this.assignDoctorToExam(e, dto.doctorId!)))
    }
    return { ok: true, updated: ids.length }
  }

  async checkIn(id: string) {
    const exam = await this.getExam(id)
    if (exam.state !== 'SCHEDULED') throw new BadRequestException(`Exam ${id} is not in SCHEDULED state`)
    return this.prisma.exam.update({
      where: { id },
      data: { state: 'ARRIVED', startedAt: new Date() },
      include: { patient: true },
    })
  }

  async start(id: string) {
    const exam = await this.getExam(id)
    if (exam.state !== 'ARRIVED') throw new BadRequestException(`Exam ${id} is not in ARRIVED state`)
    return this.prisma.exam.update({
      where: { id },
      data: { state: 'IN_PROGRESS' },
      include: { patient: true },
    })
  }

  async complete(id: string) {
    const exam = await this.getExam(id)
    if (exam.state !== 'IN_PROGRESS') throw new BadRequestException(`Exam ${id} is not in IN_PROGRESS state`)
    return this.prisma.exam.update({
      where: { id },
      data: { state: 'COMPLETED', completedAt: new Date() },
      include: { patient: true },
    })
  }

  async cancel(id: string, reason?: string) {
    const exam = await this.getExam(id)
    if (!['SCHEDULED', 'ARRIVED', 'IN_PROGRESS'].includes(exam.state)) {
      throw new BadRequestException(`Exam ${id} cannot be cancelled in ${exam.state} state`)
    }
    return this.prisma.exam.update({
      where: { id },
      data: { state: 'CANCELLED' },
      include: { patient: true },
    })
  }
}
