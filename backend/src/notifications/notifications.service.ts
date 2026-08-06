/**
 * G005 放射RIS系统 v3.0.2.2 - 通知服务
 * v3.0.6.11-53 (Phase 1.5): Web Push 订阅存储(内存) + 推送发送
 *   - GET  /notifications/vapid-public-key  → VAPID 公钥
 *   - POST /notifications/push-subscribe    → 保存订阅
 *   - POST /notifications/push-unsubscribe  → 删除订阅
 *   - POST /notifications/push-send         → 发送 Web Push(需安装 web-push + VAPID 密钥)
 */
import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

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
  /** Web Push 订阅内存存储: userId -> subscriptions (生产建议持久化为 DB) */
  private readonly pushSubscriptions = new Map<string, PushSubscriptionEntry[]>()
  private demoVapidWarned = false

  constructor(private readonly prisma: PrismaService) {}

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
  async getHistory(userId: string, limit = 50) {
    const model = (this.prisma as any).notification
    if (!model?.findMany) return []
    return model.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
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
   * POST /notifications/broadcast — 创建(广播)
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
    if (!model?.create) {
      // 返回内存对象(测试用)
      return { id: 'mock-' + Date.now(), ...data, read: false, createdAt: new Date().toISOString() }
    }
    return model.create({ data })
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
   * POST /notifications/push-subscribe — 保存/更新订阅 (内存存储)
   */
  async savePushSubscription(userId: string, sub: { endpoint: string; keys: { p256dh: string; auth: string }; topics?: string[] }) {
    const existing = this.pushSubscriptions.get(userId) ?? []
    const entry: PushSubscriptionEntry = {
      endpoint: sub.endpoint,
      keys: sub.keys,
      userId,
      topics: sub.topics,
      createdAt: new Date().toISOString(),
    }
    const updated = [...existing.filter((e) => e.endpoint !== sub.endpoint), entry]
    this.pushSubscriptions.set(userId, updated)
    this.logger.log(`push-subscribe userId=${userId} endpoints=${updated.length}`)
    return {
      success: true,
      userId,
      endpoint: sub.endpoint,
      total: updated.length,
    }
  }

  /**
   * POST /notifications/push-unsubscribe — 删除订阅
   */
  async removePushSubscription(endpoint: string) {
    for (const [userId, subs] of this.pushSubscriptions.entries()) {
      if (subs.some((s) => s.endpoint === endpoint)) {
        const updated = subs.filter((s) => s.endpoint !== endpoint)
        if (updated.length > 0) {
          this.pushSubscriptions.set(userId, updated)
        } else {
          this.pushSubscriptions.delete(userId)
        }
        this.logger.log(`push-unsubscribe userId=${userId}`)
        return { success: true, userId, endpoint, total: updated.length }
      }
    }
    return { success: false, endpoint, reason: 'not-found' }
  }

  /**
   * 列出用户订阅
   */
  getSubscriptions(userId: string): PushSubscriptionEntry[] {
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
    const subs = this.getSubscriptions(userId)
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
}
