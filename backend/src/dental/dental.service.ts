import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateDentalStudySchema, UpdateDentalStudySchema, CreateAiFindingSchema, CreateImplantSchema, UpdateImplantSchema, CreateDentalAppointmentSchema, UpdateDentalAppointmentSchema, CreateDentalInvoiceSchema, AddInventoryItemSchema, UpdateInventoryItemSchema } from './dental.schema'
import { z } from 'zod'

type CreateDentalStudyDto = z.infer<typeof CreateDentalStudySchema>
type UpdateDentalStudyDto = z.infer<typeof UpdateDentalStudySchema>
type CreateAiFindingDto = z.infer<typeof CreateAiFindingSchema>
type CreateImplantDto = z.infer<typeof CreateImplantSchema>
type UpdateImplantDto = z.infer<typeof UpdateImplantSchema>
type CreateDentalAppointmentDto = z.infer<typeof CreateDentalAppointmentSchema>
type UpdateDentalAppointmentDto = z.infer<typeof UpdateDentalAppointmentSchema>
type CreateDentalInvoiceDto = z.infer<typeof CreateDentalInvoiceSchema>
type AddInventoryItemDto = z.infer<typeof AddInventoryItemSchema>
type UpdateInventoryItemDto = z.infer<typeof UpdateInventoryItemSchema>

@Injectable()
export class DentalService {
  constructor(private readonly prisma: PrismaService) {}

  private async withSeed<T>(loader: () => Promise<unknown[]>, seed: T[]): Promise<T[]> {
    try {
      const rows = await loader()
      return rows.length > 0 ? (rows as T[]) : seed
    } catch {
      return seed
    }
  }

  private async listStudiesByModality(modality: string) {
    const rows = await this.withSeed(
      () => this.prisma.dentalStudy.findMany({ where: { modality }, orderBy: { createdAt: 'desc' }, take: 50 }),
      [],
    )
    if (rows.length > 0) return { success: true, data: rows }
    const seed = SEED_DENTAL_STUDIES.filter(s => s.modality === modality)
    return { success: true, data: seed }
  }

