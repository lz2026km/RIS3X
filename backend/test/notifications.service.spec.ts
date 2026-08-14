import { NotificationsService } from '../src/notifications/notifications.service'

describe('NotificationsService', () => {
  let svc: NotificationsService
  let mockPrisma: any

  beforeAll(() => {
    mockPrisma = {
      notification: {
        count: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
      },
    }
    svc = new NotificationsService(mockPrisma)
  })

  beforeEach(() => jest.clearAllMocks())

  it('getUnreadCount returns unread count for user', async () => {
    mockPrisma.notification.count.mockResolvedValue(3)
    const result = await svc.getUnreadCount('u1')
    expect(result).toEqual({ userId: 'u1', unread: 3 })
    expect(mockPrisma.notification.count).toHaveBeenCalledWith({ where: { userId: 'u1', read: false } })
  })

  it('getHistory returns notifications ordered by createdAt desc', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([{ id: 'n1', title: 'test' }])
    const result = await svc.getHistory('u1', 10)
    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
      where: { userId: 'u1' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })
    expect(result).toHaveLength(1)
  })

  it('markRead updates notification with read flag', async () => {
    mockPrisma.notification.update.mockResolvedValue({ id: 'n1', read: true, readAt: expect.any(Date) })
    const result = await svc.markRead('n1')
    expect(mockPrisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'n1' },
      data: { read: true, readAt: expect.any(Date) },
    })
  })

  it('broadcast creates notifications for multiple users', async () => {
    mockPrisma.notification.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ id: 'mock-' + Date.now(), ...data }),
    )
    const result = await svc.broadcast(['u1', 'u2'], { type: 'SYSTEM', title: '维护通知', content: '系统维护' })
    expect(result.count).toBe(2)
    expect(mockPrisma.notification.create).toHaveBeenCalledTimes(2)
  })

  it('savePushSubscription returns success', async () => {
    const result = await svc.savePushSubscription('u1', {
      endpoint: 'https://push.example.com',
      keys: { p256dh: 'abc', auth: 'def' },
    })
    expect(result.success).toBe(true)
    expect(result.userId).toBe('u1')
  })

  it('savePushSubscription replaces same endpoint and keeps others', async () => {
    await svc.savePushSubscription('push-user', { endpoint: 'e1', keys: { p256dh: 'a', auth: 'b' } })
    await svc.savePushSubscription('push-user', { endpoint: 'e2', keys: { p256dh: 'c', auth: 'd' } })
    await svc.savePushSubscription('push-user', { endpoint: 'e1', keys: { p256dh: 'a2', auth: 'b2' }, topics: ['critical'] })
    const subs = await svc.getSubscriptions('push-user')
    expect(subs).toHaveLength(2)
    expect(subs.find((s) => s.endpoint === 'e1')?.keys.p256dh).toBe('a2')
    expect(subs.find((s) => s.endpoint === 'e1')?.topics).toEqual(['critical'])
  })

  it('removePushSubscription removes endpoint and deletes user when last', async () => {
    await svc.savePushSubscription('u2', { endpoint: 'e3', keys: { p256dh: 'x', auth: 'y' } })
    const result = await svc.removePushSubscription('e3')
    expect(result).toMatchObject({ success: true, userId: 'u2', total: 0 })
    expect(await svc.getSubscriptions('u2')).toEqual([])
  })

  it('removePushSubscription returns not-found for unknown endpoint', async () => {
    const result = await svc.removePushSubscription('nope')
    expect(result).toMatchObject({ success: false, reason: 'not-found' })
  })

  it('getVapidPublicKey prefers env var over demo key', () => {
    const prev = process.env.VAPID_PUBLIC_KEY
    const prevNodeEnv = process.env.NODE_ENV
    process.env.VAPID_PUBLIC_KEY = 'custom-public-key'
    expect(svc.getVapidPublicKey()).toBe('custom-public-key')
    delete process.env.VAPID_PUBLIC_KEY
    process.env.NODE_ENV = 'development'
    const devKey = svc.getVapidPublicKey()
    expect(devKey).toBeTruthy()
    expect(devKey!.length).toBeGreaterThan(20)
    if (prev === undefined) delete process.env.VAPID_PUBLIC_KEY
    else process.env.VAPID_PUBLIC_KEY = prev
    process.env.NODE_ENV = prevNodeEnv ?? 'test'
  })

  it('getVapidPublicKey returns null in production without env key', () => {
    const prev = process.env.VAPID_PUBLIC_KEY
    const prevNodeEnv = process.env.NODE_ENV
    delete process.env.VAPID_PUBLIC_KEY
    process.env.NODE_ENV = 'production'
    expect(svc.getVapidPublicKey()).toBeNull()
    if (prev === undefined) delete process.env.VAPID_PUBLIC_KEY
    else process.env.VAPID_PUBLIC_KEY = prev
    process.env.NODE_ENV = prevNodeEnv ?? 'test'
  })

  it('getVapidPublicKey returns env key in production', () => {
    const prev = process.env.VAPID_PUBLIC_KEY
    const prevNodeEnv = process.env.NODE_ENV
    process.env.VAPID_PUBLIC_KEY = 'prod-public-key'
    process.env.NODE_ENV = 'production'
    expect(svc.getVapidPublicKey()).toBe('prod-public-key')
    if (prev === undefined) delete process.env.VAPID_PUBLIC_KEY
    else process.env.VAPID_PUBLIC_KEY = prev
    process.env.NODE_ENV = prevNodeEnv ?? 'test'
  })

  it('getUnreadCount returns 0 when prisma model missing', async () => {
    const bare = new NotificationsService({} as any)
    await expect(bare.getUnreadCount('u1')).resolves.toEqual({ userId: 'u1', unread: 0 })
  })

  it('getHistory returns [] when prisma model missing', async () => {
    const bare = new NotificationsService({} as any)
    await expect(bare.getHistory('u1')).resolves.toEqual([])
  })

  it('markRead returns null when prisma model missing', async () => {
    const bare = new NotificationsService({} as any)
    await expect(bare.markRead('n1')).resolves.toBeNull()
  })

  it('create returns in-memory notification when model missing', async () => {
    const bare = new NotificationsService({} as any)
    const r = await bare.create({ userId: 'u1', type: 'SYSTEM', severity: 'WARN', title: 't', content: 'c', link: 'l', targetId: 'tg' })
    expect(r.id).toMatch(/^mock-\d+/)
    expect(r).toMatchObject({ userId: 'u1', type: 'SYSTEM', severity: 'WARN', read: false })
  })

  it('sendPush returns no-subscription when user has none', async () => {
    const result = await svc.sendPush('ghost', { title: 't', content: 'c' })
    expect(result).toMatchObject({ success: false, reason: 'no-subscription' })
  })

  it('sendPush returns web-push-not-installed when web-push module absent', async () => {
    await svc.savePushSubscription('push-send-user', { endpoint: 'https://push.example.com/x', keys: { p256dh: 'a', auth: 'b' } })
    const result = await svc.sendPush('push-send-user', { title: 't', content: 'c' })
    expect(result).toMatchObject({ success: false, reason: 'web-push-not-installed' })
  })

  it('sendPush refuses demo VAPID keys in production', async () => {
    const prevNodeEnv = process.env.NODE_ENV
    const prevPub = process.env.VAPID_PUBLIC_KEY
    const prevPriv = process.env.VAPID_PRIVATE_KEY
    delete process.env.VAPID_PUBLIC_KEY
    delete process.env.VAPID_PRIVATE_KEY
    process.env.NODE_ENV = 'production'
    await svc.savePushSubscription('prod-push-user', { endpoint: 'https://push.example.com/y', keys: { p256dh: 'a', auth: 'b' } })
    const result = await svc.sendPush('prod-push-user', { title: 't', content: 'c' })
    expect(result).toMatchObject({ success: false, reason: 'vapid-not-configured' })
    if (prevPub === undefined) delete process.env.VAPID_PUBLIC_KEY
    else process.env.VAPID_PUBLIC_KEY = prevPub
    if (prevPriv === undefined) delete process.env.VAPID_PRIVATE_KEY
    else process.env.VAPID_PRIVATE_KEY = prevPriv
    process.env.NODE_ENV = prevNodeEnv ?? 'test'
  })

  it('markAllRead updates all unread for user', async () => {
    mockPrisma.notification.updateMany = jest.fn().mockResolvedValue({ count: 4 })
    const result = await svc.markAllRead('u1')
    expect(result).toEqual({ userId: 'u1', count: 4 })
    expect(mockPrisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', read: false },
      data: { read: true, readAt: expect.any(Date) },
    })
  })

  it('markAllRead returns 0 when prisma model missing', async () => {
    const bare = new NotificationsService({} as any)
    await expect(bare.markAllRead('u1')).resolves.toEqual({ userId: 'u1', count: 0 })
  })

  it('remove deletes a notification', async () => {
    mockPrisma.notification.delete = jest.fn().mockResolvedValue({ id: 'n1' })
    const result = await svc.remove('n1')
    expect(result).toEqual({ id: 'n1', deleted: true })
    expect(mockPrisma.notification.delete).toHaveBeenCalledWith({ where: { id: 'n1' } })
  })

  it('remove returns deleted false when prisma model missing', async () => {
    const bare = new NotificationsService({} as any)
    await expect(bare.remove('n1')).resolves.toEqual({ id: 'n1', deleted: false })
  })

  it('getStats aggregates total/unread/today/critical', async () => {
    mockPrisma.notification.count = jest
      .fn()
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(1)
    const result = await svc.getStats('u1')
    expect(result).toEqual({ userId: 'u1', total: 20, unread: 3, today: 5, critical: 1 })
    expect(mockPrisma.notification.count).toHaveBeenCalledWith({ where: { userId: 'u1' } })
    expect(mockPrisma.notification.count).toHaveBeenCalledWith({ where: { userId: 'u1', read: false } })
    expect(mockPrisma.notification.count).toHaveBeenCalledWith({ where: { userId: 'u1', createdAt: { gte: expect.any(Date) } } })
    expect(mockPrisma.notification.count).toHaveBeenCalledWith({ where: { userId: 'u1', severity: 'CRITICAL', read: false } })
  })

  it('getStats returns zeros when prisma model missing', async () => {
    const bare = new NotificationsService({} as any)
    await expect(bare.getStats('u1')).resolves.toEqual({ userId: 'u1', total: 0, unread: 0, today: 0, critical: 0 })
  })

  // [v3.0.6.11-99 Wave7B] 站内信/推送订阅类型 (GET/PUT /notifications/subscriptions/:userId)
  describe('subscription config', () => {
    it('returns default all types when never set', () => {
      const res = svc.getSubscriptionConfig('u-sub-1')
      expect(res.defaulted).toBe(true)
      expect(res.types).toEqual(['CRITICAL', 'REPORT', 'FOLLOWUP', 'QUALITY', 'SYSTEM'])
    })

    it('updates subscription types and persists per user', () => {
      const updated = svc.updateSubscriptionConfig('u-sub-1', ['CRITICAL', 'REPORT', 'SYSTEM'])
      expect(updated.types).toEqual(['CRITICAL', 'REPORT', 'SYSTEM'])
      const res = svc.getSubscriptionConfig('u-sub-1')
      expect(res.defaulted).toBe(false)
      expect(res.types).toEqual(['CRITICAL', 'REPORT', 'SYSTEM'])
    })

    it('dedupes and ignores unknown types, resets to default when empty', () => {
      const updated = svc.updateSubscriptionConfig('u-sub-2', ['CRITICAL', 'CRITICAL', 'HACK', 'FOLLOWUP'])
      expect(updated.types).toEqual(['CRITICAL', 'FOLLOWUP'])
      const empty = svc.updateSubscriptionConfig('u-sub-2', [])
      expect(empty.types).toEqual(['CRITICAL', 'REPORT', 'FOLLOWUP', 'QUALITY', 'SYSTEM'])
    })

    it('keeps per-user isolation', () => {
      svc.updateSubscriptionConfig('u-a', ['QUALITY'])
      svc.updateSubscriptionConfig('u-b', ['SYSTEM'])
      expect(svc.getSubscriptionConfig('u-a').types).toEqual(['QUALITY'])
      expect(svc.getSubscriptionConfig('u-b').types).toEqual(['SYSTEM'])
    })
  })
})
