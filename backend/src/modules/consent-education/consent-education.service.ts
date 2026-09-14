import { Injectable, NotFoundException } from '@nestjs/common'

// ============================================================
// [G005 Wave1A] Consent Education — 知情同意/宣教模块 (进程内存 + 确定性 seed)
// [v3.0.6.11-104 Wave 3C] 知情同意落库绑定:
//   - 同意记录新增 patientId / examId 外键绑定 (orphan 内存 overlay + seed 回退, 不改 prisma schema)
//   - type 扩展 pediatric(儿童) / pregnancy(孕妇)
//   - status 扩展 pending/signed/refused/expired
//   - signedAt / witnessName(见证人)
//   - GET /consent-education/verify?examId=&type= 供增强检查/对比剂注射前校验
// 路径双轨: /consent-education/records(新) 与 /consent-education/consents(前端现有) 指向同一存储
// ============================================================

export type ConsentStatus = 'pending' | 'signed' | 'refused' | 'expired'

export const CONSENT_STATUSES: ConsentStatus[] = ['pending', 'signed', 'refused', 'expired']

/** 扩展同意书类型 (含儿童 / 孕妇), 以 string 承载以兼容既有中文类型别名 */
export const CONSENT_TYPES = [
  'enhanced',
  'interventional',
  'mri',
  'surgery',
  'anesthesia',
  'transfusion',
  'radiotherapy',
  'pediatric',
  'pregnancy',
  'general',
] as const

export interface ConsentRecord {
  id: string
  /** 关联患者 (可选, 落库绑定的外键) */
  patientId: string | null
  patient: string
  /** 关联检查 (可选, 增强检查/注射前校验用) */
  examId: string | null
  type: string
  procedure: string
  signedAt: string | null
  status: ConsentStatus
  /** 兼容旧字段: 见证人 */
  witness: string | null
  /** 见证人 (Wave 3C 新字段) */
  witnessName: string | null
  signedBy?: string
  createdAt: string
  updatedAt?: string
}

export interface ConsentVerification {
  examId: string
  type: string | null
  /** 是否已签署 (存在 signed 记录) */
  signed: boolean
  /** 是否需要校验 (存在未签记录 或 检查被判定为增强/特殊检查) */
  required: boolean
  status: ConsentStatus | null
  recordId: string | null
  checkedAt: string
}

export interface ConsentGateResult {
  required: boolean
  signed: boolean
  status: ConsentStatus | null
  recordId: string | null
}

export interface ConsentListFilter {
  patientId?: string
  examId?: string
  status?: string
  type?: string
}

export interface CreateConsentInput {
  patient?: string
  patientId?: string
  examId?: string
  type?: string
  procedure?: string
  witnessName?: string
}

export interface EducationMaterialDto {
  id: string
  title: string
  lang: string
  category: string
  pages: number
  views: number
  format: string
  content?: string
  summary?: string
  createdAt: string
}

const SEED_CONSENTS: ConsentRecord[] = [
  { id: 'C-001', patientId: 'P-SEED-001', patient: '张三', examId: 'EX-SEED-001', type: 'enhanced', procedure: '胸部增强CT扫描 (含对比剂注射)', signedAt: '2026-08-05T09:30:00Z', status: 'signed', witness: '王护士', witnessName: '王护士', signedBy: '李医生', createdAt: '2026-08-05' },
  { id: 'C-002', patientId: 'P-SEED-002', patient: '李四', examId: 'EX-SEED-002', type: 'interventional', procedure: 'CT 引导下经皮肺穿刺活检', signedAt: '2026-08-06T14:10:00Z', status: 'signed', witness: '张护士', witnessName: '张护士', signedBy: '赵医生', createdAt: '2026-08-06' },
  { id: 'C-003', patientId: 'P-SEED-003', patient: '王五', examId: 'EX-SEED-003', type: 'mri', procedure: '颅脑MRI平扫 (含幽闭恐惧症告知)', signedAt: null, status: 'pending', witness: null, witnessName: null, createdAt: '2026-08-08' },
  { id: 'C-004', patientId: 'P-SEED-004', patient: '陈丽', examId: null, type: 'enhanced', procedure: '腹部增强CT扫描', signedAt: null, status: 'refused', witness: null, witnessName: null, signedBy: '刘医生', createdAt: '2026-08-07' },
  { id: 'C-005', patientId: 'P-SEED-005', patient: '小宇', examId: 'EX-SEED-005', type: 'pediatric', procedure: '儿童胸部CT平扫 (镇静/铅防护告知)', signedAt: '2026-08-09T10:00:00Z', status: 'signed', witness: '周护士', witnessName: '周护士', signedBy: '钱医生', createdAt: '2026-08-09' },
  { id: 'C-006', patientId: 'P-SEED-006', patient: '孙婷', examId: 'EX-SEED-006', type: 'pregnancy', procedure: '孕期腹部超声检查 (胎儿辐射风险告知)', signedAt: null, status: 'pending', witness: null, witnessName: null, createdAt: '2026-08-10' },
]

