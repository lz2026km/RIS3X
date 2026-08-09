import { Injectable, NotFoundException } from '@nestjs/common'

// ============================================================
// [G005 Wave1A] Auto Collection — 自动采集模块 (进程内存 + 确定性 seed)
// 覆盖: tasks CRUD + start/stop/run/rerun + rules CRUD + config + logs + stats
// 任务源类型: DICOM / HL7 / FTP (与前端 autoCollectionApi 契约对齐)
// ============================================================

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface AutoCollectionTask {
  id: string
  ruleId: string
  ruleName: string
  sourceType: 'DICOM' | 'HL7' | 'FTP'
  status: TaskStatus
  triggeredAt: string
  completedAt?: string
  result?: Record<string, unknown>
  error?: string
}

export interface AutoCollectionRule {
  id: string
  name: string
  description: string
  triggerType: 'event' | 'schedule' | 'threshold'
  triggerConfig: Record<string, unknown>
  action: 'notify' | 'report' | 'archive' | 'transfer'
  actionConfig: Record<string, unknown>
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface AutoCollectionConfig {
  id: string
  key: string
  value: string
  description: string
  category: string
}

export interface AutoCollectionLog {
  id: string
  time: string
  level: 'INFO' | 'WARN' | 'ERROR'
  source: string
  message: string
}

export interface AutoCollectionStats {
  totalRules: number
  activeRules: number
  totalTasks: number
  completedTasks: number
  failedTasks: number
  dailyExecutions: { date: string; count: number; successCount: number }[]
}

const SEED_RULES: AutoCollectionRule[] = [
  { id: 'ac-001', name: 'DICOM 自动归档', description: '检查完成后自动归档影像至 VNA', triggerType: 'event', triggerConfig: { event: 'exam.completed' }, action: 'archive', actionConfig: { target: 'vna' }, enabled: true, createdAt: '2026-06-01T08:00:00Z', updatedAt: '2026-07-28T10:00:00Z' },
  { id: 'ac-002', name: '危急值自动通知', description: '检出危急值后自动推送通知', triggerType: 'event', triggerConfig: { event: 'critical.created' }, action: 'notify', actionConfig: { channel: 'sms+wechat' }, enabled: true, createdAt: '2026-06-02T08:00:00Z', updatedAt: '2026-07-28T09:30:00Z' },
  { id: 'ac-003', name: '每日质量报告', description: '每日定时生成科室质量报告', triggerType: 'schedule', triggerConfig: { cron: '0 8 * * *' }, action: 'report', actionConfig: { template: 'daily-qc' }, enabled: false, createdAt: '2026-06-05T08:00:00Z', updatedAt: '2026-07-27T08:00:00Z' },
  { id: 'ac-004', name: 'HL7 ORU 入库', description: '接收检验 ORU 消息自动入库', triggerType: 'event', triggerConfig: { event: 'hl7.oru' }, action: 'transfer', actionConfig: { target: 'lis' }, enabled: true, createdAt: '2026-06-10T08:00:00Z', updatedAt: '2026-07-26T08:00:00Z' },
]

function seedTasks(): AutoCollectionTask[] {
  const now = Date.now()
  const iso = (offsetMin: number) => new Date(now - offsetMin * 60000).toISOString()
  return [
    { id: 'ac-t-001', ruleId: 'ac-001', ruleName: 'DICOM 自动归档', sourceType: 'DICOM', status: 'completed', triggeredAt: iso(320), completedAt: iso(319), result: { archived: 12, skipped: 0 } },
    { id: 'ac-t-002', ruleId: 'ac-002', ruleName: '危急值自动通知', sourceType: 'HL7', status: 'completed', triggeredAt: iso(180), completedAt: iso(179), result: { notified: 1, channel: 'sms' } },
    { id: 'ac-t-003', ruleId: 'ac-001', ruleName: 'DICOM 自动归档', sourceType: 'DICOM', status: 'running', triggeredAt: iso(8), result: { archived: 3, total: 15 } },
    { id: 'ac-t-004', ruleId: 'ac-004', ruleName: 'HL7 ORU 入库', sourceType: 'HL7', status: 'failed', triggeredAt: iso(90), completedAt: iso(89), error: '目标 LIS 连接超时 (30s)' },
    { id: 'ac-t-005', ruleId: 'ac-003', ruleName: '每日质量报告', sourceType: 'FTP', status: 'pending', triggeredAt: iso(5) },
  ]
}

const memTasks: AutoCollectionTask[] = []
const memRules: AutoCollectionRule[] = []
const memLogs: AutoCollectionLog[] = []
const memConfigs: AutoCollectionConfig[] = []

const SEED_CONFIGS: AutoCollectionConfig[] = [
  { id: 'cfg-001', key: 'poll_interval_sec', value: '30', description: 'DICOM 轮询间隔', category: 'DICOM' },
  { id: 'cfg-002', key: 'hl7_port', value: '2575', description: 'HL7 MLLP 监听端口', category: 'HL7' },
  { id: 'cfg-003', key: 'ftp_host', value: 'ftp-archive.local', description: 'FTP 归档服务器', category: 'FTP' },
  { id: 'cfg-004', key: 'max_retry', value: '3', description: '失败最大重试次数', category: 'COMMON' },
]

function nowIso(): string {
  return new Date().toISOString()
}

function addLog(source: string, message: string, level: AutoCollectionLog['level'] = 'INFO'): AutoCollectionLog {
  const log: AutoCollectionLog = {
    id: `ac-log-${Date.now().toString(36)}-${memLogs.length + 1}`,
    time: nowIso(),
    level,
    source,
    message,
  }
  memLogs.unshift(log)
  return log
}

@Injectable()
export class AutoCollectionService {
  // ===== Rules (采集规则 CRUD) =====
  listRules(): AutoCollectionRule[] {
    return [...memRules, ...SEED_RULES.filter((r) => !memRules.some((m) => m.id === r.id))]
  }

