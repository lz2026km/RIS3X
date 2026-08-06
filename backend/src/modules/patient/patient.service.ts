import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { currentTenantId } from '../../common/tenant/tenant-utils'
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
    const where: any = { deletedAt: null, tenantId: currentTenantId() }
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
    const p = await this.prisma.patient.findFirst({
      where: { id, deletedAt: null, tenantId: currentTenantId() },
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
        tenantId: currentTenantId(),
      },
    })
  }

  async update(id: string, dto: UpdatePatientDto): Promise<Patient> {
    const existing = await this.prisma.patient.findFirst({ where: { id, deletedAt: null } })
    if (!existing) throw new NotFoundException(`Patient ${id} not found`)
    const data: any = { ...dto }
    if (dto.birthDate) data.birthDate = new Date(dto.birthDate)
    return this.prisma.patient.update({ where: { id }, data })
  }

  async delete(id: string): Promise<{ ok: true }> {
    const existing = await this.prisma.patient.findFirst({ where: { id, deletedAt: null } })
    if (!existing) throw new NotFoundException(`Patient ${id} not found`)
    await this.prisma.patient.update({ where: { id }, data: { deletedAt: new Date() } })
    return { ok: true }
  }

  // [W2-4] 患者合并: 事务内将源患者关联 (exam/report/appointment/criticalValue) 迁移至目标患者, 再软删源患者
  async merge(sourceId: string, targetId: string) {
    if (sourceId === targetId) {
      throw new BadRequestException('Cannot merge a patient with itself')
    }
    const [source, target] = await Promise.all([
      this.prisma.patient.findFirst({ where: { id: sourceId, deletedAt: null } }),
      this.prisma.patient.findFirst({ where: { id: targetId, deletedAt: null } }),
    ])
    if (!source) throw new NotFoundException(`Source patient ${sourceId} not found`)
    if (!target) throw new NotFoundException(`Target patient ${targetId} not found`)
    const tenantId = currentTenantId()
    return this.prisma.$transaction(async (tx) => {
      const [movedExams, movedReports, movedAppointments, movedCriticalValues] = await Promise.all([
        tx.exam.updateMany({ where: { patientId: sourceId, tenantId }, data: { patientId: targetId } }),
        tx.report.updateMany({ where: { patientId: sourceId, tenantId }, data: { patientId: targetId } }),
        tx.appointment.updateMany({ where: { patientId: sourceId, tenantId }, data: { patientId: targetId } }),
        tx.criticalValue.updateMany({ where: { patientId: sourceId, tenantId }, data: { patientId: targetId } }),
      ])
      await tx.patient.update({ where: { id: sourceId }, data: { deletedAt: new Date() } })
      return {
        ok: true,
        merged: {
          sourceId,
          targetId,
          movedExams: movedExams.count,
          movedReports: movedReports.count,
          movedAppointments: movedAppointments.count,
          movedCriticalValues: movedCriticalValues.count,
        },
      }
    })
  }

  async getReports(patientId: string) {
    const patient = await this.prisma.patient.findFirst({ where: { id: patientId, deletedAt: null, tenantId: currentTenantId() } })
    if (!patient) throw new NotFoundException(`Patient ${patientId} not found`)
    return this.prisma.report.findMany({
      where: { patientId, tenantId: currentTenantId() },
      orderBy: { createdAt: 'desc' },
      include: { exam: true },
    })
  }

  async getExams(patientId: string) {
    const patient = await this.prisma.patient.findFirst({ where: { id: patientId, deletedAt: null, tenantId: currentTenantId() } })
    if (!patient) throw new NotFoundException(`Patient ${patientId} not found`)
    return this.prisma.exam.findMany({
      where: { patientId, tenantId: currentTenantId() },
      orderBy: { createdAt: 'desc' },
      include: { device: true, reports: true },
    })
  }

  async getTimeline(patientId: string) {
    const patient = await this.prisma.patient.findFirst({ where: { id: patientId, deletedAt: null, tenantId: currentTenantId() } })
    if (!patient) throw new NotFoundException(`Patient ${patientId} not found`)
    const [exams, reports] = await Promise.all([
      this.prisma.exam.findMany({
        where: { patientId, tenantId: currentTenantId() },
        orderBy: { createdAt: 'desc' },
        select: { id: true, modality: true, bodyPart: true, state: true, createdAt: true, scheduledAt: true },
      }),
      this.prisma.report.findMany({
        where: { patientId, tenantId: currentTenantId() },
        orderBy: { createdAt: 'desc' },
        select: { id: true, state: true, findings: true, createdAt: true },
      }),
    ])
    const events = [
      ...exams.map((e) => ({ type: 'exam' as const, id: e.id, modality: e.modality, bodyPart: e.bodyPart, state: e.state, date: (e.scheduledAt ?? e.createdAt)?.toISOString?.() ?? '' })),
      ...reports.map((r) => ({ type: 'report' as const, id: r.id, state: r.state, findings: r.findings?.slice(0, 100) ?? '', date: r.createdAt?.toISOString?.() ?? '' })),
    ].sort((a, b) => (a.date > b.date ? -1 : 1))
    return events
  }
}
