import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { Device } from '@prisma/client'

export interface CreateDeviceDto {
  code: string
  name: string
  modality: string
  manufacturer?: string
  location?: string
}

export interface UpdateDeviceDto {
  name?: string
  modality?: string
  manufacturer?: string
  location?: string
  state?: 'IDLE' | 'IN_USE' | 'MAINTENANCE' | 'BROKEN' | 'OFFLINE'
}

@Injectable()
export class DeviceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: { skip?: number; take?: number; modality?: string; state?: string }) {
    const where: { modality?: string; state?: string } = {}
    if (params.modality) where.modality = params.modality
    if (params.state) where.state = params.state
    const [items, total] = await Promise.all([
      this.prisma.device.findMany({
        where,
        skip: params.skip ?? 0,
        take: params.take ?? 50,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.device.count({ where }),
    ])
    return { items, total }
  }

  async get(id: string): Promise<Device> {
    const d = await this.prisma.device.findUnique({
      where: { id },
      include: { exams: { take: 10, orderBy: { createdAt: 'desc' } } },
    })
    if (!d) throw new NotFoundException(`Device ${id} not found`)
    return d
  }

  async create(dto: CreateDeviceDto): Promise<Device> {
    return this.prisma.device.create({
      data: {
        code: dto.code,
        name: dto.name,
        modality: dto.modality,
        manufacturer: dto.manufacturer,
        location: dto.location,
      },
    })
  }

  async update(id: string, dto: UpdateDeviceDto): Promise<Device> {
    const existing = await this.prisma.device.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Device ${id} not found`)
    return this.prisma.device.update({ where: { id }, data: dto })
  }

  async delete(id: string): Promise<{ ok: true }> {
    const existing = await this.prisma.device.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Device ${id} not found`)
    await this.prisma.device.delete({ where: { id } })
    return { ok: true }
  }

  async getStats(id: string) {
    const device = await this.prisma.device.findUnique({ where: { id } })
    if (!device) throw new NotFoundException(`Device ${id} not found`)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayExams = await this.prisma.exam.count({
      where: { deviceId: id, createdAt: { gte: today } },
    })
    return { todayExams, totalExams: device.todayExams, usageMinutes: device.todayUsageMin }
  }
}
