import { api } from './client'
import type { ApiResponse } from './types'

export type NotificationMethod = 'PHONE' | 'SMS' | 'SYSTEM' | 'EMAIL' | 'WECHAT' | 'DINGTALK'

export interface CriticalValueDto {
  id: string
  examId?: string
  patientName: string
  patientId?: string
  finding: string
  severity: string
  category?: string
  description?: string
  method?: string
  state?: string
  status: string
  triggeredAt: string
  notifiedAt?: string
  voiceCalledAt?: string
  voiceCalledBy?: string
  acknowledgedAt?: string
  confirmedBy?: string
  confirmedAt?: string
  confirmedSignature?: string
  confirmedComment?: string
  resolvedAt?: string
  doctorId?: string
  notifiedTo?: string
  ackedBy?: string
  resolvedBy?: string
  notificationMethod?: NotificationMethod
  createdAt?: string
  updatedAt?: string
}

export interface CriticalStatsDto {
  total: number
  pending: number
  notified: number
  acknowledged: number
  receipted: number
  resolved: number
  escalated: number
  todayCount: number
}

// [v3.0.6.11-105 Wave 1B] 国标 13 类危急值诊断字典
export interface NationalDiagnosisDto {
  code: string
  name: string
  category: string
  isNational: boolean
}

export interface NationalDiagnosesResult {
  items: NationalDiagnosisDto[]
  total: number
  nationalCount: number
  standard: string
  generatedAt: string
}

export interface CriticalRqiDetailDto {
  criticalId: string
  patientId?: string
  patientName?: string
  diagnosisCode: string
  diagnosisName: string
  foundAt: string
  notifiedAt?: string
  notifiedBy?: string
  receivedBy?: string
  receiveNote?: string
  notifyMinutes?: number
  within10Min: boolean
  signatureComplete: boolean
}

export interface CriticalRqiStatsDto {
  months: number
  windowStart: string
  standard: string
  deadlineMin: number
  source: 'db' | 'seed'
  nationalTotal: number
  within10MinCount: number
  overdueCount: number
  completionRate: number
  details: CriticalRqiDetailDto[]
  signatureIntegrity: {
    total: number
    notifiedAtCount: number
    notifiedByCount: number
    receivedByCount: number
    receiveNoteCount: number
    completeCount: number
    completenessRate: number
  }
}

// [G005 contract] 后端 GET /criticals 返回 { items, total } (MSW 旧 handler 为裸数组);
//   统一归一化为 { items, total }。
export interface CriticalListPayload {
  items: CriticalValueDto[]
  total: number
}

// 后端 CriticalState (大写枚举) → 前端 lowercase status (状态机/页面兼容; MSW 旧数据已带 status)
const CRITICAL_STATE_TO_STATUS: Record<string, string> = {
  FOUND: 'pending',
  NOTIFIED: 'notified',
  VOICE_CALLED: 'voice_called',
  ACKNOWLEDGED: 'acknowledged',
  RECEIPTED: 'receipted',
  RESOLVING: 'resolving',
  RESOLVED: 'resolved',
  CLOSED_LOOP: 'resolved',
  ESCALATED: 'escalated',
  CANCELLED: 'cancelled',
}

function normalizeCritical(dto: CriticalValueDto): CriticalValueDto {
  const state = String(dto?.state ?? '').toUpperCase()
  return {
    ...dto,
    status: dto?.status ?? CRITICAL_STATE_TO_STATUS[state] ?? (state ? state.toLowerCase() : 'pending'),
  }
}

// [W6] 与后端 CRITICAL_TRANSITIONS 对齐的状态流转表 (backend/src/criticals/criticals.service.ts)
const CRITICAL_TRANSITIONS: Record<string, string[]> = {
  FOUND: ['NOTIFIED', 'ESCALATED', 'CANCELLED'],
  NOTIFIED: ['VOICE_CALLED', 'ACKNOWLEDGED', 'ESCALATED', 'CANCELLED'],
  VOICE_CALLED: ['ACKNOWLEDGED', 'ESCALATED', 'CANCELLED'],
  ACKNOWLEDGED: ['RECEIPTED', 'RESOLVING', 'ESCALATED'],
  RECEIPTED: ['RESOLVING', 'ESCALATED'],
  RESOLVING: ['RESOLVED', 'ESCALATED'],
  RESOLVED: ['CLOSED_LOOP', 'CANCELLED'],
  CLOSED_LOOP: [],
  ESCALATED: ['ACKNOWLEDGED', 'CANCELLED'],
  CANCELLED: [],
}

