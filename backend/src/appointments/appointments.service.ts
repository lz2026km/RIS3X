/**
 * G005 放射RIS系统 v3.0.2 - 预约服务
 */
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { getCurrentTenantId } from '../common/interceptors/tenant-context.interceptor'
import type { Appointment, AppointmentState } from '@prisma/client'

export interface CreateAppointmentDto {
  patientName: string
  patientId: string
  modality: string
  bodyPart?: string
  startAt: string | Date
  endAt: string | Date
  deviceId: string
  deviceName: string
  room?: string
  priority?: string
  note?: string
  referringDoctor?: string
  createdById: string
}

export interface UpdateAppointmentDto {
  id?: string
  state?: AppointmentState
  startAt?: string | Date
  endAt?: string | Date
  note?: string
  deviceId?: string
}

@Injectable()
export class AppointmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: { skip?: number; take?: number; state?: AppointmentState; deviceId?: string; dateFrom?: string; dateTo?: string }) {
    const where: any = {}
    if (params.state) where.state = params.state
    if (params.deviceId) where.deviceId = params.deviceId
    if (params.dateFrom || params.dateTo) {
      where.scheduledAt = {}
      if (params.dateFrom) where.scheduledAt.gte = new Date(params.dateFrom)
      if (params.dateTo) where.scheduledAt.lte = new Date(params.dateTo)
    }
    const [items, total] = await Promise.all([
      this.prisma.appointment.findMany({
        where,
        skip: params.skip ?? 0,
        take: params.take ?? 50,
        orderBy: { scheduledAt: 'asc' },
      }),
      this.prisma.appointment.count({ where }),
    ])
    return { items, total }
  }

  async get(id: string): Promise<Appointment> {
    const a = await this.prisma.appointment.findUnique({ where: { id } })
    if (!a) throw new NotFoundException(`Appointment ${id} not found`)
    return a
  }

  async create(dto: CreateAppointmentDto): Promise<Appointment> {
    return this.prisma.$transaction(async (tx) => {
      const overlap = await tx.appointment.findFirst({
        where: {
          deviceId: dto.deviceId,
          state: { in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] },
          scheduledAt: { lt: new Date(dto.endAt), gt: new Date(dto.startAt) },
        },
      })
      if (overlap) throw new ConflictException(`设备冲突: ${overlap.id}`)
      return tx.appointment.create({
        data: {
          patientId: dto.patientId,
          modality: dto.modality,
          deviceId: dto.deviceId,
          scheduledAt: new Date(dto.startAt),
          tenantId: getCurrentTenantId(),
        },
      })
    })
  }

  async update(id: string, dto: UpdateAppointmentDto): Promise<Appointment> {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.appointment.findUnique({ where: { id } })
      if (!current) throw new NotFoundException(`Appointment ${id} not found`)
      if (dto.deviceId || dto.startAt || dto.endAt) {
        const deviceId = dto.deviceId ?? current.deviceId
        const startAt = dto.startAt ? new Date(dto.startAt) : current.scheduledAt
        const endAt = dto.endAt ? new Date(dto.endAt) : new Date(current.scheduledAt.getTime() + 30 * 60 * 1000)
        const overlap = await tx.appointment.findFirst({
          where: {
            deviceId,
            id: { not: id },
            state: { in: ['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS'] },
            scheduledAt: { lt: endAt, gt: startAt },
          },
        })
        if (overlap) throw new ConflictException(`设备冲突: ${overlap.id}`)
      }
      const data: any = { ...dto }
      delete data.id
      if (dto.startAt) data.scheduledAt = new Date(dto.startAt)
      try {
        return await tx.appointment.update({
          where: { id, version: current.version },
          data: { ...data, version: { increment: 1 } },
        })
      } catch (error: any) {
        if (error?.code === 'P2025') throw new ConflictException('版本冲突：该预约已被其他用户修改')
        throw error
      }
    })
  }

  async cancel(id: string): Promise<Appointment> {
    return this.prisma.appointment.update({
      where: { id },
      data: { state: 'CANCELLED' },
    })
  }
}
