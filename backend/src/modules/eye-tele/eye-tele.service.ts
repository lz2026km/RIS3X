/**
 * [G005 Wave 10A] 眼科远程会诊桥接服务 (/eye/tele/*)
 *
 * 对齐前端 eyeApi.tele 方法 (TeleConsultPage) 与 MSW eyeTeleconsultModule:
 *   GET  /eye/tele/turn                     → 5G+TURN 网络配置 (确定性 seed)
 *   POST /eye/tele/session                  → 创建会诊 (复用 tele 模块 WebRTC 信令会话)
 *   GET  /eye/tele/sessions                 → 会话列表 (seed 派生 + 内存)
 *   GET  /eye/tele/session/:sessionId       → 会话详情
 *   DELETE /eye/tele/session/:sessionId     → 结束会话
 *   POST /eye/tele/stream                   → 跨院 DICOM 远程流 (状态端点)
 *   GET  /eye/tele/streams                  → 流状态列表
 *   POST /eye/tele/consult                  → 会诊意见征集 (consult 记录, 内存 + seed)
 *   GET  /eye/tele/consults                 → 会诊记录列表
 *   POST /eye/tele/consult/:id/answer       → 会诊意见答复
 *   GET  /eye/tele/consult/:id              → 会诊记录详情
 *   GET  /eye/tele/stats                    → 会诊统计
 *
 * 会诊 session 复用于 tele 模块 (TeleService 内存会话) 用于真实 WebRTC 信令;
 * 眼科业务字段 (patientId/studyId/mode/participants/status) 由本服务内存保持,
 * seed 会话从 eye studies 派生 (确定性), 首次访问时惰性加载。
 */
import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common'
import { TeleService } from '../tele/tele.service'

export interface EyeTeleSession {
  sessionId: string
  patientId: string
  studyId: string
  mode: 'video' | 'screen' | 'data'
  participants: string[]
  status: 'active' | 'waiting' | 'ended'
  signalingUrl: string
  iceServers: Array<{ urls: string; username?: string; credential?: string }>
  startedAt: string
  endedAt?: string
  network?: {
    edgeNodeId: string
    slice: string
    latencyP95: number
    bandwidthUp: number
    bandwidthDown: number
  }
}

export interface EyeTeleStream {
  streamId: string
  studyId: string
  targetHospital: string
  protocol: 'wado' | 'dicom-tls'
  endpoint: string
  aesKey: string
  estimatedLoadTime: number
  chunkSize: number
  status: 'starting' | 'streaming' | 'ended'
  startedAt: string
  endedAt?: string
  bytesTransferred: number
}

export interface EyeTeleConsult {
  consultId: string
  sessionId: string
  patientId: string
  studyId: string
  specialistId: string
  specialistName: string
  question: string
  status: 'pending' | 'answered' | 'cancelled'
  sla: { responseTime: string; priority: 'normal' | 'urgent' }
  requestedAt: string
  answeredAt?: string
  answer?: string
  reviewedBy?: string
}

export interface EyeTeleStats {
  totalSessions: number
  activeSessions: number
  totalConsults: number
  answeredConsults: number
  avgResponseMinutes: number
  hospitals: string[]
  byMode: Record<string, number>
}

