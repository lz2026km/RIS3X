// [G005 Wave 6A v3.0.6.11-101] /api/v1/report-sign-v2 MSW handlers
// 对齐后端 report-sign-v2.module + reportSignV2Api (水印 preview/verify + 电子签名申请/审批/记录)
// 响应形状: GET 列表/config/统计 → { source, generatedAt, data } (SignEnvelope); 写操作 → 业务对象
import { http, HttpResponse, delay } from 'msw'
// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1')


const API = `${API_BASE}/report-sign-v2`

interface TextWatermarkParams { content: string; position: string; rotation: number; opacity: number; spacing: number; fontSize: number }
interface ImageWatermarkParams { enabled: boolean; logoKey: string; logoName: string; scale: number; position: string; opacity: number }
interface WatermarkConfig { version: 2; text: TextWatermarkParams; image: ImageWatermarkParams }

type SignKind = 'doctor' | 'reviewer' | 'co-signer'
type SignStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

interface SignRecord { id: string; action: 'apply' | 'approve' | 'reject' | 'cancel' | 'sign'; actorId: string; actorName: string; note: string; at: string }

interface SignRequest {
  id: string
  reportId: string
  reportTitle: string
  kind: SignKind
  applicantId: string
  applicantName: string
  signerId: string
  signerName: string
  reason: string
  status: SignStatus
  reportHash: string
  signedAt?: string
  signedById?: string
  signedByName?: string
  approveNote?: string
  rejectReason?: string
  createdAt: string
  updatedAt: string
  records: SignRecord[]
}

const CONFIG: WatermarkConfig = {
  version: 2,
  text: { content: '东华医院影像诊断报告', position: 'tile', rotation: 15, opacity: 0.12, spacing: 60, fontSize: 16 },
  image: { enabled: false, logoKey: '', logoName: '', scale: 0.25, position: 'center', opacity: 0.15 },
}

const SIGNS: SignRequest[] = [
  {
    id: 'sg-001', reportId: 'RPT-1001', reportTitle: '胸部 CT 平扫报告', kind: 'reviewer',
    applicantId: 'u-001', applicantName: '张主任',
    signerId: 'u-002', signerName: '李医生',
    reason: '双人复核签署',
    status: 'pending',
    reportHash: 'sha256:7f4a1c0d9e8b6f3a2c5d4e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3f2a1b',
    createdAt: '2026-08-15T09:00:00.000Z', updatedAt: '2026-08-15T09:00:00.000Z',
    records: [{ id: 'sr-001', action: 'apply', actorId: 'u-001', actorName: '张主任', note: '申请复核签署', at: '2026-08-15T09:00:00.000Z' }],
  },
  {
    id: 'sg-002', reportId: 'RPT-1002', reportTitle: '头颅 MRI 平扫报告', kind: 'doctor',
    applicantId: 'u-003', applicantName: '王医生',
    signerId: 'u-003', signerName: '王医生',
    reason: '报告签署',
    status: 'approved',
    reportHash: 'sha256:0f1e2d3c4b5a6978876a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4e3',
    signedAt: '2026-08-14T16:30:00.000Z',
    signedById: 'u-003', signedByName: '王医生',
    approveNote: '已签署',
    createdAt: '2026-08-14T16:20:00.000Z', updatedAt: '2026-08-14T16:30:00.000Z',
    records: [
      { id: 'sr-002', action: 'apply', actorId: 'u-003', actorName: '王医生', note: '申请签署', at: '2026-08-14T16:20:00.000Z' },
      { id: 'sr-003', action: 'approve', actorId: 'u-003', actorName: '王医生', note: '签署完成', at: '2026-08-14T16:30:00.000Z' },
    ],
  },
  {
    id: 'sg-003', reportId: 'RPT-1005', reportTitle: '腹部增强 CT 报告', kind: 'co-signer',
    applicantId: 'u-001', applicantName: '张主任',
    signerId: 'u-004', signerName: '赵审核',
    reason: '双签(医生+审核)',
    status: 'rejected',
    reportHash: 'sha256:ab12cd34ef56ab12cd34ef56ab12cd34ef56ab12cd34ef56ab12cd34ef56ab12',
    rejectReason: '所见描述缺少测量值',
    createdAt: '2026-08-13T10:00:00.000Z', updatedAt: '2026-08-13T11:00:00.000Z',
    records: [
      { id: 'sr-004', action: 'apply', actorId: 'u-001', actorName: '张主任', note: '申请双签', at: '2026-08-13T10:00:00.000Z' },
      { id: 'sr-005', action: 'reject', actorId: 'u-004', actorName: '赵审核', note: '缺少测量值', at: '2026-08-13T11:00:00.000Z' },
    ],
  },
]

let signs: SignRequest[] = [...SIGNS]
let signSeq = 100
let recordSeq = 100

const envelope = (data: unknown) => ({ source: 'demo' as const, generatedAt: new Date().toISOString(), data })

function hashCode(text: string): string {
  let h = 0
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) - h + text.charCodeAt(i)) | 0
  }
  const hex = (h >>> 0).toString(16).padStart(8, '0')
  return `sha256:${hex}${hex}${hex}${hex}`
}

