/**
 * G005 放射RIS系统 - 登记工作站服务 (orphan module, DB-less-safe)
 *
 * 覆盖:
 *   - GET  /registration/scan              条码 / 二维码 / 身份证号 / EMPI / 手机号 → 患者检索
 *   - POST /registration/:visitId/prep-confirm 准备项合规确认 (检查前清单)
 *   - POST /registration/:visitId/consent      预约/登记采集知情同意
 *   - GET  /registration/:visitId/charge       缴费单 (费用明细)
 *   - POST /registration/:visitId/pay          缴费 (stub, 可接 finance)
 *
 * 无 DB 时全部走内存 overlay + 确定性 seed, 同一输入恒同输出。
 */
import { BadRequestException, Injectable, Logger, Optional } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { currentTenantId } from '../../common/tenant/tenant-utils'
import {
  seedClinicalProfile,
  type ClinicalProfileDto,
  type IdType,
} from '../patient/patient.service'

export interface RegistrationPatient {
  patientId: string
  name: string
  gender: 'MALE' | 'FEMALE' | 'OTHER'
  birthDate: string
  age: number
  idType: IdType
  documentNo: string
  empiId: string
  insuranceNo?: string
  phone?: string
  isolationFlag: ClinicalProfileDto['isolationFlag']
  structuredAllergyCodes: ClinicalProfileDto['structuredAllergyCodes']
  pregnancyStatus: ClinicalProfileDto['pregnancyStatus']
  renalFunction: ClinicalProfileDto['renalFunction']
  vitals: ClinicalProfileDto['vitals']
}

export interface ScanResult {
  query: string
  type: string
  matched: RegistrationPatient | null
  candidates: RegistrationPatient[]
  source: 'db' | 'seed'
  scannedAt: string
}

export interface PrepItem {
  key: string
  label: string
  required: boolean
  checked: boolean
}

export interface PrepConfirmResult {
  visitId: string
  items: PrepItem[]
  allRequiredChecked: boolean
  pendingKeys: string[]
  confirmedBy?: string
  confirmedAt: string
}

export interface ConsentRecordDto {
  id: string
  visitId: string
  patientId?: string
  consentType: string
  procedure: string
  agreed: boolean
  signedBy?: string
  witnessName?: string
  signedAt: string
  status: 'signed' | 'refused' | 'pending'
}

export interface ChargeItemDto {
  code: string
  name: string
  category: string
  unitPrice: number
  quantity: number
  amount: number
  insuranceEligible: boolean
}

export interface ChargeDto {
  visitId: string
  visitNumber: string
  patientId: string
  patientName: string
  items: ChargeItemDto[]
  totalAmount: number
  insuranceAmount: number
  selfPayAmount: number
  paidAmount: number
  balance: number
  status: 'UNPAID' | 'PARTIAL' | 'PAID'
  updatedAt: string
}

export const DEFAULT_PREP_ITEMS: ReadonlyArray<{ key: string; label: string; required: boolean }> = [
  { key: 'identity', label: '患者身份双标识核对 (姓名 + 证件号)', required: true },
  { key: 'order', label: '申请单与检查项目核对', required: true },
  { key: 'consent', label: '知情同意已签署', required: true },
  { key: 'allergy', label: '过敏史 / 对比剂禁忌评估', required: true },
  { key: 'pregnancy', label: '育龄女性妊娠状态确认', required: true },
  { key: 'renal', label: '肾功能 (eGFR) 评估', required: false },
  { key: 'isolation', label: '隔离 / 感染防护确认', required: false },
  { key: 'prep', label: '检查前准备 (禁食/肠道准备/金属物品)', required: false },
  { key: 'barcode', label: '条码 / 腕带打印', required: false },
]