// ── 确定性 seed: 历史会诊 (从 eye studies 派生, 业务真实) ──────────────────────
const SEED_SESSIONS: EyeTeleSession[] = [
  {
    sessionId: 'SES-20260701-001',
    patientId: 'P000001',
    studyId: 'STU-20260620-00001',
    mode: 'video',
    participants: ['D001', 'D005'],
    status: 'ended',
    signalingUrl: 'wss://tele.g005.local/signal/SES-20260701-001',
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'turn:turn1.g005.local:3478', username: 'g005', credential: 'turn-secret-2026' },
    ],
    startedAt: '2026-07-01T09:15:00.000Z',
    endedAt: '2026-07-01T10:05:00.000Z',
    network: { edgeNodeId: 'edge-bj-01', slice: 'healthcare-mmtc', latencyP95: 35, bandwidthUp: 100, bandwidthDown: 500 },
  },
  {
    sessionId: 'SES-20260703-002',
    patientId: 'P000003',
    studyId: 'STU-20260702-00003',
    mode: 'screen',
    participants: ['D002', 'D003'],
    status: 'ended',
    signalingUrl: 'wss://tele.g005.local/signal/SES-20260703-002',
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'turn:turn2.g005.local:3478', username: 'g005', credential: 'turn-secret-2026' },
    ],
    startedAt: '2026-07-03T14:30:00.000Z',
    endedAt: '2026-07-03T15:20:00.000Z',
    network: { edgeNodeId: 'edge-sh-02', slice: 'healthcare-mmtc', latencyP95: 42, bandwidthUp: 80, bandwidthDown: 400 },
  },
  {
    sessionId: 'SES-20260705-003',
    patientId: 'P000005',
    studyId: 'STU-20260705-00005',
    mode: 'data',
    participants: ['D001', 'D004'],
    status: 'ended',
    signalingUrl: 'wss://tele.g005.local/signal/SES-20260705-003',
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'turn:turn1.g005.local:3478', username: 'g005', credential: 'turn-secret-2026' },
    ],
    startedAt: '2026-07-05T10:00:00.000Z',
    endedAt: '2026-07-05T10:45:00.000Z',
    network: { edgeNodeId: 'edge-bj-01', slice: 'healthcare-mmtc', latencyP95: 38, bandwidthUp: 90, bandwidthDown: 450 },
  },
  {
    sessionId: 'SES-20260708-004',
    patientId: 'P000002',
    studyId: 'STU-20260707-00002',
    mode: 'video',
    participants: ['D003', 'D005'],
    status: 'ended',
    signalingUrl: 'wss://tele.g005.local/signal/SES-20260708-004',
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'turn:turn2.g005.local:3478', username: 'g005', credential: 'turn-secret-2026' },
    ],
    startedAt: '2026-07-08T16:20:00.000Z',
    endedAt: '2026-07-08T17:10:00.000Z',
    network: { edgeNodeId: 'edge-gz-03', slice: 'healthcare-mmtc', latencyP95: 45, bandwidthUp: 70, bandwidthDown: 350 },
  },
  {
    sessionId: 'SES-20260710-005',
    patientId: 'P000004',
    studyId: 'STU-20260710-00004',
    mode: 'screen',
    participants: ['D002', 'D005'],
    status: 'ended',
    signalingUrl: 'wss://tele.g005.local/signal/SES-20260710-005',
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'turn:turn1.g005.local:3478', username: 'g005', credential: 'turn-secret-2026' },
    ],
    startedAt: '2026-07-10T11:00:00.000Z',
    endedAt: '2026-07-10T11:50:00.000Z',
    network: { edgeNodeId: 'edge-bj-01', slice: 'healthcare-mmtc', latencyP95: 36, bandwidthUp: 95, bandwidthDown: 480 },
  },
]

// ── 确定性 seed: 历史远程流 ─────────────────────────────────────────────────────
const SEED_STREAMS: EyeTeleStream[] = [
  { streamId: 'STR-20260701-001', studyId: 'STU-20260620-00001', targetHospital: 'PUMC-眼科', protocol: 'dicom-tls', endpoint: 'dicom://tele.g005.local:11112/studies/STU-20260620-00001', aesKey: 'AES256-GCM-001', estimatedLoadTime: 2.5, chunkSize: 524288, status: 'ended', startedAt: '2026-07-01T09:20:00.000Z', endedAt: '2026-07-01T10:00:00.000Z', bytesTransferred: 51200000 },
  { streamId: 'STR-20260703-001', studyId: 'STU-20260702-00003', targetHospital: '复旦眼耳鼻喉', protocol: 'wado', endpoint: 'wado://tele.g005.local:8080/studies/STU-20260702-00003', aesKey: 'AES256-GCM-002', estimatedLoadTime: 3.1, chunkSize: 524288, status: 'ended', startedAt: '2026-07-03T14:35:00.000Z', endedAt: '2026-07-03T15:15:00.000Z', bytesTransferred: 38800000 },
  { streamId: 'STR-20260708-001', studyId: 'STU-20260707-00002', targetHospital: '中山眼科中心', protocol: 'dicom-tls', endpoint: 'dicom://tele.g005.local:11112/studies/STU-20260707-00002', aesKey: 'AES256-GCM-003', estimatedLoadTime: 2.8, chunkSize: 524288, status: 'ended', startedAt: '2026-07-08T16:25:00.000Z', endedAt: '2026-07-08T17:05:00.000Z', bytesTransferred: 46100000 },
]

