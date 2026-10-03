// [G005 W4B] 临床/集成域 孤儿端点 MSW 兜底 (前置注册)
// 覆盖后端已有、前端此前无调用 (或缺少 mock) 的端点:
//   GET  /appointments/accession/parse          检查号解析 → 结构化
//   GET  /appointments/reschedule-history       改期历史
//   GET  /ihe/xds/documents/:uniqueId            按 uniqueId 调阅 XDS 文档
//   POST /dicom-dimse/transfers/process          推进 DICOM C-STORE 传输队列
//   GET  /security/dr/drills/:id                 灾难恢复演练详情
//   GET  /security/field-encryption/selftest     字段加密自检
// 数据全部确定性 (无 Math.random), 形状与后端 service 对齐。
import { http, HttpResponse, delay } from 'msw'

const API_BASE =
  typeof process !== 'undefined' && process.env.VITEST
    ? 'http://localhost:5173/api/v1'
    : typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin + '/api/v1'
      : 'http://localhost:5173/api/v1'

const nowIso = () => new Date().toISOString()

// ───────────────────────────────────────────────────────────────
// 1) 检查号解析 (镜像后端 appointments/accession.policy.ts parse)
// ───────────────────────────────────────────────────────────────
interface AccessionParseResult {
  valid: boolean
  modality?: string
  year?: number
  seq?: number
  check?: string
}

function parseAccession(accession: string): AccessionParseResult {
  const m = /^([A-Z]{2,4})(\d{4})(\d{5})(\d)$/.exec(accession)
  if (!m) return { valid: false }
  const [, modality, yearStr, seqStr, check] = m
  const body = `${modality}${yearStr}${seqStr}`
  let sum = 0
  for (let i = 0; i < body.length; i += 1) {
    const ch = body[i]!
    const value = /[0-9]/.test(ch) ? Number(ch) : ch.charCodeAt(0) % 10
    sum += value * ((i % 2) + 1)
  }
  return {
    valid: String(sum % 10) === check,
    modality,
    year: Number(yearStr),
    seq: Number(seqStr),
    check,
  }
}

// ───────────────────────────────────────────────────────────────
// 2) 改期历史 (镜像后端 seedReschedules)
// ───────────────────────────────────────────────────────────────
const RESCHEDULE_HISTORY = [
  { id: 'RS-001', patientName: '张三', phone: '13800138001', examType: '腹部CT平扫+增强', originalDate: '2026-08-03', originalTime: '09:00', newDate: '2026-08-05', newTime: '14:00', reason: 'patient', operateTime: '2026-08-02 16:20' },
  { id: 'RS-002', patientName: '李四', phone: '13800138002', examType: '头颅MR平扫', originalDate: '2026-08-04', originalTime: '10:30', newDate: '2026-08-06', newTime: '10:00', reason: 'doctor', operateTime: '2026-08-03 09:15' },
  { id: 'RS-003', patientName: '王五', phone: '13800138003', examType: '胸部CT平扫', originalDate: '2026-08-05', originalTime: '08:00', newDate: '2026-08-07', newTime: '09:30', reason: 'device', operateTime: '2026-08-04 11:40' },
]

// ───────────────────────────────────────────────────────────────
// 2b) 头影标定点 (镜像后端 SEED_CEPH_LANDMARKS, 用于 GET /dental/ceph/:id/landmarks)
// ───────────────────────────────────────────────────────────────
const CEPH_LANDMARKS: Record<string, { x: number; y: number }> = {
  N: { x: 250, y: 80 }, S: { x: 220, y: 150 }, A: { x: 240, y: 200 },
  B: { x: 230, y: 260 }, Pog: { x: 225, y: 300 }, Me: { x: 225, y: 320 },
  Go: { x: 180, y: 280 }, Ar: { x: 180, y: 155 }, PNS: { x: 280, y: 170 },
  ANS: { x: 260, y: 195 }, Or: { x: 280, y: 100 }, Po: { x: 160, y: 120 },
  Ba: { x: 195, y: 165 }, Na: { x: 250, y: 80 }, Pt: { x: 210, y: 195 },
  Cd: { x: 190, y: 145 }, Gn: { x: 225, y: 310 }, Xi: { x: 230, y: 230 },
}

// ───────────────────────────────────────────────────────────────
// 3) XDS 文档 registry (确定性 seed, 与后端 xds.service seed 对齐)
// ───────────────────────────────────────────────────────────────
const XDS_HOME_COMMUNITY = 'urn:oid:1.2.840.113556.1.8000.2554.1'
const XDS_REMOTE_COMMUNITY = 'urn:oid:1.2.840.113556.1.8000.2554.2'

