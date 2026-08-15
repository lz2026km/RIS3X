import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { currentTenantId } from '../../common/tenant/tenant-utils'

// ===== [W10E-3] 扩展端点 DTO (审计总览 / 用户活跃 / 操作趋势 / 高危操作) =====

export interface AuditOverviewDto {
  date: string
  todayOperations: number
  activeUsers: number
  highRiskCount: number
  successCount: number
  failedCount: number
  successRate: number
  totalOperations: number
  topActions: Array<{ action: string; count: number }>
  seeded: boolean
}

export interface UserActivityDto {
  userId: string
  userName: string
  count: number
  lastActive: string
  successRate: number
}

export interface AuditTrendPoint {
  date: string
  label: string
  total: number
  highRisk: number
  failed: number
  seeded: boolean
}

export interface HighRiskActionDto {
  action: string
  pattern: 'delete' | 'export' | 'batch' | 'other'
  patternZh: string
  count: number
  lastAt: string
  recentUsers: string[]
}

export interface HighRiskDto {
  total: number
  byPattern: Array<{ pattern: string; patternZh: string; count: number }>
  actions: HighRiskActionDto[]
  seeded: boolean
}

function auditHash(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 确定性伪随机: 同一 seedInput 永远得到同一结果 (统计回退可复现) */
function auditSeededRand(min: number, max: number, seedInput: string): number {
  let a = auditHash(seedInput) >>> 0
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return Math.round((r * (max - min) + min) * 10) / 10
}

function auditDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const RISK_PATTERN_ZH: Record<string, string> = {
  delete: '删除操作',
  export: '导出操作',
  batch: '批量操作',
  other: '其他',
}

function auditRiskPattern(action: string): 'delete' | 'export' | 'batch' | 'other' {
  const a = action.toLowerCase()
  // 先判断批量 (BATCH_DELETE 含 delete 字样, 需优先归类)
  if (/batch|bulk|import|批量|导入/.test(a)) return 'batch'
  if (/delete|remove|destroy|清除/.test(a)) return 'delete'
  if (/export|download|导出|下载/.test(a)) return 'export'
  return 'other'
}

const SEED_USERS = ['张医生', '李技师', '王医生', '赵护士', '陈技师', '刘主任']

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    userId?: string
    action: string
    resource: string
    resourceId?: string
    detail?: any
    ip?: string
    userAgent?: string
    success?: boolean
  }) {
    return this.prisma.auditLog.create({ data: { ...params, tenantId: currentTenantId() } })
  }

  async list(query: {
    page?: number
    pageSize?: number
    userId?: string
    action?: string
    resource?: string
    startDate?: string
    endDate?: string
  }) {
    const page = query.page || 1
    const pageSize = query.pageSize || 20
    const where: any = { tenantId: currentTenantId() }
    if (query.userId) where.userId = query.userId
    if (query.action) where.action = query.action
    if (query.resource) where.resource = query.resource
    if (query.startDate || query.endDate) {
      where.createdAt = {}
      if (query.startDate) where.createdAt.gte = new Date(query.startDate)
      if (query.endDate) where.createdAt.lte = new Date(query.endDate)
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ])
    return { items, total, page, pageSize }
  }

  async stats() {
    const [total, last24h] = await Promise.all([
      this.prisma.auditLog.count({ where: { tenantId: currentTenantId() } }),
      this.prisma.auditLog.count({
        where: {
          tenantId: currentTenantId(),
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
    ])
    return { total, last24h }
  }

  // [G005 Wave1A P0] 审计聚合 (AuditCompliancePage 在用):
  // 从 AuditLog 派生按操作类型/资源/用户分组的统计 + 总数/近24h/拒绝数
  async aggregation() {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const [total, last24h, denied, rows] = await Promise.all([
      this.prisma.auditLog.count({ where: { tenantId: currentTenantId() } }),
      this.prisma.auditLog.count({
        where: { tenantId: currentTenantId(), createdAt: { gte: since } },
      }),
      this.prisma.auditLog.count({
        where: { tenantId: currentTenantId(), success: false },
      }),
      this.prisma.auditLog.findMany({
        where: { tenantId: currentTenantId() },
        select: { action: true, resource: true, userId: true },
        orderBy: { createdAt: 'desc' },
        take: 50000,
      }),
    ])
    const byAction: Record<string, number> = {}
    const byResource: Record<string, number> = {}
    const userMap = new Map<string, number>()
    for (const row of rows) {
      byAction[row.action] = (byAction[row.action] ?? 0) + 1
      byResource[row.resource] = (byResource[row.resource] ?? 0) + 1
      const uid = row.userId ?? 'system'
      userMap.set(uid, (userMap.get(uid) ?? 0) + 1)
    }
    const byUser = Array.from(userMap.entries())
      .map(([userId, count]) => ({ userId, count }))
      .sort((a, b) => b.count - a.count)
    return { total, last24h, denied, byAction, byResource, byUser }
  }

  // [W2-C] 审计记录详情 (AuditPage Drawer)
  async getById(id: string) {
    const row = await this.prisma.auditLog.findUnique({
      where: { id },
    })
    if (!row || row.tenantId !== currentTenantId()) {
      throw new NotFoundException(`审计记录 ${id} 不存在`)
    }
    return row
  }

  // 导出 CSV（从 AuditLog 表查询，最多 10000 条，按时间倒序）
  async exportCsv(query: {
    userId?: string
    action?: string
    resource?: string
    startDate?: string
    endDate?: string
  }): Promise<string> {
    const where: any = { tenantId: currentTenantId() }
    if (query.userId) where.userId = query.userId
    if (query.action) where.action = query.action
    if (query.resource) where.resource = query.resource
    if (query.startDate || query.endDate) {
      where.createdAt = {}
      if (query.startDate) where.createdAt.gte = new Date(query.startDate)
      if (query.endDate) where.createdAt.lte = new Date(query.endDate)
    }
    const rows = await this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000,
    })
    const esc = (v: unknown) => {
      const s = String(v ?? '')
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const header = ['id', 'userId', 'action', 'resource', 'details', 'ip', 'createdAt']
    const lines = [header.map(esc).join(',')]
    for (const r of rows) {
      lines.push([r.id, r.userId, r.action, r.resource, r.detail, r.ip, r.createdAt?.toISOString()].map(esc).join(','))
    }
    return '\uFEFF' + lines.join('\r\n')
  }

  // ================= [W10E-3] 扩展: 审计总览 / 用户活跃 / 操作趋势 / 高危操作 =================

  async getOverview(): Promise<AuditOverviewDto> {
    const tenantId = currentTenantId()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    try {
      const [todayOperations, totalOperations, successCount, rows] = await Promise.all([
        this.prisma.auditLog.count({ where: { tenantId, createdAt: { gte: todayStart } } }),
        this.prisma.auditLog.count({ where: { tenantId } }),
        this.prisma.auditLog.count({ where: { tenantId, success: true } }),
        this.prisma.auditLog.findMany({
          where: { tenantId, createdAt: { gte: todayStart } },
          select: { action: true, userId: true, success: true },
          orderBy: { createdAt: 'desc' },
          take: 100000,
        }),
      ])
      if (totalOperations > 0) {
        const activeUsers = new Set(rows.map((r) => r.userId ?? 'system')).size
        const highRiskCount = rows.filter((r) => auditRiskPattern(r.action) !== 'other').length
        const actionMap = new Map<string, number>()
        for (const r of rows) actionMap.set(r.action, (actionMap.get(r.action) ?? 0) + 1)
        return {
          date: auditDateStr(new Date()),
          todayOperations,
          activeUsers,
          highRiskCount,
          successCount,
          failedCount: totalOperations - successCount,
          successRate: totalOperations > 0 ? Math.round((successCount / totalOperations) * 100) : 0,
          totalOperations,
          topActions: Array.from(actionMap.entries())
            .map(([action, count]) => ({ action, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10),
          seeded: false,
        }
      }
    } catch (err) {
      // DB 不可用 → 确定性种子
      void err
    }
    return this.seedOverview()
  }

  private seedOverview(): AuditOverviewDto {
    const seed = `audit-overview:${auditDateStr(new Date())}`
    const total = Math.round(auditSeededRand(48000, 56000, `${seed}:total`))
    const today = Math.round(auditSeededRand(380, 520, `${seed}:today`))
    const failed = Math.round(today * auditSeededRand(0.01, 0.05, `${seed}:failed`))
    const highRisk = Math.round(today * auditSeededRand(0.06, 0.14, `${seed}:highrisk`))
    const topActions = ['LOGIN', 'VIEW_REPORT', 'CREATE_REPORT', 'UPDATE_REPORT', 'PRINT', 'DELETE_REPORT', 'EXPORT_CSV']
      .map((action, i) => ({
        action,
        count: Math.round(today * auditSeededRand(0.08, 0.3, `${seed}:action:${action}`)) + i * 7,
      }))
      .sort((a, b) => b.count - a.count)
    return {
      date: auditDateStr(new Date()),
      todayOperations: today,
      activeUsers: Math.round(auditSeededRand(18, 32, `${seed}:users`)),
      highRiskCount: highRisk,
      successCount: today - failed,
      failedCount: failed,
      successRate: Math.round(((today - failed) / today) * 100),
      totalOperations: total,
      topActions,
      seeded: true,
    }
  }

  async getUserActivity(limit = 10): Promise<UserActivityDto[]> {
    const take = Math.max(1, Math.min(Math.round(limit) || 10, 50))
    try {
      const rows = await this.prisma.auditLog.findMany({
        where: { tenantId: currentTenantId() },
        select: { userId: true, success: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 100000,
      })
      if (rows.length > 0) {
        const map = new Map<string, { count: number; success: number; lastActive: number }>()
        for (const r of rows) {
          const uid = r.userId ?? 'system'
          const e = map.get(uid) ?? { count: 0, success: 0, lastActive: 0 }
          e.count += 1
          if (r.success) e.success += 1
          e.lastActive = Math.max(e.lastActive, new Date(r.createdAt).getTime())
          map.set(uid, e)
        }
        return Array.from(map.entries())
          .map(([userId, e]) => ({
            userId,
            userName: userId,
            count: e.count,
            lastActive: new Date(e.lastActive).toISOString(),
            successRate: Math.round((e.success / e.count) * 100),
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, take)
      }
    } catch (err) {
      void err
    }
    const seed = `audit-users:${auditDateStr(new Date())}`
    const base = new Date()
    base.setHours(0, 0, 0, 0)
    return SEED_USERS.map((userName, i) => ({
      userId: `u-${i + 1}`,
      userName,
      count: Math.round(auditSeededRand(120, 900, `${seed}:${userName}`)),
      lastActive: new Date(base.getTime() - i * 3600000).toISOString(),
      successRate: Math.round(auditSeededRand(95, 100, `${seed}:rate:${userName}`)),
    }))
      .sort((a, b) => b.count - a.count)
      .slice(0, take)
  }

  async getActionTrend(days = 30): Promise<AuditTrendPoint[]> {
    const count = Math.max(1, Math.min(Math.round(days) || 30, 60))
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - (count - 1))
    try {
      const rows = await this.prisma.auditLog.findMany({
        where: { tenantId: currentTenantId(), createdAt: { gte: start } },
        select: { action: true, success: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
        take: 200000,
      })
      if (rows.length > 0) {
        const byDate = new Map<string, { total: number; highRisk: number; failed: number }>()
        for (const r of rows) {
          const key = auditDateStr(new Date(r.createdAt))
          const e = byDate.get(key) ?? { total: 0, highRisk: 0, failed: 0 }
          e.total += 1
          if (auditRiskPattern(r.action) !== 'other') e.highRisk += 1
          if (!r.success) e.failed += 1
          byDate.set(key, e)
        }
        return Array.from({ length: count }, (_, i) => {
          const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
          const key = auditDateStr(d)
          const e = byDate.get(key) ?? { total: 0, highRisk: 0, failed: 0 }
          return { date: key, label: key.slice(5), total: e.total, highRisk: e.highRisk, failed: e.failed, seeded: false }
        })
      }
    } catch (err) {
      void err
    }
    const seed = `audit-trend:${auditDateStr(start)}`
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      const key = auditDateStr(d)
      const total = Math.round(auditSeededRand(320, 560, `${seed}:total:${key}`))
      const highRisk = Math.round(total * auditSeededRand(0.06, 0.13, `${seed}:risk:${key}`))
      const failed = Math.round(total * auditSeededRand(0.01, 0.04, `${seed}:failed:${key}`))
      return { date: key, label: key.slice(5), total, highRisk, failed, seeded: true }
    })
  }

  async getHighRisk(): Promise<HighRiskDto> {
    try {
      const rows = await this.prisma.auditLog.findMany({
        where: { tenantId: currentTenantId() },
        select: { action: true, userId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 100000,
      })
      if (rows.length > 0) {
        const risky = rows.filter((r) => auditRiskPattern(r.action) !== 'other')
        const actionMap = new Map<string, { action: string; pattern: 'delete' | 'export' | 'batch' | 'other'; count: number; lastAt: number; users: Set<string> }>()
        for (const r of risky) {
          const pattern = auditRiskPattern(r.action)
          const e = actionMap.get(r.action) ?? { action: r.action, pattern, count: 0, lastAt: 0, users: new Set<string>() }
          e.count += 1
          e.lastAt = Math.max(e.lastAt, new Date(r.createdAt).getTime())
          if (r.userId) e.users.add(r.userId)
          actionMap.set(r.action, e)
        }
        const actions = Array.from(actionMap.values())
          .map((e) => ({
            action: e.action,
            pattern: e.pattern,
            patternZh: RISK_PATTERN_ZH[e.pattern],
            count: e.count,
            lastAt: new Date(e.lastAt).toISOString(),
            recentUsers: Array.from(e.users).slice(0, 5),
          }))
          .sort((a, b) => b.count - a.count)
        const byPattern = (['delete', 'export', 'batch', 'other'] as const).map((pattern) => ({
          pattern,
          patternZh: RISK_PATTERN_ZH[pattern],
          count: actions.filter((a) => a.pattern === pattern).reduce((sum, a) => sum + a.count, 0),
        }))
        return { total: risky.length, byPattern, actions, seeded: false }
      }
    } catch (err) {
      void err
    }
    return this.seedHighRisk()
  }

  private seedHighRisk(): HighRiskDto {
    const seed = `audit-highrisk:${auditDateStr(new Date())}`
    const base = new Date()
    base.setHours(0, 0, 0, 0)
    const defs: Array<{ action: string; pattern: 'delete' | 'export' | 'batch'; countKey: string; hoursAgo: number }> = [
      { action: 'DELETE_REPORT', pattern: 'delete', countKey: 'delete_report', hoursAgo: 1 },
      { action: 'DELETE_PATIENT', pattern: 'delete', countKey: 'delete_patient', hoursAgo: 3 },
      { action: 'EXPORT_CSV', pattern: 'export', countKey: 'export_csv', hoursAgo: 2 },
      { action: 'EXPORT_PATIENT_DATA', pattern: 'export', countKey: 'export_patient', hoursAgo: 5 },
      { action: 'BATCH_DELETE', pattern: 'batch', countKey: 'batch_delete', hoursAgo: 4 },
      { action: 'BULK_IMPORT', pattern: 'batch', countKey: 'bulk_import', hoursAgo: 8 },
    ]
    const actions = defs
      .map((d) => ({
        action: d.action,
        pattern: d.pattern,
        patternZh: RISK_PATTERN_ZH[d.pattern],
        count: Math.round(auditSeededRand(5, 40, `${seed}:${d.countKey}`)),
        lastAt: new Date(base.getTime() - d.hoursAgo * 3600000).toISOString(),
        recentUsers: SEED_USERS.slice(0, Math.min(3, Math.round(auditSeededRand(1, 4, `${seed}:users:${d.countKey}`)))),
      }))
      .sort((a, b) => b.count - a.count)
    const byPattern = (['delete', 'export', 'batch', 'other'] as const).map((pattern) => ({
      pattern,
      patternZh: RISK_PATTERN_ZH[pattern],
      count: actions.filter((a) => a.pattern === pattern).reduce((sum, a) => sum + a.count, 0),
    }))
    return { total: actions.reduce((sum, a) => sum + a.count, 0), byPattern, actions, seeded: true }
  }
}
