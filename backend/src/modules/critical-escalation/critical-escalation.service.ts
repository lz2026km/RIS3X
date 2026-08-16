/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 6B (critical-escalation) - 危急值升级链 V2 (F12)
 *
 * 孤儿模块 (无新增 DB 表, DB 不可用自动回退确定性种子, 可无 DB 启动):
 *   1. 升级链配置: 级别 (一级电话/二级值班/三级科主任) + 每级超时时间 + 升级规则
 *   2. 升级链执行: 危急值 → 一级通知 → 超时未确认 → 自动升级二级 → … (状态机)
 *      状态: 通知中 NOTIFYING / 待确认 PENDING_CONFIRM / 已确认 CONFIRMED / 已升级 ESCALATED / 已关闭 CLOSED
 *   3. 升级记录 + 响应耗时统计 (按级别平均确认耗时 / 升级率 / 平均升级次数)
 *
 * 超时自动升级为确定性: evaluateChain(id, now) 以显式时间判断, 便于测试复现。
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { currentTenantId } from '../../common/tenant/tenant-utils'

// ================= 类型定义 =================

export type EscalationLevel = 1 | 2 | 3
export type ChainStatus = 'NOTIFYING' | 'PENDING_CONFIRM' | 'CONFIRMED' | 'ESCALATED' | 'CLOSED'
export type StepStatus = 'NOTIFIED' | 'CONFIRMED' | 'TIMEOUT'

export interface EscalationLevelConfig {
  level: EscalationLevel
  name: string
  role: string
  timeoutMinutes: number
  channels: string[]
}

export interface EscalationRule {
  key: string
  name: string
  description: string
  enabled: boolean
}

export interface EscalationStep {
  level: EscalationLevel
  levelName: string
  role: string
  status: StepStatus
  timeoutMinutes: number
  startedAt: string
  deadline: string
  notifiedAt?: string
  confirmedAt?: string
  confirmedBy?: string
}

export interface EscalationHistoryEntry {
  at: string
  reason: string
}

export interface EscalationChain {
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
  history: EscalationHistoryEntry[]
}

export interface EscalationStartInput {
  criticalValueId: string
  patientName?: string
  modality?: string
  title?: string
  severity?: string
}

export interface LevelResponseStat {
  level: EscalationLevel
  levelName: string
  count: number
  confirmed: number
  escalated: number
  avgResponseMinutes: number
}

export interface EscalationStats {
  total: number
  byStatus: Record<ChainStatus, number>
  avgResponseMinutes: number
  avgEscalationCount: number
  escalationRate: number
  closedRate: number
  byLevel: LevelResponseStat[]
}

// ================= 默认配置与种子 =================

const DEFAULT_LEVELS: EscalationLevelConfig[] = [
  { level: 1, name: '一级电话', role: '值班医师', timeoutMinutes: 15, channels: ['电话', '短信'] },
  { level: 2, name: '二级值班', role: '值班主任医师', timeoutMinutes: 10, channels: ['电话', '短信', '应用内'] },
  { level: 3, name: '三级科主任', role: '科主任', timeoutMinutes: 5, channels: ['电话', '应用内'] },
]

const DEFAULT_RULES: EscalationRule[] = [
  { key: 'auto-timeout', name: '超时自动升级', description: '当前级别超时未确认, 自动升级至下一级别', enabled: true },
  { key: 'manual-escalate', name: '手动升级', description: '值班医生可根据危急程度手动立即升级', enabled: true },
  { key: 'max-level-cap', name: '最高级别封顶', description: '达到三级科主任后不再自动升级', enabled: true },
]

const STATUS_LABEL: Record<ChainStatus, string> = {
  NOTIFYING: '通知中',
  PENDING_CONFIRM: '待确认',
  CONFIRMED: '已确认',
  ESCALATED: '已升级',
  CLOSED: '已关闭',
}

const STEP_LABEL: Record<StepStatus, string> = {
  NOTIFIED: '已通知',
  CONFIRMED: '已确认',
  TIMEOUT: '超时',
}

function iso(day: string, hour: number, minute = 0): string {
  return new Date(Date.UTC(2026, 7, Number(day.slice(8, 10)), hour, minute)).toISOString()
}

// ================= 服务 =================

@Injectable()
export class CriticalEscalationService {
  private levels: EscalationLevelConfig[] = DEFAULT_LEVELS.map((l) => ({ ...l, channels: [...l.channels] }))
  private chains: EscalationChain[] = []
  private seq = 0