const STATUS_TO_CRITICAL_STATE: Record<string, string> = {
  pending: 'FOUND',
  notified: 'NOTIFIED',
  voice_called: 'VOICE_CALLED',
  acknowledged: 'ACKNOWLEDGED',
  receipted: 'RECEIPTED',
  resolving: 'RESOLVING',
  resolved: 'RESOLVED',
  closed_loop: 'CLOSED_LOOP',
  escalated: 'ESCALATED',
  cancelled: 'CANCELLED',
}

/** 从 DTO 归一化出后端大写状态 (兼容旧 lowercase status) */
function criticalStateOf(dto?: CriticalValueDto | null): string {
  const raw = String(dto?.state ?? '').toUpperCase()
  if (CRITICAL_TRANSITIONS[raw]) return raw
  const byStatus = STATUS_TO_CRITICAL_STATE[String(dto?.status ?? '').toLowerCase()]
  return byStatus ?? (raw || 'FOUND')
}

/** BFS 求 from → to 的最短合法状态链 (不含 from), 无解返回 null */
function findCriticalPath(from: string, to: string): string[] | null {
  if (from === to) return []
  const queue: Array<{ state: string; path: string[] }> = [{ state: from, path: [] }]
  const seen = new Set<string>([from])
  while (queue.length > 0) {
    const { state, path } = queue.shift()!
    for (const next of CRITICAL_TRANSITIONS[state] ?? []) {
      if (seen.has(next)) continue
      const nextPath = [...path, next]
      if (next === to) return nextPath
      seen.add(next)
      queue.push({ state: next, path: nextPath })
    }
  }
  return null
}

/**
 * [W6] 按后端合法流转表分步流转到目标态: 非法直达 (如 FOUND→RESOLVED) 会被后端 400,
 * 因此先前置补齐中间态 (如 ACKNOWLEDGED→RESOLVING→RESOLVED) 再落目标态。
 */
async function applyCriticalTransition(
  id: string,
  target: string,
  extra?: Record<string, unknown>,
): Promise<ApiResponse<CriticalValueDto>> {
  let current: string = 'FOUND'
  try {
    const cur = await api.get<CriticalValueDto>(`/criticals/${id}`)
    current = criticalStateOf(cur.data)
  } catch {
    // 读取失败时直接提交目标态, 由后端给出准确错误
    return api.patch<CriticalValueDto>(`/criticals/${id}`, { state: target, ...extra })
  }
  const path = findCriticalPath(current, target)
  if (!path || path.length === 0) {
    return api.patch<CriticalValueDto>(`/criticals/${id}`, { state: target, ...extra })
  }
  let last: ApiResponse<CriticalValueDto> | null = null
  for (let i = 0; i < path.length; i++) {
    if (last && !last.success) return last
    const isLast = i === path.length - 1
    last = await api.patch<CriticalValueDto>(`/criticals/${id}`, isLast ? { state: path[i], ...extra } : { state: path[i] })
  }
  return last ?? api.patch<CriticalValueDto>(`/criticals/${id}`, { state: target, ...extra })
}

