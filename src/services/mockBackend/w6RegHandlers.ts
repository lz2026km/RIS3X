// [G005 W6] 登记工作站 + 分诊深度 MSW handlers (确定性 seed, 无随机)
// 覆盖: /registration/scan | :visitId/prep-confirm | consent | charge | pay
//       /patients/:id/clinical-profile (GET/PATCH)
//       /triage/re-triage | /triage/nurse
// 必须注册在 handlers 数组最前 (避免被既有 /patients/:id 等参数路由拦截)。
import { http, HttpResponse, delay } from 'msw'

const API = '/api/v1'

type IdType = 'ID_CARD' | 'PASSPORT' | 'OFFICER_CARD' | 'BIRTH_CERT' | 'OTHER'
type IsolationFlag = 'NONE' | 'CONTACT' | 'DROPLET' | 'AIRBORNE' | 'PROTECTIVE'
type PregnancyStatus = 'NONE' | 'PREGNANT' | 'UNKNOWN' | 'NOT_APPLICABLE' | 'POSTPARTUM'

interface AllergyCode { code: string; display: string; severity?: string; reaction?: string }
interface Vitals { systolicBp?: number; diastolicBp?: number; heartRate?: number; temperature?: number; spo2?: number; respiratoryRate?: number; measuredAt?: string }
interface Renal { egfr?: number; creatinine?: number; egfrSource?: string; measuredAt?: string }
interface Patient {
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
  isolationFlag: IsolationFlag
  structuredAllergyCodes: AllergyCode[]
  pregnancyStatus: PregnancyStatus
  renalFunction: Renal
  vitals: Vitals
}

