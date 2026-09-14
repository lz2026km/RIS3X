/**
 * G005 放射RIS系统 v3.0.6.11-80 - 危急值告警服务 (W1-A, P0)
 * 从 CriticalValue 表派生告警 (未闭环 + escalated), 支持确认/解决/升级/创建。
 * DB 不可用时回退内置种子告警, 保证前端 CriticalAlertPage 可用。
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { currentTenantId } from '../../common/tenant/tenant-utils'
import { recordCriticalNotification } from '../../criticals/national-critical'

export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'escalated'
export type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency'

// [v3.0.6.11-103 Wave 13] 危急值 5 步流程: 触发→通知→确认→处置→记录 (闭环)
export type CriticalFlowStep = 'triggered' | 'notified' | 'confirmed' | 'treating' | 'closed'
export type CriticalFlowStatus = CriticalFlowStep | 'escalated'

export interface CriticalFlowSteps {
  triggered?: string
  notified?: string
  confirmed?: string
  treating?: string
  closed?: string
}

export interface CriticalAlertItem {
  id: string
  patientId?: string
  patientName: string
  studyId?: string
  modality?: string
  alertType: 'critical_value' | 'unexpected_finding' | 'technical_issue' | 'protocol_deviation'
  severity: AlertSeverity
  title: string
  description: string
  acknowledgedBy?: string
  acknowledgedAt?: string
  status: AlertStatus
  assignee?: string
  createdAt: string
  resolvedAt?: string
  // [G005 Wave 8] 报告→危急值反向引用: 来源报告 ID (报告详情「危急值」区块反查)
  reportId?: string
  // [v3.0.6.11-103 Wave 13] 5 步流程: 当前步骤索引 (0-4, -1=已升级) + 各步时间戳
  step?: number
  flowStatus?: CriticalFlowStatus
  flowSteps?: CriticalFlowSteps
}

export interface CriticalAlertStats {
  totalAlerts: number
  activeCount: number
  acknowledgedCount: number
  resolvedCount: number
  avgResponseTimeMinutes: number
  severityDistribution: { severity: string; count: number }[]
}

export interface AlertQueryParams {
  status?: string
  severity?: string
  alertType?: string
  page?: number
  pageSize?: number
}

// [G005 Wave 2A] 电话网关: 模拟电话呼叫记录 (内存 + auditLog)
export interface CallLog {
  id: string
  alertId: string
  phone: string
  status: 'initiated' | 'connected' | 'failed'
  startedAt: string
  durationSec: number
  recordingUrl?: string
}

// [G005 Wave 2A] 短信网关: 模拟短信发送记录
export interface SmsLog {
  id: string
  alertId: string
  phone: string
  status: 'sent' | 'failed'
  content: string
  sentAt: string
}

export interface CommunicationEntry {
  id: string
  alertId: string
  channel: 'phone' | 'sms'
  phone: string
  status: string
  at: string
  durationSec?: number
  recordingUrl?: string
  content?: string
}

const SEVERITY_MAP: Record<string, AlertSeverity> = {
  LOW: 'info',
  HIGH: 'warning',
  URGENT: 'critical',
  CRITICAL: 'emergency',
}

const LEVEL_TO_SEVERITY: Record<string, string> = {
  info: 'LOW',
  warning: 'HIGH',
  critical: 'URGENT',
  emergency: 'CRITICAL',
}

const STATE_TO_STATUS: Record<string, AlertStatus> = {
  FOUND: 'active',
  NOTIFIED: 'active',
  VOICE_CALLED: 'active',
  RECEIPTED: 'active',
  RESOLVING: 'active',
  ACKNOWLEDGED: 'acknowledged',
  ESCALATED: 'escalated',
  RESOLVED: 'resolved',
  CLOSED_LOOP: 'resolved',
}

// 未闭环状态 (告警列表范围): 非终态或已升级
const OPEN_STATES = new Set(['FOUND', 'NOTIFIED', 'VOICE_CALLED', 'RECEIPTED', 'RESOLVING', 'ACKNOWLEDGED', 'ESCALATED'])

// [v3.0.6.11-103 Wave 13] 5 步流程: 状态 → 步骤索引 (0 触发 / 1 通知 / 2 确认 / 3 处置 / 4 记录闭环; -1=已升级)
const STATE_STEP: Record<string, number> = {
  FOUND: 0,
  NOTIFIED: 1,
  VOICE_CALLED: 1,
  RECEIPTED: 2,
  ACKNOWLEDGED: 2,
  RESOLVING: 3,
  RESOLVED: 4,
  CLOSED_LOOP: 4,
  CANCELLED: 4,
  ESCALATED: -1,
}

export const CRITICAL_FLOW_STEPS: CriticalFlowStep[] = ['triggered', 'notified', 'confirmed', 'treating', 'closed']

// 每步可执行时的前置状态集合 (不能跳步)
const NOTIFY_FROM = ['FOUND']
const CONFIRM_FROM = ['NOTIFIED', 'VOICE_CALLED']
const TREAT_FROM = ['RECEIPTED', 'ACKNOWLEDGED']
const CLOSE_FROM = ['RESOLVING']

// 种子告警 (无 DB state) 从 status 推导步骤状态
const SEED_STATE_FROM_STATUS: Record<string, string> = {
  active: 'FOUND',
  acknowledged: 'ACKNOWLEDGED',
  resolved: 'RESOLVED',
  escalated: 'ESCALATED',
}

const SEED_ALERTS: CriticalAlertItem[] = [
  { id: 'CA-001', patientId: 'RAD-P003', patientName: '李明', studyId: 'S20260801001', modality: 'CT', alertType: 'critical_value', severity: 'critical', title: '胸部CT危急值: 主动脉夹层可能', description: 'CTA 显示主动脉增宽伴内膜片, 疑似主动脉夹层, 需立即处理。', status: 'active', createdAt: new Date(Date.now() - 45 * 60_000).toISOString() },
  { id: 'CA-002', patientId: 'RAD-P001', patientName: '张伟', studyId: 'S20260801002', modality: 'MR', alertType: 'critical_value', severity: 'emergency', title: '头颅MR: 急性大面积脑梗死', description: 'DWI 显示左侧大脑中动脉供血区大面积高信号, 急诊处理。', status: 'acknowledged', acknowledgedBy: 'Dr. 王浩', acknowledgedAt: new Date(Date.now() - 120 * 60_000).toISOString(), createdAt: new Date(Date.now() - 3 * 3600_000).toISOString() },
  { id: 'CA-003', patientId: 'RAD-P005', patientName: '赵敏', studyId: 'S20260801003', modality: 'DR', alertType: 'unexpected_finding', severity: 'warning', title: 'DR 意外发现: 肺门占位', description: '胸片示右肺门增大, 建议进一步 CT 检查。', status: 'resolved', resolvedAt: new Date(Date.now() - 5 * 3600_000).toISOString(), createdAt: new Date(Date.now() - 8 * 3600_000).toISOString() },
  { id: 'CA-004', patientId: 'RAD-P007', patientName: '周婷', studyId: 'S20260801004', modality: 'CT', alertType: 'critical_value', severity: 'critical', title: '腹部CT: 肝破裂出血', description: '腹腔积血伴肝实质破裂, 需急诊外科会诊。', status: 'escalated', assignee: '值班主任医师', createdAt: new Date(Date.now() - 10 * 3600_000).toISOString() },
  { id: 'CA-005', patientId: 'RAD-P002', patientName: '王芳', studyId: 'S20260801005', modality: 'MG', alertType: 'critical_value', severity: 'warning', title: '钼靶 BI-RADS 5', description: '左乳不规则肿块伴毛刺, BI-RADS 5 类, 建议穿刺活检。', status: 'active', createdAt: new Date(Date.now() - 14 * 3600_000).toISOString() },
  { id: 'CA-006', patientId: 'RAD-P009', patientName: '吴强', studyId: 'S20260801006', modality: 'CT', alertType: 'technical_issue', severity: 'info', title: '扫描协议偏离', description: '增强扫描时相偏早, 图像质量受影响, 已标记。', status: 'resolved', resolvedAt: new Date(Date.now() - 20 * 3600_000).toISOString(), createdAt: new Date(Date.now() - 26 * 3600_000).toISOString() },
]

// [G005 Wave 2A] 电话/短信网关内存记录 (seed: CA-001/CA-002 已有历史通话)
const SEED_CALL_LOGS: CallLog[] = [
  { id: 'CL-001', alertId: 'CA-001', phone: '13800000001', status: 'connected', startedAt: new Date(Date.now() - 35 * 60_000).toISOString(), durationSec: 96, recordingUrl: '/recordings/CA-001-20260815-0930.wav' },
  { id: 'CL-002', alertId: 'CA-002', phone: '13800000002', status: 'connected', startedAt: new Date(Date.now() - 110 * 60_000).toISOString(), durationSec: 132, recordingUrl: '/recordings/CA-002-20260815-0855.wav' },
  { id: 'CL-003', alertId: 'CA-005', phone: '13800000003', status: 'failed', startedAt: new Date(Date.now() - 12 * 60_000).toISOString(), durationSec: 0 },
]

const SEED_SMS_LOGS: SmsLog[] = [
  { id: 'SM-001', alertId: 'CA-001', phone: '13800000001', status: 'sent', content: '【危急值通知】患者李明: 胸部CT提示主动脉夹层可能, 请立即查看。', sentAt: new Date(Date.now() - 38 * 60_000).toISOString() },
  { id: 'SM-002', alertId: 'CA-004', phone: '13800000004', status: 'sent', content: '【危急值通知】患者周婷: 腹部CT提示肝破裂出血, 请立即会诊处理。', sentAt: new Date(Date.now() - 9 * 3600_000).toISOString() },
]

@Injectable()
export class CriticalAlertService {
  /** 内存扩展信息: alertId → assignee / reportId 等 (升级/报告转入等操作写入) */
  private readonly extras = new Map<string, { assignee?: string; reportId?: string }>()

  /** [G005 Wave 2A] 电话/短信网关内存记录 */
  private readonly callLogs: CallLog[] = [...SEED_CALL_LOGS]
  private readonly smsLogs: SmsLog[] = [...SEED_SMS_LOGS]

  /** [v3.0.6.11-103 Wave 13] 5 步流程内存状态 (DB 不可用/种子告警时覆盖派生) */
  private readonly flowState = new Map<string, string>()
  /** [v3.0.6.11-103 Wave 13] 5 步流程各步时间戳内存记录 (处置步骤无 DB 列, 走内存) */
  private readonly flowStepsMem = new Map<string, CriticalFlowSteps>()

  constructor(private readonly prisma: PrismaService) {}

  // ================= 电话/短信网关 (Wave 2A) =================

  /** POST /critical-alert/alerts/:id/auto-call — 模拟电话呼叫 */
  async autoCall(id: string, dto: { phone?: string } = {}): Promise<CallLog> {
    const alert = await this.getAlert(id)
    const phone = dto.phone?.trim() || '13800000000'
    // 模拟呼叫: 大部分接通, 小部分失败
    const failed = phone.endsWith('9')
    const connected = !failed
    const log: CallLog = {
      id: `CL-${Date.now().toString(36).toUpperCase()}`,
      alertId: id,
      phone,
      status: failed ? 'failed' : 'connected',
      startedAt: new Date().toISOString(),
      durationSec: failed ? 0 : 30 + Math.floor(Math.random() * 180),
      recordingUrl: connected ? `/recordings/${id}-${Date.now()}.wav` : undefined,
    }
    this.callLogs.unshift(log)
    await this.recordAudit('AUTO_CALL', id, { phone, status: log.status, alertTitle: alert.title })
    return log
  }

  /** POST /critical-alert/alerts/:id/auto-sms — 模拟短信发送 */
  async autoSms(id: string, dto: { phone?: string; content?: string } = {}): Promise<SmsLog> {
    const alert = await this.getAlert(id)
    const phone = dto.phone?.trim() || '13800000000'
    const failed = phone.endsWith('8')
    const log: SmsLog = {
      id: `SM-${Date.now().toString(36).toUpperCase()}`,
      alertId: id,
      phone,
      status: failed ? 'failed' : 'sent',
      content: dto.content?.trim() || `【危急值通知】${alert.patientName}: ${alert.title}, 请及时查看处理。`,
      sentAt: new Date().toISOString(),
    }
    this.smsLogs.unshift(log)
    await this.recordAudit('AUTO_SMS', id, { phone, status: log.status, alertTitle: alert.title })
    return log
  }

  /** GET /critical-alert/alerts/:id/communication-log — 电话+短信合并记录 */
  async communicationLog(id: string): Promise<CommunicationEntry[]> {
    await this.ensureExists(id)
    const calls: CommunicationEntry[] = this.callLogs
      .filter((c) => c.alertId === id)
      .map((c) => ({
        id: c.id,
        alertId: c.alertId,
        channel: 'phone',
        phone: c.phone,
        status: c.status,
        at: c.startedAt,
        durationSec: c.durationSec,
        recordingUrl: c.recordingUrl,
      }))
    const sms: CommunicationEntry[] = this.smsLogs
      .filter((s) => s.alertId === id)
      .map((s) => ({
        id: s.id,
        alertId: s.alertId,
        channel: 'sms',
        phone: s.phone,
        status: s.status,
        at: s.sentAt,
        content: s.content,
      }))
    return [...calls, ...sms].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
  }

  /** auditLog 记录 (DB 不可用时静默跳过) */
  private async recordAudit(action: string, resourceId: string, detail: unknown): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: { action, resource: 'critical-alert', resourceId, detail: detail as any, tenantId: currentTenantId() },
      })
    } catch {
      /* DB 不可用 → 仅内存记录 */
    }
  }

  // ================= 派生 =================

  private async fetchValues(): Promise<any[] | null> {
    try {
      const items = await this.prisma.criticalValue.findMany({
        where: { tenantId: currentTenantId() },
        orderBy: { createdAt: 'desc' },
        include: { patient: true, exam: true },
        take: 200,
      })
      return items.length > 0 ? items : null
    } catch {
      return null
    }
  }

  private toAlert(cv: any): CriticalAlertItem {
    const state = String(this.flowState.get(cv.id) ?? cv.state ?? 'FOUND')
    const patient = cv.patient ?? {}
    const exam = cv.exam ?? {}
    const severity = SEVERITY_MAP[String(cv.severity ?? 'HIGH')] ?? 'warning'
    const extra = this.extras.get(cv.id)
    const memSteps = this.flowStepsMem.get(cv.id)
    const step = STATE_STEP[state] ?? 0
    const flowSteps: CriticalFlowSteps = {
      triggered: cv.createdAt ? new Date(cv.createdAt).toISOString() : memSteps?.triggered,
      notified: cv.voiceCalledAt ? new Date(cv.voiceCalledAt).toISOString() : memSteps?.notified,
      confirmed: cv.confirmedAt ? new Date(cv.confirmedAt).toISOString() : memSteps?.confirmed,
      treating: memSteps?.treating,
      closed: cv.closedAt ? new Date(cv.closedAt).toISOString() : memSteps?.closed,
    }
    const item: CriticalAlertItem = {
      id: cv.id,
      patientId: cv.patientId ?? patient.id,
      patientName: patient.name ?? '未知患者',
      studyId: exam.accessionNumber ?? cv.examId,
      modality: exam.modality,
      alertType: 'critical_value',
      severity,
      title: (cv.description ?? '危急值告警').slice(0, 80),
      description: cv.description ?? '',
      acknowledgedBy: cv.ackedBy ?? undefined,
      acknowledgedAt: cv.ackedAt ? new Date(cv.ackedAt).toISOString() : undefined,
      status: STATE_TO_STATUS[state] ?? 'active',
      assignee: extra?.assignee,
      createdAt: cv.createdAt ? new Date(cv.createdAt).toISOString() : new Date().toISOString(),
      resolvedAt: cv.resolvedAt ? new Date(cv.resolvedAt).toISOString() : undefined,
      // [G005 Wave 8] 报告→危急值反向引用 (内存 extras)
      reportId: extra?.reportId ?? (cv as any).reportId,
      // [v3.0.6.11-103 Wave 13] 5 步流程: 步骤索引 + 状态 + 各步时间戳
      step,
      flowStatus: step < 0 ? 'escalated' : CRITICAL_FLOW_STEPS[Math.min(step, 4)],
      flowSteps,
    }
    return item
  }

  /** [v3.0.6.11-103 Wave 13] 种子告警 (无 DB state) 的 5 步流程派生: 内存状态/时间戳覆盖 */
  private withSeedFlow(a: CriticalAlertItem): CriticalAlertItem {
    const mem = this.flowStepsMem.get(a.id)
    const st = this.flowState.get(a.id)
    const state = st ?? SEED_STATE_FROM_STATUS[a.status] ?? 'FOUND'
    const step = STATE_STEP[state] ?? 0
    const flowSteps: CriticalFlowSteps = {
      triggered: mem?.triggered ?? a.createdAt,
      notified: mem?.notified,
      confirmed: mem?.confirmed ?? a.acknowledgedAt,
      treating: mem?.treating,
      closed: mem?.closed ?? a.resolvedAt,
    }
    return {
      ...a,
      step,
      flowStatus: step < 0 ? 'escalated' : CRITICAL_FLOW_STEPS[Math.min(step, 4)],
      flowSteps,
    }
  }

  private async deriveAlerts(): Promise<CriticalAlertItem[]> {
    const values = await this.fetchValues()
    if (!values) return SEED_ALERTS.map((a) => this.withSeedFlow({ ...a, assignee: this.extras.get(a.id)?.assignee ?? a.assignee }))
    return values
      .filter((cv: any) => OPEN_STATES.has(String(this.flowState.get(cv.id) ?? cv.state ?? 'FOUND')))
      .map((cv: any) => this.toAlert(cv))
  }

  private async deriveStats(): Promise<CriticalAlertStats> {
    const values = await this.fetchValues()
    if (!values) {
      return this.statsFromAlerts(SEED_ALERTS.map((a) => this.withSeedFlow({ ...a, assignee: this.extras.get(a.id)?.assignee ?? a.assignee })))
    }
    const alerts = values.map((cv: any) => this.toAlert(cv))
    return this.statsFromAlerts(alerts)
  }

  private statsFromAlerts(alerts: CriticalAlertItem[]): CriticalAlertStats {
    const severityDistribution: Record<string, number> = {}
    for (const a of alerts) {
      severityDistribution[a.severity] = (severityDistribution[a.severity] ?? 0) + 1
    }
    const withResponse = alerts.filter((a) => a.acknowledgedAt && a.createdAt)
    const avgResponseTimeMinutes = withResponse.length
      ? Math.round(
          withResponse.reduce((sum, a) => sum + (new Date(a.acknowledgedAt!).getTime() - new Date(a.createdAt).getTime()) / 60000, 0) /
            withResponse.length,
        )
      : 0
    return {
      totalAlerts: alerts.length,
      activeCount: alerts.filter((a) => a.status === 'active').length,
      acknowledgedCount: alerts.filter((a) => a.status === 'acknowledged').length,
      resolvedCount: alerts.filter((a) => a.status === 'resolved').length,
      avgResponseTimeMinutes,
      severityDistribution: Object.entries(severityDistribution).map(([severity, count]) => ({ severity, count })),
    }
  }

  // ================= API =================

  async listAlerts(params: AlertQueryParams = {}): Promise<CriticalAlertItem[]> {
    let alerts = await this.deriveAlerts()
    if (params.status) alerts = alerts.filter((a) => a.status === params.status)
    if (params.severity) alerts = alerts.filter((a) => a.severity === params.severity)
    if (params.alertType) alerts = alerts.filter((a) => a.alertType === params.alertType)
    const page = Math.max(1, params.page ?? 1)
    const pageSize = Math.min(200, Math.max(1, params.pageSize ?? 50))
    const start = (page - 1) * pageSize
    return alerts.slice(start, start + pageSize)
  }

  async getAlert(id: string): Promise<CriticalAlertItem> {
    const alerts = await this.deriveAlerts()
    const hit = alerts.find((a) => a.id === id)
    if (hit) return hit
    // [v3.0.6.11-103 Wave 13] 终态 (已闭环/已解决) 告警: 直接查库/种子, 保证闭环后详情仍可查
    try {
      const cv = await this.prisma.criticalValue.findUnique({ where: { id } })
      if (cv) return this.toAlert(cv)
    } catch {
      /* DB 不可用 */
    }
    const seed = SEED_ALERTS.find((a) => a.id === id)
    if (seed) return this.withSeedFlow({ ...seed, assignee: this.extras.get(id)?.assignee ?? seed.assignee })
    throw new NotFoundException(`Critical alert ${id} not found`)
  }

  // ================= [v3.0.6.11-103 Wave 13] 危急值 5 步流程 (触发→通知→确认→处置→记录) =================

  /** 当前 5 步流程状态 (内存优先, 其次 DB, 最后种子) */
  private async currentFlowState(id: string): Promise<string> {
    if (this.flowState.has(id)) return this.flowState.get(id)!
    try {
      const cv = await this.prisma.criticalValue.findUnique({ where: { id } })
      if (cv) return String((cv as any).state ?? 'FOUND')
    } catch {
      /* DB 不可用 */
    }
    const seed = SEED_ALERTS.find((a) => a.id === id)
    if (seed) return SEED_STATE_FROM_STATUS[seed.status] ?? 'FOUND'
    return 'FOUND'
  }

  /** 落库/落内存 5 步状态 (DB 不可用时回退内存 + 种子 status 同步) */
  private async persistFlowState(id: string, state: string, extra?: Record<string, unknown>): Promise<void> {
    try {
      await this.prisma.criticalValue.update({
        where: { id },
        data: { state, ...(extra ?? {}) } as any,
      })
    } catch {
      this.flowState.set(id, state)
      const seed = SEED_ALERTS.find((a) => a.id === id)
      if (seed) {
        seed.status = STATE_TO_STATUS[state] ?? 'active'
        if (state === 'VOICE_CALLED' || state === 'RECEIPTED' || state === 'RESOLVING' || state === 'NOTIFIED') seed.status = 'active'
        if (state === 'RESOLVED' || state === 'CLOSED_LOOP') seed.status = 'resolved'
      }
    }
  }

  private recordFlowStep(id: string, key: keyof CriticalFlowSteps): void {
    const prev = this.flowStepsMem.get(id) ?? {}
    this.flowStepsMem.set(id, { ...prev, [key]: new Date().toISOString() })
  }

  private assertFlowStep(id: string, state: string, allowedFrom: string[], action: string, actionLabel: string): void {
    if (!allowedFrom.includes(state)) {
      throw new BadRequestException(
        `INVALID_FLOW_STEP: 危急值 ${id} 当前步骤 ${STATE_STEP[state] ?? -1} (${state}), ${actionLabel}仅允许在「${action}」步骤后执行, 不能跳步`,
      )
    }
  }

  /**
   * 步骤 2 通知: FOUND → NOTIFIED (短信) / VOICE_CALLED (电话)
   * 记录通知时间戳 (voiceCalledAt 列 / 内存), 关联 notifiedTo 接收人。
   */
  async notify(id: string, dto: { method?: 'phone' | 'sms'; phone?: string; recipient?: string } = {}): Promise<CriticalAlertItem> {
    await this.ensureExists(id)
    const state = await this.currentFlowState(id)
    this.assertFlowStep(id, state, NOTIFY_FROM, 'notify', '通知')
    const isPhone = dto.method === 'phone'
    const toState = isPhone ? 'VOICE_CALLED' : 'NOTIFIED'
    const recipient = dto.recipient?.trim() || dto.phone?.trim() || undefined
    const notifiedAt = new Date().toISOString()
    await this.persistFlowState(id, toState, {
      voiceCalledAt: new Date(),
      voiceCalledBy: recipient ?? '当前用户',
      ...(recipient ? { notifiedTo: recipient } : {}),
    })
    this.recordFlowStep(id, 'notified')
    // [v3.0.6.11-105 Wave 1B] 补充 notifiedAt/notifiedBy 内存 overlay (RQI 10 分钟通报口径)
    const alert = await this.getAlert(id)
    recordCriticalNotification(id, {
      notifiedAt,
      notifiedBy: recipient ?? '当前用户',
      foundAt: alert.createdAt,
    })
    await this.recordAudit('FLOW_NOTIFY', id, { method: isPhone ? 'phone' : 'sms', phone: dto.phone, recipient, toState })
    return this.getAlert(id)
  }

  /** 步骤 3 确认: NOTIFIED/VOICE_CALLED → RECEIPTED (接收人确认), 记录 confirmedAt/confirmedBy/comment */
  async confirm(id: string, dto: { receiver?: string; comment?: string } = {}): Promise<CriticalAlertItem> {
    await this.ensureExists(id)
    const state = await this.currentFlowState(id)
    this.assertFlowStep(id, state, CONFIRM_FROM, 'confirm', '确认')
    const receiver = dto.receiver?.trim() || '当前用户'
    await this.persistFlowState(id, 'RECEIPTED', {
      confirmedBy: receiver,
      confirmedAt: new Date(),
      ...(dto.comment?.trim() ? { confirmedComment: dto.comment.trim() } : {}),
    })
    this.recordFlowStep(id, 'confirmed')
    // [v3.0.6.11-105 Wave 1B] 补充 receivedBy/receiveNote 内存 overlay (署名记录完整性)
    const receiveNote = dto.comment?.trim()
    recordCriticalNotification(id, receiveNote ? { receivedBy: receiver, receiveNote } : { receivedBy: receiver })
    await this.recordAudit('FLOW_CONFIRM', id, { receiver, comment: dto.comment, toState: 'RECEIPTED' })
    return this.getAlert(id)
  }

  /** 步骤 4 处置: RECEIPTED/ACKNOWLEDGED → RESOLVING (医嘱/处理中), 记录处置时间戳 */
  async treat(id: string, dto: { treatment?: string; orders?: string } = {}): Promise<CriticalAlertItem> {
    await this.ensureExists(id)
    const state = await this.currentFlowState(id)
    this.assertFlowStep(id, state, TREAT_FROM, 'treat', '处置')
    await this.persistFlowState(id, 'RESOLVING')
    this.recordFlowStep(id, 'treating')
    await this.recordAudit('FLOW_TREAT', id, { treatment: dto.treatment, orders: dto.orders, toState: 'RESOLVING' })
    return this.getAlert(id)
  }

  /** 步骤 5 记录 (闭环): RESOLVING → CLOSED_LOOP, 记录 closedAt/closedBy + 闭环摘要 */
  async close(id: string, dto: { summary?: string; closedBy?: string } = {}): Promise<CriticalAlertItem> {
    await this.ensureExists(id)
    const state = await this.currentFlowState(id)
    this.assertFlowStep(id, state, CLOSE_FROM, 'close', '记录闭环')
    const closedBy = dto.closedBy?.trim() || '当前用户'
    await this.persistFlowState(id, 'CLOSED_LOOP', { closedBy, closedAt: new Date() })
    this.recordFlowStep(id, 'closed')
    await this.recordAudit('FLOW_CLOSE', id, { closedBy, summary: dto.summary, toState: 'CLOSED_LOOP' })
    return this.getAlert(id)
  }

  async acknowledge(id: string, dto: { comment?: string } = {}): Promise<CriticalAlertItem> {
    await this.ensureExists(id)
    void dto
    try {
      await this.prisma.criticalValue.update({
        where: { id },
        data: { state: 'ACKNOWLEDGED', ackedBy: '当前用户', ackedAt: new Date() } as any,
      })
    } catch {
      // DB 不可用 → 仅内存处理
      const seed = SEED_ALERTS.find((a) => a.id === id)
      if (seed) {
        seed.status = 'acknowledged'
        seed.acknowledgedBy = '当前用户'
        seed.acknowledgedAt = new Date().toISOString()
      }
    }
    return this.getAlert(id)
  }

  async resolve(id: string, dto: { resolution?: string; comment?: string } = {}): Promise<CriticalAlertItem> {
    await this.ensureExists(id)
    void dto
    try {
      await this.prisma.criticalValue.update({
        where: { id },
        data: { state: 'RESOLVED', resolvedBy: '当前用户', resolvedAt: new Date() } as any,
      })
    } catch {
      const seed = SEED_ALERTS.find((a) => a.id === id)
      if (seed) {
        seed.status = 'resolved'
        seed.resolvedAt = new Date().toISOString()
      }
    }
    return this.getAlert(id)
  }

  async escalate(id: string, assignee?: string): Promise<CriticalAlertItem> {
    await this.ensureExists(id)
    this.extras.set(id, { assignee: assignee || '值班主任医师' })
    try {
      await this.prisma.criticalValue.update({
        where: { id },
        data: { state: 'ESCALATED', notifiedTo: assignee || '值班主任医师' } as any,
      })
    } catch {
      const seed = SEED_ALERTS.find((a) => a.id === id)
      if (seed) {
        seed.status = 'escalated'
        seed.assignee = assignee || '值班主任医师'
      }
    }
    return this.getAlert(id)
  }

  async create(dto: {
    criticalValueId?: string
    level?: string
    patientId?: string
    patientName?: string
    studyId?: string
    modality?: string
    title?: string
    description?: string
    // [G005 Wave 8] 报告→危急值反向引用
    reportId?: string
  }): Promise<CriticalAlertItem> {
    const severity = LEVEL_TO_SEVERITY[dto.level ?? ''] ?? 'URGENT'
    const description = dto.description ?? dto.title ?? '危急值告警'
    let id = dto.criticalValueId
    if (id) {
      // 关联已有 criticalValue: 若已终态则重置为 FOUND
      try {
        const existing = await this.prisma.criticalValue.findUnique({ where: { id } })
        if (existing) {
          await this.prisma.criticalValue.update({
            where: { id },
            data: { state: 'FOUND', severity: severity as any } as any,
          })
        } else {
          id = undefined
        }
      } catch {
        // DB 不可用, 保留 id (若命中种子告警则重置状态)
        const seed = SEED_ALERTS.find((a) => a.id === id)
        if (seed) seed.status = 'active'
      }
    }
    if (!id) {
      try {
        const created = await this.prisma.criticalValue.create({
          data: {
            tenantId: currentTenantId(),
            patientId: dto.patientId ?? null,
            examId: dto.studyId ?? null,
            description,
            severity: severity as any,
            state: 'FOUND',
            method: 'SYSTEM',
          } as any,
        })
        id = created.id
      } catch {
        // [v3.0.6.11-103 Wave 13] id 保证唯一 (同毫秒多次创建不冲突)
        const item: CriticalAlertItem = {
          id: `CA-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
          patientId: dto.patientId,
          patientName: dto.patientName ?? '未知患者',
          studyId: dto.studyId,
          modality: dto.modality,
          alertType: 'critical_value',
          severity: (SEVERITY_MAP[severity] ?? 'critical'),
          title: description.slice(0, 80),
          description,
          status: 'active',
          createdAt: new Date().toISOString(),
          reportId: dto.reportId,
        }
        SEED_ALERTS.unshift(item)
        if (dto.reportId) this.extras.set(item.id, { reportId: dto.reportId })
        return item
      }
    }
    // [G005 Wave 8] 记录 reportId 内存链接 (DB 路径同样写入 extras, 供 forReport 反查)
    if (dto.reportId) {
      const prev = this.extras.get(id)
      this.extras.set(id, { ...(prev ?? {}), reportId: dto.reportId })
    }
    return this.getAlert(id)
  }

  /**
   * [G005 Wave 8] GET /critical-alert/for-report/:reportId — 按报告查询关联危急值告警 (反向引用)。
   * 匹配: 内存 extras reportId 精确链接 + 报告 examId 对应检查派生 (DB 不可用时仅内存链接)。
   */
  async forReport(reportId: string): Promise<CriticalAlertItem[]> {
    let examId: string | null = null
    let patientId: string | null = null
    try {
      const report = await this.prisma.report.findUnique({ where: { id: reportId } })
      if (report) {
        examId = report.examId ?? null
        patientId = report.patientId ?? null
      }
    } catch { /* DB 不可用 */ }
    const alerts = await this.deriveAlerts()
    return alerts.filter((a) => {
      if (this.extras.get(a.id)?.reportId === reportId) return true
      if (examId && (a.studyId === examId || a.studyId === reportId)) return true
      return false
    })
  }

  async stats(): Promise<CriticalAlertStats> {
    return this.deriveStats()
  }

  private async ensureExists(id: string): Promise<void> {
    const alerts = await this.deriveAlerts()
    if (!alerts.some((a) => a.id === id)) {
      // 兼容: id 为已终态 criticalValue 时也允许操作 (确认/解决历史告警)
      try {
        const cv = await this.prisma.criticalValue.findUnique({ where: { id } })
        if (!cv) throw new NotFoundException(`Critical alert ${id} not found`)
      } catch (err) {
        if (err instanceof NotFoundException) throw err
        if (!SEED_ALERTS.some((a) => a.id === id)) {
          throw new NotFoundException(`Critical alert ${id} not found`)
        }
      }
    }
  }
}