interface XdsDocEntry {
  id: string
  uniqueId: string
  patientId: string
  repositoryUniqueId: string
  homeCommunityId: string
  title: string
  classCode: string
  classDisplayName: string
  formatCode: string
  formatDisplayName: string
  typeCode: string
  typeDisplayName: string
  mimeType: string
  size: number
  hash: string
  hashAlgorithm: 'SHA1'
  creationTime: string
  authorInstitution?: string
  authorPerson?: string
  availabilityStatus: 'APPROVED' | 'DEPRECATED'
  availabilityStatusLabel?: string
  sourcePatientId?: string
  submittedAt: string
  source: 'SUBMISSION' | 'SEED'
  content?: string
}

const XDS_DOCUMENTS: XdsDocEntry[] = [
  {
    id: 'doc-0001', uniqueId: '1.2.840.113556.1.8000.2554.1.100.1', patientId: 'P000023',
    repositoryUniqueId: '1.2.840.113556.1.8000.2554.1.100', homeCommunityId: XDS_HOME_COMMUNITY,
    title: '胸部 CT 平扫报告', classCode: 'RAD', classDisplayName: '放射影像', formatCode: 'urn:ihe:rad:1',
    formatDisplayName: 'IHE Radiology Report', typeCode: 'RAD-REPORT', typeDisplayName: '放射报告',
    mimeType: 'application/pdf', size: 24, hash: 'd15b12a4c0f27e6b8a1e', hashAlgorithm: 'SHA1',
    creationTime: '2026-06-28T09:12:00.000Z', authorPerson: '王建华^主任医师', availabilityStatus: 'APPROVED',
    sourcePatientId: 'P000023', submittedAt: '2026-06-28T09:12:00.000Z', source: 'SEED',
    content: BufferLike('CT chest plain report'),
  },
  {
    id: 'doc-0002', uniqueId: '1.2.840.113556.1.8000.2554.1.101.1', patientId: 'P000023',
    repositoryUniqueId: '1.2.840.113556.1.8000.2554.1.101', homeCommunityId: XDS_HOME_COMMUNITY,
    title: '胸部 CT 影像', classCode: 'RAD', classDisplayName: '放射影像', formatCode: 'urn:ihe:rad:2',
    formatDisplayName: 'IHE Radiology Image', typeCode: 'RAD-IMAGE', typeDisplayName: '放射影像',
    mimeType: 'application/dicom', size: 524288, hash: 'a93f7c21bd0e4f5a6c88', hashAlgorithm: 'SHA1',
    creationTime: '2026-06-28T09:05:00.000Z', authorInstitution: '汉东省人民医院', availabilityStatus: 'APPROVED',
    sourcePatientId: 'P000023', submittedAt: '2026-06-28T09:05:00.000Z', source: 'SEED',
  },
  {
    id: 'doc-0003', uniqueId: '1.2.840.113556.1.8000.2554.2.100.1', patientId: 'P000023',
    repositoryUniqueId: '1.2.840.113556.1.8000.2554.2.100', homeCommunityId: XDS_REMOTE_COMMUNITY,
    title: '外院胸部 CT 基线影像', classCode: 'RAD', classDisplayName: '放射影像', formatCode: 'urn:ihe:rad:2',
    formatDisplayName: 'IHE Radiology Image', typeCode: 'RAD-IMAGE', typeDisplayName: '放射影像',
    mimeType: 'application/dicom', size: 786432, hash: 'c7e210f9aa34bd5512ee', hashAlgorithm: 'SHA1',
    creationTime: '2025-03-12T03:20:00.000Z', authorInstitution: '东华区第一医院', availabilityStatus: 'APPROVED',
    sourcePatientId: 'P000023', submittedAt: '2025-03-12T03:20:00.000Z', source: 'SEED',
    content: BufferLike('remote baseline dicom'),
  },
  {
    id: 'doc-0004', uniqueId: '1.2.840.113556.1.8000.2554.1.100.2', patientId: 'P000047',
    repositoryUniqueId: '1.2.840.113556.1.8000.2554.1.100', homeCommunityId: XDS_HOME_COMMUNITY,
    title: '腰椎 MRI 报告', classCode: 'RAD', classDisplayName: '放射影像', formatCode: 'urn:ihe:rad:1',
    formatDisplayName: 'IHE Radiology Report', typeCode: 'RAD-REPORT', typeDisplayName: '放射报告',
    mimeType: 'application/pdf', size: 22, hash: '11aa22bb33cc44dd55ee', hashAlgorithm: 'SHA1',
    creationTime: '2026-05-20T07:40:00.000Z', authorPerson: '李慧敏^副主任医师', availabilityStatus: 'APPROVED',
    sourcePatientId: 'P000047', submittedAt: '2026-05-20T07:40:00.000Z', source: 'SEED',
    content: BufferLike('MRI lumbar report'),
  },
]

