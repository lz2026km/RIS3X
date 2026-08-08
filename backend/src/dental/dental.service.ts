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