export const criticalApi = {
  list: async (params?: { skip?: number; take?: number; state?: string; severity?: string; dateFrom?: string; dateTo?: string; patientId?: string }) => {
    const searchParams = new URLSearchParams()
    if (params) {
      if (params.skip !== undefined) searchParams.set('skip', String(params.skip))
      if (params.take !== undefined) searchParams.set('take', String(params.take))
      if (params.state) searchParams.set('state', params.state)
      if (params.severity) searchParams.set('severity', params.severity)
      if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom)
      if (params.dateTo) searchParams.set('dateTo', params.dateTo)
      if (params.patientId) searchParams.set('patientId', params.patientId)
    }
    const qs = searchParams.toString()
    const res = await api.get<CriticalValueDto[] | { items?: CriticalValueDto[]; total?: number }>(`/criticals${qs ? `?${qs}` : ''}`)
    const raw = res.data
    const items = Array.isArray(raw) ? raw : (raw?.items ?? [])
    return {
      ...res,
      data: {
        items: items.map(normalizeCritical),
        total: Array.isArray(raw) ? raw.length : (raw?.total ?? items.length),
      },
    }
  },

  getById: (id: string) =>
    api.get<CriticalValueDto>(`/criticals/${id}`),

  // [G005 Wave 8] 报告→危急值反向引用: 按报告查询关联危急值 (级别/状态/时间)
  forReport: (reportId: string) =>
    api.get<{ reportId: string; items: CriticalValueDto[]; total: number }>(`/criticals/for-report/${encodeURIComponent(reportId)}`),

  create: (data: { examId?: string; description: string; severity?: string; method?: string; reportId?: string }) =>
    api.post<CriticalValueDto>('/criticals', data),

  update: (id: string, data: { description?: string; severity?: string; state?: string; notifiedTo?: string; ackedBy?: string; resolvedBy?: string; closedBy?: string }) =>
    api.patch<CriticalValueDto>(`/criticals/${id}`, data),

  delete: (id: string) =>
    api.delete(`/criticals/${id}`),

  voiceCall: (id: string, data: { calledBy: string; phoneNumber: string; note?: string }) =>
    api.post<CriticalValueDto>(`/criticals/${id}/voice-call`, data),

  clinicalReceipt: (id: string, data: { confirmedBy: string; signature?: string; comment?: string }) =>
    api.post<CriticalValueDto>(`/criticals/${id}/clinical-receipt`, data),

  // [W6] 确认/处理/闭环走合法流转链 (不能 ACK 早于 NOTIFIED / RESOLVE 早于 ACKNOWLEDGED)
  acknowledge: (id: string) =>
    applyCriticalTransition(id, 'ACKNOWLEDGED'),

  resolve: (id: string) =>
    applyCriticalTransition(id, 'RESOLVED'),

  // [G005-P0] 闭环统一走 PATCH /criticals/:id state=CLOSED_LOOP (原 POST /criticals/close-loop 后端无该端点)
  closeLoop: (id: string, closedBy?: string) =>
    applyCriticalTransition(id, 'CLOSED_LOOP', closedBy ? { closedBy } : undefined),

  notify: (id: string, method?: NotificationMethod, extra?: { patientName?: string; patientId?: string; category?: string; finding?: string; recipientName?: string; recipientDept?: string; recipientPhone?: string }) =>
    api.post<{ id: string; status?: string; count?: number }>('/criticals/notify', { criticalId: id, channels: method ? [method] : ['SYSTEM'], ...extra }),

  escalate: (id: string, to: string, reason: string) =>
    api.post<{ id: string }>('/criticals/escalate', { criticalId: id, reason, newRecipients: [{ name: to, dept: '', phone: '' }] }),

  listHistory: (criticalId: string) =>
    api.get<unknown[]>(`/criticals/${criticalId}/history`),

  // [G005-P0] 5 步工作流记录 (criticalValue + 通知记录聚合, 后端 /criticals/value5step/list)
  getValue5StepList: () =>
    api.get<{ items: unknown[]; total: number }>('/criticals/value5step/list'),

  runEscalationChain: (eventId: string) =>
    api.post<{ chain: unknown; nodesTriggered: Array<{ level: number; role: string; doctor: string; smsResults: number; voiceResults: number }> }>(`/criticals/${eventId}/escalation-chain`),

  getStats: () =>
    api.get<CriticalStatsDto>('/criticals/stats'),

  // [v3.0.6.11-105 Wave 1B] 国标 13 类危急值诊断字典
  getNationalDiagnoses: () =>
    api.get<NationalDiagnosesResult>('/criticals/national-diagnoses'),

  // [v3.0.6.11-105 Wave 1B] 国标口径 RQI 统计 (10 分钟通报完成率 + 署名完整性)
  getRqiStats: (months = 1) =>
    api.get<CriticalRqiStatsDto>(`/criticals/rqi-stats?months=${months}`),
}