/** 浏览器/Node 通用的 base64 编码 (确定性) */
function BufferLike(text: string): string {
  try {
    if (typeof btoa === 'function') return btoa(unescape(encodeURIComponent(text)))
  } catch {
    /* noop */
  }
  return text
}

// ───────────────────────────────────────────────────────────────
// 4) DICOM C-STORE 传输队列 (进程内可变镜像, 与 dicomDimseHandlers seed 对齐)
// ───────────────────────────────────────────────────────────────
interface TransferRow {
  id: string
  studyUid: string
  targetAe: string
  status: 'queued' | 'sending' | 'paused' | 'failed' | 'completed' | 'canceled'
  progress: number
  totalInstances: number
  completedInstances: number
  priority: 'HIGH' | 'NORMAL' | 'LOW'
  createdAt: string
  updatedAt: string
  error?: string
  source: 'queue' | 'seed'
  attempts?: number
  nextRetryAt?: string
}

const TRANSFERS: TransferRow[] = [
  { id: 'TR-0001', studyUid: '1.2.840.114350.1.1.20260801.001', targetAe: 'CT_SCANNER_01', status: 'sending', progress: 42, totalInstances: 120, completedInstances: 50, priority: 'NORMAL', createdAt: nowIso(), updatedAt: nowIso(), source: 'seed' },
  { id: 'TR-0002', studyUid: '1.2.840.114350.1.1.20260801.002', targetAe: 'MR_SCANNER_02', status: 'queued', progress: 0, totalInstances: 90, completedInstances: 0, priority: 'HIGH', createdAt: nowIso(), updatedAt: nowIso(), source: 'seed' },
  { id: 'TR-0003', studyUid: '1.2.840.114350.1.1.20260731.003', targetAe: 'XA_LAB_01', status: 'completed', progress: 100, totalInstances: 60, completedInstances: 60, priority: 'NORMAL', createdAt: nowIso(), updatedAt: nowIso(), source: 'seed' },
  { id: 'TR-0004', studyUid: '1.2.840.114350.1.1.20260730.004', targetAe: 'US_UNIT_01', status: 'failed', progress: 35, totalInstances: 40, completedInstances: 14, priority: 'LOW', createdAt: nowIso(), updatedAt: nowIso(), error: '目标 AE 无响应', source: 'seed' },
]

function processTransfers(nowIsoParam?: string) {
  const now = nowIsoParam ?? nowIso()
  let processed = 0
  let retried = 0
  let completed = 0
  for (const rec of TRANSFERS) {
    if (rec.status !== 'queued' && rec.status !== 'sending') continue
    if (rec.nextRetryAt && rec.nextRetryAt > now) continue
    processed += 1
    rec.progress = Math.min(100, rec.progress + 50)
    rec.completedInstances = Math.round((rec.progress / 100) * rec.totalInstances)
    rec.updatedAt = now
    if (rec.progress >= 100) {
      rec.status = 'completed'
      rec.error = undefined
      completed += 1
    } else if (rec.error) {
      rec.attempts = (rec.attempts ?? 0) + 1
      rec.nextRetryAt = new Date(Date.now() + Math.min(1000 * 2 ** Math.max(0, rec.attempts - 1), 60000)).toISOString()
      rec.status = 'queued'
      retried += 1
    } else {
      rec.status = 'sending'
    }
  }
  return { processed, advanced: processed - retried, retried, completed }
}

// ───────────────────────────────────────────────────────────────
// 5) 灾难恢复演练记录 (确定性 seed, 对齐 disaster-recovery.service)
// ───────────────────────────────────────────────────────────────
const DAY = 86_400_000
const isoOffsetDays = (d: number) => new Date(Date.now() + d * DAY).toISOString()

interface DrillStep { name: string; status: 'ok' | 'warn' | 'fail'; durationSec: number; detail: string }
interface DrillRecord {
  id: string
  startedAt: string
  finishedAt: string
  durationSec: number
  scenario: string
  rtoTargetMin: number
  rtoActualMin: number
  rpoTargetMin: number
  rpoActualMin: number
  result: 'pass' | 'warn' | 'fail'
  steps: DrillStep[]
  executedBy?: string
}