  constructor(private readonly prisma: PrismaService) {
    this.seed()
  }

  private nextId(): string {
    this.seq += 1
    return `ESC-${this.seq}`
  }

  private cloneChain(c: EscalationChain): EscalationChain {
    return { ...c, steps: c.steps.map((s) => ({ ...s })), history: c.history.map((h) => ({ ...h })) }
  }

  private seed(): void {
    const mkStep = (level: EscalationLevel, status: StepStatus, startedAt: string, deadline: string, extra: Partial<EscalationStep> = {}): EscalationStep => {
      const cfg = this.levels.find((l) => l.level === level)!
      return {
        level,
        levelName: cfg.name,
        role: cfg.role,
        status,
        timeoutMinutes: cfg.timeoutMinutes,
        startedAt,
        deadline,
        notifiedAt: status === 'NOTIFIED' ? startedAt : undefined,
        confirmedAt: extra.confirmedAt,
        confirmedBy: extra.confirmedBy,
      }
    }

    // 1) 已确认 (一级 8 分钟内确认)
    const c1: EscalationChain = {
      id: this.nextId(),
      criticalValueId: 'CV-20260801-001',
      patientName: '李明',
      modality: 'CT',
      title: '主动脉夹层可能',
      severity: 'critical',
      status: 'CONFIRMED',
      currentLevel: 1,
      startedAt: iso('2026-08-14', 9, 0),
      currentLevelStartedAt: iso('2026-08-14', 9, 0),
      currentDeadline: iso('2026-08-14', 9, 15),
      escalatedCount: 0,
      acknowledgedBy: '值班医师 王浩',
      acknowledgedAt: iso('2026-08-14', 9, 8),
      history: [{ at: iso('2026-08-14', 9, 0), reason: '启动升级链, 一级电话通知值班医师' }],
      steps: [mkStep(1, 'CONFIRMED', iso('2026-08-14', 9, 0), iso('2026-08-14', 9, 15), { confirmedAt: iso('2026-08-14', 9, 8), confirmedBy: '值班医师 王浩' })],
    }
    // 2) 已升级到二级 (一级超时 18 分钟 → 自动升级)
    const s1 = mkStep(1, 'TIMEOUT', iso('2026-08-14', 10, 0), iso('2026-08-14', 10, 15))
    const c2: EscalationChain = {
      id: this.nextId(),
      criticalValueId: 'CV-20260814-002',
      patientName: '张伟',
      modality: 'MR',
      title: '急性大面积脑梗死',
      severity: 'emergency',
      status: 'ESCALATED',
      currentLevel: 2,
      startedAt: iso('2026-08-14', 10, 0),
      currentLevelStartedAt: iso('2026-08-14', 10, 18),
      currentDeadline: iso('2026-08-14', 10, 28),
      escalatedCount: 1,
      history: [
        { at: iso('2026-08-14', 10, 0), reason: '启动升级链, 一级电话通知值班医师' },
        { at: iso('2026-08-14', 10, 18), reason: '一级超时 18 分钟未确认, 自动升级二级值班' },
      ],
      steps: [s1, mkStep(2, 'NOTIFIED', iso('2026-08-14', 10, 18), iso('2026-08-14', 10, 28))],
    }
    // 3) 通知中 (一级未超时, 倒计时进行中)
    const c3: EscalationChain = {
      id: this.nextId(),
      criticalValueId: 'CV-20260814-003',
      patientName: '赵敏',
      modality: 'CT',
      title: '肝破裂出血',
      severity: 'critical',
      status: 'NOTIFYING',
      currentLevel: 1,
      startedAt: iso('2026-08-14', 11, 0),
      currentLevelStartedAt: iso('2026-08-14', 11, 0),
      currentDeadline: iso('2026-08-14', 11, 15),
      escalatedCount: 0,
      history: [{ at: iso('2026-08-14', 11, 0), reason: '启动升级链, 一级电话通知值班医师' }],
      steps: [mkStep(1, 'NOTIFIED', iso('2026-08-14', 11, 0), iso('2026-08-14', 11, 15))],
    }
    // 4) 已关闭 (三级科主任确认后关闭)
    const c4: EscalationChain = {
      id: this.nextId(),
      criticalValueId: 'CV-20260812-004',
      patientName: '王芳',
      modality: 'MG',
      title: 'BI-RADS 5 类',
      severity: 'warning',
      status: 'CLOSED',
      currentLevel: 3,
      startedAt: iso('2026-08-12', 15, 0),
      currentLevelStartedAt: iso('2026-08-12', 15, 20),
      currentDeadline: iso('2026-08-12', 15, 25),
      escalatedCount: 2,
      acknowledgedBy: '科主任 周主任',
      acknowledgedAt: iso('2026-08-12', 15, 28),
      closedAt: iso('2026-08-12', 15, 30),
      closedBy: '科主任 周主任',
      history: [
        { at: iso('2026-08-12', 15, 0), reason: '启动升级链, 一级电话通知值班医师' },
        { at: iso('2026-08-12', 15, 15), reason: '一级超时未确认, 自动升级二级值班' },
        { at: iso('2026-08-12', 15, 25), reason: '二级超时未确认, 自动升级三级科主任' },
        { at: iso('2026-08-12', 15, 30), reason: '科主任确认危急值, 升级链关闭' },
      ],
      steps: [
        mkStep(1, 'TIMEOUT', iso('2026-08-12', 15, 0), iso('2026-08-12', 15, 15)),
        mkStep(2, 'TIMEOUT', iso('2026-08-12', 15, 15), iso('2026-08-12', 15, 25)),
        mkStep(3, 'CONFIRMED', iso('2026-08-12', 15, 25), iso('2026-08-12', 15, 30), { confirmedAt: iso('2026-08-12', 15, 28), confirmedBy: '科主任 周主任' }),
      ],
    }
    this.chains = [c1, c2, c3, c4]
  }