  getRule(id: string): AutoCollectionRule {
    const found = this.listRules().find((r) => r.id === id)
    if (!found) throw new NotFoundException(`采集规则 ${id} 不存在`)
    return found
  }

  createRule(input: Omit<AutoCollectionRule, 'id' | 'createdAt' | 'updatedAt'>): AutoCollectionRule {
    const now = nowIso()
    const rule: AutoCollectionRule = {
      id: `ac-${Date.now().toString(36)}`,
      name: input.name?.trim() || '未命名规则',
      description: input.description ?? '',
      triggerType: input.triggerType ?? 'event',
      triggerConfig: input.triggerConfig ?? {},
      action: input.action ?? 'notify',
      actionConfig: input.actionConfig ?? {},
      enabled: input.enabled !== false,
      createdAt: now,
      updatedAt: now,
    }
    memRules.unshift(rule)
    addLog('RULES', `创建采集规则 ${rule.name}`, 'INFO')
    return rule
  }

  updateRule(id: string, data: Partial<AutoCollectionRule>): AutoCollectionRule {
    const rule = this.getRule(id)
    const mem = memRules.find((r) => r.id === id)
    if (mem) {
      Object.assign(mem, data, { updatedAt: nowIso() })
      return mem
    }
    const copy = { ...rule, ...data, updatedAt: nowIso() }
    memRules.unshift(copy)
    return copy
  }

  deleteRule(id: string): { id: string; deleted: boolean } {
    const idx = memRules.findIndex((r) => r.id === id)
    if (idx < 0) void this.getRule(id) // seed 规则不可删除, 校验存在性
    if (idx >= 0) memRules.splice(idx, 1)
    addLog('RULES', `删除采集规则 ${id}`, 'WARN')
    return { id, deleted: true }
  }

  // ===== Tasks =====
  listTasks(query: { ruleId?: string; status?: string } = {}): AutoCollectionTask[] {
    let all = [...memTasks, ...seedTasks()]
    if (query.ruleId) all = all.filter((t) => t.ruleId === query.ruleId)
    if (query.status) all = all.filter((t) => t.status === query.status)
    return all
  }

  getTask(id: string): AutoCollectionTask {
    const found = this.listTasks().find((t) => t.id === id)
    if (!found) throw new NotFoundException(`采集任务 ${id} 不存在`)
    return found
  }