  async listStudies() {
    const data = await this.prisma.dentalStudy.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async getStudy(id: string) {
    const data = await this.prisma.dentalStudy.findUnique({ where: { id } })
    return { data: data ? [data] : [] }
  }

  async createStudy(body: CreateDentalStudyDto) {
    const data = await this.prisma.dentalStudy.create({ data: body as any })
    return { data: [data] }
  }

  async updateStudy(id: string, body: UpdateDentalStudyDto) {
    const data = await this.prisma.dentalStudy.update({ where: { id }, data: body as any })
    return { data: [data] }
  }

  async deleteStudy(id: string) {
    await this.prisma.dentalStudy.delete({ where: { id } })
    return { data: [] }
  }

  async listAiFindings() {
    const data = await this.prisma.dentalAiFinding.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async createAiFinding(body: CreateAiFindingDto) {
    const data = await this.prisma.dentalAiFinding.create({ data: body as any })
    return { data: [data] }
  }

  async listImplants() {
    const data = await this.prisma.dentalImplant.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async createImplant(body: CreateImplantDto) {
    const data = await this.prisma.dentalImplant.create({ data: body as any })
    return { data: [data] }
  }

  async updateImplant(id: string, body: UpdateImplantDto) {
    const data = await this.prisma.dentalImplant.update({ where: { id }, data: body as any })
    return { data: [data] }
  }

  async listAppointments() {
    const data = await this.prisma.dentalAppointment.findMany({ orderBy: { scheduledAt: 'desc' } })
    return { data }
  }

  async createAppointment(body: CreateDentalAppointmentDto) {
    const data = await this.prisma.dentalAppointment.create({ data: body as any })
    return { data: [data] }
  }

  async updateAppointment(id: string, body: UpdateDentalAppointmentDto) {
    const data = await this.prisma.dentalAppointment.update({ where: { id }, data: body as any })
    return { data: [data] }
  }

  async listInvoices() {
    const data = await this.prisma.dentalInvoice.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async createInvoice(body: CreateDentalInvoiceDto) {
    const data = await this.prisma.dentalInvoice.create({ data: body as any })
    return { data: [data] }
  }

  async listInventory() {
    const data = await this.prisma.dentalInventoryItem.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async addInventoryItem(body: AddInventoryItemDto) {
    const data = await this.prisma.dentalInventoryItem.create({ data: body as any })
    return { data: [data] }
  }

  async updateInventoryItem(id: string, body: UpdateInventoryItemDto) {
    const data = await this.prisma.dentalInventoryItem.update({ where: { id }, data: body as any })
    return { data: [data] }
  }

  // ── [G005-P1] 在用孤儿补齐: 核心 8 个 (DentalStudy/DentalAppointment 表查 + seed) ──
  // 说明: 口腔影像专项列表 (cbct/panoramic/periapical/scan/bitewing) 从 DentalStudy 表按
  //       modality 过滤, 表为空时回退下方 seed (风格与 dentalHandlers.ts 一致)。

  async listCbct() {
    return this.listStudiesByModality('CBCT')
  }

  async listPanoramic() {
    return this.listStudiesByModality('Panoramic')
  }

  async listPeriapical() {
    return this.listStudiesByModality('Periapical')
  }

  async listScan() {
    return this.listStudiesByModality('Scan')
  }

  async listBitewing() {
    return this.listStudiesByModality('Bitewing')
  }

  async compareStudies(idA: string, idB: string) {
    const [a, b] = await Promise.all([this.getStudyOrSeed(idA), this.getStudyOrSeed(idB)])
    return {
      success: true,
      data: {
        idA: a?.id ?? idA,
        idB: b?.id ?? idB,
        modalityA: a?.modality ?? 'unknown',
        modalityB: b?.modality ?? 'unknown',
        samePatient: a?.patientId === b?.patientId,
        differenceScore: a?.patientId === b?.patientId ? 0.15 : 1.0,
        diff: { acquiredA: a?.acquisitionDate ?? null, acquiredB: b?.acquisitionDate ?? null },
      },
    }
  }

  async getStats() {
    const studies = await this.withSeed(
      () => this.prisma.dentalStudy.findMany({ take: 100 }),
      SEED_DENTAL_STUDIES,
    )
    const appointments = await this.withSeed(
      () => this.prisma.dentalAppointment.findMany({ take: 100 }),
      SEED_DENTAL_APPOINTMENTS,
    )
    const byModality: Record<string, number> = {}
    for (const s of studies) byModality[s.modality] = (byModality[s.modality] ?? 0) + 1
    const byStatus: Record<string, number> = {}
    for (const a of appointments) byStatus[a.state ?? 'SCHEDULED'] = (byStatus[a.state ?? 'SCHEDULED'] ?? 0) + 1
    const today = new Date().toISOString().slice(0, 10)
    const todayAppointments = appointments.filter(a => String(a.scheduledAt ?? '').startsWith(today)).length
    return {
      success: true,
      data: {
        totalStudies: studies.length,
        totalAppointments: appointments.length,
        todayAppointments,
        byModality,
        byStatus,
        reportRate: studies.length ? Math.round((studies.filter(s => s.status === 'reported' || s.status === 'COMPLETED').length / studies.length) * 100) : 0,
      },
    }
  }

  async listTreatments(params: { status?: string; patientId?: string; pageSize?: number }) {
    let data = SEED_DENTAL_TREATMENTS
    if (params.status) data = data.filter(t => t.status === params.status)
    if (params.patientId) data = data.filter(t => t.patientId === params.patientId)
    if (params.pageSize) data = data.slice(0, params.pageSize)
    return { success: true, data }
  }

  async listTreatmentTypes() {
    return {
      success: true,
      data: [
        { id: 'T-RST', name: '修复治疗', category: 'Restorative' },
        { id: 'T-ENDO', name: '根管治疗', category: 'Endodontics' },
        { id: 'T-ORTHO', name: '正畸治疗', category: 'Orthodontic' },
        { id: 'T-IMPLANT', name: '种植治疗', category: 'Implant' },
        { id: 'T-PERIO', name: '牙周治疗', category: 'Periodontal' },
      ],
    }
  }

  private async getStudyOrSeed(id: string) {
    try {
      const row = await this.prisma.dentalStudy.findUnique({ where: { id } })
      if (row) return row as any
    } catch {
      // fallthrough to seed
    }
    return SEED_DENTAL_STUDIES.find(s => s.id === id) ?? null
  }
}

// ── [G005-P1] seed: 口腔影像专项 + 治疗计划 (demo 级) ──

export interface DentalStudySeed {
  id: string; patientId: string; patientName: string; modality: string; region: string
  acquisitionDate: string; deviceModel: string; status: string; indications: string; patient: { name: string }
}

const SEED_DENTAL_STUDIES: DentalStudySeed[] = [
  { id: 'DT-1001', patientId: 'PDNT-001', patientName: '钱立军', modality: 'CBCT', region: '右下颌后牙区', acquisitionDate: '2026-07-05T09:30:00.000Z', deviceModel: 'Planmeca ProMax 3D', status: 'reported', indications: '46 种植术前评估', patient: { name: '钱立军' } },
  { id: 'DT-1002', patientId: 'PDNT-002', patientName: '吴玉兰', modality: 'CBCT', region: '上颌前牙区', acquisitionDate: '2026-07-04T10:15:00.000Z', deviceModel: 'Planmeca ProMax 3D', status: 'reviewed', indications: '11/21 阻生牙定位', patient: { name: '吴玉兰' } },
  { id: 'DT-1003', patientId: 'PDNT-003', patientName: '郑晓东', modality: 'Panoramic', region: '全口', acquisitionDate: '2026-07-03T14:40:00.000Z', deviceModel: 'Sirona ORTHOPHOS', status: 'reported', indications: '全口牙周检查', patient: { name: '郑晓东' } },
  { id: 'DT-1004', patientId: 'PDNT-004', patientName: '冯丽华', modality: 'Periapical', region: '36 根尖区', acquisitionDate: '2026-07-02T08:50:00.000Z', deviceModel: 'Carestream RVG', status: 'reported', indications: '36 根管治疗复查', patient: { name: '冯丽华' } },
  { id: 'DT-1005', patientId: 'PDNT-005', patientName: '褚一鸣', modality: 'Scan', region: '上颌全牙弓', acquisitionDate: '2026-07-01T11:20:00.000Z', deviceModel: '3Shape TRIOS 5', status: 'reported', indications: '正畸取模', patient: { name: '褚一鸣' } },
  { id: 'DT-1006', patientId: 'PDNT-006', patientName: '卫晓霞', modality: 'Bitewing', region: '双侧后牙邻面', acquisitionDate: '2026-06-30T15:05:00.000Z', deviceModel: 'Sirona HELIODENT', status: 'reviewed', indications: '邻面龋筛查', patient: { name: '卫晓霞' } },
]

export interface DentalAppointmentSeed {
  id: string; patientId: string; patientName: string; dentistName: string; modality: string
  scheduledAt: string; state: string; notes: string
}

const SEED_DENTAL_APPOINTMENTS: DentalAppointmentSeed[] = [
  { id: 'DAPT-2001', patientId: 'PDNT-001', patientName: '钱立军', dentistName: '周大夫', modality: 'Implant', scheduledAt: new Date().toISOString(), state: 'SCHEDULED', notes: '46 种植二期手术' },
  { id: 'DAPT-2002', patientId: 'PDNT-003', patientName: '郑晓东', dentistName: '李大夫', modality: 'Periodontal', scheduledAt: new Date(Date.now() + 86400000).toISOString(), state: 'SCHEDULED', notes: '牙周洁治' },
  { id: 'DAPT-2003', patientId: 'PDNT-004', patientName: '冯丽华', dentistName: '王大夫', modality: 'Endodontics', scheduledAt: new Date(Date.now() + 2 * 86400000).toISOString(), state: 'CONFIRMED', notes: '36 根管充填' },
]

export interface DentalTreatmentSeed {
  id: string; patientId: string; patientName: string; type: string; toothNo: string
  status: string; plan: string; createdAt: string; doctorName: string
}

const SEED_DENTAL_TREATMENTS: DentalTreatmentSeed[] = [
  { id: 'T-3001', patientId: 'PDNT-001', patientName: '钱立军', type: '种植治疗', toothNo: '46', status: 'in_progress', plan: '46 种植体植入 (Straumann BLT 4.8×10mm)', createdAt: '2026-07-01T09:00:00.000Z', doctorName: '周大夫' },
  { id: 'T-3002', patientId: 'PDNT-004', patientName: '冯丽华', type: '根管治疗', toothNo: '36', status: 'in_progress', plan: '36 根管再治疗', createdAt: '2026-06-28T14:00:00.000Z', doctorName: '王大夫' },
  { id: 'T-3003', patientId: 'PDNT-005', patientName: '褚一鸣', type: '正畸治疗', toothNo: '全口', status: 'pending', plan: '隐形矫治方案评估', createdAt: '2026-07-02T10:00:00.000Z', doctorName: '李大夫' },
  { id: 'T-3004', patientId: 'PDNT-003', patientName: '郑晓东', type: '牙周治疗', toothNo: '全口', status: 'completed', plan: '牙周基础治疗', createdAt: '2026-06-20T09:00:00.000Z', doctorName: '李大夫' },
]