  // ================= 配置 =================

  /** GET /critical-escalation/config — 升级链配置 */
  getConfig(): { levels: EscalationLevelConfig[]; rules: EscalationRule[]; statusLabels: Record<ChainStatus, string>; stepLabels: Record<StepStatus, string> } {
    return {
      levels: this.levels.map((l) => ({ ...l, channels: [...l.channels] })),
      rules: DEFAULT_RULES.map((r) => ({ ...r })),
      statusLabels: { ...STATUS_LABEL },
      stepLabels: { ...STEP_LABEL },
    }
  }

  /** PUT /critical-escalation/config — 更新升级链配置 (级别 + 超时时间) */
  updateConfig(body: { levels: Array<{ level: number; name?: string; role?: string; timeoutMinutes: number; channels?: string[] }> }): { levels: EscalationLevelConfig[] } {
    if (!Array.isArray(body.levels) || body.levels.length !== 3) {
      throw new BadRequestException('必须配置 3 个升级级别')
    }
    const seen = new Set<number>()
    this.levels = body.levels.map((l, i) => {
      const level = (l.level ?? (i + 1)) as EscalationLevel
      if (level < 1 || level > 3 || seen.has(level)) throw new BadRequestException(`级别配置不合法: ${level}`)
      seen.add(level)
      if (!Number.isFinite(l.timeoutMinutes) || l.timeoutMinutes < 1 || l.timeoutMinutes > 240) {
        throw new BadRequestException(`级别 ${level} 超时时间应为 1-240 分钟`)
      }
      const prev = this.levels.find((x) => x.level === level)
      return {
        level,
        name: l.name?.trim() || prev?.name || `级别 ${level}`,
        role: l.role?.trim() || prev?.role || '值班人员',
        timeoutMinutes: Math.round(l.timeoutMinutes),
        channels: Array.isArray(l.channels) && l.channels.length > 0 ? l.channels.slice(0, 4) : (prev?.channels ?? ['电话']),
      }
    })
    return { levels: this.levels.map((l) => ({ ...l, channels: [...l.channels] })) }
  }

  // ================= 升级链执行 (状态机) =================

  private levelCfg(level: EscalationLevel): EscalationLevelConfig {
    const cfg = this.levels.find((l) => l.level === level)
    if (!cfg) throw new BadRequestException(`级别 ${level} 未配置`)
    return cfg
  }

  private newStep(level: EscalationLevel, startedAt: Date): EscalationStep {
    const cfg = this.levelCfg(level)
    const deadline = new Date(startedAt.getTime() + cfg.timeoutMinutes * 60000)
    return {
      level,
      levelName: cfg.name,
      role: cfg.role,
      status: 'NOTIFIED',
      timeoutMinutes: cfg.timeoutMinutes,
      startedAt: startedAt.toISOString(),
      deadline: deadline.toISOString(),
      notifiedAt: startedAt.toISOString(),
    }
  }

