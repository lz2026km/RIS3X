/**
 * G005 放射RIS系统 v3.0.2.2 - 通知服务
 * v3.0.6.11-53 (Phase 1.5): Web Push 订阅存储(内存) + 推送发送
 * v3.0.6.11-75 (W4-2): 订阅持久化至 DB (NotificationSubscription 表, 无表时回退内存);
 *   create/broadcast 后通过 socket.io gateway 实时推送 (notify 事件)
 */
import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { createNoopGateway, NotificationsGateway } from './notifications.gateway'

export interface CreateNotificationDto {
  userId: string
  type: 'CRITICAL' | 'REPORT' | 'TASK' | 'SYSTEM' | 'APPOINTMENT'
  severity?: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'
  title: string
  content: string
  link?: string
  targetId?: string
}

export interface PushSubscriptionEntry {
  endpoint: string
  keys: { p256dh: string; auth: string }
  userId: string
  topics?: string[]
  createdAt: string
}

// [v3.0.6.11-99 Wave7B] 站内信/推送订阅类型 (通知中心订阅管理 + 移动推送页)
export type NotificationSubscriptionType =
  | 'CRITICAL'   // 危急值
  | 'REPORT'     // 报告完成
  | 'FOLLOWUP'   // 随访提醒
  | 'QUALITY'    // 质控通知
  | 'SYSTEM'     // 系统公告

export const DEFAULT_SUBSCRIPTION_TYPES: NotificationSubscriptionType[] = [
  'CRITICAL', 'REPORT', 'FOLLOWUP', 'QUALITY', 'SYSTEM',
]

// 演示 VAPID 密钥对 (生成于 2026-08, 仅用于本地/演示; 生产用环境变量覆盖)
const DEMO_VAPID_PUBLIC_KEY =
  'BK-yELa-ndXqb0Qr5gdFEnEtYjaPWadKr25P1ApwdgNcbgtPIAaWdTwdwyy1eyP8ntlQSWM-XH5GK2Lk6S1hb88'
const DEMO_VAPID_PRIVATE_KEY = 'lJB1JAesCU5_iEbyCJFFuhgIRuvC3rm8b5yI3uIxtJk'