// ── 确定性 seed: 历史会诊意见 ──────────────────────────────────────────────────
const SEED_CONSULTS: EyeTeleConsult[] = [
  {
    consultId: 'CON-20260701-001',
    sessionId: 'SES-20260701-001',
    patientId: 'P000001',
    studyId: 'STU-20260620-00001',
    specialistId: 'D005',
    specialistName: '孙会诊专家',
    question: '请评估该患者 OCT 黄斑水肿程度及抗 VEGF 治疗建议',
    status: 'answered',
    sla: { responseTime: '4 hours', priority: 'normal' },
    requestedAt: '2026-07-01T09:30:00.000Z',
    answeredAt: '2026-07-01T11:45:00.000Z',
    answer: 'OCT 显示黄斑中心凹厚度 428μm,视网膜内液明显,符合糖尿病性黄斑水肿。建议首选抗 VEGF 治疗,每月一针共 3 次后复查 OCT 评估疗效。',
    reviewedBy: 'D001',
  },
  {
    consultId: 'CON-20260703-001',
    sessionId: 'SES-20260703-002',
    patientId: 'P000003',
    studyId: 'STU-20260702-00003',
    specialistId: 'D003',
    specialistName: '李医师',
    question: '右眼视野 MD 值进行性下降,是否需要调整青光眼用药方案?',
    status: 'answered',
    sla: { responseTime: '4 hours', priority: 'urgent' },
    requestedAt: '2026-07-03T14:45:00.000Z',
    answeredAt: '2026-07-03T16:30:00.000Z',
    answer: '视野 MD 从 -6.2dB 降至 -8.4dB,眼压控制不佳。建议加用固定复方制剂,4 周后复查眼压及视野。',
    reviewedBy: 'D002',
  },
  {
    consultId: 'CON-20260705-001',
    sessionId: 'SES-20260705-003',
    patientId: 'P000005',
    studyId: 'STU-20260705-00005',
    specialistId: 'D004',
    specialistName: '赵医师',
    question: 'ICG 造影见脉络膜新生血管,是否建议光动力治疗?',
    status: 'answered',
    sla: { responseTime: '4 hours', priority: 'normal' },
    requestedAt: '2026-07-05T10:15:00.000Z',
    answeredAt: '2026-07-05T13:00:00.000Z',
    answer: '黄斑中心凹下典型性 CNV,病灶面积 2.1mm²。建议行抗 VEGF 玻璃体腔注射,若 3 针后仍有活动性渗漏可考虑 PDT 联合治疗。',
    reviewedBy: 'D001',
  },
  {
    consultId: 'CON-20260708-001',
    sessionId: 'SES-20260708-004',
    patientId: 'P000002',
    studyId: 'STU-20260707-00002',
    specialistId: 'D005',
    specialistName: '孙会诊专家',
    question: '高度近视患者眼底彩照见颞侧弧形斑扩大,需评估病理性近视风险',
    status: 'pending',
    sla: { responseTime: '4 hours', priority: 'normal' },
    requestedAt: '2026-07-08T16:35:00.000Z',
  },
]

// ── 确定性 seed: TURN 网络配置 (5G 边缘切片) ───────────────────────────────────
const SEED_TURN = {
  turnServers: [
    { url: 'turn:turn1.g005.local:3478', username: 'g005', credential: 'turn-secret-2026', ttl: 86400 },
    { url: 'turn:turn2.g005.local:3478', username: 'g005', credential: 'turn-secret-2026', ttl: 86400 },
  ],
  '5G_edge': { enabled: true, edgeNodeId: 'edge-bj-01', slice: 'healthcare-mmtc' },
  latency: { p50: 18, p95: 35, p99: 58, unit: 'ms' },
  bandwidth: { up: 100, down: 500, unit: 'Mbps' },
}

const HOSPITALS = ['PUMC-眼科', '复旦眼耳鼻喉', '中山眼科中心', '北京同仁眼科', '温州医大眼视光']

function nowIso(): string {
  return new Date().toISOString()
}

function genId(prefix: string): string {
  return `${prefix}-${Date.now()}`
}

@Injectable()
export class EyeTeleService {
  private readonly logger = new Logger(EyeTeleService.name)
  private readonly sessions = new Map<string, EyeTeleSession>()
  private readonly streams = new Map<string, EyeTeleStream>()
  private readonly consults = new Map<string, EyeTeleConsult>()
  private seeded = false

  constructor(private readonly tele: TeleService) {}