  /** POST /critical-escalation/chains — 启动升级链 (危急值 → 一级通知) */
  async startChain(input: EscalationStartInput): Promise<EscalationChain> {
    if (!input.criticalValueId?.trim()) throw new BadRequestException('criticalValueId 不能为空')
    const now = new Date()
    const step = this.newStep(1, now)
    const chain: EscalationChain = {
      id: this.nextId(),
      criticalValueId: input.criticalValueId.trim(),
      patientName: input.patientName ?? '未知患者',
      modality: input.modality ?? 'CT',
      title: input.title ?? '危急值告警',
      severity: input.severity ?? 'critical',
      status: 'NOTIFYING',
      currentLevel: 1,
      startedAt: now.toISOString(),
      currentLevelStartedAt: now.toISOString(),
      currentDeadline: step.deadline,
      escalatedCount: 0,
      steps: [step],
      history: [{ at: now.toISOString(), reason: '启动升级链, 一级电话通知' }],
    }
    this.chains.unshift(chain)
    await this.recordAudit('ESC_CHAIN_START', chain.id, { criticalValueId: chain.criticalValueId })
    return this.cloneChain(chain)
  }

  /** GET /critical-escalation/chains — 升级链列表 (status 过滤) */
  listChains(params: { status?: string } = {}): EscalationChain[] {
    let list = this.chains.map((c) => this.cloneChain(c))
    if (params.status) list = list.filter((c) => c.status === params.status)
    return list
  }

  /** GET /critical-escalation/chains/:id — 升级链详情 (含步骤时间线 + 当前倒计时) */
  getChain(id: string): EscalationChain {
    return this.cloneChain(this.findChain(id))
  }

  /** 内部: 根据显式时间判断当前级别是否超时 (确定性; 三级封顶不再升级) */
  private evaluate(id: string, now: Date): EscalationChain {
    const chain = this.findChain(id)
    if (chain.status === 'CONFIRMED' || chain.status === 'CLOSED') return chain
    if (chain.currentLevel < 3 && now.getTime() > new Date(chain.currentDeadline).getTime()) {
      this.escalateInternal(chain, now, '系统自动升级')
    }
    return chain
  }

  /** POST /critical-escalation/chains/:id/tick — 超时检查 (自动升级) */
  tick(id: string, now?: Date): EscalationChain {
    const chain = this.evaluate(id, now ?? new Date())
    return this.cloneChain(chain)
  }

  /** POST /critical-escalation/chains/:id/acknowledge — 确认 (当前级别已通知/待确认) */
  async acknowledge(id: string, body: { confirmedBy: string; comment?: string }): Promise<EscalationChain> {
    const chain = this.findChain(id)
    if (chain.status === 'CONFIRMED' || chain.status === 'CLOSED') throw new BadRequestException(`链状态 ${chain.status} 不可确认`)
    if (!body.confirmedBy?.trim()) throw new BadRequestException('confirmedBy 不能为空')
    const now = new Date()
    const step = chain.steps[chain.steps.length - 1]!
    step.status = 'CONFIRMED'
    step.confirmedAt = now.toISOString()
    step.confirmedBy = body.confirmedBy.trim()
    chain.status = 'CONFIRMED'
    chain.acknowledgedBy = body.confirmedBy.trim()
    chain.acknowledgedAt = now.toISOString()
    await this.recordAudit('ESC_CHAIN_ACK', chain.id, { level: step.level, confirmedBy: body.confirmedBy, comment: body.comment })
    return this.cloneChain(chain)
  }

  /** POST /critical-escalation/chains/:id/escalate — 手动升级 */
  async escalate(id: string, body: { reason?: string; escalatedBy?: string } = {}): Promise<EscalationChain> {
    const chain = this.findChain(id)
    if (chain.status === 'CONFIRMED' || chain.status === 'CLOSED') throw new BadRequestException(`链状态 ${chain.status} 不可升级`)
    if (chain.currentLevel >= 3) throw new BadRequestException('已达最高升级级别 (三级科主任), 不再升级')
    this.escalateInternal(chain, new Date(), body.reason?.trim() || '手动升级')
    await this.recordAudit('ESC_CHAIN_ESCALATE', chain.id, { fromLevel: chain.currentLevel - 1, toLevel: chain.currentLevel, reason: body.reason, escalatedBy: body.escalatedBy })
    return this.cloneChain(chain)
  }

