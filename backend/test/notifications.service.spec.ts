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
    const subs = svc.getSubscriptions('push-user')
    expect(subs).toHaveLength(2)
    expect(subs.find((s) => s.endpoint === 'e1')?.keys.p256dh).toBe('a2')
    expect(subs.find((s) => s.endpoint === 'e1')?.topics).toEqual(['critical'])
  })

  it('removePushSubscription removes endpoint and deletes user when last', async () => {
    await svc.savePushSubscription('u2', { endpoint: 'e3', keys: { p256dh: 'x', auth: 'y' } })
    const result = await svc.removePushSubscription('e3')
    expect(result).toMatchObject({ success: true, userId: 'u2', total: 0 })
    expect(svc.getSubscriptions('u2')).toEqual([])
  })

  it('removePushSubscription returns not-found for unknown endpoint', async () => {
    const result = await svc.removePushSubscription('nope')
    expect(result).toMatchObject({ success: false, reason: 'not-found' })
  })

  it('getVapidPublicKey prefers env var over demo key', () => {
    const prev = process.env.VAPID_PUBLIC_KEY
    process.env.VAPID_PUBLIC_KEY = 'custom-public-key'
    expect(svc.getVapidPublicKey()).toBe('custom-public-key')
    delete process.env.VAPID_PUBLIC_KEY
    expect(svc.getVapidPublicKey().length).toBeGreaterThan(20)
    if (prev === undefined) delete process.env.VAPID_PUBLIC_KEY
    else process.env.VAPID_PUBLIC_KEY = prev
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
})
