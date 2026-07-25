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
})