// web-push 模块最小类型声明 (见 backend/src/types/web-push.d.ts)
interface WebPushModule {
  setVapidDetails(subject: string, publicKey: string, privateKey: string): void
  sendNotification(
    subscription: unknown,
    payload?: string | Buffer,
    options?: Record<string, unknown>,
  ): Promise<unknown>
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)
  /** Web Push 订阅内存回退存储 (DB 不可用/未迁移时使用; 生产建议迁移后以 DB 为准) */
  private readonly pushSubscriptions = new Map<string, PushSubscriptionEntry[]>()
  /** [v3.0.6.11-99 Wave7B] 站内信/推送订阅类型 (内存存储, 默认全开; 前端 localStorage 兜底持久化) */
  private readonly subscriptions = new Map<string, NotificationSubscriptionType[]>()
  /** [v3.0.6.11-99 Wave 10D] 用户偏好 (类型/渠道/免打扰) 内存存储 */
  private readonly preferences = new Map<string, NotificationPreferences>()
  private demoVapidWarned = false
  private readonly gateway: NotificationsGateway

  constructor(
    private readonly prisma: PrismaService,
    gateway?: NotificationsGateway,
  ) {
    this.gateway = gateway ?? createNoopGateway()
  }

  /**
   * GET /notifications/unread/:userId — 获取未读数
   */
  async getUnreadCount(userId: string): Promise<{ userId: string; unread: number }> {
    const model = (this.prisma as any).notification
    if (!model?.count) return { userId, unread: 0 }
    const unread = await model.count({ where: { userId, read: false } })
    return { userId, unread }
  }

  /**
   * GET /notifications/history/:userId — 获取历史
   */
  async getHistory(userId: string, limit = 50, skip = 0, type?: string) {
    const model = (this.prisma as any).notification
    if (!model?.findMany) return []
    const where: Record<string, unknown> = { userId }
    if (type) where.type = type
    const query: Record<string, unknown> = { where, orderBy: { createdAt: 'desc' }, take: limit }
    // 仅在显式分页时附加 skip, 保持默认调用的查询形态不变 (向后兼容)
    if (skip) query.skip = skip
    return model.findMany(query)
  }

  /**
   * POST /notifications/read — 标记已读
   */
  async markRead(id: string) {
    const model = (this.prisma as any).notification
    if (!model?.update) return null
    return model.update({
      where: { id },
      data: { read: true, readAt: new Date() },
    })
  }

  /**
   * POST /notifications/read-all/:userId — 一键全部已读
   */
  async markAllRead(userId: string): Promise<{ userId: string; count: number }> {
    const model = (this.prisma as any).notification
    if (!model?.updateMany) return { userId, count: 0 }
    const result = await model.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    })
    return { userId, count: result?.count ?? 0 }
  }

  /**
   * DELETE /notifications/:id — 删除单条通知
   */
  async remove(id: string): Promise<{ id: string; deleted: boolean }> {
    const model = (this.prisma as any).notification
    if (!model?.delete) return { id, deleted: false }
    await model.delete({ where: { id } })
    return { id, deleted: true }
  }

  /**
   * GET /notifications/stats/:userId — 未读/今日/总数统计
   */
  async getStats(userId: string): Promise<{ userId: string; total: number; unread: number; today: number; critical: number }> {
    const model = (this.prisma as any).notification
    if (!model?.count) return { userId, total: 0, unread: 0, today: 0, critical: 0 }
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    const [total, unread, today, critical] = await Promise.all([
      model.count({ where: { userId } }),
      model.count({ where: { userId, read: false } }),
      model.count({ where: { userId, createdAt: { gte: dayStart } } }),
      model.count({ where: { userId, severity: 'CRITICAL', read: false } }),
    ])
    return { userId, total, unread, today, critical }
  }

  /**
   * POST /notifications/broadcast — 创建(广播)
   * 创建后经 socket.io 网关实时推送 notify 事件到目标用户房间
   */
  async create(dto: CreateNotificationDto) {
    const model = (this.prisma as any).notification
    const data: any = {
      userId: dto.userId,
      type: dto.type,
      severity: dto.severity ?? 'INFO',
      title: dto.title,
      content: dto.content,
      link: dto.link,
      targetId: dto.targetId,
    }
    let created: any
    if (!model?.create) {
      // 返回内存对象(测试用)
      created = { id: 'mock-' + Date.now(), ...data, read: false, createdAt: new Date().toISOString() }
    } else {
      created = await model.create({ data })
    }
    try {
      this.gateway.push(dto.userId, {
        event: 'notify',
        type: 'notification',
        notification: created,
        timestamp: Date.now(),
      })
    } catch (e) {
      this.logger.warn('realtime push failed', (e as Error)?.message)
    }
    return created
  }

  /**
   * 批量广播给多个用户
   */
  async broadcast(userIds: string[], dto: Omit<CreateNotificationDto, 'userId'>) {
    const results = []
    for (const userId of userIds) {
      const r = await this.create({ ...dto, userId })
      results.push(r)
    }
    return { count: results.length, items: results }
  }

  /**
   * [v3.0.6.11-99 Wave 5B-C] 报表生成完成推送 (内部端点 POST /notifications/report-generated)
   * 由定时报表执行器/报表模块在生成完成后调用, 按 recipients 逐个创建「报表已生成」通知。
   * 待联动: Wave 5A 自定义报表调度 (schedule/recipients 字段) 落地后,
   * 由定时执行器在 due 时调用本方法并附带报表摘要 summary。
   */
  async reportGenerated(dto: { reportId: string; reportName: string; recipients: string[]; summary?: string; link?: string }) {
    const title = `报表已生成: ${dto.reportName}`
    const content = dto.summary || `报表「${dto.reportName}」(ID: ${dto.reportId}) 已生成, 请在报表中心查看。`
    const recipients = Array.isArray(dto.recipients) && dto.recipients.length > 0 ? dto.recipients : ['current']
    return this.broadcast(recipients, {
      type: 'REPORT',
      severity: 'INFO',
      title,
      content,
      link: dto.link,
      targetId: dto.reportId,
    })
  }

  /**
   * VAPID 公钥: 环境变量优先; 生产未配置返回 null (禁用演示密钥), 开发环境回退内置演示密钥并打 warning
   */
  getVapidPublicKey(): string | null {
    const envKey = process.env['VAPID_PUBLIC_KEY']?.trim()
    if (envKey) return envKey
    if (process.env['NODE_ENV'] === 'production') {
      this.logger.error('VAPID_PUBLIC_KEY 未配置: 生产环境已禁用演示 VAPID 密钥, Web Push 不可用')
      return null
    }
    this.warnDemoVapid()
    return DEMO_VAPID_PUBLIC_KEY
  }

  private getVapidPrivateKey(): string | null {
    const envKey = process.env['VAPID_PRIVATE_KEY']?.trim()
    if (envKey) return envKey
    if (process.env['NODE_ENV'] === 'production') return null
    this.warnDemoVapid()
    return DEMO_VAPID_PRIVATE_KEY
  }

  private warnDemoVapid(): void {
    if (!this.demoVapidWarned) {
      this.demoVapidWarned = true
      this.logger.warn(
        '使用内置演示 VAPID 密钥 (仅限开发环境); 生产环境必须设置 VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY',
      )
    }
  }

  /**
   * POST /notifications/push-subscribe — 保存/更新订阅
   * v3.0.6.11-75 (W4-2): 优先持久化到 NotificationSubscription 表 (endpoint 唯一),
   * DB 不可用(未迁移/断连)时回退内存存储
   */
  async savePushSubscription(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string }; topics?: string[] }) {
    const entry: PushSubscriptionEntry = {
      endpoint: sub.endpoint,
      keys: sub.keys,
      userId,
      topics: sub.topics,
      createdAt: new Date().toISOString(),
    }
    const dbModel = (this.prisma as any).notificationSubscription
    let total = 0
    if (dbModel?.upsert && dbModel?.count) {
      try {
        await dbModel.upsert({
          where: { endpoint: sub.endpoint },
          create: {
            userId,
            endpoint: sub.endpoint,
            keysJson: JSON.stringify(sub.keys),
            topics: sub.topics ?? null,
          },
          update: {
            userId,
            keysJson: JSON.stringify(sub.keys),
            topics: sub.topics ?? null,
          },
        })
        total = await dbModel.count({ where: { userId } })
        this.logger.log(`push-subscribe (DB) userId=${userId} endpoints=${total}`)
        return { success: true, userId, endpoint: sub.endpoint, total, store: 'db' }
      } catch (e) {
        this.logger.warn(`push-subscribe DB failed, fallback memory: ${(e as Error)?.message}`)
      }
    }
    const existing = this.pushSubscriptions.get(userId) ?? []
    const updated = [...existing.filter((e) => e.endpoint !== sub.endpoint), entry]
    this.pushSubscriptions.set(userId, updated)
    this.logger.log(`push-subscribe (memory) userId=${userId} endpoints=${updated.length}`)
    return {
      success: true,
      userId,
      endpoint: sub.endpoint,
      total: updated.length,
      store: 'memory',
    }
  }

  /**
   * POST /notifications/push-unsubscribe — 删除订阅 (DB 优先, 回退内存)
   */
  async removePushSubscription(endpoint: string) {
    const dbModel = (this.prisma as any).notificationSubscription
    if (dbModel?.deleteMany && dbModel?.count) {
      try {
        const deleted = await dbModel.deleteMany({ where: { endpoint } })
        if (deleted?.count && deleted.count > 0) {
          this.logger.log(`push-unsubscribe (DB) endpoint=${endpoint}`)
          return { success: true, endpoint, total: 0, store: 'db' }
        }
      } catch (e) {
        this.logger.warn(`push-unsubscribe DB failed, fallback memory: ${(e as Error)?.message}`)
      }
    }
    for (const [userId, subs] of this.pushSubscriptions.entries()) {
      if (subs.some((s) => s.endpoint === endpoint)) {
        const updated = subs.filter((s) => s.endpoint !== endpoint)
        if (updated.length > 0) {
          this.pushSubscriptions.set(userId, updated)
        } else {
          this.pushSubscriptions.delete(userId)
        }
        this.logger.log(`push-unsubscribe (memory) userId=${userId}`)
        return { success: true, userId, endpoint, total: updated.length, store: 'memory' }
      }
    }
    return { success: false, endpoint, reason: 'not-found' }
  }

  /**
   * 列出用户订阅 (DB 优先, 回退内存)
   */
  async getSubscriptions(userId: string): Promise<PushSubscriptionEntry[]> {
    const dbModel = (this.prisma as any).notificationSubscription
    if (dbModel?.findMany) {
      try {
        const rows = await dbModel.findMany({ where: { userId } })
        if (rows && rows.length > 0) {
          return rows.map((r: any) => ({
            endpoint: r.endpoint,
            keys: JSON.parse(r.keysJson ?? '{}'),
            userId: r.userId,
            topics: Array.isArray(r.topics) ? r.topics : undefined,
            createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt ?? ''),
          }))
        }
      } catch (e) {
        this.logger.warn(`getSubscriptions DB failed, fallback memory: ${(e as Error)?.message}`)
      }
    }
    return this.pushSubscriptions.get(userId) ?? []
  }

  /**
   * 动态加载 web-push (未安装时返回 null, 不阻塞启动)
   */
  private async loadWebPush(): Promise<WebPushModule | null> {
    try {
      const mod = (await import('web-push')) as unknown
      const wp = (mod as { default?: WebPushModule })?.default ?? (mod as WebPushModule)
      if (wp && typeof wp.sendNotification === 'function') return wp
    } catch (e) {
      this.logger.warn('web-push not installed, push delivery skipped:', (e as Error)?.message)
    }
    return null
  }

  /**
   * POST /notifications/push-send — 向用户订阅发送 Web Push
   * 依赖: npm i web-push + VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY 环境变量
   * 未安装 web-push 时返回 501 语义结果, 前端仍可走 Notification API 本地通知
   */
  async sendPush(userId: string, payload: { title: string; content: string; url?: string; tag?: string; requireInteraction?: boolean }) {
    const subs = await this.getSubscriptions(userId)
    if (subs.length === 0) {
      return { success: false, userId, delivered: 0, reason: 'no-subscription' }
    }
    const publicKey = this.getVapidPublicKey()
    const privateKey = this.getVapidPrivateKey()
    if (!publicKey || !privateKey) {
      return {
        success: false,
        userId,
        delivered: 0,
        reason: 'vapid-not-configured',
        hint: '生产环境必须配置 VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY',
      }
    }
    const wp = await this.loadWebPush()
    if (!wp) {
      return {
        success: false,
        userId,
        delivered: 0,
        reason: 'web-push-not-installed',
        hint: '安装 web-push 并配置 VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY',
      }
    }
    try {
      wp.setVapidDetails('mailto:admin@g005-ris.local', publicKey, privateKey)
    } catch (e) {
      this.logger.error('VAPID config error', e)
      return { success: false, userId, delivered: 0, reason: 'vapid-config-error' }
    }
    const body = JSON.stringify({
      title: payload.title,
      body: payload.content,
      url: payload.url,
      tag: payload.tag ?? `g005-${userId}`,
      requireInteraction: payload.requireInteraction ?? true,
      data: { url: payload.url },
    })
    const results: Array<{ endpoint: string; ok: boolean; status?: number }> = []
    for (const sub of subs) {
      try {
        await wp.sendNotification(sub, body, { TTL: 86400 })
        results.push({ endpoint: sub.endpoint, ok: true })
      } catch (e) {
        const err = e as { statusCode?: number }
        this.logger.warn(`push-send failed endpoint=${sub.endpoint}`, err.statusCode ?? e)
        results.push({ endpoint: sub.endpoint, ok: false, status: err.statusCode })
      }
    }
    const delivered = results.filter((r) => r.ok).length
    return { success: delivered > 0, userId, delivered, total: subs.length, results }
  }

  /**
   * [v3.0.6.11-99 Wave7B] GET /notifications/subscriptions/:userId
   * 站内信/推送订阅类型: 未设置时返回默认全开
   */
  getSubscriptionConfig(userId: string): { userId: string; types: NotificationSubscriptionType[]; defaulted: boolean } {
    const existing = this.subscriptions.get(userId)
    if (!existing) {
      return { userId, types: [...DEFAULT_SUBSCRIPTION_TYPES], defaulted: true }
    }
    return { userId, types: [...existing], defaulted: false }
  }

  /**
   * [v3.0.6.11-99 Wave7B] PUT /notifications/subscriptions/:userId
   * 更新订阅类型 (白名单校验, 非法项忽略)
   */
  updateSubscriptionConfig(userId: string, types: string[]): { userId: string; types: NotificationSubscriptionType[] } {
    const allowed = new Set<string>(DEFAULT_SUBSCRIPTION_TYPES)
    const cleaned = Array.from(new Set(types))
      .filter((t): t is NotificationSubscriptionType => allowed.has(t))
    const normalized = cleaned.length > 0 ? cleaned : [...DEFAULT_SUBSCRIPTION_TYPES]
    this.subscriptions.set(userId, [...normalized])
    this.logger.log(`subscriptions updated userId=${userId} types=${normalized.join(',')}`)
    return { userId, types: [...normalized] }
  }

  // ============ [v3.0.6.11-99 Wave 10D] 总览 / 30日趋势 / 用户偏好 ============

  /** 日期工具: 近 N 天日期数组 (升序, YYYY-MM-DD, 本地时区) */
  private lastNDays(days: number): string[] {
    const out: string[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - i)
      out.push(this.dateKey(d))
    }
    return out
  }

  /** 本地时区 YYYY-MM-DD (避免 toISOString UTC 跨日错位) */
  private dateKey(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  /**
   * GET /notifications/overview — 通知总览: 按类型计数 / 未读 / 今日 / 严重度。
   * 数据源: notification 表 (可用时); DB 不可用回退确定性 seed (与 getUnreadCount 风格一致)。
   */
  async getOverview(userId?: string) {
    const model = (this.prisma as any).notification
    if (model?.groupBy && model?.count) {
      try {
        const base = userId ? { userId } : {}
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        const twoWeeksAgo = new Date()
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
        const [byType, bySeverity, total, unread, today, critical, lastWeek, prevWeek] = await Promise.all([
          model.groupBy({ by: ['type'], where: base, _count: { _all: true } }),
          model.groupBy({ by: ['severity'], where: base, _count: { _all: true } }),
          model.count({ where: base }),
          model.count({ where: { ...base, read: false } }),
          model.count({ where: { ...base, createdAt: { gte: this.dayStart() } } }),
          model.count({ where: { ...base, severity: 'CRITICAL', read: false } }),
          model.count({ where: { ...base, createdAt: { gte: weekAgo } } }),
          model.count({ where: { ...base, createdAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
        ])
        const byTypeCount: Record<string, number> = {}
        for (const g of byType) byTypeCount[g.type] = g._count._all
        const bySeverityCount: Record<string, number> = {}
        for (const g of bySeverity) bySeverityCount[g.severity] = g._count._all
        const typesTotal = Object.values(byTypeCount).reduce((a, b) => a + b, 0)
        if (typesTotal === 0) {
          return this.seedNotificationOverview(userId)
        }
        return {
          userId: userId ?? '*',
          total,
          unread,
          today,
          critical,
          lastWeek: lastWeek ?? 0,
          lastWeekDeltaPercent: (prevWeek ?? 0) > 0 ? Number((((lastWeek - prevWeek) / prevWeek) * 100).toFixed(1)) : 0,
          byType: byTypeCount,
          bySeverity: bySeverityCount,
        }
      } catch (e) {
        this.logger.warn(`getOverview DB failed, fallback seed: ${(e as Error)?.message}`)
      }
    }
    return this.seedNotificationOverview(userId)
  }

  private seedNotificationOverview(userId?: string) {
    return {
      userId: userId ?? '*',
      total: 48,
      unread: 6,
      today: 9,
      critical: 2,
      lastWeek: 41,
      lastWeekDeltaPercent: 10.8,
      byType: { CRITICAL: 8, REPORT: 21, TASK: 9, SYSTEM: 6, APPOINTMENT: 4 },
      bySeverity: { INFO: 32, WARN: 11, ERROR: 3, CRITICAL: 2 },
    }
  }

  private dayStart(): Date {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    return d
  }

  /**
   * GET /notifications/daily-trend — 近 30 日通知趋势: 每日 总数/未读/危急值。
   * 数据源: notification 表分桶; 空数据回退确定性 seed。
   */
  async getDailyTrend(days = 30, userId?: string) {
    const n = Number.isFinite(days) && days > 0 && days <= 365 ? Math.floor(days) : 30
    const start = this.dayStart()
    start.setDate(start.getDate() - (n - 1))
    const model = (this.prisma as any).notification
    if (model?.findMany) {
      try {
        const base = { ...(userId ? { userId } : {}), createdAt: { gte: start } }
        const rows = await model.findMany({ where: base, select: { createdAt: true, read: true, severity: true } })
        const dates = this.lastNDays(n)
        const totalMap = new Map<string, number>()
        const unreadMap = new Map<string, number>()
        const criticalMap = new Map<string, number>()
        for (const r of rows) {
          const iso = r.createdAt instanceof Date ? this.dateKey(r.createdAt) : String(r.createdAt ?? '').slice(0, 10)
          const key = iso
          totalMap.set(key, (totalMap.get(key) ?? 0) + 1)
          if (r.read === false) unreadMap.set(key, (unreadMap.get(key) ?? 0) + 1)
          if (r.severity === 'CRITICAL') criticalMap.set(key, (criticalMap.get(key) ?? 0) + 1)
        }
        const items = dates.map((date) => ({
          date,
          total: totalMap.get(date) ?? 0,
          unread: unreadMap.get(date) ?? 0,
          critical: criticalMap.get(date) ?? 0,
        }))
        if (items.reduce((a, i) => a + i.total, 0) === 0) {
          return { items: dates.map((date, idx) => ({ date, total: (idx * 4) % 12, unread: (idx * 2) % 6, critical: idx % 3 })), total: n }
        }
        return { items, total: n }
      } catch (e) {
        this.logger.warn(`getDailyTrend DB failed, fallback seed: ${(e as Error)?.message}`)
      }
    }
    const dates = this.lastNDays(n)
    return { items: dates.map((date, idx) => ({ date, total: (idx * 4) % 12, unread: (idx * 2) % 6, critical: idx % 3 })), total: n }
  }

  /**
   * GET /notifications/preferences/:userId — 用户偏好: 类型开关 (订阅) + 渠道 + 免打扰时段。
   * 内存存储 (与 subscriptions 一致), 未设置返回默认 (全开)。
   */
  getPreferences(userId: string): NotificationPreferences {
    const existing = this.preferences.get(userId)
    if (!existing) return { ...DEFAULT_PREFERENCES, userId, defaulted: true }
    return { ...existing, userId, defaulted: false }
  }

  /**
   * PUT /notifications/preferences/:userId — 更新用户偏好 (类型/渠道/免打扰)。
   */
  updatePreferences(userId: string, prefs: { types?: string[]; channels?: Record<string, boolean>; quietHours?: { enabled: boolean; from: string; to: string } }): NotificationPreferences {
    const current = this.getPreferences(userId)
    const merged: NotificationPreferences = {
      userId,
      defaulted: false,
      types: Array.isArray(prefs.types) ? this.cleanTypes(prefs.types) : current.types,
      channels: prefs.channels && typeof prefs.channels === 'object' ? { ...DEFAULT_PREFERENCES.channels, ...prefs.channels } : current.channels,
      quietHours: prefs.quietHours && typeof prefs.quietHours === 'object' ? { ...DEFAULT_PREFERENCES.quietHours, ...prefs.quietHours } : current.quietHours,
    }
    this.preferences.set(userId, merged)
    this.logger.log(`preferences updated userId=${userId}`)
    return merged
  }

  private cleanTypes(types: string[]): NotificationSubscriptionType[] {
    const allowed = new Set<string>(DEFAULT_SUBSCRIPTION_TYPES)
    const cleaned = Array.from(new Set(types)).filter((t): t is NotificationSubscriptionType => allowed.has(t))
    return cleaned.length > 0 ? cleaned : [...DEFAULT_SUBSCRIPTION_TYPES]
  }
}

// [v3.0.6.11-99 Wave 10D] 用户通知偏好结构 (类型开关 + 渠道开关 + 免打扰时段)
export interface NotificationPreferences {
  userId: string
  types: NotificationSubscriptionType[]
  channels: Record<string, boolean>
  quietHours: { enabled: boolean; from: string; to: string }
  defaulted: boolean
}

export const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'userId' | 'defaulted'> = {
  types: [...DEFAULT_SUBSCRIPTION_TYPES],
  channels: { SMS: true, WECHAT: true, APP: true, SYSTEM: true, EMAIL: false, PHONE: true },
  quietHours: { enabled: false, from: '22:00', to: '07:00' },
}
