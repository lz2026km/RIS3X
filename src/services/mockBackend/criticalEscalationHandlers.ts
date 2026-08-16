// [G005 Wave 6B v3.0.6.11-101] /api/v1/critical-escalation MSW handlers
// 对齐后端 critical-escalation.module + criticalEscalationApi (升级链配置 + 执行状态机 + 统计, 孤儿模块)
// 响应形状: { success: true, data: <T> }
import { http, HttpResponse, delay } from 'msw'
// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1')


const API = `${API_BASE}/critical-escalation`

type EscalationLevel = 1 | 2 | 3
type ChainStatus = 'NOTIFYING' | 'PENDING_CONFIRM' | 'CONFIRMED' | 'ESCALATED' | 'CLOSED'
type StepStatus = 'NOTIFIED' | 'CONFIRMED' | 'TIMEOUT'

interface LevelConfig { level: EscalationLevel; name: string; role: string; timeoutMinutes: number; channels: string[] }
interface EscalationRule { key: string; name: string; description: string; enabled: boolean }
interface EscalationStep { level: EscalationLevel; levelName: string; role: string; status: StepStatus; timeoutMinutes: number; startedAt: string; deadline: string; notifiedAt?: string; confirmedAt?: string; confirmedBy?: string }
interface EscalationChain {
  id: string
  criticalValueId: string
  patientName: string
  modality: string
  title: string
  severity: string
  status: ChainStatus
  currentLevel: EscalationLevel
  startedAt: string
  currentLevelStartedAt: string
  currentDeadline: string
  escalatedCount: number
  acknowledgedBy?: string
  acknowledgedAt?: string
  closedAt?: string
  closedBy?: string
  steps: EscalationStep[]
  history: Array<{ at: string; reason: string }>
}

const STATUS_LABELS: Record<ChainStatus, string> = {
  NOTIFYING: '通知中', PENDING_CONFIRM: '待确认', CONFIRMED: '已确认', ESCALATED: '已升级', CLOSED: '已关闭',
}
const STEP_LABELS: Record<StepStatus, string> = {
  NOTIFIED: '已通知', CONFIRMED: '已确认', TIMEOUT: '已超时',
}

let LEVELS: LevelConfig[] = [
  { level: 1, name: '值班医生', role: 'DOCTOR', timeoutMinutes: 10, channels: ['phone', 'message'] },
  { level: 2, name: '值班组长', role: 'DOCTOR', timeoutMinutes: 15, channels: ['phone', 'sms'] },
  { level: 3, name: '科主任', role: 'DIRECTOR', timeoutMinutes: 30, channels: ['phone'] },
]

const RULES: EscalationRule[] = [
  { key: 'no-ack', name: '超时未确认', description: '当值医生 10 分钟未确认则升级', enabled: true },
  { key: 'no-response', name: '执行无响应', description: '危急处置无响应时升级', enabled: true },
  { key: 'manual', name: '手动升级', description: '当值医生主动申请上级协助', enabled: true },
]

function fmtDeadline(startIso: string, minutes: number): string {
  return new Date(new Date(startIso).getTime() + minutes * 60000).toISOString()
}

function stepsFor(level: EscalationLevel): EscalationStep[] {
  return LEVELS.filter((l) => l.level <= level).map((l) => ({
    level: l.level,
    levelName: l.name,
    role: l.role,
    status: 'NOTIFIED' as StepStatus,
    timeoutMinutes: l.timeoutMinutes,
    startedAt: '2026-08-16T08:00:00.000Z',
    deadline: fmtDeadline('2026-08-16T08:00:00.000Z', l.timeoutMinutes),
    notifiedAt: '2026-08-16T08:00:00.000Z',
  }))
}