  private ensureSeeded(): void {
    if (this.seeded) return
    for (const s of SEED_SESSIONS) this.sessions.set(s.sessionId, { ...s, participants: [...s.participants] })
    for (const s of SEED_STREAMS) this.streams.set(s.streamId, { ...s })
    for (const c of SEED_CONSULTS) this.consults.set(c.consultId, { ...c })
    this.seeded = true
  }

  /** GET /eye/tele/turn — 5G + TURN 网络配置 (确定性 seed) */
  getTurn(): Record<string, unknown> {
    return {
      turnServers: SEED_TURN.turnServers,
      '5G': { ...SEED_TURN['5G_edge'] },
      '5G_edge': { ...SEED_TURN['5G_edge'] },
      latency: { ...SEED_TURN.latency },
      bandwidth: { ...SEED_TURN.bandwidth },
      refreshedAt: nowIso(),
    }
  }

  /** POST /eye/tele/session — 创建会诊 (复用 tele 模块真实 WebRTC 信令会话) */
  createSession(input: {
    patientId: string
    studyId?: string
    participants?: string[]
    mode?: 'video' | 'screen' | 'data'
  }): EyeTeleSession {
    this.ensureSeeded()
    if (!input.patientId) throw new BadRequestException('patientId 不能为空')
    const participants = Array.isArray(input.participants) && input.participants.length > 0 ? input.participants : ['D001', 'D002']
    const hostId = participants[0] ?? 'D001'
    const hostName = this.specialistName(hostId)
    const webRtc = this.tele.createSession(hostId, hostName, input.studyId ? [input.studyId] : [])
    const session: EyeTeleSession = {
      sessionId: webRtc.id,
      patientId: input.patientId,
      studyId: input.studyId ?? `STU-${nowIso().slice(0, 10).replace(/-/g, '')}-00001`,
      mode: input.mode ?? 'video',
      participants,
      status: 'active',
      signalingUrl: `wss://tele.g005.local/signal/${webRtc.id}`,
      iceServers: SEED_TURN.turnServers.map((t) => ({ urls: t.url, username: t.username, credential: t.credential })),
      startedAt: nowIso(),
      network: { edgeNodeId: SEED_TURN['5G_edge'].edgeNodeId, slice: SEED_TURN['5G_edge'].slice, latencyP95: 35, bandwidthUp: 100, bandwidthDown: 500 },
    }
    this.sessions.set(session.sessionId, session)
    this.logger.log(`Eye tele session ${session.sessionId} created for patient ${input.patientId}`)
    return session
  }

  /** GET /eye/tele/sessions — 会话列表 (seed + 内存, 可选 status 过滤) */
  listSessions(status?: string): EyeTeleSession[] {
    this.ensureSeeded()
    const all = [...this.sessions.values()]
    if (status) return all.filter((s) => s.status === status)
    return all
  }

  /** GET /eye/tele/session/:sessionId — 会话详情 */
  getSession(sessionId: string): EyeTeleSession {
    this.ensureSeeded()
    const session = this.sessions.get(sessionId)
    if (!session) throw new NotFoundException(`会诊会话不存在: ${sessionId}`)
    return session
  }

  /** DELETE /eye/tele/session/:sessionId — 结束会诊 */
  endSession(sessionId: string): { sessionId: string; status: string; endedAt: string } {
    const session = this.getSession(sessionId)
    if (session.status === 'active') {
      try {
        this.tele.endSession(sessionId)
      } catch {
        // 会话从未 join 时 tele 模块可能未持有,忽略
      }
    }
    session.status = 'ended'
    session.endedAt = nowIso()
    return { sessionId, status: session.status, endedAt: session.endedAt }
  }

  /** POST /eye/tele/stream — 跨院 DICOM 远程流 */
  createStream(input: { studyId: string; targetHospital?: string; protocol?: 'wado' | 'dicom-tls' }): EyeTeleStream {
    this.ensureSeeded()
    if (!input.studyId) throw new BadRequestException('studyId 不能为空')
    const hospital = input.targetHospital ?? HOSPITALS[0]
    const protocol = input.protocol ?? 'dicom-tls'
    const stream: EyeTeleStream = {
      streamId: genId('STR'),
      studyId: input.studyId,
      targetHospital: hospital,
      protocol,
      endpoint: protocol === 'wado'
        ? `wado://tele.g005.local:8080/studies/${input.studyId}`
        : `dicom://tele.g005.local:11112/studies/${input.studyId}`,
      aesKey: `AES256-GCM-${Date.now()}`,
      estimatedLoadTime: protocol === 'wado' ? 3.2 : 2.5,
      chunkSize: 524288,
      status: 'streaming',
      startedAt: nowIso(),
      bytesTransferred: 0,
    }
    this.streams.set(stream.streamId, stream)
    return stream
  }

