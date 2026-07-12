import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { getCurrentTenantId } from '../../common/interceptors/tenant-context.interceptor'
import type { Patient } from '@prisma/client'

export interface CreatePatientDto {
  name: string
  gender: 'MALE' | 'FEMALE' | 'OTHER'
  birthDate?: string
  idCard?: string
  phone?: string
  type?: 'OUTPATIENT' | 'INPATIENT' | 'EMERGENCY' | 'PHYSICAL'
}

export interface UpdatePatientDto {
  name?: string
  gender?: 'MALE' | 'FEMALE' | 'OTHER'
  birthDate?: string
  idCard?: string
  phone?: string
  type?: 'OUTPATIENT' | 'INPATIENT' | 'EMERGENCY' | 'PHYSICAL'
}

@Injectable()
export class PatientService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: { skip?: number; take?: number; name?: string; phone?: string }) {
    const where: any = {}
    if (params.name) where.name = { contains: params.name }
    if (params.phone) where.phone = { contains: params.phone }
    const [items, total] = await Promise.all([
      this.prisma.patient.findMany({
        where,
        skip: params.skip ?? 0,
        take: params.take ?? 50,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.patient.count({ where }),
    ])
    return { items, total }
  }

  async get(id: string): Promise<Patient> {
    const p = await this.prisma.patient.findUnique({
      where: { id },
      include: { reports: true, exams: true },
    })
    if (!p) throw new NotFoundException(`Patient ${id} not found`)
    return p
  }

  async create(dto: CreatePatientDto): Promise<Patient> {
    return this.prisma.patient.create({
      data: {
        name: dto.name,
        gender: dto.gender,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        idCard: dto.idCard,
        phone: dto.phone,
        type: dto.type ?? 'OUTPATIENT',
        tenantId: getCurrentTenantId(),
      },
    })
  }

  async update(id: string, dto: UpdatePatientDto): Promise<Patient> {
    const existing = await this.prisma.patient.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Patient ${id} not found`)
    const data: any = { ...dto }
    if (dto.birthDate) data.birthDate = new Date(dto.birthDate)
    return this.prisma.patient.update({ where: { id }, data })
  }

  async delete(id: string): Promise<{ ok: true }> {
    const existing = await this.prisma.patient.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Patient ${id} not found`)
    await this.prisma.patient.delete({ where: { id } })
    return { ok: true }
  }

  async getReports(patientId: string) {
    const patient = await this.prisma.patient.findUnique({ where: { id: patientId } })
    if (!patient) throw new NotFoundException(`Patient ${patientId} not found`)
    return this.prisma.report.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
      include: { exam: true },
    })
  }
}
