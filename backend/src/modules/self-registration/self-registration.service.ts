/**
 * [G005 W12-PatientService] 自助登记服务 (orphan module, DB-less-safe)
 *
 * 患者自助闭环:
 *   - POST /self-registration/identify      身份识别 (身份证/手机号/EMPI)
 *   - POST /self-registration/check-in      自助签到 (建档/到检)
 *   - POST /self-registration/questionnaire 检查前问卷 (准备/过敏)
 *   - POST /self-registration/consent       知情同意签署
 *   - POST /self-registration/queue-number  取号 (排队序号)
 *   - GET  /self-registration/status/:patientId  自助状态汇总
 *
 * 无 DB 可启动: 内存 overlay + 确定性 seed, 同一输入恒同输出。
 */
import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface SelfPatientDto {
  patientId: string
  name: string
  gender: 'MALE' | 'FEMALE' | 'OTHER'
  birthDate: string
  age: number
  idCard: string
  phone: string
  empiId: string
  insuranceNo?: string
}

export interface IdentifyResultDto {
  query: { idCard?: string; phone?: string; empiId?: string; name?: string }
  matched: SelfPatientDto | null
  candidates: SelfPatientDto[]
  needQuestionnaire: boolean
  prepRequired: boolean
  source: 'db' | 'seed'
  identifiedAt: string
}

export type CheckInStatus = 'CHECKED_IN' | 'ALREADY_CHECKED_IN' | 'BLOCKED'

export interface CheckInResultDto {
  id: string
  patientId: string
  patientName: string
  visitId: string
  appointmentId?: string
  status: CheckInStatus
  blockers: string[]
  booth: string
  checkedInAt: string
}

export interface QuestionnaireDto {
  patientId: string
  answers: Record<string, string | number | boolean>
  allergyFlag: boolean
  pregnancyFlag: boolean
  fastingConfirmed: boolean
  implantFlag: boolean
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  riskNotes: string[]
  prepItems: Array<{ key: string; label: string; required: boolean }>
  submittedAt: string
}

export type ConsentStatus = 'signed' | 'refused'

export interface SelfConsentDto {
  id: string
  patientId: string
  visitId: string
  consentType: string
  procedure: string
  agreed: boolean
  status: ConsentStatus
  signedBy?: string
  witnessName?: string
  signedAt: string
  signatureHash: string
}

export interface QueueNumberDto {
  ticket: string
  patientId: string
  patientName: string
  visitId: string
  modality: string
  priority: 'NORMAL' | 'URGENT' | 'EMERGENCY'
  position: number
  estimatedWaitMinutes: number
  room: string
  issuedAt: string
}

const PATIENT_SEED: SelfPatientDto[] = [
  { patientId: 'P100001', name: '张伟', gender: 'MALE', birthDate: '1968-03-12', age: 58, idCard: '110101196803120011', phone: '13800001001', empiId: 'EMPI-000001', insuranceNo: 'YB-1101010001' },
  { patientId: 'P100002', name: '李娜', gender: 'FEMALE', birthDate: '1992-11-05', age: 33, idCard: '110101199211050028', phone: '13800001002', empiId: 'EMPI-000002', insuranceNo: 'YB-1101010002' },
  { patientId: 'P100003', name: '王芳', gender: 'FEMALE', birthDate: '1974-06-20', age: 52, idCard: 'E12345678', phone: '13800001003', empiId: 'EMPI-000003', insuranceNo: 'YB-1101010003' },
  { patientId: 'P100004', name: '陈杰', gender: 'MALE', birthDate: '1986-01-30', age: 40, idCard: '110101198601300037', phone: '13800001004', empiId: 'EMPI-000004', insuranceNo: 'YB-1101010004' },
]

const PREP_ITEMS: Array<{ key: string; label: string; required: boolean }> = [
  { key: 'fasting', label: '禁食 4-6 小时 (增强/腹部检查)', required: true },
  { key: 'metal', label: '去除金属物品 / 磁卡 (MR)', required: true },
  { key: 'water', label: '检查前适量饮水充盈膀胱 (腹部/盆腔)', required: false },
  { key: 'bowel', label: '肠道准备 (结肠相关检查)', required: false },
  { key: 'renal', label: '提供近期肾功能报告 (增强)', required: true },
]