const CHAINS: EscalationChain[] = [
  {
    id: 'ce-ch-001', criticalValueId: 'CV-20260816-001', patientName: '陈志强', modality: 'CT',
    title: '颅内出血 (高危急值)', severity: 'high',
    status: 'PENDING_CONFIRM', currentLevel: 1,
    startedAt: '2026-08-16T08:00:00.000Z', currentLevelStartedAt: '2026-08-16T08:00:00.000Z',
    currentDeadline: fmtDeadline('2026-08-16T08:00:00.000Z', 10),
    escalatedCount: 0,
    steps: stepsFor(1),
    history: [{ at: '2026-08-16T08:00:00.000Z', reason: '危急值上报触发升级链' }],
  },
  {
    id: 'ce-ch-002', criticalValueId: 'CV-20260815-003', patientName: '张建国', modality: 'MR',
    title: '主动脉夹层', severity: 'high',
    status: 'CONFIRMED', currentLevel: 2,
    startedAt: '2026-08-15T16:20:00.000Z', currentLevelStartedAt: '2026-08-15T16:20:00.000Z',
    currentDeadline: fmtDeadline('2026-08-15T16:20:00.000Z', 15),
    escalatedCount: 1,
    acknowledgedBy: 'u-021', acknowledgedAt: '2026-08-15T16:26:00.000Z',
    steps: [
      { level: 1, levelName: '值班医生', role: 'DOCTOR', status: 'CONFIRMED', timeoutMinutes: 10, startedAt: '2026-08-15T16:20:00.000Z', deadline: fmtDeadline('2026-08-15T16:20:00.000Z', 10), notifiedAt: '2026-08-15T16:20:00.000Z', confirmedAt: '2026-08-15T16:26:00.000Z', confirmedBy: 'u-021' },
      { level: 2, levelName: '值班组长', role: 'DOCTOR', status: 'NOTIFIED', timeoutMinutes: 15, startedAt: '2026-08-15T16:26:00.000Z', deadline: fmtDeadline('2026-08-15T16:26:00.000Z', 15), notifiedAt: '2026-08-15T16:26:00.000Z' },
    ],
    history: [
      { at: '2026-08-15T16:20:00.000Z', reason: '危急值上报触发升级链' },
      { at: '2026-08-15T16:26:00.000Z', reason: '值班医生确认' },
    ],
  },
  {
    id: 'ce-ch-003', criticalValueId: 'CV-20260810-002', patientName: '李秀英', modality: 'CT',
    title: '肺栓塞 (高危急值)', severity: 'high',
    status: 'CLOSED', currentLevel: 1,
    startedAt: '2026-08-10T09:10:00.000Z', currentLevelStartedAt: '2026-08-10T09:10:00.000Z',
    currentDeadline: fmtDeadline('2026-08-10T09:10:00.000Z', 10),
    escalatedCount: 0,
    acknowledgedBy: 'u-018', acknowledgedAt: '2026-08-10T09:15:00.000Z',
    closedAt: '2026-08-10T11:00:00.000Z', closedBy: 'u-018',
    steps: [{ level: 1, levelName: '值班医生', role: 'DOCTOR', status: 'CONFIRMED', timeoutMinutes: 10, startedAt: '2026-08-10T09:10:00.000Z', deadline: fmtDeadline('2026-08-10T09:10:00.000Z', 10), notifiedAt: '2026-08-10T09:10:00.000Z', confirmedAt: '2026-08-10T09:15:00.000Z', confirmedBy: 'u-018' }],
    history: [
      { at: '2026-08-10T09:10:00.000Z', reason: '危急值上报触发升级链' },
      { at: '2026-08-10T09:15:00.000Z', reason: '值班医生确认' },
      { at: '2026-08-10T11:00:00.000Z', reason: '处置完成, 链关闭' },
    ],
  },
]

let chains: EscalationChain[] = [...CHAINS]
let chainSeq = 100