const SEED_MATERIALS: EducationMaterialDto[] = [
  { id: 'M-001', title: 'CT 增强检查须知', lang: 'zh-CN', category: '增强检查', pages: 2, views: 1280, format: 'PDF', summary: '对比剂过敏风险与注意事项', content: '检查前禁食 4 小时; 有碘对比剂过敏史请提前告知医生…', createdAt: '2026-05-01' },
  { id: 'M-002', title: 'MRI 检查安全须知', lang: 'zh-CN', category: '核磁共振', pages: 3, views: 960, format: 'PDF', summary: '体内植入物筛查与幽闭恐惧症告知', content: '检查前请移除金属物品; 装有心脏起搏器者禁止进入扫描间…', createdAt: '2026-05-03' },
  { id: 'M-003', title: 'CT 引导下穿刺活检介绍', lang: 'zh-CN', category: '介入', pages: 4, views: 340, format: 'PDF', summary: '穿刺流程与风险', createdAt: '2026-06-10' },
  { id: 'M-004', title: 'Radiology Contrast Safety', lang: 'en', category: 'Contrast', pages: 2, views: 120, format: 'PDF', summary: 'English contrast safety guidance', createdAt: '2026-06-15' },
]

// 进程内 orphan overlay (无 DB 亦可运行); 与 seed 合并对外可见
const memConsents: ConsentRecord[] = []
const memMaterials: EducationMaterialDto[] = []

function nowIso(): string {
  return new Date().toISOString()
}

/** 合并内存 overlay 与确定性 seed (内存优先, 同 id 去重) */
export function listAllConsentRecords(): ConsentRecord[] {
  return [...memConsents, ...SEED_CONSENTS.filter((c) => !memConsents.some((m) => m.id === c.id))]
}

/** 类型别名归一: 支持 pediatric/儿童, pregnancy/孕妇, contrast/enhanced/增强 等 */
function normalizeTypeKey(type: string): string {
  const t = type.trim().toLowerCase()
  if (/(pediatric|儿童)/.test(t)) return 'pediatric'
  if (/(pregnancy|pregnant|孕妇|妊娠)/.test(t)) return 'pregnancy'
  if (/(contrast|enhanced|增强|对比剂|造影)/.test(t)) return 'enhanced'
  return t
}

function typeMatches(recordType: string, requested: string): boolean {
  if (!requested) return true
  const req = normalizeTypeKey(requested)
  const rec = normalizeTypeKey(recordType)
  return req === rec || recordType.toLowerCase().includes(requested.toLowerCase())
}

/** 检查是否属于增强/对比剂检查 (供 start 前同意门禁判断) */
export function isEnhancedExamMeta(meta: { modality?: string | null; bodyPart?: string | null; techNotes?: string | null; priority?: string | null } | null | undefined): boolean {
  if (!meta) return false
  const haystack = [meta.modality, meta.bodyPart, meta.techNotes, meta.priority].filter(Boolean).join(' ')
  return /(增强|对比剂|造影|contrast|enhanced|CE-MRA)/i.test(haystack)
}

/**
 * GET /consent-education/verify?examId=&type=
 * 校验某检查某类型同意书是否已签 (增强检查/对比剂注射前调用)
 */
export function verifyConsentForExam(examId: string, type?: string): ConsentVerification {
  const id = (examId ?? '').trim()
  const records = listAllConsentRecords().filter((c) => c.examId === id && typeMatches(c.type, type ?? ''))
  const signedRecord = records.find((c) => c.status === 'signed')
  const latest = records[records.length - 1] ?? null
  return {
    examId: id,
    type: type ?? null,
    signed: Boolean(signedRecord),
    required: records.length > 0,
    status: latest?.status ?? null,
    recordId: signedRecord?.id ?? latest?.id ?? null,
    checkedAt: nowIso(),
  }
}

/**
 * worklist start 门禁: 增强检查或已登记同意要求的检查, 未签署则拦截。
 * - required: 检查被判定为增强/特殊 或 已存在绑定该检查的同意记录
 * - signed:   存在 signed 记录
 */
