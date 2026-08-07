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

  // [W4-A] 批量导入: 逐条创建 + 冲突跳过 (idCard 或 name+phone 判重), 错误逐条收集
  async importMany(rows: CreatePatientDto[]): Promise<{ imported: number; skipped: number; errors: { index: number; message: string }[] }> {
    const tenantId = currentTenantId()
    const result: { imported: number; skipped: number; errors: { index: number; message: string }[] } = { imported: 0, skipped: 0, errors: [] }
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        if (!row || typeof row !== 'object') {
          result.errors.push({ index: i, message: '第 ' + (i + 1) + ' 行数据为空' })
          continue
        }
        const name = (row.name ?? '').trim()
        if (!name) {
          result.errors.push({ index: i, message: '第 ' + (i + 1) + ' 行: 姓名不能为空' })
          continue
        }
        const gender = normalizeGender(row.gender)
        const phone = row.phone?.trim() || undefined
        const idCard = row.idCard?.trim() || undefined
        const orClauses: any[] = []
        if (idCard) orClauses.push({ idCard })
        if (name && phone) orClauses.push({ name, phone })
        if (orClauses.length > 0) {
          const dup = await this.prisma.patient.findFirst({
            where: { tenantId, deletedAt: null, OR: orClauses },
            select: { id: true },
          })
          if (dup) {
            result.skipped++
            continue
          }
        }
        await this.prisma.patient.create({
          data: {
            name,
            gender,
            birthDate: row.birthDate ? new Date(row.birthDate) : null,
            idCard,
            phone,
            type: row.type ?? 'OUTPATIENT',
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

  // [W4-A] CSV 导出 (全部或按 name/phone 筛选)
  async exportCsv(params: { name?: string; phone?: string } = {}): Promise<{ filename: string; content: string; count: number }> {
    const where: any = { tenantId: currentTenantId(), deletedAt: null }
    if (params.name) where.name = { contains: params.name }
    if (params.phone) where.phone = { contains: params.phone }
    const items = await this.prisma.patient.findMany({ where, orderBy: { createdAt: 'desc' } })
    const header = ['id', 'name', 'gender', 'birthDate', 'idCard', 'phone', 'type', 'state', 'createdAt']
    const esc = (v: unknown) => {
      const s = String(v ?? '')
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
    }
    const lines = [header.join(',')]
    for (const p of items) {
      lines.push(header.map((h) => esc((p as any)[h])).join(','))
    }
    const date = new Date().toISOString().slice(0, 10)
    return { filename: `patients_${date}.csv`, content: '\ufeff' + lines.join('\n'), count: items.length }
  }
}

function normalizeGender(g: string | undefined): 'MALE' | 'FEMALE' | 'OTHER' {
  if (g === 'MALE' || g === '男') return 'MALE'
  if (g === 'FEMALE' || g === '女') return 'FEMALE'
  return 'OTHER'
}