function hash(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const SEED_PATIENTS: Patient[] = [
  {
    patientId: 'P100001', name: '张伟', gender: 'MALE', birthDate: '1968-03-12', age: 58,
    idType: 'ID_CARD', documentNo: '110101196803120011', empiId: 'EMPI-000001', insuranceNo: 'YB-1101010001', phone: '13800001001',
    isolationFlag: 'NONE',
    structuredAllergyCodes: [{ code: '373255001', display: '碘对比剂过敏', severity: 'MODERATE', reaction: '皮疹/瘙痒' }],
    pregnancyStatus: 'NOT_APPLICABLE',
    renalFunction: { egfr: 78, creatinine: 92, egfrSource: 'LIS', measuredAt: '2026-08-07T07:30:00.000Z' },
    vitals: { systolicBp: 158, diastolicBp: 92, heartRate: 88, temperature: 36.8, spo2: 96, respiratoryRate: 18, measuredAt: '2026-08-07T08:40:00.000Z' },
  },
  {
    patientId: 'P100002', name: '李娜', gender: 'FEMALE', birthDate: '1992-11-05', age: 33,
    idType: 'ID_CARD', documentNo: '110101199211050028', empiId: 'EMPI-000002', insuranceNo: 'YB-1101010002', phone: '13800001002',
    isolationFlag: 'CONTACT', structuredAllergyCodes: [], pregnancyStatus: 'PREGNANT',
    renalFunction: { egfr: 102, creatinine: 61, egfrSource: 'CALCULATED', measuredAt: '2026-08-07T08:10:00.000Z' },
    vitals: { systolicBp: 112, diastolicBp: 70, heartRate: 96, temperature: 36.6, spo2: 99, respiratoryRate: 16, measuredAt: '2026-08-07T08:42:00.000Z' },
  },
  {
    patientId: 'P100003', name: '王芳', gender: 'FEMALE', birthDate: '1974-06-20', age: 52,
    idType: 'PASSPORT', documentNo: 'E12345678', empiId: 'EMPI-000003', insuranceNo: 'YB-1101010003', phone: '13800001003',
    isolationFlag: 'NONE',
    structuredAllergyCodes: [{ code: '294595009', display: '青霉素过敏', severity: 'MILD', reaction: '皮疹' }],
    pregnancyStatus: 'NOT_APPLICABLE',
    renalFunction: { egfr: 68, creatinine: 88, egfrSource: 'MANUAL', measuredAt: '2026-08-06T09:00:00.000Z' },
    vitals: { systolicBp: 132, diastolicBp: 84, heartRate: 76, temperature: 36.5, spo2: 97, respiratoryRate: 17, measuredAt: '2026-08-07T08:20:00.000Z' },
  },
  {
    patientId: 'P100004', name: '陈杰', gender: 'MALE', birthDate: '1986-01-30', age: 40,
    idType: 'ID_CARD', documentNo: '110101198601300037', empiId: 'EMPI-000004', insuranceNo: 'YB-1101010004', phone: '13800001004',
    isolationFlag: 'DROPLET', structuredAllergyCodes: [], pregnancyStatus: 'NOT_APPLICABLE',
    renalFunction: { egfr: 41, creatinine: 152, egfrSource: 'LIS', measuredAt: '2026-08-07T07:50:00.000Z' },
    vitals: { systolicBp: 176, diastolicBp: 104, heartRate: 118, temperature: 38.4, spo2: 92, respiratoryRate: 24, measuredAt: '2026-08-07T08:44:00.000Z' },
  },
]

const DEFAULT_PREP = [
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

const clinicalProfiles = new Map<string, any>()
const prepResults = new Map<string, any>()
const consents = new Map<string, any[]>()
const charges = new Map<string, any>()
let consentSeq = 0

function seedProfile(patientId: string) {
  const p = SEED_PATIENTS.find((x) => x.patientId === patientId)
  const h = hash(patientId)
  if (p) {
    return {
      patientId,
      idType: p.idType,
      documentType: p.idType === 'ID_CARD' ? '居民身份证' : p.idType === 'PASSPORT' ? '护照' : '证件',
      documentNo: p.documentNo,
      empiId: p.empiId,
      insuranceNo: p.insuranceNo,
      heightCm: 158 + (h % 25),
      weightKg: 52 + (h % 40),
      bmi: undefined,
      structuredAllergyCodes: p.structuredAllergyCodes,
      pregnancyStatus: p.pregnancyStatus,
      renalFunction: p.renalFunction,
      isolationFlag: p.isolationFlag,
      vitals: p.vitals,
      updatedAt: new Date().toISOString(),
    }
  }
  const heightCm = 158 + (h % 25)
  const weightKg = 52 + (h % 40)
  return {
    patientId,
    idType: 'ID_CARD' as IdType,
    documentType: '居民身份证',
    documentNo: `110101${String(19600101 + (h % 20000)).slice(-8)}${String(h % 10000).padStart(4, '0')}`.slice(0, 18),
    empiId: `EMPI-${String(h % 1000000).padStart(6, '0')}`,
    insuranceNo: `YB-${String(h % 1000000000).padStart(9, '0')}`,
    heightCm,
    weightKg,
    bmi: Math.round((weightKg / ((heightCm / 100) * (heightCm / 100))) * 10) / 10,
    structuredAllergyCodes: h % 3 === 0 ? [{ code: '373255001', display: '碘对比剂过敏', severity: 'MODERATE' }] : [],
    pregnancyStatus: (['NOT_APPLICABLE', 'NONE', 'UNKNOWN', 'PREGNANT'][h % 4]) as PregnancyStatus,
    renalFunction: { egfr: 55 + (h % 60), creatinine: 70 + (h % 60), egfrSource: h % 2 === 0 ? 'LIS' : 'MANUAL' },
    isolationFlag: (['NONE', 'NONE', 'CONTACT', 'DROPLET', 'AIRBORNE'][h % 5]) as IsolationFlag,
    vitals: { systolicBp: 108 + (h % 70), diastolicBp: 66 + (h % 30), heartRate: 58 + (h % 50), temperature: 36 + (h % 15) / 10, spo2: 93 + (h % 8), respiratoryRate: 14 + (h % 10) },
    updatedAt: new Date().toISOString(),
  }
}

function inferType(q: string): string {
  if (/^EMPI-/i.test(q)) return 'EMPI'
  if (/^\d{17}[\dXx]$/.test(q)) return 'ID_CARD'
  if (/^1[3-9]\d{9}$/.test(q)) return 'PHONE'
  if (/^(BC|QR)/i.test(q)) return 'BARCODE'
  return 'UNKNOWN'
}

function seedCharge(visitId: string) {
  const h = hash(visitId || 'VISIT')
  const patient = SEED_PATIENTS[h % SEED_PATIENTS.length]!
  const catalog = [
    { code: 'EXAM-CT', name: 'CT 平扫 (单部位)', category: '检查费', unitPrice: 380, insuranceEligible: true },
    { code: 'EXAM-CT-ENH', name: 'CT 增强 (含对比剂)', category: '检查费', unitPrice: 680, insuranceEligible: true },
    { code: 'CONTRAST', name: '碘对比剂 (碘海醇 300mgI/ml)', category: '药品费', unitPrice: 260, insuranceEligible: false },
    { code: 'FILM', name: '激光胶片 (14x17)', category: '材料费', unitPrice: 45, insuranceEligible: false },
    { code: 'SERVICE', name: '影像诊断服务费', category: '服务费', unitPrice: 120, insuranceEligible: true },
  ]
  const count = 2 + (h % 3)
  const items = catalog.slice(0, count).map((c) => ({ ...c, quantity: 1, amount: c.unitPrice }))
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
    status: 'UNPAID' as const,
    updatedAt: new Date().toISOString(),
  }
}

const LEVEL_PRIORITY: Record<string, string> = { CRITICAL: '危重', URGENT: '紧急', SEMI_URGENT: '紧急', ROUTINE: '普通' }

function esiFromBody(body: any): { esiLevel: number; breaches: string[]; queuePriority: string } {
  const v = body?.vitals ?? {}
  const breaches: string[] = []
  // 与后端一致: 由 level 映射基础 ESI, 体征越界升级
  const score = body?.score ?? 8
  let esi = score >= 80 ? 2 : score >= 65 ? 2 : score >= 45 ? 3 : score >= 20 ? 4 : 5
  const elevate = (to: number, label: string) => { breaches.push(label); if (to < esi) esi = to }
  if (v.systolicBp !== undefined) {
    if (v.systolicBp < 90 || v.systolicBp >= 220) elevate(1, `收缩压危象 ${v.systolicBp}mmHg`)
    else if (v.systolicBp < 100 || v.systolicBp >= 180) elevate(2, `收缩压异常 ${v.systolicBp}mmHg`)
    else if (v.systolicBp >= 160) elevate(3, `收缩压偏高 ${v.systolicBp}mmHg`)
  }
  if (v.spo2 !== undefined) {
    if (v.spo2 < 90) elevate(1, `血氧危急 ${v.spo2}%`)
    else if (v.spo2 < 93) elevate(2, `血氧偏低 ${v.spo2}%`)
    else if (v.spo2 < 95) elevate(3, `血氧临界 ${v.spo2}%`)
  }
  if (v.heartRate !== undefined) {
    if (v.heartRate < 40 || v.heartRate > 150) elevate(1, `心率危象 ${v.heartRate}bpm`)
    else if (v.heartRate < 50 || v.heartRate > 120) elevate(2, `心率异常 ${v.heartRate}bpm`)
    else if (v.heartRate < 60 || v.heartRate > 100) elevate(3, `心率偏离 ${v.heartRate}bpm`)
  }
  if (v.respiratoryRate !== undefined) {
    if (v.respiratoryRate < 8 || v.respiratoryRate > 30) elevate(1, `呼吸危象 ${v.respiratoryRate}/min`)
    else if (v.respiratoryRate > 24 || v.respiratoryRate < 10) elevate(2, `呼吸异常 ${v.respiratoryRate}/min`)
    else if (v.respiratoryRate > 20) elevate(3, `呼吸偏快 ${v.respiratoryRate}/min`)
  }
  if (v.temperature !== undefined) {
    if (v.temperature >= 41 || v.temperature < 35) elevate(1, `体温危象 ${v.temperature}℃`)
    else if (v.temperature >= 39 || v.temperature < 36) elevate(2, `体温异常 ${v.temperature}℃`)
    else if (v.temperature >= 38) elevate(3, `发热 ${v.temperature}℃`)
  }
  const queuePriority = esi <= 1 ? '危重' : esi <= 3 ? '紧急' : '普通'
  return { esiLevel: esi, breaches, queuePriority }
}

export const w6RegHandlers = [
  // ---- 扫码 / 检索 ----
  http.get(`${API}/registration/scan`, async ({ request }) => {
    await delay(120)
    const url = new URL(request.url)
    const code = (url.searchParams.get('code') ?? '').trim()
    const type = url.searchParams.get('type') ?? inferType(code)
    if (!code) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '扫描内容不能为空' } }, { status: 400 })
    }
    const lower = code.toLowerCase()
    const candidates = SEED_PATIENTS.filter((p) =>
      p.patientId.toLowerCase() === lower ||
      p.empiId.toLowerCase() === lower ||
      p.documentNo.toLowerCase() === lower ||
      (p.insuranceNo ?? '').toLowerCase() === lower ||
      (p.phone ?? '') === code ||
      p.name.includes(code),
    )
    return HttpResponse.json({
      success: true,
      data: { query: code, type, matched: candidates[0] ?? null, candidates, source: 'seed', scannedAt: new Date().toISOString() },
    })
  }),

  // ---- 结构化临床档案 ----
  http.get(`${API}/patients/:id/clinical-profile`, async ({ params }) => {
    await delay(60)
    const id = String(params.id)
    const existing = clinicalProfiles.get(id) ?? seedProfile(id)
    clinicalProfiles.set(id, existing)
    return HttpResponse.json({ success: true, data: existing })
  }),

  http.patch(`${API}/patients/:id/clinical-profile`, async ({ params, request }) => {
    await delay(80)
    const id = String(params.id)
    const base = clinicalProfiles.get(id) ?? seedProfile(id)
    const patch = (await request.json()) as any
    const next: any = {
      ...base,
      ...patch,
      structuredAllergyCodes: patch?.structuredAllergyCodes ?? base.structuredAllergyCodes,
      renalFunction: { ...base.renalFunction, ...(patch?.renalFunction ?? {}) },
      vitals: { ...base.vitals, ...(patch?.vitals ?? {}) },
      updatedAt: new Date().toISOString(),
    }
    if (next.heightCm && next.weightKg) {
      next.bmi = Math.round((next.weightKg / ((next.heightCm / 100) * (next.heightCm / 100))) * 10) / 10
    }
    clinicalProfiles.set(id, next)
    return HttpResponse.json({ success: true, data: next })
  }),

  // ---- 准备项确认 ----
  http.post(`${API}/registration/:visitId/prep-confirm`, async ({ params, request }) => {
    await delay(100)
    const visitId = String(params.visitId)
    const body = (await request.json()) as any
    const provided: any[] = Array.isArray(body?.items) ? body.items : []
    const items = DEFAULT_PREP.map((def) => {
      const inc = provided.find((i) => i.key === def.key)
      return { key: def.key, label: inc?.label ?? def.label, required: inc?.required ?? def.required, checked: Boolean(inc?.checked) }
    })
    const pendingKeys = items.filter((i) => i.required && !i.checked).map((i) => i.key)
    const result = { visitId, items, allRequiredChecked: pendingKeys.length === 0, pendingKeys, confirmedBy: body?.confirmedBy, confirmedAt: new Date().toISOString() }
    prepResults.set(visitId, result)
    return HttpResponse.json({ success: true, data: result })
  }),

  // ---- 知情同意 ----
  http.post(`${API}/registration/:visitId/consent`, async ({ params, request }) => {
    await delay(100)
    const visitId = String(params.visitId)
    const body = (await request.json()) as any
    const record = {
      id: `consent-${++consentSeq}`,
      visitId,
      patientId: body?.patientId,
      consentType: body?.consentType ?? 'registration',
      procedure: body?.procedure ?? '影像检查登记',
      agreed: body?.agreed !== false,
      signedBy: body?.signedBy,
      witnessName: body?.witnessName,
      signedAt: new Date().toISOString(),
      status: body?.agreed === false ? 'refused' : 'signed',
    }
    const list = consents.get(visitId) ?? []
    list.push(record)
    consents.set(visitId, list)
    return HttpResponse.json({ success: true, data: record }, { status: 201 })
  }),

  // ---- 缴费 ----
  http.get(`${API}/registration/:visitId/charge`, async ({ params }) => {
    await delay(80)
    const visitId = String(params.visitId)
    const existing = charges.get(visitId) ?? seedCharge(visitId)
    charges.set(visitId, existing)
    return HttpResponse.json({ success: true, data: existing })
  }),

  http.post(`${API}/registration/:visitId/pay`, async ({ params, request }) => {
    await delay(150)
    const visitId = String(params.visitId)
    const body = (await request.json().catch(() => ({}))) as any
    const charge = charges.get(visitId) ?? seedCharge(visitId)
    const amount = Number(body?.amount ?? charge.balance)
    if (!Number.isFinite(amount) || amount <= 0) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '缴费金额必须大于 0' } }, { status: 400 })
    }
    const paidAmount = Math.min(charge.totalAmount, charge.paidAmount + amount)
    const balance = Math.max(0, charge.totalAmount - paidAmount)
    const updated = {
      ...charge,
      paidAmount,
      balance,
      status: balance <= 0 ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID',
      updatedAt: new Date().toISOString(),
      method: body?.method ?? 'CASH',
      paidAt: new Date().toISOString(),
      operator: body?.operator,
    }
    charges.set(visitId, updated)
    return HttpResponse.json({ success: true, data: updated })
  }),

  // ---- 分诊: 复评 + 护士指派 ----
  http.post(`${API}/triage/re-triage`, async ({ request }) => {
    await delay(120)
    const body = (await request.json()) as any
    const esi = esiFromBody(body)
    return HttpResponse.json({
      success: true,
      data: {
        examId: body?.examId,
        score: body?.score ?? 0,
        level: LEVEL_PRIORITY[body?.level] ? body.level : 'ROUTINE',
        factors: [],
        esiLevel: esi.esiLevel,
        queuePriority: esi.queuePriority,
        vitalsBreaches: esi.breaches,
        reTriageRecommended: esi.breaches.length > 0,
        reTriageAt: new Date().toISOString(),
        nurseId: body?.nurseId,
        nurseName: body?.nurseName,
        status: 'PENDING',
      },
    })
  }),

  http.post(`${API}/triage/nurse`, async ({ request }) => {
    await delay(100)
    const body = (await request.json()) as any
    return HttpResponse.json({
      success: true,
      data: { examId: body?.examId, nurseId: body?.nurseId, nurseName: body?.nurseName, esiLevel: 3, queuePriority: '紧急' },
    })
  }),
]

export default w6RegHandlers