const FALLBACK_PATIENTS: RegistrationPatient[] = [
  {
    patientId: 'P100001',
    name: '张伟',
    gender: 'MALE',
    birthDate: '1968-03-12',
    age: 58,
    idType: 'ID_CARD',
    documentNo: '110101196803120011',
    empiId: 'EMPI-000001',
    insuranceNo: 'YB-1101010001',
    phone: '13800001001',
    isolationFlag: 'NONE',
    structuredAllergyCodes: [{ code: '373255001', display: '碘对比剂过敏', severity: 'MODERATE', reaction: '皮疹/瘙痒' }],
    pregnancyStatus: 'NOT_APPLICABLE',
    renalFunction: { egfr: 78, creatinine: 92, egfrSource: 'LIS', measuredAt: '2026-08-07T07:30:00.000Z' },
    vitals: { systolicBp: 158, diastolicBp: 92, heartRate: 88, temperature: 36.8, spo2: 96, respiratoryRate: 18, measuredAt: '2026-08-07T08:40:00.000Z' },
  },
  {
    patientId: 'P100002',
    name: '李娜',
    gender: 'FEMALE',
    birthDate: '1992-11-05',
    age: 33,
    idType: 'ID_CARD',
    documentNo: '110101199211050028',
    empiId: 'EMPI-000002',
    insuranceNo: 'YB-1101010002',
    phone: '13800001002',
    isolationFlag: 'CONTACT',
    structuredAllergyCodes: [],
    pregnancyStatus: 'PREGNANT',
    renalFunction: { egfr: 102, creatinine: 61, egfrSource: 'CALCULATED', measuredAt: '2026-08-07T08:10:00.000Z' },
    vitals: { systolicBp: 112, diastolicBp: 70, heartRate: 96, temperature: 36.6, spo2: 99, respiratoryRate: 16, measuredAt: '2026-08-07T08:42:00.000Z' },
  },
  {
    patientId: 'P100003',
    name: '王芳',
    gender: 'FEMALE',
    birthDate: '1974-06-20',
    age: 52,
    idType: 'PASSPORT',
    documentNo: 'E12345678',
    empiId: 'EMPI-000003',
    insuranceNo: 'YB-1101010003',
    phone: '13800001003',
    isolationFlag: 'NONE',
    structuredAllergyCodes: [{ code: '294595009', display: '青霉素过敏', severity: 'MILD', reaction: '皮疹' }],
    pregnancyStatus: 'NOT_APPLICABLE',
    renalFunction: { egfr: 68, creatinine: 88, egfrSource: 'MANUAL', measuredAt: '2026-08-06T09:00:00.000Z' },
    vitals: { systolicBp: 132, diastolicBp: 84, heartRate: 76, temperature: 36.5, spo2: 97, respiratoryRate: 17, measuredAt: '2026-08-07T08:20:00.000Z' },
  },
  {
    patientId: 'P100004',
    name: '陈杰',
    gender: 'MALE',
    birthDate: '1986-01-30',
    age: 40,
    idType: 'ID_CARD',
    documentNo: '110101198601300037',
    empiId: 'EMPI-000004',
    insuranceNo: 'YB-1101010004',
    phone: '13800001004',
    isolationFlag: 'DROPLET',
    structuredAllergyCodes: [],
    pregnancyStatus: 'NOT_APPLICABLE',
    renalFunction: { egfr: 41, creatinine: 152, egfrSource: 'LIS', measuredAt: '2026-08-07T07:50:00.000Z' },
    vitals: { systolicBp: 176, diastolicBp: 104, heartRate: 118, temperature: 38.4, spo2: 92, respiratoryRate: 24, measuredAt: '2026-08-07T08:44:00.000Z' },
  },
]

function ageFrom(birthDate: string): number {
  const d = new Date(birthDate)
  if (Number.isNaN(d.getTime())) return 0
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / (365.25 * 86400_000)))
}