const DR_DRILLS: DrillRecord[] = [
  {
    id: 'drill-0001', startedAt: isoOffsetDays(-7), finishedAt: isoOffsetDays(-7), durationSec: 300,
    scenario: 'site-failover', rtoTargetMin: 30, rtoActualMin: 28, rpoTargetMin: 15, rpoActualMin: 12, result: 'pass',
    steps: [
      { name: '备份完整性校验', status: 'ok', durationSec: 45, detail: '校验和一致' },
      { name: '切换到灾备站点', status: 'ok', durationSec: 120, detail: 'DCC-02 服务已就绪' },
      { name: '业务连通性验证', status: 'ok', durationSec: 90, detail: 'DICOM/RIS 接口正常' },
      { name: '回切主站', status: 'ok', durationSec: 45, detail: '主站恢复' },
    ],
    executedBy: 'DR-Auto',
  },
  {
    id: 'drill-0002', startedAt: isoOffsetDays(-30), finishedAt: isoOffsetDays(-30), durationSec: 420,
    scenario: 'db-restore', rtoTargetMin: 30, rtoActualMin: 34, rpoTargetMin: 15, rpoActualMin: 18, result: 'warn',
    steps: [
      { name: '备份完整性校验', status: 'ok', durationSec: 50, detail: '校验和一致' },
      { name: '数据库恢复', status: 'warn', durationSec: 240, detail: '恢复耗时略超目标' },
      { name: '数据一致性校验', status: 'ok', durationSec: 90, detail: '行数一致' },
      { name: '回切主站', status: 'ok', durationSec: 40, detail: '主站恢复' },
    ],
    executedBy: 'DBA-张工',
  },
]

// ───────────────────────────────────────────────────────────────
// 6) 字段加密自检 (确定性往返)
// ───────────────────────────────────────────────────────────────
function maskValue(value: string, field?: string): string {
  if (field === 'phone' && value.length >= 7) return `${value.slice(0, 3)}****${value.slice(-3)}`
  if (field === 'idCard' && value.length >= 8) return `${value.slice(0, 6)}********${value.slice(-4)}`
  if (value.length <= 2) return '*'.repeat(value.length)
  return `${value[0]}${'*'.repeat(Math.max(1, value.length - 2))}${value[value.length - 1]}`
}

function selfTest() {
  const samples = [
    { field: 'idCard', value: '110101196803120011' },
    { field: 'phone', value: '13800001001' },
    { field: 'allergy', value: '青霉素过敏' },
  ]
  return {
    algorithm: 'AES-256-GCM' as const,
    samples: samples.map((s) => {
      const ciphertext = BufferLike(s.value)
      return {
        field: s.field,
        plainMasked: maskValue(s.value, s.field),
        ciphertextPrefix: ciphertext.slice(0, 16),
        decryptedMatches: true,
        maskedRead: maskValue(s.value, s.field),
      }
    }),
  }
}

// ───────────────────────────────────────────────────────────────
// handlers
// ───────────────────────────────────────────────────────────────
export const w4bOrphansHandlers = [
  // 1) 检查号解析 (后端返回裸对象)
  http.get(`${API_BASE}/appointments/accession/parse`, async ({ request }) => {
    await delay(60)
    const url = new URL(request.url)
    const accession = url.searchParams.get('accession') ?? ''
    return HttpResponse.json(parseAccession(accession))
  }),

  // 2) 改期历史
  http.get(`${API_BASE}/appointments/reschedule-history`, async () => {
    await delay(80)
    return HttpResponse.json({ success: true, data: RESCHEDULE_HISTORY.map((r) => ({ ...r })) })
  }),

  // 2b) 单检查标定点集 (GET /dental/ceph/:id/landmarks, 形状对齐后端: { data, meta })
  http.get(`${API_BASE}/dental/ceph/:id/landmarks`, async ({ params }) => {
    await delay(60)
    return HttpResponse.json({
      success: true,
      data: { ...CEPH_LANDMARKS },
      meta: { studyId: String(params.id), source: 'default' },
    })
  }),

  // 3) 按 uniqueId 调阅 XDS 文档
  http.get(`${API_BASE}/ihe/xds/documents/:uniqueId`, async ({ params }) => {
    await delay(80)
    const uniqueId = decodeURIComponent(String(params.uniqueId))
    const doc = XDS_DOCUMENTS.find((d) => d.uniqueId === uniqueId)
    if (!doc) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `Document ${uniqueId} not found` } }, { status: 404 })
    }
    return HttpResponse.json({ ...doc })
  }),

  // 4) 推进 DICOM C-STORE 传输队列
  http.post(`${API_BASE}/dicom-dimse/transfers/process`, async ({ request }) => {
    await delay(120)
    const url = new URL(request.url)
    const now = url.searchParams.get('now') ?? undefined
    const result = processTransfers(now ?? undefined)
    return HttpResponse.json({ success: true, data: result })
  }),

  // 5) 灾难恢复演练详情
  http.get(`${API_BASE}/security/dr/drills/:id`, async ({ params }) => {
    await delay(60)
    const id = String(params.id)
    const drill = DR_DRILLS.find((d) => d.id === id)
    if (!drill) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `演练 ${id} 不存在` } }, { status: 404 })
    }
    return HttpResponse.json({ success: true, data: { ...drill, steps: drill.steps.map((s) => ({ ...s })) } })
  }),

  // 6) 字段加密自检
  http.get(`${API_BASE}/security/field-encryption/selftest`, async () => {
    await delay(80)
    return HttpResponse.json({ success: true, data: selfTest() })
  }),
]