export const criticalEscalationHandlers = [
  http.get(`${API}/config`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: { levels: LEVELS, rules: RULES, statusLabels: STATUS_LABELS, stepLabels: STEP_LABELS } })
  }),

  http.put(`${API}/config`, async ({ request }) => {
    await delay(50)
    const body = (await request.json()) as { levels?: Array<{ level: number; name?: string; role?: string; timeoutMinutes: number; channels?: string[] }> }
    if (Array.isArray(body?.levels)) {
      LEVELS = body.levels.map((l) => ({
        level: l.level as EscalationLevel,
        name: l.name ?? LEVELS.find((x) => x.level === l.level)?.name ?? `L${l.level}`,
        role: l.role ?? LEVELS.find((x) => x.level === l.level)?.role ?? 'DOCTOR',
        timeoutMinutes: l.timeoutMinutes,
        channels: l.channels ?? ['phone'],
      }))
    }
    return HttpResponse.json({ success: true, data: { levels: LEVELS } })
  }),

  http.get(`${API}/chains`, async ({ request }) => {
    await delay(40)
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const items = status ? chains.filter((c) => c.status === status) : chains
    return HttpResponse.json({ success: true, data: items })
  }),

  http.post(`${API}/chains`, async ({ request }) => {
    await delay(60)
    const body = (await request.json()) as { criticalValueId?: string; patientName?: string; modality?: string; title?: string; severity?: string }
    const now = new Date().toISOString()
    const chain: EscalationChain = {
      id: `ce-ch-${chainSeq++}`,
      criticalValueId: String(body?.criticalValueId ?? 'CV-UNKNOWN'),
      patientName: String(body?.patientName ?? '演示患者'),
      modality: String(body?.modality ?? 'CT'),
      title: String(body?.title ?? '危急值上报'),
      severity: String(body?.severity ?? 'high'),
      status: 'NOTIFYING',
      currentLevel: 1,
      startedAt: now,
      currentLevelStartedAt: now,
      currentDeadline: fmtDeadline(now, LEVELS[0]!.timeoutMinutes),
      escalatedCount: 0,
      steps: LEVELS.map((l) => ({
        level: l.level, levelName: l.name, role: l.role, status: 'NOTIFIED' as StepStatus,
        timeoutMinutes: l.timeoutMinutes, startedAt: now, deadline: fmtDeadline(now, l.timeoutMinutes), notifiedAt: now,
      })),
      history: [{ at: now, reason: '危急值上报触发升级链' }],
    }
    chains.unshift(chain)
    return HttpResponse.json({ success: true, data: chain })
  }),

  http.get(`${API}/chains/:id`, async ({ params }) => {
    await delay(40)
    const item = chains.find((c) => c.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `chain ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: item })
  }),

  http.post(`${API}/chains/:id/tick`, async ({ params }) => {
    await delay(40)
    const item = chains.find((c) => c.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `chain ${params.id} not found` } }, { status: 404 })
    if (item.status !== 'NOTIFYING' && item.status !== 'PENDING_CONFIRM') return HttpResponse.json({ success: true, data: item })
    const now = new Date()
    const deadline = new Date(item.currentDeadline)
    if (now > deadline && item.currentLevel < 3) {
      item.currentLevel = (item.currentLevel + 1) as EscalationLevel
      item.status = 'NOTIFYING'
      item.escalatedCount += 1
      item.currentLevelStartedAt = now.toISOString()
      item.currentDeadline = fmtDeadline(now.toISOString(), LEVELS[item.currentLevel - 1]!.timeoutMinutes)
      item.steps = item.steps.map((s) => (s.level === item.currentLevel - 1 ? { ...s, status: 'TIMEOUT' as StepStatus } : s))
      item.history.push({ at: now.toISOString(), reason: `L${item.currentLevel - 1} 超时, 升级至 L${item.currentLevel}` })
    }
    return HttpResponse.json({ success: true, data: item })
  }),

  http.post(`${API}/chains/:id/acknowledge`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { confirmedBy?: string; comment?: string }
    const item = chains.find((c) => c.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `chain ${params.id} not found` } }, { status: 404 })
    const now = new Date().toISOString()
    item.status = 'CONFIRMED'
    item.acknowledgedBy = String(body?.confirmedBy ?? 'u-001')
    item.acknowledgedAt = now
    item.steps = item.steps.map((s) => (s.level === item.currentLevel ? { ...s, status: 'CONFIRMED' as StepStatus, confirmedAt: now, confirmedBy: String(body?.confirmedBy ?? 'u-001') } : s))
    item.history.push({ at: now, reason: `${item.currentLevel} 级确认: ${String(body?.comment ?? '')}` })
    return HttpResponse.json({ success: true, data: item })
  }),

  http.post(`${API}/chains/:id/escalate`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { reason?: string; escalatedBy?: string }
    const item = chains.find((c) => c.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `chain ${params.id} not found` } }, { status: 404 })
    const now = new Date().toISOString()
    const next = Math.min(3, item.currentLevel + 1) as EscalationLevel
    item.currentLevel = next
    item.status = 'NOTIFYING'
    item.escalatedCount += 1
    item.currentLevelStartedAt = now
    item.currentDeadline = fmtDeadline(now, LEVELS[next - 1]!.timeoutMinutes)
    item.steps = item.steps.map((s) => {
      if (s.level === next - 1 && s.status !== 'CONFIRMED') return { ...s, status: 'TIMEOUT' as StepStatus }
      if (s.level === next) return { ...s, status: 'NOTIFIED' as StepStatus, notifiedAt: now, startedAt: now, deadline: fmtDeadline(now, s.timeoutMinutes) }
      return s
    })
    item.history.push({ at: now, reason: `手动升级至 L${next}: ${String(body?.reason ?? '')} (${String(body?.escalatedBy ?? '')})` })
    return HttpResponse.json({ success: true, data: item })
  }),

  http.post(`${API}/chains/:id/close`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { closedBy?: string; comment?: string }
    const item = chains.find((c) => c.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `chain ${params.id} not found` } }, { status: 404 })
    const now = new Date().toISOString()
    item.status = 'CLOSED'
    item.closedAt = now
    item.closedBy = String(body?.closedBy ?? 'u-001')
    item.history.push({ at: now, reason: `关闭: ${String(body?.comment ?? '')}` })
    return HttpResponse.json({ success: true, data: item })
  }),

  http.get(`${API}/chains/:id/steps`, async ({ params }) => {
    await delay(40)
    const item = chains.find((c) => c.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `chain ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: item.steps })
  }),

  http.get(`${API}/stats`, async () => {
    await delay(40)
    const total = chains.length
    const byStatus: Record<ChainStatus, number> = { NOTIFYING: 0, PENDING_CONFIRM: 0, CONFIRMED: 0, ESCALATED: 0, CLOSED: 0 }
    for (const c of chains) byStatus[c.status] += 1
    return HttpResponse.json({
      success: true,
      data: {
        total,
        byStatus,
        avgResponseMinutes: Math.round(total * 100) / 10,
        avgEscalationCount: Math.round(chains.reduce((s, c) => s + c.escalatedCount, 0) / Math.max(1, total) * 10) / 10,
        escalationRate: Math.round((chains.filter((c) => c.escalatedCount > 0).length / Math.max(1, total)) * 1000) / 10,
        closedRate: Math.round((byStatus.CLOSED / Math.max(1, total)) * 1000) / 10,
        byLevel: [1, 2, 3].map((lv) => ({
          level: lv as EscalationLevel,
          levelName: LEVELS.find((l) => l.level === lv)?.name ?? `L${lv}`,
          count: chains.filter((c) => c.currentLevel === lv).length,
          confirmed: chains.filter((c) => c.currentLevel === lv && c.status === 'CONFIRMED').length,
          escalated: chains.filter((c) => c.currentLevel === lv && c.escalatedCount >= lv).length,
          avgResponseMinutes: 6 + lv * 4,
        })),
      },
    })
  }),
]