export function getConsentGateForExam(
  examId: string,
  meta?: { modality?: string | null; bodyPart?: string | null; techNotes?: string | null; priority?: string | null } | null,
): ConsentGateResult {
  const v = verifyConsentForExam(examId)
  const required = v.required || isEnhancedExamMeta(meta)
  return { required, signed: v.signed, status: v.status, recordId: v.recordId }
}

@Injectable()
export class ConsentEducationService {
  // ===== Records (consents 别名同存储) =====
  listConsents(filter: ConsentListFilter = {}): ConsentRecord[] {
    let records = listAllConsentRecords()
    if (filter.patientId) records = records.filter((c) => c.patientId === filter.patientId)
    if (filter.examId) records = records.filter((c) => c.examId === filter.examId)
    if (filter.status) records = records.filter((c) => c.status === filter.status)
    if (filter.type) records = records.filter((c) => typeMatches(c.type, filter.type!))
    return records
  }

  getConsent(id: string): ConsentRecord {
    const found = listAllConsentRecords().find((c) => c.id === id)
    if (!found) throw new NotFoundException(`知情同意记录 ${id} 不存在`)
    return found
  }

  // POST /consent-education/records — 创建 (含 examId/patientId 绑定)
  createConsent(data: CreateConsentInput): ConsentRecord {
    const record: ConsentRecord = {
      id: `C-${Date.now().toString(36)}`,
      patientId: data.patientId?.trim() || null,
      patient: data.patient?.trim() || '新患者',
      examId: data.examId?.trim() || null,
      type: data.type || 'general',
      procedure: data.procedure || '标准诊疗流程',
      signedAt: null,
      status: 'pending',
      witness: data.witnessName?.trim() || null,
      witnessName: data.witnessName?.trim() || null,
      createdAt: nowIso().slice(0, 10),
    }
    memConsents.unshift(record)
    return record
  }

  updateConsent(id: string, data: Partial<ConsentRecord>): ConsentRecord {
    const target = memConsents.find((c) => c.id === id) ?? SEED_CONSENTS.find((c) => c.id === id)
    if (!target) throw new NotFoundException(`知情同意记录 ${id} 不存在`)
    // witness 与 witnessName 双写保持兼容
    if (data.witnessName !== undefined && data.witness === undefined) data.witness = data.witnessName
    if (data.witness !== undefined && data.witnessName === undefined) data.witnessName = data.witness
    if (data.status === 'signed' && !data.signedAt) data.signedAt = nowIso()
    Object.assign(target, data, { updatedAt: nowIso() })
    return target
  }

  // POST /records/:id/sign — 签署知情同意 (兼容旧签名 signer: string)
  signConsent(id: string, body?: string | { signer?: string; witnessName?: string }): ConsentRecord {
    const record = this.getConsent(id)
    const signer = typeof body === 'string' ? body : body?.signer
    const witnessName = typeof body === 'string' ? undefined : body?.witnessName
    record.status = 'signed'
    record.signedAt = nowIso()
    record.signedBy = signer || '当前用户'
    if (witnessName) {
      record.witnessName = witnessName
      record.witness = witnessName
    } else {
      record.witness = record.witness ?? '护士站'
      record.witnessName = record.witnessName ?? record.witness
    }
    record.updatedAt = nowIso()
    return record
  }

  // GET /verify?examId=&type= — 增强检查/注射前同意校验
  verifyConsent(examId: string, type?: string): ConsentVerification {
    return verifyConsentForExam(examId, type)
  }

  // ===== Education Materials (materials 别名同存储) =====
  listMaterials(): EducationMaterialDto[] {
    return [...memMaterials, ...SEED_MATERIALS.filter((m) => !memMaterials.some((x) => x.id === m.id))]
  }

  getMaterial(id: string): EducationMaterialDto {
    const found = this.listMaterials().find((m) => m.id === id)
    if (!found) throw new NotFoundException(`宣教材料 ${id} 不存在`)
    return found
  }

  createMaterial(data: Partial<EducationMaterialDto>): EducationMaterialDto {
    const material: EducationMaterialDto = {
      id: `M-${Date.now().toString(36)}`,
      title: data.title?.trim() || '未命名宣教材料',
      lang: data.lang ?? 'zh-CN',
      category: data.category ?? 'General',
      pages: data.pages ?? 1,
      views: 0,
      format: data.format ?? 'PDF',
      content: data.content,
      summary: data.summary,
      createdAt: nowIso().slice(0, 10),
    }
    memMaterials.unshift(material)
    return material
  }

  updateMaterial(id: string, data: Partial<EducationMaterialDto>): EducationMaterialDto {
    const material = this.getMaterial(id)
    Object.assign(material, data)
    return material
  }
}
