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

  // ── [G005 Wave1A P0] 收费/划价/医保 (DentalBillingPage, /dental/billing/*) ──
  // 静态收费字典 + 支付方式字典 (确定性 seed); 账单走内存 store (与 MSW dentalBillingModule 形状对齐)

  getFeeCatalog() {
    return { success: true, data: SEED_FEE_CATALOG }
  }

  getPaymentMethods() {
    return { success: true, data: SEED_PAYMENT_METHODS }
  }

  listBillingInvoices(patientId?: string) {
    let list = BILLING_INVOICES_STORE
    if (patientId) list = list.filter((inv) => inv.patientId === patientId)
    return { success: true, data: list }
  }

  createBillingInvoice(body: Record<string, unknown>) {
    const items = Array.isArray(body.items) ? body.items : []
    const total = items.reduce((s: number, i: any) => s + Number(i.unitPrice ?? i.amount ?? 0) * Number(i.qty ?? i.quantity ?? 1), 0)
    const invoice = {
      id: `INV-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(BILLING_INVOICES_STORE.length + 1).padStart(3, '0')}`,
      patientId: String(body.patientId ?? ''),
      patientName: String(body.patientName ?? ''),
      date: new Date().toISOString().slice(0, 10),
      items: items.map((i: any) => ({ code: i.code ?? 'GEN', name: i.name ?? '口腔诊疗', qty: Number(i.qty ?? i.quantity ?? 1), unitPrice: Number(i.unitPrice ?? i.amount ?? 0), discount: 0 })),
      total,
      insuranceType: '城镇职工',
      insuranceCover: Math.round(total * 0.4),
      selfPay: Math.round(total * 0.6),
      discountTotal: 0,
      copay: 0,
      status: 'pending',
      paidAt: null,
      paymentMethod: null,
      createdAt: new Date().toISOString(),
    }
    BILLING_INVOICES_STORE.unshift(invoice)
    return { success: true, data: invoice }
  }

  payBillingInvoice(id: string, body: { paymentMethod?: string; transactionId?: string; outTradeNo?: string }) {
    const inv = BILLING_INVOICES_STORE.find((x) => x.id === id)
    if (!inv) return { success: false, error: { code: 'NOT_FOUND', message: `Invoice ${id} not found` } }
    inv.status = 'paid'
    inv.paidAt = new Date().toISOString()
    inv.paymentMethod = body.paymentMethod ?? 'cash'
    inv.transactionId = body.transactionId
    inv.outTradeNo = body.outTradeNo
    return { success: true, data: { id, status: 'paid', paidAt: inv.paidAt, paymentMethod: inv.paymentMethod } }
  }

  verifyInsurance(body: { patientId?: string; insuranceType?: string; feeTotal?: number }) {
    const feeTotal = Number(body.feeTotal ?? 0)
    return {
      success: true,
      data: {
        verified: true,
        insuranceCover: Math.round(feeTotal * 0.4),
        selfPay: Math.round(feeTotal * 0.6),
        recommendation: '建议使用城镇职工医保+补充医疗',
        items: [
          { category: '甲类', total: 120, ratio: 0.8, cover: 96 },
          { category: '乙类', total: 2000, ratio: 0.6, cover: 1200 },
          { category: '丙类', total: 8000, ratio: 0, cover: 0 },
        ],
      },
    }
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

  // [G005 W3-A] 补缺: 全景片 / 根尖片单条详情 (DentalStudy 表 + seed, 与 list* 同源)
  async getPanoramic(id: string) {
    const row = await this.getStudyOrSeed(id)
    if (!row || row.modality !== 'Panoramic') {
      return { success: false, error: { code: 'NOT_FOUND', message: `Panoramic ${id} not found` } }
    }
    return { success: true, data: row }
  }

  async getPeriapical(id: string) {
    const row = await this.getStudyOrSeed(id)
    if (!row || row.modality !== 'Periapical') {
      return { success: false, error: { code: 'NOT_FOUND', message: `Periapical ${id} not found` } }
    }
    return { success: true, data: row }
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
    let data = DENTAL_TREATMENTS_STORE
    if (params.status) data = data.filter(t => t.status === params.status)
    if (params.patientId) data = data.filter(t => t.patientId === params.patientId)
    if (params.pageSize) data = data.slice(0, params.pageSize)
    return { success: true, data }
  }

  async getTreatment(id: string) {
    const t = DENTAL_TREATMENTS_STORE.find(x => x.id === id)
    if (!t) return { success: false, error: { code: 'NOT_FOUND' } }
    return { success: true, data: t }
  }

  async createTreatment(body: Record<string, unknown>) {
    const item: any = { id: `T-${Date.now()}`, ...body, createdAt: new Date().toISOString() }
    DENTAL_TREATMENTS_STORE.unshift(item)
    return { success: true, data: item }
  }

  async updateTreatment(id: string, body: Record<string, unknown>) {
    const idx = DENTAL_TREATMENTS_STORE.findIndex(x => x.id === id)
    if (idx < 0) return { success: false, error: { code: 'NOT_FOUND' } }
    DENTAL_TREATMENTS_STORE[idx] = { ...DENTAL_TREATMENTS_STORE[idx], ...body, updatedAt: new Date().toISOString() }
    return { success: true, data: DENTAL_TREATMENTS_STORE[idx] }
  }

  async startTreatment(id: string) {
    const t = DENTAL_TREATMENTS_STORE.find(x => x.id === id)
    if (!t) return { success: false, error: { code: 'NOT_FOUND' } }
    t.status = 'in_progress'
    return { success: true, data: { id, status: 'InProgress', startedAt: new Date().toISOString() } }
  }

  async completeTreatment(id: string) {
    const t = DENTAL_TREATMENTS_STORE.find(x => x.id === id)
    if (!t) return { success: false, error: { code: 'NOT_FOUND' } }
    t.status = 'completed'
    return { success: true, data: { id, status: 'Completed', completedAt: new Date().toISOString() } }
  }

  // ── [G005 W1-A] 牙椅排班 / 患者 / 医生 (DentalSchedulePage 在用) ──

  async listScheduleChairs() {
    return { success: true, data: SEED_DENTAL_CHAIRS }
  }

  async listScheduleAppointments(date?: string) {
    const d = date || new Date().toISOString().slice(0, 10)
    const data = generateMockScheduleAppointments(d)
    return { success: true, data, meta: { date: d, total: data.length } }
  }

  // [G005 W3-A] 补缺: 单条排班预约 (DentalAppointment 表 + seed)
  async getScheduleAppointment(id: string) {
    try {
      const row = await this.prisma.dentalAppointment.findUnique({ where: { id } })
      if (row) return { success: true, data: row }
    } catch {
      // fallthrough to seed
    }
    const seeded = SEED_DENTAL_APPOINTMENTS.find(a => a.id === id)
    if (seeded) return { success: true, data: seeded }
    const generated = generateMockScheduleAppointments(new Date().toISOString().slice(0, 10)).find(a => a.id === id)
    if (generated) return { success: true, data: generated }
    return { success: false, error: { code: 'NOT_FOUND', message: `Appointment ${id} not found` } }
  }

  async createScheduleAppointment(body: Record<string, unknown>) {
    const item = {
      id: `APT-${Date.now()}`,
      time: (body.time as string) ?? '09:00',
      patientId: body.patientId as string,
      patientName: body.patientName as string,
      chairId: body.chairId as string,
      chairName: (body.chairName as string) ?? '1号椅',
      dentist: (body.dentist as string) ?? '周大夫',
      type: (body.type as string) ?? '初诊',
      status: (body.status as string) ?? 'scheduled',
      createdAt: new Date().toISOString(),
    }
    return { success: true, data: item }
  }

  async updateScheduleAppointmentStatus(id: string, body: { status?: string }) {
    return { success: true, data: { id, status: body.status ?? 'scheduled', updatedAt: new Date().toISOString() } }
  }

  async getScheduleStats() {
    const today = new Date().toISOString().slice(0, 10)
    const appts = generateMockScheduleAppointments(today)
    return {
      success: true,
      data: {
        todayAppointments: appts.length,
        completed: appts.filter(a => a.status === 'completed').length,
        inProgress: appts.filter(a => a.status === 'in-progress').length,
        noShow: appts.filter(a => a.status === 'no-show').length,
        chairUtilization: 0.68,
        avgWaitTime: 15,
      },
    }
  }

  async listDentalPatients() {
    const rows = await this.withSeed(
      () => this.prisma.patient.findMany({ select: { id: true, name: true }, take: 200, orderBy: { createdAt: 'desc' } }),
      [],
    )
    const data = rows.length > 0 ? rows : SEED_DENTAL_PATIENTS
    return { success: true, data, meta: { total: data.length } }
  }

  async listDentists() {
    return { success: true, data: SEED_DENTAL_DENTISTS }
  }

  // ── [G005 W2-A P0] 患者 360° 视图 7 端点 (DentalEmrPage 在用; 形状对齐 dentalHandlers dentalEmrModule / dentalEmrMock) ──
  // 汇总: 患者基本信息 (prisma patient → 映射, 缺失演示字段 seed 兜底) + 派生统计

  private isEmrDemoPatient(patientId: string): boolean {
    return EMR_DEMO_IDS.includes(patientId)
  }

  private async findEmrPatient(patientId: string): Promise<any | null> {
    const demo = SEED_EMR_PATIENTS.find((x) => x.id === patientId)
    try {
      const p = await this.prisma.patient.findUnique({ where: { id: patientId } })
      if (p) {
        const age = p.birthDate
          ? Math.max(0, Math.floor((Date.now() - new Date(p.birthDate).getTime()) / (365.25 * 86400_000)))
          : demo?.age ?? 0
        return {
          ...(demo ?? {}),
          id: p.id,
          name: p.name,
          gender: p.gender === 'MALE' ? 'M' : 'F',
          age,
          phone: p.phone ?? demo?.phone ?? '',
        }
      }
    } catch {
      // DB 不可用 → 回退 seed
    }
    return demo ?? null
  }

  async getPatientOverview(patientId: string) {
    const patient = await this.findEmrPatient(patientId)
    if (!patient) {
      return { success: false, error: { code: 'NOT_FOUND', message: `Patient ${patientId} not found` } }
    }
    const [treatments, appts, bills] = await Promise.all([
      this.getPatientOverviewTreatments(patientId),
      this.getPatientOverviewAppointments(patientId),
      this.getPatientOverviewBilling(patientId),
    ])
    const summary = {
      treatments: treatments.data.length,
      appointments: appts.data.filter((a: any) => a.status !== 'completed').length,
      unpaid: bills.data.filter((b: any) => b.status !== 'paid').reduce((s: number, b: any) => s + Number(b.selfPay ?? 0), 0),
    }
    return { success: true, data: { ...patient, summary } }
  }

  async getPatientOverviewTreatments(patientId: string) {
    const fromStore = DENTAL_TREATMENTS_STORE
      .filter((t: any) => t.patientId === patientId)
      .map((t: any) => ({
        id: t.id,
        date: String(t.createdAt ?? '').slice(0, 10),
        type: t.type ?? 'Examination',
        toothNo: t.toothNo === '全口' || t.toothNo === '0' ? 0 : Number(t.toothNo ?? 0),
        description: t.plan ?? '',
        dentist: t.doctorName ?? '',
        cost: 0,
        insurancePaid: 0,
        patientPaid: 0,
      }))
    if (fromStore.length > 0) return { success: true, data: fromStore }
    if (this.isEmrDemoPatient(patientId)) return { success: true, data: SEED_EMR_TREATMENTS }
    return { success: true, data: [] }
  }

  async getPatientOverviewAppointments(patientId: string) {
    try {
      const rows = await this.prisma.dentalAppointment.findMany({ where: { patientId } as any })
      if (rows.length > 0) {
        return {
          success: true,
          data: rows.map((a: any) => {
            const dt = a.scheduledAt ? new Date(a.scheduledAt) : null
            return {
              id: a.id,
              date: dt ? dt.toISOString().slice(0, 10) : '',
              time: dt ? `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}` : '',
              type: a.modality ?? '复诊',
              toothNo: '0',
              description: a.notes ?? '',
              dentist: a.dentistName ?? '',
              chair: '',
              status: ({ SCHEDULED: 'scheduled', CONFIRMED: 'scheduled', COMPLETED: 'completed', CANCELLED: 'cancelled' } as Record<string, string>)[a.state ?? 'SCHEDULED'] ?? 'scheduled',
            }
          }),
        }
      }
    } catch {
      // DB 不可用 → 回退 seed
    }
    if (this.isEmrDemoPatient(patientId)) return { success: true, data: SEED_EMR_APPOINTMENTS }
    return { success: true, data: [] }
  }

  async getPatientOverviewBilling(patientId: string) {
    const fromInvoices = BILLING_INVOICES_STORE
      .filter((inv: any) => inv.patientId === patientId)
      .map((inv: any) => ({
        id: inv.id,
        date: inv.date,
        items: (inv.items ?? []).map((i: any) => ({ name: i.name ?? '口腔诊疗', qty: Number(i.qty ?? 1), price: Number(i.unitPrice ?? i.amount ?? 0) })),
        total: Number(inv.total ?? 0),
        insurance: Number(inv.insuranceCover ?? 0),
        selfPay: Number(inv.selfPay ?? 0),
        status: ({ paid: 'paid', partial: 'partial' } as Record<string, string>)[inv.status ?? ''] ?? 'pending',
      }))
    if (fromInvoices.length > 0) return { success: true, data: fromInvoices }
    if (this.isEmrDemoPatient(patientId)) return { success: true, data: SEED_EMR_BILLING }
    return { success: true, data: [] }
  }

  async getPatientOverviewPrescriptions(patientId: string) {
    if (!this.isEmrDemoPatient(patientId)) return { success: true, data: [] }
    return { success: true, data: SEED_EMR_PRESCRIPTIONS }
  }

  async getPatientOverviewConsents(patientId: string) {
    if (!this.isEmrDemoPatient(patientId)) return { success: true, data: [] }
    return { success: true, data: SEED_EMR_CONSENTS }
  }

  async getPatientOverviewRecalls(patientId: string) {
    if (!this.isEmrDemoPatient(patientId)) return { success: true, data: [] }
    return { success: true, data: SEED_EMR_RECALLS }
  }

  // ── [G005 W1-A] PSR 牙周记录 (DentalSchedulePage 原始 fetch 在用) ──

  async listPsrRecords(patientId: string) {
    return { success: true, data: SEED_PSR_RECORDS.filter(r => r.patientId === patientId) }
  }

  async createPsrRecord(patientId: string, body: Record<string, unknown>) {
    const item = { id: `PSR-${Date.now()}`, patientId, ...body, createdAt: new Date().toISOString() }
    SEED_PSR_RECORDS.unshift(item as any)
    return { success: true, data: item }
  }

  // [G005 W3-A] 补缺: 患者牙位图 (FDI 32 牙, 由 DentalStudy 表驱动 + seed, ToothChartPage 在用)
  async getDentalChart(patientId: string) {
    const FDI_TEETH = [
      11,12,13,14,15,16,17,18, 21,22,23,24,25,26,27,28,
      31,32,33,34,35,36,37,38, 41,42,43,44,45,46,47,48,
    ]
    const SURFACES = ['O', 'M', 'D', 'B', 'L']
    const STATUSES = ['Healthy', 'Caries', 'Restored', 'Missing', 'Crown', 'RootCanal', 'Implant', 'Partial']
    const teeth: Record<number, any> = {}
    FDI_TEETH.forEach((t, i) => {
      const h = (i * 7 + t * 13) % STATUSES.length
      const status = STATUSES[h]
      const surfaces: Record<string, string> = {}
      for (const s of SURFACES) surfaces[s] = status === 'Healthy' ? 'Healthy' : h % 2 === 0 ? 'Restored' : 'Caries-Moderate'
      teeth[t] = {
        toothNo: t,
        status,
        surfaces,
        cariesGrade: status === 'Caries' ? `ICDAS-${(h % 5) + 1}` : undefined,
        periodontal: (t % 3) === 0 ? { pd: 2 + (h % 5), cal: h % 4, bop: h % 2 === 1, mob: h % 3, furcation: h % 4 } : undefined,
        notes: '',
      }
    })
    let patientName = ''
    try {
      const p = await this.prisma.patient.findUnique({ where: { id: patientId } })
      if (p) patientName = p.name ?? ''
    } catch { /* ignore */ }
    if (!patientName) {
      const seedStudy = SEED_DENTAL_STUDIES.find(s => s.patientId === patientId)
      if (seedStudy) patientName = seedStudy.patientName
      else {
        const seedPatient = SEED_DENTAL_PATIENTS.find(p => p.id === patientId)
        if (seedPatient) patientName = seedPatient.name
      }
    }
    const chart = {
      patientId,
      patientName,
      age: 42,
      teeth,
      numberingSystem: 'FDI',
      createdAt: new Date(Date.now() - 30 * 86400_000).toISOString(),
      updatedAt: new Date().toISOString(),
    }
    return { success: true, data: chart }
  }

  // ── [G005 W1-A] 跨科室转诊 (DentalRadFusionPages 在用) ──

  async listReferrals() {
    return { success: true, data: DENTAL_REFERRALS, meta: { total: DENTAL_REFERRALS.length } }
  }

  async createReferral(body: Record<string, unknown>) {
    const item = {
      id: `REF-${Date.now()}`,
      patientId: (body.patientId as string) ?? 'P100001',
      patient: (body.patient as string) ?? '张伟',
      source: (body.source as string) ?? '口腔科',
      target: (body.target as string) ?? '放射科',
      reason: (body.reason as string) ?? '种植术前 CBCT 检查',
      doctor: (body.doctor as string) ?? '当前医生',
      status: 'pending',
      createdAt: new Date().toISOString(),
    }
    DENTAL_REFERRALS.unshift(item)
    return { success: true, data: item }
  }

  async acceptReferral(id: string) {
    const item = DENTAL_REFERRALS.find((r: any) => r.id === id)
    if (!item) return { success: false, error: { code: 'NOT_FOUND' } }
    item.status = 'accepted'
    item.acceptedAt = new Date().toISOString()
    return { success: true, data: item }
  }

  // ── [G005 W1-A] 远程口腔会诊 (DentalTelePage 在用) ──

  async listTeleSessions() {
    return { success: true, data: DENTAL_TELE_SESSIONS, meta: { total: DENTAL_TELE_SESSIONS.length } }
  }

  async createTeleSession(body: Record<string, unknown>) {
    const session = {
      id: `TEL-${Date.now()}`,
      title: (body.title as string) ?? '口腔远程会诊',
      patientId: (body.patientId as string) ?? 'P100001',
      patientName: (body.patientName as string) ?? '张伟',
      expert: (body.expert as string) ?? '王专家(种植)',
      reason: (body.reason as string) ?? '',
      status: (body.status as string) ?? 'waiting',
      hostDoctor: (body.hostDoctor as string) ?? '当前医生',
      participants: (body.participants as any[]) ?? [],
      createdAt: new Date().toISOString(),
    }
    DENTAL_TELE_SESSIONS.unshift(session)
    return { success: true, data: session }
  }

  async endTeleSession(id: string) {
    const idx = DENTAL_TELE_SESSIONS.findIndex((s: any) => s.id === id)
    if (idx < 0) return { success: false, error: { code: 'NOT_FOUND' } }
    DENTAL_TELE_SESSIONS.splice(idx, 1)
    return { success: true, data: { id, deleted: true } }
  }

  // ── [G005 W1-A] CAD/CAM (DentalCadPage 在用) ──

  async getCadMaterials() {
    return { success: true, data: SEED_CAD_MATERIALS }
  }

  async getCadShades() {
    return { success: true, data: SEED_VITA_SHADES }
  }

  async getCadMillingUnits() {
    return { success: true, data: SEED_MILLING_UNITS }
  }

  async getCadTemplates() {
    return { success: true, data: SEED_CAD_TEMPLATES }
  }

  async createCadDesign(body: Record<string, unknown>) {
    const item: any = {
      id: `CAD-${Date.now()}`,
      ...body,
      marginLine: Array.from({ length: 12 }, (_, i) => [200 + Math.sin(i / 12 * Math.PI * 2) * 30, 200 + Math.cos(i / 12 * Math.PI * 2) * 30]),
      occlusalAnatomy: 'anatomic', thickness: 1.5, cementGap: 30, contactStrength: 'normal',
      status: 'draft', designTime: 0, designer: 'Dr. CAD',
      createdAt: new Date().toISOString(),
    }
    CAD_DESIGNS_STORE.unshift(item)
    return { success: true, data: item }
  }

  async getCadDesign(id: string) {
    const d = CAD_DESIGNS_STORE.find(x => x.id === id)
    if (!d) return { success: false, error: { code: 'NOT_FOUND' } }
    return { success: true, data: d }
  }

  async listCadDesigns(patientId?: string) {
    let items = CAD_DESIGNS_STORE
    if (patientId) items = items.filter((d: any) => d.patientId === patientId)
    return { success: true, data: items, meta: { total: items.length } }
  }

  async saveMarginLine(id: string, body: { marginLine?: number[][] }) {
    const d = CAD_DESIGNS_STORE.find(x => x.id === id)
    if (!d) return { success: false, error: { code: 'NOT_FOUND' } }
    d.marginLine = body.marginLine ?? []
    d.updatedAt = new Date().toISOString()
    return { success: true, data: { id, marginLine: d.marginLine, updatedAt: d.updatedAt } }
  }

  async saveAnatomy(id: string, body: Record<string, unknown>) {
    const d = CAD_DESIGNS_STORE.find(x => x.id === id)
    if (!d) return { success: false, error: { code: 'NOT_FOUND' } }
    Object.assign(d, body, { updatedAt: new Date().toISOString() })
    return { success: true, data: { id, ...body, updatedAt: d.updatedAt } }
  }

  async previewCadDesign(id: string) {
    return {
      success: true,
      data: {
        id,
        previewUrl: `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`,
        stlUrl: `/api/v1/dental/cad/design/${id}/model.stl`,
        triangleCount: 18500,
        volume: 0.28,
        facets: ['occlusal', 'buccal', 'lingual', 'mesial', 'distal'].map(f => ({ facet: f, quality: 'good' })),
      },
    }
  }

  async exportCadStl(id: string) {
    return { success: true, data: { url: `/api/v1/dental/cad/design/${id}/model.stl`, format: 'STL', size: '1.2 MB' } }
  }

  async updateCadStatus(id: string, body: { status?: string }) {
    const d = CAD_DESIGNS_STORE.find(x => x.id === id)
    if (!d) return { success: false, error: { code: 'NOT_FOUND' } }
    d.status = body.status ?? d.status
    d.updatedAt = new Date().toISOString()
    return { success: true, data: { id, status: d.status, updatedAt: d.updatedAt } }
  }

  async submitMill(id: string, body: { millingUnit?: string }) {
    const d = CAD_DESIGNS_STORE.find(x => x.id === id)
    if (!d) return { success: false, error: { code: 'NOT_FOUND' } }
    d.status = 'milling'
    d.updatedAt = new Date().toISOString()
    return { success: true, data: { id, millingUnit: body.millingUnit, submittedAt: new Date().toISOString(), estimatedTime: '15min', status: 'milling' } }
  }

  // ── [G005 W1-A] 种植 3D 规划 (DentalImplant3DPage / DentalImplantPlanPage 在用) ──

  async getImplantBrands() {
    return {
      success: true,
      data: SEED_IMPLANT_BRANDS.map(b => ({ id: b.id, name: b.name, country: b.country, modelCount: b.models.length })),
    }
  }

  async getImplantModels(brandId?: string, toothNo?: number) {
    const models = brandId
      ? (SEED_IMPLANT_BRANDS.find(b => b.id === brandId)?.models ?? [])
      : SEED_IMPLANT_BRANDS.flatMap(b => b.models)
    return { success: true, data: models.map((m: any) => ({ ...m, brandId, toothNo })) }
  }

  async getGuideSleeves(brand?: string) {
    const data = SEED_GUIDE_SLEEVES.filter(s => !brand || s.brand === brand)
    return { success: true, data }
  }

  async createImplantPlan3d(body: Record<string, unknown>) {
    const item: any = {
      id: `IMP3D-${Date.now()}`,
      ...body,
      entryPoint: { x: 150, y: 120, z: 80 },
      apexPoint: { x: 148, y: 109, z: 30 },
      distanceToNerve: 3.5, boneDensityAtApex: 800,
      status: 'planning', guideDesigned: false,
      createdAt: new Date().toISOString(),
    }
    IMPLANT_PLANS_3D_STORE.unshift(item)
    return { success: true, data: item }
  }

  async getImplantPlan3d(id: string) {
    const p = IMPLANT_PLANS_3D_STORE.find(x => x.id === id)
    if (!p) return { success: false, error: { code: 'NOT_FOUND' } }
    return { success: true, data: p }
  }

  async listImplantPlans3d() {
    return { success: true, data: IMPLANT_PLANS_3D_STORE }
  }

  async updateImplantPlacement(id: string, body: Record<string, unknown>) {
    const p = IMPLANT_PLANS_3D_STORE.find(x => x.id === id)
    if (!p) return { success: false, error: { code: 'NOT_FOUND' } }
    Object.assign(p, body, { updatedAt: new Date().toISOString() })
    return { success: true, data: { id, ...body, updatedAt: p.updatedAt } }
  }

  async updateImplantModel(id: string, body: { brand?: string; model?: string }) {
    const p = IMPLANT_PLANS_3D_STORE.find(x => x.id === id)
    if (!p) return { success: false, error: { code: 'NOT_FOUND' } }
    if (body.brand) p.brand = body.brand
    if (body.model) p.model = body.model
    return { success: true, data: { id, brand: p.brand, model: p.model, updatedAt: new Date().toISOString() } }
  }

  async getImplantNerveDistance(id: string) {
    const plan = IMPLANT_PLANS_3D_STORE.find(x => x.id === id)
    return {
      success: true,
      data: {
        distances: SEED_NERVE_DISTANCES,
        nervePath: SEED_NERVE_3D,
        closestNerve: { distance: plan?.distanceToNerve || 3.2, safe: (plan?.distanceToNerve || 3.2) > 2, position: { x: 150, y: 115, z: 35 } },
      },
    }
  }

  async getImplantBoneDensityRoi(id: string, body: Record<string, unknown>) {
    return {
      success: true,
      data: {
        studyId: id,
        roi: body.roi || { x: 145, y: 110, z: 30, radius: 3 },
        ...SEED_BONE_DENSITY_MAP,
      },
    }
  }

  async markImplantNerve(id: string, body: { points?: unknown[] }) {
    return { success: true, data: { planId: id, markedPoints: body.points ?? [] } }
  }

  async validateImplantPlan(_id: string) {
    return {
      success: true,
      data: { valid: true, collision: false, minDistanceToNerve: 3.2, warnings: [], decisions: [{ key: '36 distal bone', action: '注意远中骨量', severity: 'info' }] },
    }
  }

  async approveImplantPlan(id: string) {
    const p = IMPLANT_PLANS_3D_STORE.find(x => x.id === id)
    if (!p) return { success: false, error: { code: 'NOT_FOUND' } }
    p.status = 'approved'
    return { success: true, data: { id, status: 'approved', approvedAt: new Date().toISOString() } }
  }

  // ── [G005 W1-A] 导板 (DentalGuidePage 在用) ──

  async getGuideMaterials() {
    return { success: true, data: SEED_GUIDE_MATERIALS }
  }

  async listSurgicalGuides() {
    return { success: true, data: SEED_SURGICAL_GUIDES }
  }

  async createSurgicalGuide(body: Record<string, unknown>) {
    const item: any = { id: `GUIDE-${Date.now()}`, ...body, status: 'designing', createdAt: new Date().toISOString() }
    SEED_SURGICAL_GUIDES.unshift(item)
    return { success: true, data: item }
  }

  /**
   * [v3.0.6.11-92 Wave2A P1] 导板套筒配置: PUT /dental/guide/:id/sleeve
   * { sleeveType, diameter, height, angle } 内存 store + seed 更新; 记录不存在返回 NOT_FOUND
   */
  async updateGuideSleeve(id: string, body: { sleeveType?: string; diameter?: number; height?: number; angle?: number }) {
    const guide: any = SEED_SURGICAL_GUIDES.find(g => g.id === id)
    if (!guide) return { success: false, error: { code: 'NOT_FOUND', message: `Surgical guide ${id} not found` } }
    if (body.sleeveType !== undefined) guide.sleeveType = String(body.sleeveType)
    if (body.diameter !== undefined) guide.diameter = Number(body.diameter)
    if (body.height !== undefined) guide.height = Number(body.height)
    if (body.angle !== undefined) guide.angle = Number(body.angle)
    guide.updatedAt = new Date().toISOString()
    return {
      success: true,
      data: { id, sleeveType: guide.sleeveType, diameter: guide.diameter, height: guide.height, angle: guide.angle, updatedAt: guide.updatedAt },
    }
  }

  async exportSurgicalGuide(id: string) {
    return { success: true, data: { url: `/dental/guides/${id}.stl`, format: 'STL', size: '3.5 MB', estimatedPrintTime: '4h' } }
  }

  // ── [G005 W1-A] 口扫模型 (Scan3DViewerPage 在用) ──

  async getScanModel(id: string) {
    return { success: true, data: { modelUrl: `/api/v1/dental/scan/${id}/model.stl`, format: 'STL' } }
  }

  // ── [G005 W1-A] 口腔 AI 检测 (DentalAIPage 在用, 演示级) ──

  async detectCaries() {
    return {
      success: true,
      data: {
        detections: [
          { toothNo: '16', surface: 'O', confidence: 0.88, severity: 'moderate', bbox: [100, 80, 180, 150] },
          { toothNo: '36', surface: 'M', confidence: 0.75, severity: 'mild', bbox: [280, 90, 350, 160] },
          { toothNo: '24', surface: 'O', confidence: 0.62, severity: 'incipient', bbox: [200, 70, 260, 140] },
        ],
        analysisTimeMs: 450,
        model: 'dental-yolov8n-v1.3',
        method: 'backend-mock',
      },
    }
  }

  async gradePeriapical() {
    return {
      success: true,
      data: {
        periapicalIndex: 2.5,
        rcpScore: 7,
        lesions: [{ toothNo: '36', region: 'mesial-root', diameter: 4.2, unit: 'mm', stage: 'RCP-stage-2' }],
        confidence: 0.82,
      },
    }
  }

  async measureBoneLoss() {
    return {
      success: true,
      data: {
        boneLoss: { maxilla: 15, mandible: 22, unit: '%' },
        furcationInvolvements: ['36-buccal', '37-mesial'],
        confidence: 0.78,
      },
    }
  }

  async detectRootCanal() {
    return {
      success: true,
      data: {
        canals: [
          { toothNo: '36', canalCount: 3, filled: 2, missed: 'mesiolingual', difficulty: 'moderate' },
          { toothNo: '46', canalCount: 2, filled: 2, missed: null, difficulty: 'easy' },
        ],
      },
    }
  }

  async screenOralCavity() {
    return {
      success: true,
      data: {
        findings: [
          { location: '左侧颊黏膜', type: 'leukoplakia', probability: 0.72, risk: 'moderate' },
          { location: '舌腹', type: 'normal', probability: 0.91, risk: 'low' },
        ],
      },
    }
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

  // ── [G005 Wave1B] 正畸 ortho 真实化 (DentalOrthoPage / DentalAlignerPage; 形状对齐 dentalHandlers) ──

  // GET /dental/ortho/plans — 正畸计划列表 (从 DENTAL_TREATMENTS_STORE type=Orthodontic 派生)
  listOrthoPlans() {
    const items = DENTAL_TREATMENTS_STORE.filter(
      (t: any) => String(t.type ?? '').toLowerCase().includes('ortho') || String(t.type ?? '').includes('正畸'),
    )
    const data = items.map((t: any) => ({
      id: t.id,
      patientId: t.patientId,
      patientName: t.patientName ?? '',
      toothNo: t.toothNo === '全口' || t.toothNo === '0' ? undefined : Number(t.toothNo ?? 0),
      diagnosis: t.diagnosis ?? t.plan ?? '正畸评估',
      plan: t.plan ?? '正畸治疗计划',
      cost: Number(t.cost ?? 0),
      status: t.status ?? 'Planned',
      doctorName: t.doctorName ?? '',
      createdAt: t.createdAt,
    }))
    return { success: true, data }
  }

  // POST /dental/ortho/plans — 创建正畸计划 (写入治疗 store)
  createOrthoPlan(body: Record<string, unknown>) {
    const item: any = {
      id: `T-${Date.now()}`,
      patientId: (body.patientId as string) ?? 'PDNT-005',
      patientName: (body.patientName as string) ?? '',
      type: 'Orthodontic',
      toothNo: body.toothNo ? String(body.toothNo) : '全口',
      diagnosis: (body.diagnosis as string) ?? '正畸评估',
      plan: (body.plan as string) ?? '正畸治疗计划',
      cost: Number(body.cost ?? 0),
      status: (body.status as string) ?? 'Planned',
      doctorName: (body.doctorName as string) ?? '当前医生',
      createdAt: new Date().toISOString(),
    }
    DENTAL_TREATMENTS_STORE.unshift(item)
    return { success: true, data: this.toOrthoPlanDto(item) }
  }

  // GET /dental/ortho/plans/:id — 详情: 分期 + 弓分析
  getOrthoPlan(id: string) {
    const t = DENTAL_TREATMENTS_STORE.find((x: any) => x.id === id)
    if (!t) return { success: false, error: { code: 'NOT_FOUND', message: `OrthoPlan ${id} not found` } }
    const plan = this.toOrthoPlanDto(t)
    return {
      success: true,
      data: {
        ...plan,
        totalStages: ORTHO_TOTAL_STAGES,
        stages: generateAlignerStageData(ORTHO_TOTAL_STAGES).slice(0, 6),
        archAnalysis: this.archAnalysis({}).data,
      },
    }
  }

  // POST /dental/ortho/arch-analysis — 弓形分析 (确定性计算, {landmarks} 可选)
  archAnalysis(body: Record<string, unknown> = {}) {
    const landmarks = Array.isArray(body.landmarks) ? (body.landmarks as any[]) : []
    const maxillaCrowding = landmarks.length > 0 ? Number((landmarks.length * 0.5).toFixed(1)) : 2.5
    const mandibleCrowding = landmarks.length > 0 ? Number((landmarks.length * 0.3).toFixed(1)) : 1.5
    return {
      success: true,
      data: {
        maxillaArch: { intermolarWidth: 42.5, intercanineWidth: 35.2, archLength: 48.0, archPerimeter: 65.2, spacing: 0, crowding: -maxillaCrowding, shape: 'oval' },
        mandibleArch: { intermolarWidth: 38.0, intercanineWidth: 28.5, archLength: 42.0, archPerimeter: 58.5, spacing: 0.5, crowding: -mandibleCrowding, shape: 'parabolic' },
        discrepancy: {
          maxillaCrowding, mandibleCrowding, maxillarySpace: 0, mandibularSpace: 0.5,
          boltonRatio: 0.902, boltonNormMin: 0.87, boltonNormMax: 0.93, boltonStatus: 'normal',
          needExtraction: maxillaCrowding + mandibleCrowding > 4, extractionTeeth: [],
        },
        analysisType: 'space-analysis',
        computedFrom: landmarks.length > 0 ? 'landmarks' : 'default',
      },
    }
  }

  // GET /dental/ortho/aligner-plans — 隐形矫治方案列表
  listAlignerPlans() {
    return { success: true, data: ALIGNER_PLANS_STORE, meta: { total: ALIGNER_PLANS_STORE.length } }
  }

  // POST /dental/ortho/aligner-plans — 创建方案
  createAlignerPlan(body: Record<string, unknown>) {
    const item: any = {
      id: `ALIGN-${Date.now()}`,
      patientId: (body.patientId as string) ?? 'P100004',
      patientName: (body.patientName as string) ?? '未命名患者',
      diagnosis: (body.diagnosis as string) ?? '错颌畸形',
      totalStages: Number(body.totalStages ?? 24),
      currentStage: 0,
      wearDaysPerStage: Number(body.wearDaysPerStage ?? 7),
      startedAt: null,
      estimatedEnd: null,
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      ipr: Array.isArray(body.ipr) ? body.ipr : [],
      status: 'pending',
      doctor: (body.doctor as string) ?? '李正畸',
      lab: (body.lab as string) ?? 'AlignTech',
      createdBy: (body.createdBy as string) ?? 'Dr. Li',
      createdAt: new Date().toISOString(),
    }
    ALIGNER_PLANS_STORE.unshift(item)
    return { success: true, data: item }
  }

  // GET /dental/ortho/aligner-plans/:id
  getAlignerPlan(id: string) {
    const p = ALIGNER_PLANS_STORE.find((x: any) => x.id === id)
    if (!p) return { success: false, error: { code: 'NOT_FOUND', message: `AlignerPlan ${id} not found` } }
    return { success: true, data: p }
  }

  // GET /dental/ortho/aligner-plans/:id/stages — 分期牙移动数据 (确定性生成)
  getAlignerStages(id: string) {
    const p = ALIGNER_PLANS_STORE.find((x: any) => x.id === id)
    return { success: true, data: generateAlignerStageData(p?.totalStages ?? 24) }
  }

  // POST /dental/ortho/aligner-plans/:id/stages — 生成分期 (固化到内存 store)
  generateAlignerStages(id: string) {
    const p = ALIGNER_PLANS_STORE.find((x: any) => x.id === id)
    const total = Number(p?.totalStages ?? 24)
    const stages = generateAlignerStageData(total)
    if (p) p.stages = stages
    return { success: true, data: stages, meta: { planId: id, total } }
  }

  // GET /dental/ortho/aligner-plans/:id/progress — 治疗进度
  getAlignerProgress(id: string) {
    const p = ALIGNER_PLANS_STORE.find((x: any) => x.id === id)
    const total = Number(p?.totalStages ?? 24)
    const current = Number(p?.currentStage ?? 0)
    return {
      success: true,
      data: {
        planId: id,
        totalStages: total,
        currentStage: current,
        completedStages: current,
        patientCompliance: 0.92,
        trackingQuality: 'good',
        lastStageWornDays: current > 0 ? 8 : 0,
        nextStageDate: current < total ? new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) : null,
        refinementSuggested: false,
        refinementCount: 0,
      },
    }
  }

  // POST /dental/ortho/aligner-plans/:id/progress — 进度更新
  updateAlignerProgress(id: string, body: Record<string, unknown>) {
    const p = ALIGNER_PLANS_STORE.find((x: any) => x.id === id)
    if (!p) return { success: false, error: { code: 'NOT_FOUND', message: `AlignerPlan ${id} not found` } }
    if (body.currentStage !== undefined) p.currentStage = Number(body.currentStage)
    if (body.patientCompliance !== undefined) p.patientCompliance = Number(body.patientCompliance)
    if (body.trackingQuality !== undefined) p.trackingQuality = String(body.trackingQuality)
    return {
      success: true,
      data: { planId: id, currentStage: p.currentStage, patientCompliance: p.patientCompliance, trackingQuality: p.trackingQuality, updatedAt: new Date().toISOString() },
    }
  }

  // POST /dental/ortho/aligner-plans/:id/approve — 批准方案
  approveAlignerPlan(id: string) {
    const p = ALIGNER_PLANS_STORE.find((x: any) => x.id === id)
    if (!p) return { success: false, error: { code: 'NOT_FOUND', message: `AlignerPlan ${id} not found` } }
    p.status = 'approved'
    return { success: true, data: { id, status: 'approved', approvedAt: new Date().toISOString() } }
  }

  // POST /dental/ortho/aligner-plans/:id/order-lab — 加工厂下单
  orderAlignerLab(id: string, body: { lab?: string; quantity?: number; shippingMethod?: string }) {
    const p = ALIGNER_PLANS_STORE.find((x: any) => x.id === id)
    if (!p) return { success: false, error: { code: 'NOT_FOUND', message: `AlignerPlan ${id} not found` } }
    const order = {
      planId: id,
      orderId: `ORD-${Date.now()}`,
      lab: body.lab ?? p.lab ?? 'AlignTech',
      quantity: Number(body.quantity ?? 6),
      shippingMethod: body.shippingMethod ?? 'express',
      status: 'submitted',
      estimatedDelivery: new Date(Date.now() + 14 * 86400000).toISOString(),
    }
    ALIGNER_LAB_ORDERS_STORE.unshift(order)
    p.status = 'ordered'
    return { success: true, data: order }
  }

  private toOrthoPlanDto(t: any) {
    return {
      id: t.id,
      patientId: t.patientId,
      patientName: t.patientName ?? '',
      toothNo: t.toothNo === '全口' || t.toothNo === '0' ? undefined : Number(t.toothNo ?? 0),
      diagnosis: t.diagnosis ?? t.plan ?? '正畸评估',
      plan: t.plan ?? '正畸治疗计划',
      cost: Number(t.cost ?? 0),
      status: t.status ?? 'Planned',
      doctorName: t.doctorName ?? '',
      createdAt: t.createdAt,
    }
  }

  // ── [G005 Wave1B] 头影测量 ceph 真实化 (DentalCephPage; 形状对齐 dentalHandlers dentalCephModule) ──

  // GET /dental/ceph/studies — 检查列表 (DentalStudy 表 modality=Ceph 派生 + seed)
  async listCephStudies() {
    try {
      const rows = await this.prisma.dentalStudy.findMany({ where: { modality: 'Ceph' } as any, orderBy: { createdAt: 'desc' }, take: 50 })
      if (rows.length > 0) {
        return {
          success: true,
          data: rows.map((s: any) => ({
            id: s.id,
            patientId: s.patientId,
            patientName: s.patientName ?? '',
            age: 12,
            gender: 'M',
            studyType: 'lateral',
            acquisitionDate: String(s.acquisitionDate ?? s.createdAt ?? '').slice(0, 10),
            device: s.deviceModel ?? '',
            imageUrl: s.dicomPath ?? 'data:image/png;base64,CEPH_LATERAL_DUMMY',
            status: s.status === 'reported' ? 'analyzed' : 'pending',
            analysisType: null,
          })),
        }
      }
    } catch {
      // DB 不可用 → seed
    }
    return { success: true, data: SEED_CEPH_STUDIES }
  }

  // POST /dental/ceph/studies — 创建检查
  createCephStudy(body: Record<string, unknown>) {
    const item: any = {
      id: `CEPH-${Date.now()}`,
      patientId: (body.patientId as string) ?? 'P100004',
      patientName: (body.patientName as string) ?? '未命名患者',
      age: Number(body.age ?? 12),
      gender: (body.gender as string) ?? 'M',
      studyType: (body.studyType as string) ?? 'lateral',
      acquisitionDate: new Date().toISOString().slice(0, 10),
      device: (body.device as string) ?? 'Sirona Orthophos S3 Ceph',
      imageUrl: 'data:image/png;base64,CEPH_LATERAL_DUMMY',
      status: 'pending',
      analysisType: null,
    }
    SEED_CEPH_STUDIES.unshift(item)
    return { success: true, data: item }
  }

  // GET /dental/ceph/studies/:id
  getCephStudy(id: string) {
    const s = SEED_CEPH_STUDIES.find((x: any) => x.id === id)
    if (!s) return { success: false, error: { code: 'NOT_FOUND', message: `CephStudy ${id} not found` } }
    return { success: true, data: s }
  }

  // GET /dental/ceph/analysis-types — 分析类型字典
  listCephAnalysisTypes() {
    return { success: true, data: SEED_CEPH_ANALYSIS_TYPES }
  }

  // GET /dental/ceph/landmarks — 默认标定点集 (全局)
  getDefaultCephLandmarks() {
    return { success: true, data: SEED_CEPH_LANDMARKS }
  }

  // GET /dental/ceph/:id/landmarks — 检查标定点 (seed 默认点集)
  getCephLandmarks(id: string) {
    const saved = CEPH_LANDMARKS_STORE[id]
    return { success: true, data: saved ?? SEED_CEPH_LANDMARKS, meta: { studyId: id, source: saved ? 'saved' : 'default' } }
  }

  // PUT /dental/ceph/:id/landmarks — 保存标定
  saveCephLandmarks(id: string, body: { landmarks?: Record<string, { x: number; y: number }> }) {
    if (body.landmarks && typeof body.landmarks === 'object') {
      CEPH_LANDMARKS_STORE[id] = body.landmarks
    }
    return { success: true, data: { studyId: id, landmarks: body.landmarks ?? {}, updatedAt: new Date().toISOString() } }
  }

  // GET /dental/ceph/:id/analysis — 已有分析结果
  getCephAnalysis(id: string) {
    const saved = CEPH_ANALYSIS_STORE[id]
    if (saved) return { success: true, data: saved }
    const study = SEED_CEPH_STUDIES.find((x: any) => x.id === id)
    if (!study || !study.analysisType) return { success: false, error: { code: 'NOT_FOUND', message: `Ceph analysis for ${id} not found` } }
    return { success: true, data: this.computeCephAnalysis(id, study.analysisType, CEPH_LANDMARKS_STORE[id]) }
  }

  // POST /dental/ceph/:id/analysis — 确定性测量计算 (SNA/SNB/ANB 由标定点夹角计算, 缺失回退 seed)
  runCephAnalysis(id: string, body: { type?: string }) {
    const study = SEED_CEPH_STUDIES.find((x: any) => x.id === id)
    if (!study) return { success: false, error: { code: 'NOT_FOUND', message: `CephStudy ${id} not found` } }
    const type = String(body.type ?? study.analysisType ?? 'steiner')
    const data = this.computeCephAnalysis(id, type, CEPH_LANDMARKS_STORE[id])
    CEPH_ANALYSIS_STORE[id] = data
    return { success: true, data: { ...data, studyId: id, performedAt: new Date().toISOString() } }
  }

  private computeCephAnalysis(studyId: string, type: string, landmarks?: Record<string, { x: number; y: number }>) {
    const base = SEED_STEINER_ANALYSIS
    const computed = { ...base }
    if (landmarks && landmarks.S && landmarks.N && landmarks.A && landmarks.B) {
      const sna = Math.round(angleAt(landmarks.A, landmarks.S, landmarks.N) * 10) / 10
      const snb = Math.round(angleAt(landmarks.B, landmarks.S, landmarks.N) * 10) / 10
      const anb = Math.round((sna - snb) * 10) / 10
      computed.measurements = base.measurements.map((m: any) => {
        if (m.key === 'SNA') return { ...m, value: sna, status: sna >= 80 && sna <= 84 ? 'normal' : 'abnormal' }
        if (m.key === 'SNB') return { ...m, value: snb, status: snb >= 78 && snb <= 82 ? 'normal' : 'abnormal' }
        if (m.key === 'ANB') return { ...m, value: anb, status: anb >= 0 && anb <= 4 ? 'normal' : 'abnormal' }
        return m
      })
      computed.diagnosis = anb > 4 ? '骨性 II 类, 均角面型' : anb < 0 ? '骨性 III 类, 均角面型' : '骨性 I 类, 均角面型'
      computed.computedFrom = 'landmarks'
    }
    computed.analysisType = type
    computed.studyId = studyId
    return computed
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

  // ── [G005 Wave 10A] CBCT 体绘制 (DentalVolumeViewerPage, /dental/volume/*) ──
  // 牙科 CBCT 序列: 从 SEED_CBCT_VOLUME_STUDIES 确定性派生 (业务真实 FOV/层数/设备)

  async listVolumeStudies(): Promise<{ success: boolean; data: unknown[] }> {
    try {
      const rows = await this.prisma.dentalStudy.findMany({
        where: { modality: 'CBCT' },
        orderBy: { acquisitionDate: 'desc' },
        take: 20,
      })
      if (rows.length > 0) {
        return {
          success: true,
          data: rows.map((r: any) => ({
            id: r.id,
            patientId: r.patientId,
            patientName: r.patientName ?? '未知患者',
            device: r.deviceModel ?? 'Planmeca ProMax 3D',
            fov: '16×12 cm',
            slices: 400,
            status: (r.status ?? 'processed') === 'reported' ? 'processed' : (r.status ?? 'processed'),
            acquisitionDate: r.acquisitionDate ? new Date(r.acquisitionDate).toISOString().slice(0, 10) : undefined,
          })),
        }
      }
    } catch {
      // fallthrough to seed
    }
    return { success: true, data: SEED_CBCT_VOLUME_STUDIES }
  }

  async getVolumeStudy(id: string): Promise<{ success: boolean; data?: unknown; error?: { code: string; message: string } }> {
    const s = SEED_CBCT_VOLUME_STUDIES.find((x: any) => x.id === id)
    if (!s) return { success: false, error: { code: 'NOT_FOUND', message: `CBCT volume study ${id} not found` } }
    return { success: true, data: s }
  }

  async listVolumePresets(): Promise<{ success: boolean; data: unknown[] }> {
    return { success: true, data: SEED_CBCT_VOLUME_PRESETS }
  }

  /** POST /dental/volume/presets/:id/apply — 应用渲染预设 (返回窗宽窗位等参数) */
  async applyVolumePreset(id: string): Promise<{ success: boolean; data?: unknown; error?: { code: string; message: string } }> {
    const preset = SEED_CBCT_VOLUME_PRESETS.find((p: any) => p.id === id)
    if (!preset) return { success: false, error: { code: 'NOT_FOUND', message: `CBCT preset ${id} not found` } }
    return { success: true, data: { preset, applied: true, appliedAt: new Date().toISOString() } }
  }

  // 曲断重建路径 (Curve MPR): 牙弓展开路径点 (确定性)
  async getVolumeCurvePath(id: string): Promise<{ success: boolean; data?: unknown; error?: { code: string; message: string } }> {
    const s = SEED_CBCT_VOLUME_STUDIES.find((x: any) => x.id === id)
    if (!s) return { success: false, error: { code: 'NOT_FOUND', message: `CBCT volume study ${id} not found` } }
    return { success: true, data: { studyId: id, points: SEED_CBCT_CURVE_POINTS, expandedLengthMm: 152, spacingMm: 0.5 } }
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

// ── [G005 W1-A] 在用孤儿补齐: 排班/患者/医生/转诊/远程/治疗/CAD/种植/导板/AI 内存 seed (风格与 dentalHandlers.ts 一致) ──

const SEED_DENTAL_CHAIRS = [
  { id: 'chair-1', name: '1号椅', status: 'online' },
  { id: 'chair-2', name: '2号椅', status: 'online' },
  { id: 'chair-3', name: '3号椅', status: 'offline' },
  { id: 'chair-4', name: '4号椅', status: 'maintenance' },
  { id: 'chair-5', name: '5号椅', status: 'online' },
]

const SEED_DENTAL_DENTISTS = [
  { id: 'doc-1', name: '周大夫', specialty: '种植' },
  { id: 'doc-2', name: '李大夫', specialty: '正畸' },
  { id: 'doc-3', name: '王大夫', specialty: '牙体牙髓' },
  { id: 'doc-4', name: '赵大夫', specialty: '牙周' },
]

const SEED_DENTAL_PATIENTS = [
  { id: 'PDNT-001', name: '钱立军' },
  { id: 'PDNT-002', name: '吴玉兰' },
  { id: 'PDNT-003', name: '郑晓东' },
  { id: 'PDNT-004', name: '冯丽华' },
  { id: 'PDNT-005', name: '褚一鸣' },
  { id: 'PDNT-006', name: '卫晓霞' },
]

const DENTAL_TREATMENTS_STORE: any[] = [...SEED_DENTAL_TREATMENTS]

const DENTAL_REFERRALS: any[] = [
  { id: 'REF-001', patientId: 'P100001', patient: '张伟', source: '口腔科', target: '放射科', reason: '36 位种植术前 CBCT 三维评估', doctor: '王强', status: 'pending', createdAt: '2026-07-02T09:20:00.000Z' },
  { id: 'REF-002', patientId: 'P100002', patient: '李娜', source: '口腔科', target: '放射科', reason: '16 位根管治疗后 CBCT 复查', doctor: '王强', status: 'accepted', createdAt: '2026-07-01T14:10:00.000Z', acceptedAt: '2026-07-01T15:00:00.000Z' },
  { id: 'REF-003', patientId: 'P100003', patient: '王芳', source: '正畸科', target: '放射科', reason: '正畸-正颌联合治疗头影测量', doctor: '刘敏', status: 'accepted', createdAt: '2026-06-28T10:00:00.000Z', acceptedAt: '2026-06-28T10:40:00.000Z' },
  { id: 'REF-004', patientId: 'P100004', patient: '陈丽', source: '口腔科', target: '口腔外科', reason: '38 阻生智齿拔除术前评估', doctor: '王强', status: 'completed', createdAt: '2026-06-20T08:30:00.000Z', acceptedAt: '2026-06-20T09:00:00.000Z' },
]

const DENTAL_TELE_SESSIONS: any[] = [
  { id: 'TEL-001', title: '种植疑难病例会诊', patientId: 'P100001', patientName: '张伟', expert: '王专家(种植)', reason: '46 位骨量不足, 需骨增量方案', status: 'in_progress', hostDoctor: '周大夫', participants: ['周大夫', '王专家'], createdAt: '2026-07-03T09:00:00.000Z' },
  { id: 'TEL-002', title: '正畸-正颌联合会诊', patientId: 'P100005', patientName: '刘洋', expert: '李专家(正颌)', reason: '骨性 III 类错颌畸形', status: 'completed', hostDoctor: '李大夫', participants: ['李大夫', '李专家'], createdAt: '2026-07-01T14:00:00.000Z' },
]

const SEED_CAD_MATERIALS = [
  { id: 'mat-001', name: 'E-max CAD 瓷块', type: 'ceramic', shades: ['A1', 'A2', 'A3', 'B1', 'B2', 'C1'], millingCompatible: true, price: 480 },
  { id: 'mat-002', name: 'PMMA 临时冠材料', type: 'pmma', shades: ['A1', 'A2', 'A3'], millingCompatible: true, price: 120 },
  { id: 'mat-003', name: '钛合金棒料', type: 'metal', shades: [], millingCompatible: true, price: 680 },
  { id: 'mat-004', name: '氧化锆瓷块', type: 'zirconia', shades: ['A1', 'A2', 'A3', 'B1'], millingCompatible: true, price: 560 },
]

const SEED_VITA_SHADES = [
  { id: 'A1', name: 'A1', brightness: 5, chroma: 1 },
  { id: 'A2', name: 'A2', brightness: 4, chroma: 2 },
  { id: 'A3', name: 'A3', brightness: 3, chroma: 3 },
  { id: 'B1', name: 'B1', brightness: 5, chroma: 1 },
  { id: 'B2', name: 'B2', brightness: 4, chroma: 2 },
  { id: 'C1', name: 'C1', brightness: 3, chroma: 2 },
]

const SEED_MILLING_UNITS = [
  { id: 'mill-001', name: 'Ceramill Motion 2', status: 'idle', currentJob: null, errorRate: 0.5 },
  { id: 'mill-002', name: 'DWX-52D', status: 'milling', currentJob: 'CAD-2024-001', errorRate: 1.2 },
  { id: 'mill-003', name: 'CORiTEC 250i', status: 'maintenance', currentJob: null, errorRate: 0 },
]

const SEED_CAD_TEMPLATES = [
  { id: 'tpl-1', name: '标准全冠 (前磨牙)', type: 'crown', anatomy: 'anatomic', thickness: 1.5 },
  { id: 'tpl-2', name: '标准全冠 (磨牙)', type: 'crown', anatomy: 'semi-anatomic', thickness: 1.5 },
  { id: 'tpl-3', name: '嵌体 MOD 预备型', type: 'inlay', anatomy: 'semi-anatomic', thickness: 2.0 },
  { id: 'tpl-4', name: '贴面 (前牙)', type: 'veneer', anatomy: 'anatomic', thickness: 0.8 },
]

const CAD_DESIGNS_STORE: any[] = [
  { id: 'CAD-1001', patientId: 'PDNT-001', patientName: '钱立军', toothNo: '46', type: 'crown', material: 'E-max CAD', shade: 'A2', status: 'draft', marginLine: Array.from({ length: 12 }, (_, i) => [200 + Math.sin(i / 12 * Math.PI * 2) * 30, 200 + Math.cos(i / 12 * Math.PI * 2) * 30]), occlusalAnatomy: 'anatomic', thickness: 1.5, cementGap: 30, contactStrength: 'normal', designer: 'Dr. CAD', createdAt: '2026-07-05T09:00:00.000Z', updatedAt: '2026-07-05T09:00:00.000Z' },
  { id: 'CAD-1002', patientId: 'PDNT-003', patientName: '郑晓东', toothNo: '16', type: 'crown', material: '氧化锆', shade: 'A1', status: 'milling', marginLine: [], occlusalAnatomy: 'semi-anatomic', thickness: 1.5, cementGap: 25, contactStrength: 'normal', designer: 'Dr. CAD', createdAt: '2026-07-03T10:00:00.000Z', updatedAt: '2026-07-03T10:00:00.000Z' },
]

const SEED_IMPLANT_BRANDS = [
  { id: 'brd-001', name: 'Straumann', country: '瑞士', models: [{ id: 'mod-001', name: 'BLT 骨水平', diameter: 4.1, length: 10, price: 2680 }, { id: 'mod-002', name: 'BLT 骨水平', diameter: 4.8, length: 10, price: 2880 }] },
  { id: 'brd-002', name: 'Nobel Biocare', country: '瑞典', models: [{ id: 'mod-003', name: 'Active 锥形', diameter: 4.3, length: 11.5, price: 3100 }] },
  { id: 'brd-003', name: 'Dentsply', country: '美国', models: [{ id: 'mod-004', name: 'Astra TX', diameter: 3.8, length: 9, price: 2450 }] },
]

const SEED_GUIDE_SLEEVES = [
  { id: 'slv-001', brand: 'Straumann', diameter: 4.8, height: 5.0, type: 'closed' },
  { id: 'slv-002', brand: 'Straumann', diameter: 5.2, height: 6.0, type: 'open' },
  { id: 'slv-003', brand: 'Nobel', diameter: 4.3, height: 5.0, type: 'closed' },
  { id: 'slv-004', brand: 'Dentsply', diameter: 4.5, height: 4.5, type: 'open' },
]

const SEED_GUIDE_MATERIALS = [
  { id: 'gm-001', name: '光敏树脂 (白色)', price: 180, units: 'kg', recommended: true },
  { id: 'gm-002', name: '生物相容性树脂', price: 320, units: 'kg', recommended: true },
  { id: 'gm-003', name: '耐高温树脂', price: 280, units: 'kg', recommended: false },
]

const SEED_SURGICAL_GUIDES = [
  { id: 'GUIDE-1001', patientId: 'PDNT-001', patientName: '钱立军', toothNo: '46', brand: 'Straumann', planId: 'IMP3D-1001', status: 'designing', material: '生物相容性树脂', sleeveType: 'closed', exportUrl: null, createdAt: '2026-07-05T10:00:00.000Z' },
  { id: 'GUIDE-1002', patientId: 'PDNT-003', patientName: '郑晓东', toothNo: '16', brand: 'Nobel', planId: 'IMP3D-1002', status: 'exported', material: '光敏树脂', sleeveType: 'open', exportUrl: '/dental/guides/GUIDE-1002.stl', createdAt: '2026-07-02T09:00:00.000Z' },
]

const IMPLANT_PLANS_3D_STORE: any[] = [
  { id: 'IMP3D-1001', patientId: 'PDNT-001', patientName: '钱立军', toothNo: '46', brand: 'Straumann', model: 'BLT 骨水平', diameter: 4.8, length: 10, entryPoint: { x: 150, y: 120, z: 80 }, apexPoint: { x: 148, y: 109, z: 30 }, distanceToNerve: 3.5, boneDensityAtApex: 800, status: 'planning', guideDesigned: false, createdAt: '2026-07-04T09:00:00.000Z' },
  { id: 'IMP3D-1002', patientId: 'PDNT-003', patientName: '郑晓东', toothNo: '16', brand: 'Nobel', model: 'Active 锥形', diameter: 4.3, length: 11.5, entryPoint: { x: 90, y: 110, z: 75 }, apexPoint: { x: 88, y: 100, z: 30 }, distanceToNerve: 5.2, boneDensityAtApex: 720, status: 'approved', guideDesigned: true, createdAt: '2026-07-01T09:00:00.000Z' },
]

const SEED_NERVE_3D = [
  [100, 200, 50], [105, 210, 55], [110, 220, 60],
]

const SEED_NERVE_DISTANCES = [
  { position: 'canal-entry', distance: 4.2, safe: true },
  { position: 'mid-root', distance: 3.5, safe: true },
  { position: 'apex', distance: 2.8, safe: true },
]

const SEED_BONE_DENSITY_MAP = {
  densityMap: [
    { region: '下颌前牙区', density: 850, unit: 'HU' },
    { region: '下颌后牙区', density: 1100, unit: 'HU' },
    { region: '上颌前牙区', density: 720, unit: 'HU' },
    { region: '上颌后牙区', density: 480, unit: 'HU' },
  ],
  quality: 'D2',
}

const SEED_PSR_RECORDS = [
  { id: 'PSR-001', patientId: 'P100001', quadrant: 1, probingDepths: [2, 3, 4, 3, 2, 2], bleeding: [false, true, true, false, false, false], mobility: 1, psrCode: 2, note: '右上后牙区探诊出血', createdAt: '2026-06-15T09:00:00.000Z' },
  { id: 'PSR-002', patientId: 'P100001', quadrant: 2, probingDepths: [2, 2, 3, 2, 2, 2], bleeding: [false, false, false, false, false, false], mobility: 0, psrCode: 1, note: '', createdAt: '2026-06-15T09:10:00.000Z' },
]

// [G005 Wave1A P0] 收费/划价/医保: 静态收费字典 + 支付方式 (对标 src/data/dental/dentalBillingMock)
const SEED_FEE_CATALOG = [
  { code: 'D1001', name: '初诊检查费', category: '诊疗费', unitPrice: 50, insuranceType: '甲类', insuranceRatio: 0.8 },
  { code: 'D1002', name: '口腔CBCT（单颌）', category: '放射', unitPrice: 350, insuranceType: '乙类', insuranceRatio: 0.7 },
  { code: 'D1003', name: '全景片', category: '放射', unitPrice: 120, insuranceType: '甲类', insuranceRatio: 0.8 },
  { code: 'D1004', name: '根尖片', category: '放射', unitPrice: 40, insuranceType: '甲类', insuranceRatio: 0.8 },
  { code: 'D2001', name: '树脂充填（单面）', category: '治疗', unitPrice: 300, insuranceType: '乙类', insuranceRatio: 0.6 },
  { code: 'D2002', name: '树脂充填（双面）', category: '治疗', unitPrice: 450, insuranceType: '乙类', insuranceRatio: 0.6 },
  { code: 'D2003', name: '树脂充填（三面）', category: '治疗', unitPrice: 600, insuranceType: '乙类', insuranceRatio: 0.6 },
  { code: 'D2004', name: '根管治疗（前牙）', category: '治疗', unitPrice: 800, insuranceType: '乙类', insuranceRatio: 0.5 },
  { code: 'D2005', name: '根管治疗（前磨牙）', category: '治疗', unitPrice: 1200, insuranceType: '乙类', insuranceRatio: 0.5 },
  { code: 'D2006', name: '根管治疗（磨牙）', category: '治疗', unitPrice: 2000, insuranceType: '乙类', insuranceRatio: 0.5 },
  { code: 'D2007', name: '全口洁牙', category: '治疗', unitPrice: 400, insuranceType: '甲类', insuranceRatio: 0.8 },
  { code: 'D3001', name: '种植体植入术（单颗）', category: '种植', unitPrice: 4000, insuranceType: '丙类', insuranceRatio: 0 },
  { code: 'D3002', name: '种植体（Straumann BLT）', category: '材料', unitPrice: 8000, insuranceType: '丙类', insuranceRatio: 0 },
  { code: 'D3003', name: '种植体（Osstem TS III）', category: '材料', unitPrice: 3500, insuranceType: '丙类', insuranceRatio: 0 },
  { code: 'D3004', name: '种植体（Nobel Active）', category: '材料', unitPrice: 8500, insuranceType: '丙类', insuranceRatio: 0 },
  { code: 'D3005', name: '基台（钛合金）', category: '材料', unitPrice: 1500, insuranceType: '丙类', insuranceRatio: 0 },
  { code: 'D3006', name: '钴铬烤瓷冠', category: '修复', unitPrice: 1800, insuranceType: '乙类', insuranceRatio: 0.5 },
  { code: 'D3007', name: '氧化锆全瓷冠', category: '修复', unitPrice: 3500, insuranceType: '丙类', insuranceRatio: 0 },
  { code: 'D3008', name: 'E-max 贴面', category: '修复', unitPrice: 3000, insuranceType: '丙类', insuranceRatio: 0 },
  { code: 'D4001', name: '正畸初诊设计', category: '正畸', unitPrice: 500, insuranceType: '丙类', insuranceRatio: 0 },
  { code: 'D4002', name: '隐形矫治方案设计', category: '正畸', unitPrice: 2000, insuranceType: '丙类', insuranceRatio: 0 },
  { code: 'D4003', name: '固定矫治器（单颌）', category: '正畸', unitPrice: 8000, insuranceType: '丙类', insuranceRatio: 0 },
  { code: 'D4004', name: '隐形矫治（全口）', category: '正畸', unitPrice: 28000, insuranceType: '丙类', insuranceRatio: 0 },
  { code: 'D5001', name: '局部麻醉费', category: '其他', unitPrice: 50, insuranceType: '甲类', insuranceRatio: 0.8 },
  { code: 'D5002', name: '一次性材料费', category: '材料', unitPrice: 30, insuranceType: '自费', insuranceRatio: 0 },
]

const SEED_PAYMENT_METHODS = [
  { id: 'cash', name: '现金' }, { id: 'wechat', name: '微信支付' }, { id: 'alipay', name: '支付宝' },
  { id: 'bank-card', name: '银行卡' }, { id: 'medicare', name: '医保卡' }, { id: 'mixed', name: '混合支付' },
]

const BILLING_INVOICES_STORE: any[] = [
  { id: 'INV-20260628-001', patientId: 'P100001', patientName: '张伟', date: '2026-06-28', items: [
    { code: 'D2002', name: '树脂充填（双面）', qty: 1, unitPrice: 450, toothNo: 16, discount: 0 },
    { code: 'D5001', name: '局部麻醉费', qty: 1, unitPrice: 50, toothNo: 16, discount: 0 },
    { code: 'D5002', name: '一次性材料费', qty: 1, unitPrice: 30, toothNo: 16, discount: 0 },
  ], total: 530, insuranceType: '城镇职工', insuranceCover: 328, selfPay: 202, discountTotal: 0, copay: 10, status: 'paid', paidAt: '2026-06-28T10:30:00.000Z', paymentMethod: '微信' },
  { id: 'INV-20260625-002', patientId: 'P100001', patientName: '张伟', date: '2026-06-25', items: [
    { code: 'D2006', name: '根管治疗（磨牙）', qty: 1, unitPrice: 2000, toothNo: 36, discount: 0 },
  ], total: 2000, insuranceType: '城镇职工', insuranceCover: 1000, selfPay: 1000, discountTotal: 0, copay: 0, status: 'pending', paidAt: null, paymentMethod: null },
  { id: 'INV-20260620-003', patientId: 'P100003', patientName: '王芳', date: '2026-06-20', items: [
    { code: 'D3001', name: '种植体植入术（单颗）', qty: 1, unitPrice: 4000, toothNo: 46, discount: 500 },
    { code: 'D3002', name: '种植体（Straumann BLT）', qty: 1, unitPrice: 8000, toothNo: 46, discount: 0 },
  ], total: 12000, insuranceType: '城镇职工', insuranceCover: 3000, selfPay: 8500, discountTotal: 500, copay: 0, status: 'paid', paidAt: '2026-06-20T15:00:00.000Z', paymentMethod: '银行卡' },
  { id: 'INV-20260615-004', patientId: 'P100002', patientName: '李娜', date: '2026-06-15', items: [
    { code: 'D2007', name: '全口洁牙', qty: 1, unitPrice: 400, toothNo: 0, discount: 0 },
  ], total: 400, insuranceType: '城镇居民', insuranceCover: 240, selfPay: 160, discountTotal: 0, copay: 0, status: 'paid', paidAt: '2026-06-15T09:20:00.000Z', paymentMethod: '支付宝' },
]

function generateMockScheduleAppointments(date: string): any[] {
  const patients = SEED_DENTAL_PATIENTS
  const dentists = SEED_DENTAL_DENTISTS
  const chairs = SEED_DENTAL_CHAIRS
  const types = ['初诊', '复诊', '治疗', '复查', '洁牙', '种植', '正畸']
  const statuses = ['scheduled', 'in-progress', 'completed', 'no-show', 'cancelled']
  const times = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00']
  return Array.from({ length: 12 }, (_, i) => {
    const p = patients[i % patients.length]
    const d = dentists[i % dentists.length]
    const c = chairs[i % chairs.length]
    return {
      id: `APT-${date.replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`,
      time: times[i % times.length],
      patientId: p.id,
      patientName: p.name,
      chairId: c.id,
      chairName: c.name,
      dentist: d.name,
      type: types[i % types.length],
      status: statuses[i % statuses.length],
    }
  })
}

// ── [G005 W2-A P0] 患者 360° 视图 seed (形状对齐 src/data/dental/dentalEmrMock) ──
// 治疗/预约/费用优先从内存 store / prisma 派生; 处方/知情同意/回访为过程性记录, 演示患者走 seed

const EMR_DEMO_IDS = ['P100001', 'P100002', 'P100003']

const SEED_EMR_PATIENTS: any[] = [
  {
    id: 'P100001', name: '张伟', gender: 'M', age: 35, phone: '13800138001', idCard: '110101199001011234',
    address: '北京市朝阳区建国路88号', occupation: '软件工程师',
    firstVisit: '2025-03-15', lastVisit: '2026-06-28', totalVisits: 12,
    totalSpent: 28500, insuranceType: '城镇职工',
    allergies: ['青霉素'], systemicDisease: ['高血压'], medications: ['氨氯地平'],
    dentist: '王医生', tags: ['VIP', '种植意向'],
  },
  {
    id: 'P100002', name: '李娜', gender: 'F', age: 28, phone: '13900139002', idCard: '110102199512051234',
    address: '北京市海淀区中关村大街1号', occupation: '教师',
    firstVisit: '2025-08-20', lastVisit: '2026-06-27', totalVisits: 8,
    totalSpent: 18600, insuranceType: '城镇职工',
    allergies: [], systemicDisease: [], medications: [],
    dentist: '李医生', tags: ['正畸'],
  },
  {
    id: 'P100003', name: '王芳', gender: 'F', age: 45, phone: '13700137003', idCard: '110103197812051234',
    address: '上海市浦东新区陆家嘴环路1000号', occupation: '银行经理',
    firstVisit: '2024-11-10', lastVisit: '2026-06-22', totalVisits: 15,
    totalSpent: 52000, insuranceType: '城镇职工',
    allergies: ['磺胺类'], systemicDisease: ['糖尿病'], medications: ['二甲双胍'],
    dentist: '张主任', tags: ['VIP', '种植完成', '定期复查'],
  },
]

const SEED_EMR_TREATMENTS = [
  { id: 'TH-001', date: '2026-06-28', type: 'Restorative', toothNo: 16, description: '树脂充填 MOD', dentist: '王医生', cost: 800, insurancePaid: 400, patientPaid: 400 },
  { id: 'TH-002', date: '2026-06-25', type: 'Endodontic', toothNo: 36, description: '根管治疗 - 已完成', dentist: '王医生', cost: 2500, insurancePaid: 1200, patientPaid: 1300 },
  { id: 'TH-003', date: '2026-06-20', type: 'Implant', toothNo: 36, description: '种植体植入 Straumann BLT 4.1x10', dentist: '张主任', cost: 12000, insurancePaid: 3000, patientPaid: 9000 },
  { id: 'TH-004', date: '2026-06-15', type: 'Periodontal', toothNo: 0, description: '全口洁牙 + 牙周探查', dentist: '李医生', cost: 600, insurancePaid: 300, patientPaid: 300 },
  { id: 'TH-005', date: '2026-06-10', type: 'Examination', toothNo: 0, description: '初诊检查 + CBCT', dentist: '王医生', cost: 1200, insurancePaid: 600, patientPaid: 600 },
]

const SEED_EMR_APPOINTMENTS = [
  { id: 'APT-001', date: '2026-07-05', time: '09:00', type: '复诊', toothNo: '16', description: '充填后复查', dentist: '王医生', chair: '1号椅', status: 'scheduled' },
  { id: 'APT-002', date: '2026-07-12', time: '14:30', type: '复诊', toothNo: '36', description: '种植二期手术', dentist: '张主任', chair: '1号椅', status: 'scheduled' },
  { id: 'APT-003', date: '2026-06-28', time: '10:00', type: '治疗', toothNo: '26', description: '根管治疗复诊', dentist: '王医生', chair: '2号椅', status: 'completed' },
]

const SEED_EMR_RECALLS = [
  { id: 'REC-001', date: '2026-08-28', type: '复查', description: '种植术后 2 月复查', status: 'pending', method: 'SMS', sent: false },
  { id: 'REC-002', date: '2026-09-15', type: '洁牙', description: '常规洁牙提醒', status: 'pending', method: 'WeChat', sent: false },
]

const SEED_EMR_CONSENTS = [
  { id: 'CON-001', date: '2026-06-20', type: '种植手术同意书', signed: true, signedBy: '张伟', witness: '王医生' },
  { id: 'CON-002', date: '2026-05-15', type: 'CBCT 检查知情同意', signed: true, signedBy: '张伟', witness: '技师赵' },
  { id: 'CON-003', date: '2026-06-25', type: '根管治疗同意书', signed: false },
]

const SEED_EMR_PRESCRIPTIONS = [
  { id: 'RX-001', date: '2026-06-20', drug: '阿莫西林胶囊 0.5g', dosage: '一次一粒 一日三次', days: 7, dentist: '王医生', note: '种植术后抗感染' },
  { id: 'RX-002', date: '2026-06-20', drug: '布洛芬缓释胶囊 0.3g', dosage: '必要时服用', days: 3, dentist: '王医生', note: '止痛' },
  { id: 'RX-003', date: '2026-06-15', drug: '复方氯己定漱口水', dosage: '一日两次 含漱', days: 14, dentist: '李医生', note: '牙周护理' },
]

const SEED_EMR_BILLING = [
  { id: 'BILL-001', date: '2026-06-28', items: [{ name: '树脂充填 MOD', qty: 1, price: 800 }], total: 800, insurance: 400, selfPay: 400, status: 'paid' },
  { id: 'BILL-002', date: '2026-06-20', items: [{ name: '种植体 Straumann BLT', qty: 1, price: 8000 }, { name: '种植手术费', qty: 1, price: 4000 }], total: 12000, insurance: 3000, selfPay: 9000, status: 'partial' },
  { id: 'BILL-003', date: '2026-06-25', items: [{ name: '根管治疗', qty: 1, price: 2500 }], total: 2500, insurance: 1200, selfPay: 1300, status: 'pending' },
]

// ── [G005 Wave1B] 正畸/头影 seed (形状对齐 src/data/dental/dentalAlignerMock + dentalCephMock) ──

const ORTHO_TOTAL_STAGES = 24

// 各阶段牙移动数据 (确定性生成, 与前端 MOCK_ALIGNER 同规则)
function generateAlignerStageData(totalStages: number) {
  const teeth = [11,12,13,14,15,21,22,23,24,25,31,32,33,34,35,41,42,43,44,45]
  const out: any[] = []
  for (let s = 0; s < totalStages; s++) {
    const progress = s / totalStages
    out.push({
      stage: s,
      toothMovements: teeth.map((tno, ti) => {
        const targetDx = ti < 10 ? -2.5 : 1.5
        const targetDy = [11,12,21,22,31,32,41,42].includes(tno) ? -3 : -1
        return {
          toothNo: tno,
          dx: Number((targetDx * progress).toFixed(3)),
          dy: Number((targetDy * progress * (s / totalStages)).toFixed(3)),
          dz: [14,15,24,25].includes(tno) ? Number((progress * 1.5).toFixed(3)) : 0,
          rotation: [13,23,33,43].includes(tno) ? Number((progress * 8).toFixed(3)) : 0,
        }
      }),
    })
  }
  return out
}

const SEED_ALIGNER_PLANS: any[] = [
  {
    id: 'ALIGN-001', patientId: 'P100004', patientName: '赵雪', age: 28, gender: 'F',
    diagnosis: '安氏 II 类 1 分类, 前牙深覆盖 6mm, 下前牙轻度拥挤',
    totalStages: 24, currentStage: 8, wearDaysPerStage: 7,
    startedAt: '2026-04-15', estimatedEnd: '2026-12-15',
    attachments: [
      { toothNo: 13, type: 'horizontal', position: 'buccal' },
      { toothNo: 23, type: 'horizontal', position: 'buccal' },
      { toothNo: 33, type: 'vertical', position: 'buccal' },
      { toothNo: 43, type: 'vertical', position: 'buccal' },
      { toothNo: 16, type: 'beveled', position: 'occlusal' },
      { toothNo: 26, type: 'beveled', position: 'occlusal' },
    ],
    ipr: [{ toothNo: 33, amount: 0.3 }, { toothNo: 43, amount: 0.3 }, { toothNo: 32, amount: 0.2 }],
    status: 'in-progress', doctor: '李正畸', lab: 'AlignTech',
    createdBy: 'Dr. Li', createdAt: '2026-04-01T10:00:00Z',
  },
  {
    id: 'ALIGN-002', patientId: 'P100005', patientName: '刘阳', age: 32, gender: 'M',
    diagnosis: '安氏 III 类, 反合, 上前牙舌倾',
    totalStages: 30, currentStage: 0, wearDaysPerStage: 7,
    startedAt: null, estimatedEnd: null,
    attachments: [
      { toothNo: 14, type: 'horizontal', position: 'buccal' },
      { toothNo: 24, type: 'horizontal', position: 'buccal' },
      { toothNo: 34, type: 'horizontal', position: 'buccal' },
      { toothNo: 44, type: 'horizontal', position: 'buccal' },
    ],
    ipr: [{ toothNo: 34, amount: 0.3 }, { toothNo: 44, amount: 0.3 }],
    status: 'pending', doctor: '李正畸', lab: 'AlignTech',
    createdBy: 'Dr. Li', createdAt: '2026-06-20T14:30:00Z',
  },
]

const ALIGNER_PLANS_STORE: any[] = [...SEED_ALIGNER_PLANS]
const ALIGNER_LAB_ORDERS_STORE: any[] = []

const SEED_CEPH_STUDIES: any[] = [
  { id: 'CEPH-001', patientId: 'P100001', patientName: '张伟', age: 12, gender: 'M', studyType: 'lateral', acquisitionDate: '2026-06-28', device: 'Sirona Orthophos S3 Ceph', imageUrl: 'data:image/png;base64,CEPH_LATERAL_DUMMY', status: 'analyzed', analysisType: 'steiner' },
  { id: 'CEPH-002', patientId: 'P100004', patientName: '赵雪', age: 9, gender: 'F', studyType: 'lateral', acquisitionDate: '2026-06-27', device: 'Planmeca ProMax Ceph', imageUrl: 'data:image/png;base64,CEPH_LATERAL_DUMMY', status: 'pending', analysisType: null },
  { id: 'CEPH-003', patientId: 'P100005', patientName: '刘阳', age: 15, gender: 'M', studyType: 'lateral', acquisitionDate: '2026-06-25', device: 'Carestream CS 9600', imageUrl: 'data:image/png;base64,CEPH_LATERAL_DUMMY', status: 'analyzed', analysisType: 'mcmamara' },
  { id: 'CEPH-004', patientId: 'P100006', patientName: '陈雨', age: 28, gender: 'F', studyType: 'lateral', acquisitionDate: '2026-06-24', device: 'Sirona Orthophos S3 Ceph', imageUrl: 'data:image/png;base64,CEPH_LATERAL_DUMMY', status: 'analyzed', analysisType: 'steiner' },
]

// 标准 18 个解剖标志点
const SEED_CEPH_LANDMARKS: Record<string, { x: number; y: number }> = {
  N: { x: 250, y: 80 }, S: { x: 220, y: 150 }, A: { x: 240, y: 200 },
  B: { x: 230, y: 260 }, Pog: { x: 225, y: 300 }, Me: { x: 225, y: 320 },
  Go: { x: 180, y: 280 }, Ar: { x: 180, y: 155 }, PNS: { x: 280, y: 170 },
  ANS: { x: 260, y: 195 }, Or: { x: 280, y: 100 }, Po: { x: 160, y: 120 },
  Ba: { x: 195, y: 165 }, Na: { x: 250, y: 80 }, Pt: { x: 210, y: 195 },
  Cd: { x: 190, y: 145 }, Gn: { x: 225, y: 310 }, Xi: { x: 230, y: 230 },
}

const SEED_CEPH_ANALYSIS_TYPES = [
  { id: 'steiner', name: 'Steiner 分析法', description: 'SNA/SNB/ANB ± 角度测量', landmarks: ['N','S','A','B','Pog','Me','Go','Ar','PNS','ANS'], keyMeasurements: ['SNA','SNB','ANB','SN-MP','FMA'] },
  { id: 'downs', name: 'Downs 分析法', description: '面部骨骼角度分析 + 颅颌面', landmarks: ['N','S','A','B','Pog','Me','Go','Ar','Or','Po'], keyMeasurements: ['FPA','SNB','AB-MP','YAxis','OP-FH'] },
  { id: 'mcmamara', name: 'McNamara 分析法', description: '线距分析 + 气道分析', landmarks: ['N','A','B','Pog','ANS','PNS','Go','Cd','Gn','Ba'], keyMeasurements: ['Maxilla-Mandible','LFH','LTA-Pog','Airway-PS','NaPerp-A'] },
  { id: 'ricketts', name: 'Ricketts 分析法', description: '面部生长预测 + 面部三角', landmarks: ['N','S','A','B','Pog','Me','Go','Ar','Ba','Pt','Cd','Xi'], keyMeasurements: ['FacialAxis','FacialAngle','Convexity','MandArc','LowerFacialHt'] },
  { id: 'tweeds', name: 'Tweed 分析法', description: '诊断三角 + 矫治目标', landmarks: ['N','A','B','Pog','Me','Go','Or','Po'], keyMeasurements: ['FMA','IMPA','FMIA','ZAngle'] },
  { id: 'coben', name: 'Coben 分析法', description: '颅底三角分析', landmarks: ['N','S','Ba','Ar','PNS','A','B','Pog','Gn','Go'], keyMeasurements: ['S-N','N-Ba','N-ANS','N-Me','ANS-PNS'] },
]

const SEED_STEINER_ANALYSIS: any = {
  analysisType: 'steiner',
  measurements: [
    { key: 'SNA', label: 'SNA', value: 82, unit: '°', norm: { min: 80, max: 84 }, status: 'normal' },
    { key: 'SNB', label: 'SNB', value: 80, unit: '°', norm: { min: 78, max: 82 }, status: 'normal' },
    { key: 'ANB', label: 'ANB', value: 2, unit: '°', norm: { min: 0, max: 4 }, status: 'normal' },
    { key: 'SN-MP', label: 'SN-MP (下颌平面角)', value: 32, unit: '°', norm: { min: 28, max: 36 }, status: 'normal' },
    { key: 'FMA', label: 'FMA (下颌平面角-FH)', value: 25, unit: '°', norm: { min: 20, max: 30 }, status: 'normal' },
    { key: 'MP-SN', label: 'MP-SN', value: 32, unit: '°', norm: { min: 27, max: 37 }, status: 'normal' },
    { key: 'U1-SN', label: 'U1-SN (上中切牙角)', value: 104, unit: '°', norm: { min: 100, max: 108 }, status: 'normal' },
    { key: 'L1-MP', label: 'L1-MP (下中切牙角)', value: 92, unit: '°', norm: { min: 88, max: 98 }, status: 'normal' },
    { key: 'IMPA', label: 'IMPA', value: 92, unit: '°', norm: { min: 85, max: 95 }, status: 'normal' },
    { key: 'ZAngle', label: 'Z 角', value: 72, unit: '°', norm: { min: 65, max: 80 }, status: 'normal' },
    { key: 'Wits', label: 'Wits 值', value: -1, unit: 'mm', norm: { min: -2, max: 2 }, status: 'normal' },
    { key: 'U1-L1', label: 'U1-L1 (上下切牙角)', value: 128, unit: '°', norm: { min: 120, max: 140 }, status: 'normal' },
    { key: 'Holdaway', label: 'Holdaway 角', value: 12, unit: '°', norm: { min: 8, max: 15 }, status: 'normal' },
  ],
  diagnosis: '骨性 I 类, 均角, 均角型面型',
  facialType: 'dolichofacial',
  growthDirection: 'clockwise',
  createdAt: new Date().toISOString(),
}

// 内存 store: 标定点 / 分析结果
const CEPH_LANDMARKS_STORE: Record<string, Record<string, { x: number; y: number }>> = {}
const CEPH_ANALYSIS_STORE: Record<string, any> = {}

// 三点夹角 (p1-apex-p2, 度)
function angleAt(apex: { x: number; y: number }, p1: { x: number; y: number }, p2: { x: number; y: number }): number {
  const a1 = Math.atan2(p1.y - apex.y, p1.x - apex.x)
  const a2 = Math.atan2(p2.y - apex.y, p2.x - apex.x)
  let deg = Math.abs((a1 - a2) * 180 / Math.PI)
  if (deg > 180) deg = 360 - deg
  return deg
}

// ── [G005 Wave 10A] CBCT 体绘制 seed (DentalVolumeViewerPage, 形状对齐 MSW MOCK_VOLUME_STUDIES) ──

const SEED_CBCT_VOLUME_STUDIES: any[] = [
  { id: 'CBCT-001', patientId: 'PDNT-001', patientName: '钱立军', device: 'Planmeca ProMax 3D', fov: '16×12 cm', voxelSize: '0.2mm', slices: 400, series: 'SER-CBCT-001', status: 'processed', acquisitionDate: '2026-07-05', region: '右下颌后牙区', indication: '46 种植术前评估', dose: { kvp: 90, mas: 120, dlp: 520 }, operator: '技师赵' },
  { id: 'CBCT-002', patientId: 'PDNT-002', patientName: '吴玉兰', device: 'Sirona GALILEOS', fov: '15×15 cm', voxelSize: '0.3mm', slices: 300, series: 'SER-CBCT-002', status: 'processed', acquisitionDate: '2026-07-04', region: '上颌前牙区', indication: '11/21 阻生牙定位', dose: { kvp: 85, mas: 110, dlp: 480 }, operator: '技师钱' },
  { id: 'CBCT-003', patientId: 'PDNT-003', patientName: '郑晓东', device: 'Carestream CS 9600', fov: '17×14 cm', voxelSize: '0.25mm', slices: 350, series: 'SER-CBCT-003', status: 'processed', acquisitionDate: '2026-07-02', region: '全口', indication: '全口种植规划', dose: { kvp: 95, mas: 130, dlp: 610 }, operator: '技师孙' },
  { id: 'CBCT-004', patientId: 'PDNT-004', patientName: '冯丽华', device: 'Planmeca ProMax 3D', fov: '16×12 cm', voxelSize: '0.2mm', slices: 420, series: 'SER-CBCT-004', status: 'processing', acquisitionDate: '2026-07-01', region: '下颌全牙弓', indication: '36 根管解剖评估', dose: { kvp: 90, mas: 115, dlp: 505 }, operator: '技师赵' },
  { id: 'CBCT-005', patientId: 'PDNT-005', patientName: '褚一鸣', device: 'Sirona GALILEOS', fov: '12×8 cm', voxelSize: '0.15mm', slices: 500, series: 'SER-CBCT-005', status: 'processed', acquisitionDate: '2026-06-29', region: '上颌窦区', indication: '上颌窦提升术前评估', dose: { kvp: 88, mas: 125, dlp: 560 }, operator: '技师钱' },
  { id: 'CBCT-006', patientId: 'PDNT-006', patientName: '卫晓霞', device: 'Carestream CS 9600', fov: '10×10 cm', voxelSize: '0.2mm', slices: 380, series: 'SER-CBCT-006', status: 'archived', acquisitionDate: '2026-06-25', region: '右下颌第三磨牙', indication: '38 水平阻生评估', dose: { kvp: 90, mas: 108, dlp: 470 }, operator: '技师孙' },
  { id: 'CBCT-007', patientId: 'PDNT-007', patientName: '胡海峰', device: 'Planmeca ProMax 3D', fov: '16×12 cm', voxelSize: '0.2mm', slices: 410, series: 'SER-CBCT-007', status: 'processed', acquisitionDate: '2026-06-22', region: '上颌前牙区', indication: '12/22 根尖囊肿评估', dose: { kvp: 90, mas: 118, dlp: 515 }, operator: '技师赵' },
  { id: 'CBCT-008', patientId: 'PDNT-008', patientName: '罗素珍', device: 'Sirona GALILEOS', fov: '15×15 cm', voxelSize: '0.3mm', slices: 320, series: 'SER-CBCT-008', status: 'processed', acquisitionDate: '2026-06-18', region: '全口', indication: '牙周病骨量评估', dose: { kvp: 86, mas: 112, dlp: 495 }, operator: '技师钱' },
]

// 8 种牙科渲染预设 (骨/软组织/气道/神经/种植/牙釉质/上颌窦/MPR)
const SEED_CBCT_VOLUME_PRESETS: any[] = [
  { id: 'bone', name: '骨组织', ww: 2500, wc: 480, opacity: 0.85, transfer: 'bone', description: '高密度骨组织显影, 用于种植规划', color: '#f2d9a6' },
  { id: 'soft', name: '软组织', ww: 400, wc: 40, opacity: 0.5, transfer: 'linear', description: '软组织窗, 观察牙龈与黏膜轮廓', color: '#e8a0a0' },
  { id: 'airway', name: '气道', ww: 1500, wc: -600, opacity: 0.35, transfer: 'lung', description: '上气道通道显影, 评估 OSA 与气道容积', color: '#8fb8e8' },
  { id: 'nerve', name: '神经管', ww: 1200, wc: 300, opacity: 0.9, transfer: 'hot', description: '下颌神经管高亮, 种植风险规避', color: '#ff4d4f' },
  { id: 'implant', name: '种植体', ww: 4000, wc: 1200, opacity: 1, transfer: 'metal', description: '钛金属高密度增强, 评估骨整合', color: '#d9d9d9' },
  { id: 'enamel', name: '牙釉质', ww: 3500, wc: 800, opacity: 0.9, transfer: 'bone', description: '牙釉质/牙本质高亮, 龋坏评估', color: '#e8f4ff' },
  { id: 'sinus', name: '上颌窦', ww: 1000, wc: 100, opacity: 0.6, transfer: 'soft', description: '上颌窦黏膜与窦腔显影', color: '#7ec8e8' },
  { id: 'mpr', name: 'MPR 灰阶', ww: 1500, wc: 500, opacity: 1, transfer: 'linear', description: '标准三平面灰阶重建', color: '#ffffff' },
]

// 曲断重建牙弓路径点 (25 点, 沿牙弓展开)
const SEED_CBCT_CURVE_POINTS: Array<{ x: number; y: number; z: number }> = [
  { x: -55, y: 28, z: 0 }, { x: -50, y: 22, z: 0 }, { x: -45, y: 17, z: 0 }, { x: -40, y: 13, z: 0 },
  { x: -35, y: 10, z: 0 }, { x: -30, y: 8, z: 0 }, { x: -25, y: 6, z: 0 }, { x: -20, y: 5, z: 0 },
  { x: -15, y: 5, z: 0 }, { x: -10, y: 5, z: 0 }, { x: -5, y: 5, z: 0 }, { x: 0, y: 5, z: 0 },
  { x: 5, y: 5, z: 0 }, { x: 10, y: 5, z: 0 }, { x: 15, y: 5, z: 0 }, { x: 20, y: 5, z: 0 },
  { x: 25, y: 6, z: 0 }, { x: 30, y: 8, z: 0 }, { x: 35, y: 10, z: 0 }, { x: 40, y: 13, z: 0 },
  { x: 45, y: 17, z: 0 }, { x: 50, y: 22, z: 0 }, { x: 55, y: 28, z: 0 },
]