export const reportSignV2Handlers = [
  http.get(`${API}/watermark/config`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: envelope(CONFIG) })
  }),

  http.post(`${API}/watermark/preview`, async ({ request }) => {
    await delay(60)
    const body = (await request.json()) as { reportId?: string; text?: string; config?: Partial<WatermarkConfig> }
    const text = body?.text ?? CONFIG.text.content
    const cfg = { ...CONFIG, ...(body?.config ?? {}) }
    const tiles = []
    const spacing = cfg.text.spacing
    const count = Math.max(4, Math.min(12, Math.floor(1000 / Math.max(20, spacing))))
    for (let i = 0; i < count; i++) {
      tiles.push({ x: 10 + ((i * 137) % 85), y: 10 + ((i * 61) % 85), rotation: cfg.text.rotation })
    }
    const contentHash = hashCode(text)
    return HttpResponse.json({
      success: true,
      data: {
        source: 'demo' as const,
        generatedAt: new Date().toISOString(),
        config: cfg,
        contentHash,
        tamperCode: hashCode(`${contentHash}|${cfg.text.position}|${cfg.text.opacity}`),
        tiles,
      },
    })
  }),

  http.post(`${API}/watermark/verify`, async ({ request }) => {
    await delay(50)
    const body = (await request.json()) as { text?: string; contentHash?: string; tamperCode?: string }
    const text = body?.text ?? CONFIG.text.content
    const computed = hashCode(text)
    const valid = body?.contentHash === computed
    return HttpResponse.json({
      success: true,
      data: {
        valid,
        contentHashOk: body?.contentHash === computed,
        tamperOk: body?.tamperCode === hashCode(`${computed}|${CONFIG.text.position}|${CONFIG.text.opacity}`),
        computedContentHash: computed,
        computedTamperCode: hashCode(`${computed}|${CONFIG.text.position}|${CONFIG.text.opacity}`),
      },
    })
  }),

  http.get(`${API}/signs/stats`, async () => {
    await delay(40)
    const byStatus: Record<string, number> = { pending: 0, approved: 0, rejected: 0, cancelled: 0 }
    for (const s of signs) byStatus[s.status] = (byStatus[s.status] ?? 0) + 1
    return HttpResponse.json({
      success: true,
      data: envelope({
        total: signs.length,
        byStatus,
        pending: byStatus.pending,
        approved: byStatus.approved,
        rejected: byStatus.rejected,
        cancelled: byStatus.cancelled,
        signedToday: 4,
      }),
    })
  }),

  http.get(`${API}/signs`, async ({ request }) => {
    await delay(40)
    const url = new URL(request.url)
    const reportId = url.searchParams.get('reportId')
    const items = reportId ? signs.filter((s) => s.reportId === reportId) : signs
    return HttpResponse.json({ success: true, data: envelope(items) })
  }),

  http.post(`${API}/signs`, async ({ request }) => {
    await delay(60)
    const body = (await request.json()) as { reportId?: string; reportTitle?: string; kind?: SignKind; signerId?: string; applicantId?: string; reason?: string; reportText?: string }
    const now = new Date().toISOString()
    const sign: SignRequest = {
      id: `sg-${signSeq++}`,
      reportId: String(body?.reportId ?? 'RPT-UNKNOWN'),
      reportTitle: String(body?.reportTitle ?? '报告签署'),
      kind: (body?.kind ?? 'doctor') as SignKind,
      applicantId: String(body?.applicantId ?? 'u-001'),
      applicantName: '张主任',
      signerId: String(body?.signerId ?? 'u-002'),
      signerName: body?.signerId === 'u-002' ? '李医生' : body?.signerId === 'u-003' ? '王医生' : body?.signerId === 'u-004' ? '赵审核' : '未知签署人',
      reason: String(body?.reason ?? ''),
      status: 'pending',
      reportHash: hashCode(String(body?.reportText ?? body?.reportId ?? '')),
      createdAt: now,
      updatedAt: now,
      records: [{ id: `sr-${recordSeq++}`, action: 'apply', actorId: String(body?.applicantId ?? 'u-001'), actorName: '张主任', note: String(body?.reason ?? '申请签署'), at: now }],
    }
    signs.unshift(sign)
    return HttpResponse.json({ success: true, data: sign })
  }),

  http.get(`${API}/signs/:id`, async ({ params }) => {
    await delay(40)
    const item = signs.find((s) => s.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `sign ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: item })
  }),

  http.post(`${API}/signs/:id/approve`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { note?: string; actorId?: string }
    const item = signs.find((s) => s.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `sign ${params.id} not found` } }, { status: 404 })
    const now = new Date().toISOString()
    item.status = 'approved'
    item.signedAt = now
    item.signedById = String(body?.actorId ?? item.signerId)
    item.signedByName = item.signerName
    item.approveNote = String(body?.note ?? '已签署')
    item.updatedAt = now
    item.records = [...item.records, { id: `sr-${recordSeq++}`, action: 'approve', actorId: String(body?.actorId ?? item.signerId), actorName: item.signerName, note: String(body?.note ?? '已签署'), at: now }]
    return HttpResponse.json({ success: true, data: item })
  }),

  http.post(`${API}/signs/:id/reject`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { reason?: string; actorId?: string }
    const item = signs.find((s) => s.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `sign ${params.id} not found` } }, { status: 404 })
    const now = new Date().toISOString()
    item.status = 'rejected'
    item.rejectReason = String(body?.reason ?? '驳回')
    item.updatedAt = now
    item.records = [...item.records, { id: `sr-${recordSeq++}`, action: 'reject', actorId: String(body?.actorId ?? item.signerId), actorName: item.signerName, note: String(body?.reason ?? '驳回'), at: now }]
    return HttpResponse.json({ success: true, data: item })
  }),

  http.post(`${API}/signs/:id/cancel`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { reason?: string; actorId?: string }
    const item = signs.find((s) => s.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `sign ${params.id} not found` } }, { status: 404 })
    const now = new Date().toISOString()
    item.status = 'cancelled'
    item.updatedAt = now
    item.records = [...item.records, { id: `sr-${recordSeq++}`, action: 'cancel', actorId: String(body?.actorId ?? item.applicantId), actorName: item.applicantName, note: String(body?.reason ?? '撤销'), at: now }]
    return HttpResponse.json({ success: true, data: item })
  }),
]