function hashNum(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

@Injectable()
export class SelfRegistrationService {
  private readonly logger = new Logger(SelfRegistrationService.name)
  private readonly checkIns = new Map<string, CheckInResultDto>()
  private readonly questionnaires = new Map<string, QuestionnaireDto>()
  private readonly consents = new Map<string, SelfConsentDto[]>()
  private readonly queues = new Map<string, QueueNumberDto[]>()
  private checkInSeq = 0
  private consentSeq = 0
  private ticketSeq = 0

  constructor(@Optional() private readonly prisma?: PrismaService) {
    if (!prisma) this.logger.log('SelfRegistrationService: no Prisma injected (orphan mode, memory overlay + deterministic seed)')
  }

  private findPatient(query: { patientId?: string; idCard?: string; phone?: string; empiId?: string; name?: string }): SelfPatientDto | null {
    const { patientId, idCard, phone, empiId, name } = query
    return (
      PATIENT_SEED.find((p) =>
        (patientId && p.patientId === patientId) ||
        (idCard && p.idCard === idCard) ||
        (phone && p.phone === phone) ||
        (empiId && p.empiId === empiId) ||
        (name && p.name === name),
      ) ?? null
    )
  }

  // ──────────────────────────────────────────────────────────────────────────
  // identify
  // ──────────────────────────────────────────────────────────────────────────

  /** POST /self-registration/identify */
  identify(body: { idCard?: string; phone?: string; empiId?: string; name?: string }): IdentifyResultDto {
    if (!body.idCard && !body.phone && !body.empiId && !body.name) {
      throw new BadRequestException('请至少提供身份证号 / 手机号 / EMPI / 姓名之一')
    }
    const matched = this.findPatient(body)
    const candidates = matched
      ? PATIENT_SEED
      : PATIENT_SEED.filter((p) => (body.name ? p.name.includes(body.name) : false))
    return {
      query: body,
      matched,
      candidates: candidates.length > 0 ? candidates : PATIENT_SEED,
      needQuestionnaire: true,
      prepRequired: true,
      source: 'seed',
      identifiedAt: new Date().toISOString(),
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // check-in
  // ──────────────────────────────────────────────────────────────────────────

  /** POST /self-registration/check-in */
  checkIn(body: { patientId: string; visitId?: string; appointmentId?: string }): CheckInResultDto {
    if (!body.patientId?.trim()) throw new BadRequestException('patientId 不能为空')
    const patient = this.findPatient({ patientId: body.patientId })
    if (!patient) throw new NotFoundException(`患者 ${body.patientId} 不存在`)
    const existing = this.checkIns.get(patient.patientId)
    if (existing && existing.status === 'CHECKED_IN') {
      return { ...existing, status: 'ALREADY_CHECKED_IN' }
    }
    const blockers: string[] = []
    const questionnaire = this.questionnaires.get(patient.patientId)
    if (!questionnaire) blockers.push('未完成检查前问卷')
    const consentList = this.consents.get(patient.patientId) ?? []
    if (consentList.length === 0) blockers.push('未签署知情同意')
    const visitId = body.visitId ?? `V${new Date().getFullYear()}${String(hashNum(patient.patientId) % 100000).padStart(5, '0')}`
    const record: CheckInResultDto = {
      id: `CI-${String(++this.checkInSeq).padStart(6, '0')}`,
      patientId: patient.patientId,
      patientName: patient.name,
      visitId,
      appointmentId: body.appointmentId,
      status: blockers.length === 0 ? 'CHECKED_IN' : 'BLOCKED',
      blockers,
      booth: `自助机-${1 + (hashNum(patient.patientId) % 4)}`,
      checkedInAt: new Date().toISOString(),
    }
    this.checkIns.set(patient.patientId, record)
    return record
  }

  // ──────────────────────────────────────────────────────────────────────────
  // questionnaire
  // ──────────────────────────────────────────────────────────────────────────

  /** POST /self-registration/questionnaire — 准备/过敏问卷 */
  submitQuestionnaire(body: {
    patientId: string
    allergies?: string[]
    pregnant?: boolean
    fastingConfirmed?: boolean
    implants?: string[]
    contrastHistory?: boolean
    claustrophobia?: boolean
    answers?: Record<string, string | number | boolean>
  }): QuestionnaireDto {
    if (!body.patientId?.trim()) throw new BadRequestException('patientId 不能为空')
    const patient = this.findPatient({ patientId: body.patientId })
    if (!patient) throw new NotFoundException(`患者 ${body.patientId} 不存在`)
    const allergies = body.allergies ?? []
    const implants = body.implants ?? []
    const allergyFlag = allergies.length > 0
    const pregnancyFlag = Boolean(body.pregnant)
    const implantFlag = implants.length > 0
    const fastingConfirmed = body.fastingConfirmed !== false
    const riskNotes: string[] = []
    if (allergyFlag) riskNotes.push(`过敏史: ${allergies.join('、')}`)
    if (pregnancyFlag) riskNotes.push('妊娠状态, 慎用辐射/对比剂')
    if (implantFlag) riskNotes.push(`体内植入物: ${implants.join('、')}`)
    if (body.claustrophobia) riskNotes.push('幽闭恐惧, 需镇静评估')
    if (!fastingConfirmed) riskNotes.push('未确认禁食准备')
    const riskLevel: QuestionnaireDto['riskLevel'] = allergyFlag || pregnancyFlag || implantFlag
      ? 'HIGH'
      : riskNotes.length > 0 ? 'MEDIUM' : 'LOW'
    const record: QuestionnaireDto = {
      patientId: patient.patientId,
      answers: body.answers ?? {},
      allergyFlag,
      pregnancyFlag,
      fastingConfirmed,
      implantFlag,
      riskLevel,
      riskNotes,
      prepItems: PREP_ITEMS.map((p) => ({ ...p })),
      submittedAt: new Date().toISOString(),
    }
    this.questionnaires.set(patient.patientId, record)
    return record
  }

  getQuestionnaire(patientId: string): QuestionnaireDto | null {
    return this.questionnaires.get(patientId) ?? null
  }

  // ──────────────────────────────────────────────────────────────────────────
  // consent
  // ──────────────────────────────────────────────────────────────────────────

  /** POST /self-registration/consent — 知情同意签署 */
  signConsent(body: {
    patientId: string
    visitId?: string
    consentType?: string
    procedure?: string
    agreed?: boolean
    signedBy?: string
    witnessName?: string
    signature?: string
  }): SelfConsentDto {
    if (!body.patientId?.trim()) throw new BadRequestException('patientId 不能为空')
    const patient = this.findPatient({ patientId: body.patientId })
    if (!patient) throw new NotFoundException(`患者 ${body.patientId} 不存在`)
    const agreed = body.agreed !== false
    if (agreed && !body.signature?.trim() && !body.signedBy?.trim()) {
      throw new BadRequestException('同意时需提供签名或签署人')
    }
    const record: SelfConsentDto = {
      id: `SC-${String(++this.consentSeq).padStart(6, '0')}`,
      patientId: patient.patientId,
      visitId: body.visitId ?? `V${hashNum(patient.patientId) % 100000}`,
      consentType: body.consentType ?? 'contrast',
      procedure: body.procedure ?? '影像检查及对比剂使用',
      agreed,
      status: agreed ? 'signed' : 'refused',
      signedBy: body.signedBy,
      witnessName: body.witnessName,
      signedAt: new Date().toISOString(),
      signatureHash: hashNum(`${patient.patientId}:${body.signature ?? body.signedBy ?? ''}`).toString(16),
    }
    const list = this.consents.get(patient.patientId) ?? []
    list.push(record)
    this.consents.set(patient.patientId, list)
    return record
  }

  listConsents(patientId: string): SelfConsentDto[] {
    return this.consents.get(patientId) ?? []
  }

  // ──────────────────────────────────────────────────────────────────────────
  // queue number
  // ──────────────────────────────────────────────────────────────────────────

  /** POST /self-registration/queue-number — 取号 */
  issueQueueNumber(body: {
    patientId: string
    visitId?: string
    modality?: string
    priority?: 'NORMAL' | 'URGENT' | 'EMERGENCY'
  }): QueueNumberDto {
    if (!body.patientId?.trim()) throw new BadRequestException('patientId 不能为空')
    const patient = this.findPatient({ patientId: body.patientId })
    if (!patient) throw new NotFoundException(`患者 ${body.patientId} 不存在`)
    const modality = (body.modality ?? 'CT').toUpperCase()
    const priority = body.priority ?? 'NORMAL'
    const prefix = modality.slice(0, 1)
    const seq = ++this.ticketSeq
    const priorityBoost = priority === 'EMERGENCY' ? -0 : priority === 'URGENT' ? 1 : 2
    const position = Math.max(1, priorityBoost + (hashNum(patient.patientId + modality) % 4))
    const record: QueueNumberDto = {
      ticket: `${prefix}${String(seq).padStart(3, '0')}`,
      patientId: patient.patientId,
      patientName: patient.name,
      visitId: body.visitId ?? `V${hashNum(patient.patientId) % 100000}`,
      modality,
      priority,
      position,
      estimatedWaitMinutes: position * 8,
      room: `${modality}-${1 + (hashNum(modality) % 3)}`,
      issuedAt: new Date().toISOString(),
    }
    const list = this.queues.get(modality) ?? []
    list.push(record)
    this.queues.set(modality, list)
    return record
  }

  listQueue(modality: string): QueueNumberDto[] {
    return this.queues.get(modality.toUpperCase()) ?? []
  }

  // ──────────────────────────────────────────────────────────────────────────
  // status
  // ──────────────────────────────────────────────────────────────────────────

  /** GET /self-registration/status/:patientId */
  status(patientId: string): {
    patientId: string
    checkedIn: boolean
    checkIn: CheckInResultDto | null
    questionnaireDone: boolean
    consentSigned: boolean
    queue: QueueNumberDto | null
  } {
    const checkIn = this.checkIns.get(patientId) ?? null
    const consentList = this.consents.get(patientId) ?? []
    let queue: QueueNumberDto | null = null
    for (const list of this.queues.values()) {
      const found = list.find((q) => q.patientId === patientId)
      if (found) queue = found
    }
    return {
      patientId,
      checkedIn: checkIn?.status === 'CHECKED_IN' || checkIn?.status === 'ALREADY_CHECKED_IN',
      checkIn,
      questionnaireDone: this.questionnaires.has(patientId),
      consentSigned: consentList.some((c) => c.status === 'signed'),
      queue,
    }
  }
}