  private escalateInternal(chain: EscalationChain, now: Date, reason: string): void {
    const prevStep = chain.steps[chain.steps.length - 1]!
    prevStep.status = 'TIMEOUT'
    const nextLevel = Math.min(3, chain.currentLevel + 1) as EscalationLevel
    chain.currentLevel = nextLevel
    chain.escalatedCount += 1
    chain.currentLevelStartedAt = now.toISOString()
    const step = this.newStep(nextLevel, now)
    chain.currentDeadline = step.deadline
    chain.steps.push(step)
    chain.status = 'ESCALATED'
    chain.history.push({ at: now.toISOString(), reason })
  }

  /** POST /critical-escalation/chains/:id/close — 关闭升级链 */
  async closeChain(id: string, body: { closedBy?: string; comment?: string } = {}): Promise<EscalationChain> {
    const chain = this.findChain(id)
    if (chain.status === 'CLOSED') throw new BadRequestException('升级链已关闭')
    const now = new Date()
    chain.status = 'CLOSED'
    chain.closedAt = now.toISOString()
    chain.closedBy = body.closedBy?.trim() || '当前用户'
    await this.recordAudit('ESC_CHAIN_CLOSE', chain.id, { closedBy: chain.closedBy, comment: body.comment })
    return this.cloneChain(chain)
  }

  // ================= 升级记录 + 统计 =================

  /** GET /critical-escalation/chains/:id/steps — 升级步骤时间线 */
  stepsOf(id: string): EscalationStep[] {
    return this.findChain(id).steps.map((s) => ({ ...s }))
  }

  /** GET /critical-escalation/stats — 响应耗时统计 */
  getStats(): EscalationStats {
    const chains = this.chains
    const byStatus = Object.fromEntries((Object.keys(STATUS_LABEL) as ChainStatus[]).map((s) => [s, 0])) as Record<ChainStatus, number>
    for (const c of chains) byStatus[c.status] = (byStatus[c.status] ?? 0) + 1

    const responseTimes: number[] = []
    const perLevel = new Map<EscalationLevel, { stat: LevelResponseStat; sumMinutes: number }>()
    for (const c of chains) {
      for (const s of c.steps) {
        const entry = perLevel.get(s.level) ?? {
          stat: { level: s.level, levelName: s.levelName, count: 0, confirmed: 0, escalated: 0, avgResponseMinutes: 0 },
          sumMinutes: 0,
        }
        entry.stat.count += 1
        if (s.status === 'CONFIRMED' && s.confirmedAt) {
          entry.stat.confirmed += 1
          const start = new Date(s.startedAt).getTime()
          const confirmed = new Date(s.confirmedAt).getTime()
          if (confirmed >= start) {
            const minutes = (confirmed - start) / 60000
            entry.sumMinutes += minutes
            responseTimes.push(minutes)
          }
        }
        if (s.status === 'TIMEOUT') entry.stat.escalated += 1
        perLevel.set(s.level, entry)
      }
    }
    const byLevel: LevelResponseStat[] = [...perLevel.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, e]) => ({ ...e.stat, avgResponseMinutes: e.stat.confirmed > 0 ? Math.round((e.sumMinutes / e.stat.confirmed) * 10) / 10 : 0 }))

    const avgResponseMinutes =
      responseTimes.length > 0 ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10) / 10 : 0
    const avgEscalationCount = chains.length > 0 ? Math.round((chains.reduce((a, c) => a + c.escalatedCount, 0) / chains.length) * 10) / 10 : 0
    const escalated = chains.filter((c) => c.escalatedCount > 0).length

    return {
      total: chains.length,
      byStatus,
      avgResponseMinutes,
      avgEscalationCount,
      escalationRate: chains.length > 0 ? Math.round((escalated / chains.length) * 1000) / 10 : 0,
      closedRate: chains.length > 0 ? Math.round(((byStatus.CLOSED ?? 0) / chains.length) * 1000) / 10 : 0,
      byLevel,
    }
  }

  // ================= 内部工具 =================

  private findChain(id: string): EscalationChain {
    const chain = this.chains.find((c) => c.id === id)
    if (!chain) throw new NotFoundException(`升级链 ${id} 不存在`)
    return chain
  }

  /** auditLog 记录 (DB 不可用时静默跳过) */
  private async recordAudit(action: string, resourceId: string, detail: unknown): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: { action, resource: 'critical-escalation', resourceId, detail: detail as any, tenantId: currentTenantId() },
      })
    } catch {
      /* DB 不可用 → 仅内存记录 */
    }
  }
}