  createTask(input: { ruleId?: string; sourceType?: AutoCollectionTask['sourceType'] }): AutoCollectionTask {
    const rule = input.ruleId ? this.getRule(input.ruleId) : undefined
    const task: AutoCollectionTask = {
      id: `ac-t-${Date.now().toString(36)}`,
      ruleId: rule?.id ?? 'manual',
      ruleName: rule?.name ?? '手动任务',
      sourceType: input.sourceType ?? (rule?.action === 'notify' ? 'HL7' : 'DICOM'),
      status: 'pending',
      triggeredAt: nowIso(),
    }
    memTasks.unshift(task)
    addLog('TASKS', `创建采集任务 ${task.id} (${task.sourceType})`, 'INFO')
    return task
  }

  private setStatus(id: string, status: TaskStatus, extra?: Partial<AutoCollectionTask>): AutoCollectionTask {
    const task = this.getTask(id)
    const mem = memTasks.find((t) => t.id === id)
    const target = mem ?? task
    Object.assign(target, { status, ...extra })
    if (status === 'completed' || status === 'failed') target.completedAt = nowIso()
    addLog('TASKS', `任务 ${id} → ${status}`, status === 'failed' ? 'ERROR' : 'INFO')
    return target
  }

  startTask(id: string): AutoCollectionTask {
    return this.setStatus(id, 'running', { result: { startedAt: nowIso() } })
  }

  stopTask(id: string): AutoCollectionTask {
    return this.setStatus(id, 'completed', { result: { stopped: true, stoppedAt: nowIso() } })
  }

  runTask(id: string): AutoCollectionTask {
    const task = this.setStatus(id, 'running', { result: { triggeredAt: nowIso() } })
    this.setStatus(id, 'completed', { result: { ...(task.result ?? {}), success: true, count: 1 } })
    return this.getTask(id)
  }

  rerunTask(id: string): AutoCollectionTask {
    return this.runTask(id)
  }

  // ===== Config =====
  listConfig(): AutoCollectionConfig[] {
    return [...memConfigs, ...SEED_CONFIGS.filter((c) => !memConfigs.some((m) => m.key === c.key))]
  }

  updateConfig(key: string, value: string): AutoCollectionConfig {
    const existing = memConfigs.find((c) => c.key === key)
    if (existing) {
      existing.value = value
      return existing
    }
    const seed = SEED_CONFIGS.find((c) => c.key === key)
    const config: AutoCollectionConfig = {
      id: seed?.id ?? `cfg-${Date.now().toString(36)}`,
      key,
      value,
      description: seed?.description ?? '',
      category: seed?.category ?? 'CUSTOM',
    }
    memConfigs.push(config)
    return config
  }

  // ===== Logs =====
  listLogs(limit = 50): AutoCollectionLog[] {
    const clamped = Math.min(Math.max(Math.floor(limit) || 50, 1), 500)
    const seed: AutoCollectionLog[] = [
      { id: 'ac-log-seed-1', time: new Date(Date.now() - 3600000).toISOString(), level: 'INFO', source: 'DICOM', message: '轮询发现 12 个待归档研究' },
      { id: 'ac-log-seed-2', time: new Date(Date.now() - 3000000).toISOString(), level: 'INFO', source: 'HL7', message: '收到 ORU^R01 消息, 校验通过' },
      { id: 'ac-log-seed-3', time: new Date(Date.now() - 1500000).toISOString(), level: 'ERROR', source: 'FTP', message: 'FTP 连接失败: 认证失败 (5 次尝试)' },
    ]
    return [...memLogs, ...seed].slice(0, clamped)
  }

  // ===== Stats =====
  getStats(): AutoCollectionStats {
    const rules = this.listRules()
    const tasks = this.listTasks()
    const daily: { date: string; count: number; successCount: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      const dayTasks = tasks.filter((t) => t.triggeredAt.slice(0, 10) === key)
      daily.push({ date: key, count: dayTasks.length, successCount: dayTasks.filter((t) => t.status === 'completed').length })
    }
    return {
      totalRules: rules.length,
      activeRules: rules.filter((r) => r.enabled).length,
      totalTasks: tasks.length,
      completedTasks: tasks.filter((t) => t.status === 'completed').length,
      failedTasks: tasks.filter((t) => t.status === 'failed').length,
      dailyExecutions: daily,
    }
  }
}