  /** GET /eye/tele/streams — 流状态列表 */
  listStreams(status?: string): EyeTeleStream[] {
    this.ensureSeeded()
    const all = [...this.streams.values()]
    if (status) return all.filter((s) => s.status === status)
    return all
  }

  /** POST /eye/tele/consult — 会诊意见征集 */
  createConsult(input: {
    sessionId?: string
    specialistId: string
    question: string
    patientId?: string
    studyId?: string
    priority?: 'normal' | 'urgent'
  }): EyeTeleConsult {
    this.ensureSeeded()
    if (!input.specialistId) throw new BadRequestException('specialistId 不能为空')
    if (!input.question?.trim()) throw new BadRequestException('question 不能为空')
    let patientId = input.patientId ?? ''
    let studyId = input.studyId ?? ''
    if (input.sessionId) {
      const session = this.sessions.get(input.sessionId)
      if (!session) throw new NotFoundException(`会诊会话不存在: ${input.sessionId}`)
      patientId = patientId || session.patientId
      studyId = studyId || session.studyId
    }
    const consult: EyeTeleConsult = {
      consultId: genId('CON'),
      sessionId: input.sessionId ?? '',
      patientId,
      studyId,
      specialistId: input.specialistId,
      specialistName: this.specialistName(input.specialistId),
      question: input.question,
      status: 'pending',
      sla: { responseTime: input.priority === 'urgent' ? '1 hour' : '4 hours', priority: input.priority ?? 'normal' },
      requestedAt: nowIso(),
    }
    this.consults.set(consult.consultId, consult)
    return consult
  }

  /** GET /eye/tele/consults — 会诊记录列表 (可选 status/specialistId 过滤) */
  listConsults(params?: { status?: string; specialistId?: string }): EyeTeleConsult[] {
    this.ensureSeeded()
    let all = [...this.consults.values()]
    if (params?.status) all = all.filter((c) => c.status === params.status)
    if (params?.specialistId) all = all.filter((c) => c.specialistId === params.specialistId)
    return all
  }

  /** GET /eye/tele/consult/:id — 会诊记录详情 */
  getConsult(consultId: string): EyeTeleConsult {
    this.ensureSeeded()
    const consult = this.consults.get(consultId)
    if (!consult) throw new NotFoundException(`会诊记录不存在: ${consultId}`)
    return consult
  }

  /** POST /eye/tele/consult/:id/answer — 会诊意见答复 */
  answerConsult(consultId: string, input: { answer: string; reviewedBy?: string }): EyeTeleConsult {
    const consult = this.getConsult(consultId)
    if (consult.status !== 'pending') throw new ConflictException(`会诊记录已 ${consult.status},不可重复答复`)
    if (!input.answer?.trim()) throw new BadRequestException('answer 不能为空')
    consult.answer = input.answer
    consult.reviewedBy = input.reviewedBy ?? 'D005'
    consult.status = 'answered'
    consult.answeredAt = nowIso()
    return consult
  }

  /** GET /eye/tele/stats — 会诊统计 (确定性聚合) */
  getStats(): EyeTeleStats {
    this.ensureSeeded()
    const sessions = [...this.sessions.values()]
    const consults = [...this.consults.values()]
    const byMode: Record<string, number> = {}
    for (const s of sessions) byMode[s.mode] = (byMode[s.mode] ?? 0) + 1
    const answered = consults.filter((c) => c.status === 'answered')
    const avgResponseMinutes = answered.length > 0
      ? Math.round(answered.reduce((sum, c) => {
          const ms = c.answeredAt ? Date.parse(c.answeredAt) - Date.parse(c.requestedAt) : 0
          return sum + (Number.isFinite(ms) ? ms / 60000 : 0)
        }, 0) / answered.length)
      : 0
    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter((s) => s.status === 'active').length,
      totalConsults: consults.length,
      answeredConsults: answered.length,
      avgResponseMinutes,
      hospitals: [...HOSPITALS],
      byMode,
    }
  }

  private specialistName(doctorId: string): string {
    const map: Record<string, string> = {
      D001: '张主任', D002: '王医生', D003: '李医师', D004: '赵医师', D005: '孙会诊专家',
    }
    return map[doctorId] ?? `专家${doctorId}`
  }
}