function hashNum(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

@Injectable()
export class RegistrationService {
  private readonly logger = new Logger(RegistrationService.name)

  private readonly prepResults = new Map<string, PrepConfirmResult>()
  private readonly consents = new Map<string, ConsentRecordDto[]>()
  private readonly charges = new Map<string, ChargeDto>()
  private readonly extraPatients = new Map<string, RegistrationPatient>()
  private consentSeq = 0

  constructor(@Optional() private readonly prisma?: PrismaService) {
    if (!prisma) this.logger.log('RegistrationService: no Prisma injected (orphan mode, memory overlay + seed fallback)')
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 患者检索 (条码/二维码/身份证号/EMPI/手机号)
  // ────────────────────────────────────────────────────────────────────────────

  private allSeedPatients(): RegistrationPatient[] {
    return [...this.extraPatients.values(), ...FALLBACK_PATIENTS]
  }

  private matchPatients(query: string): RegistrationPatient[] {
    const q = query.trim()
    if (!q) return []
    const lower = q.toLowerCase()
    return this.allSeedPatients().filter((p) =>
      p.patientId.toLowerCase() === lower ||
      p.empiId.toLowerCase() === lower ||
      p.documentNo.toLowerCase() === lower ||
      (p.insuranceNo ?? '').toLowerCase() === lower ||
      (p.phone ?? '') === q ||
      p.name.includes(q),
    )
  }

  private async lookupDb(query: string): Promise<RegistrationPatient | null> {
    if (!this.prisma?.patient?.findFirst) return null
    try {
      const p = await this.prisma.patient.findFirst({
        where: {
          tenantId: currentTenantId(),
          deletedAt: null,
          OR: [{ id: query }, { idCard: query }, { phone: query }, { name: query }],
        },
      })
      if (!p) return null
      const profile = seedClinicalProfile(p.id)
      return {
        patientId: p.id,
        name: p.name,
        gender: (p.gender as RegistrationPatient['gender']) ?? 'OTHER',
        birthDate: p.birthDate ? p.birthDate.toISOString().slice(0, 10) : '',
        age: p.birthDate ? ageFrom(p.birthDate.toISOString()) : 0,
        idType: profile.idType,
        documentNo: p.idCard ?? profile.documentNo ?? '',
        empiId: profile.empiId,
        insuranceNo: profile.insuranceNo,
        phone: p.phone ?? undefined,
        isolationFlag: profile.isolationFlag,
        structuredAllergyCodes: profile.structuredAllergyCodes,
        pregnancyStatus: profile.pregnancyStatus,
        renalFunction: profile.renalFunction,
        vitals: profile.vitals,
      }
    } catch {
      return null
    }
  }

  /** GET /registration/scan?code=&type= — 解码条码/二维码/身份证号并检索患者 */
  async scan(code: string, type?: string): Promise<ScanResult> {
    const query = (code ?? '').trim()
    if (!query) throw new BadRequestException('扫描内容不能为空')
    const dbMatch = await this.lookupDb(query)
    const seeded = this.matchPatients(query)
    const matched = dbMatch ?? seeded[0] ?? null
    return {
      query,
      type: type ?? this.inferScanType(query),
      matched,
      candidates: dbMatch ? [dbMatch, ...seeded.filter((p) => p.patientId !== dbMatch.patientId)] : seeded,
      source: dbMatch ? 'db' : 'seed',
      scannedAt: new Date().toISOString(),
    }
  }

  private inferScanType(query: string): string {
    if (/^EMPI-/i.test(query)) return 'EMPI'
    if (/^\d{17}[\dXx]$/.test(query)) return 'ID_CARD'
    if (/^1[3-9]\d{9}$/.test(query)) return 'PHONE'
    if (/^(BC|QR)/i.test(query)) return 'BARCODE'
    return 'UNKNOWN'
  }

  /** 供前端登记页组合调用: 直接按 patientId 取患者档案 */
  async getPatient(patientId: string): Promise<RegistrationPatient | null> {
    const dbMatch = await this.lookupDb(patientId)
    if (dbMatch) return dbMatch
    return this.allSeedPatients().find((p) => p.patientId === patientId) ?? null
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 准备项确认
  // ────────────────────────────────────────────────────────────────────────────

  /** POST /registration/:visitId/prep-confirm — 准备项合规确认 */
  async prepConfirm(
    visitId: string,
    body: { items?: PrepItem[]; confirmedBy?: string },
  ): Promise<PrepConfirmResult> {
    const provided = Array.isArray(body.items) ? body.items : []
    const items: PrepItem[] = DEFAULT_PREP_ITEMS.map((def) => {
      const incoming = provided.find((i) => i.key === def.key)
      return { key: def.key, label: incoming?.label ?? def.label, required: incoming?.required ?? def.required, checked: Boolean(incoming?.checked) }
    })
    const pendingKeys = items.filter((i) => i.required && !i.checked).map((i) => i.key)
    const result: PrepConfirmResult = {
      visitId,
      items,
      allRequiredChecked: pendingKeys.length === 0,
      pendingKeys,
      confirmedBy: body.confirmedBy,
      confirmedAt: new Date().toISOString(),
    }
    this.prepResults.set(visitId, result)
    return result
  }

  getPrepConfirm(visitId: string): PrepConfirmResult | null {
    return this.prepResults.get(visitId) ?? null
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 知情同意
  // ────────────────────────────────────────────────────────────────────────────

  /** POST /registration/:visitId/consent — 预约/登记采集知情同意 */
  async recordConsent(
    visitId: string,
    body: { patientId?: string; consentType?: string; procedure?: string; agreed?: boolean; signedBy?: string; witnessName?: string },
  ): Promise<ConsentRecordDto> {
    const record: ConsentRecordDto = {
      id: `consent-${++this.consentSeq}`,
      visitId,
      patientId: body.patientId,
      consentType: body.consentType ?? 'registration',
      procedure: body.procedure ?? '影像检查登记',
      agreed: body.agreed !== false,
      signedBy: body.signedBy,
      witnessName: body.witnessName,
      signedAt: new Date().toISOString(),
      status: body.agreed === false ? 'refused' : 'signed',
    }
    const list = this.consents.get(visitId) ?? []
    list.push(record)
    this.consents.set(visitId, list)
    return record
  }

  listConsents(visitId: string): ConsentRecordDto[] {
    return this.consents.get(visitId) ?? []
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 缴费
  // ────────────────────────────────────────────────────────────────────────────

  private seedCharge(visitId: string): ChargeDto {
    const h = hashNum(visitId || 'VISIT')
    const patient = this.allSeedPatients()[h % this.allSeedPatients().length]!
    const catalog: Array<{ code: string; name: string; category: string; price: number; ins: boolean }> = [
      { code: 'EXAM-CT', name: 'CT 平扫 (单部位)', category: '检查费', price: 380, ins: true },
      { code: 'EXAM-CT-ENH', name: 'CT 增强 (含对比剂)', category: '检查费', price: 680, ins: true },
      { code: 'CONTRAST', name: '碘对比剂 (碘海醇 300mgI/ml)', category: '药品费', price: 260, ins: false },
      { code: 'FILM', name: '激光胶片 (14x17)', category: '材料费', price: 45, ins: false },
      { code: 'SERVICE', name: '影像诊断服务费', category: '服务费', price: 120, ins: true },
    ]
    const count = 2 + (h % 3)
    const items: ChargeItemDto[] = catalog.slice(0, count).map((c) => ({
      code: c.code,
      name: c.name,
      category: c.category,
      unitPrice: c.price,
      quantity: 1,
      amount: c.price,
      insuranceEligible: c.ins,
    }))
    const totalAmount = items.reduce((a, i) => a + i.amount, 0)
    const insuranceAmount = Math.round(items.filter((i) => i.insuranceEligible).reduce((a, i) => a + i.amount, 0) * 0.7)
    return {
      visitId,
      visitNumber: `V${new Date().getFullYear()}${String(h % 100000).padStart(5, '0')}`,
      patientId: patient.patientId,
      patientName: patient.name,
      items,
      totalAmount,
      insuranceAmount,
      selfPayAmount: totalAmount - insuranceAmount,
      paidAmount: 0,
      balance: totalAmount,
      status: 'UNPAID',
      updatedAt: new Date().toISOString(),
    }
  }

  /** GET /registration/:visitId/charge — 缴费单 */
  getCharge(visitId: string): ChargeDto {
    const existing = this.charges.get(visitId)
    if (existing) return existing
    const seeded = this.seedCharge(visitId)
    this.charges.set(visitId, seeded)
    return seeded
  }

  /** POST /registration/:visitId/pay — 缴费 (stub; 可接 finance) */
  async pay(visitId: string, body: { amount?: number; method?: string; operator?: string }): Promise<ChargeDto & { method: string; paidAt: string; operator?: string }> {
    const charge = this.getCharge(visitId)
    const amount = body.amount ?? charge.balance
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('缴费金额必须大于 0')
    const paidAmount = Math.min(charge.totalAmount, charge.paidAmount + amount)
    const balance = Math.max(0, charge.totalAmount - paidAmount)
    const updated: ChargeDto = {
      ...charge,
      paidAmount,
      balance,
      status: balance <= 0 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID',
      updatedAt: new Date().toISOString(),
    }
    this.charges.set(visitId, updated)
    return { ...updated, method: body.method ?? 'CASH', paidAt: new Date().toISOString(), operator: body.operator }
  }
}
