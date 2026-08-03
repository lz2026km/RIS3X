import { NotificationsService } from '../src/notifications/notifications.service'

jest.mock(
  'web-push',
  () => ({
    setVapidDetails: jest.fn(),
    sendNotification: jest.fn(),
  }),
  { virtual: true },
)

import * as webPush from 'web-push'

describe('NotificationsService push delivery (mocked web-push)', () => {
  let svc: NotificationsService

  const endpoint = 'https://fcm.example.com/push/abc'
  const keys = { p256dh: 'p256dh-value', auth: 'auth-value' }

  beforeAll(() => {
    svc = new NotificationsService({} as any)
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('delivers to all subscriptions and reports success', async () => {
    await svc.savePushSubscription('u1', { endpoint, keys })
    await svc.savePushSubscription('u1', { endpoint: 'https://fcm.example.com/push/def', keys })
    ;(webPush.sendNotification as jest.Mock).mockResolvedValue(undefined)
    const result = await svc.sendPush('u1', { title: '报告完成', content: '张三 CT 报告已生成', url: '/report/1', tag: 'tag1', requireInteraction: true })
    expect(webPush.setVapidDetails).toHaveBeenCalled()
    expect(webPush.sendNotification).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({ success: true, userId: 'u1', delivered: 2, total: 2 })
    expect(result.results).toHaveLength(2)
  })

  it('reports partial failure when one endpoint errors', async () => {
    await svc.savePushSubscription('partial-user', { endpoint: 'https://fcm.example.com/push/p1', keys })
    await svc.savePushSubscription('partial-user', { endpoint: 'https://fcm.example.com/push/p2', keys })
    ;(webPush.sendNotification as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce({ statusCode: 410 })
    const result = await svc.sendPush('partial-user', { title: 't', content: 'c' })
    expect(result.delivered).toBe(1)
    expect((result as any).results.find((r: any) => !r.ok)?.status).toBe(410)
  })

  it('returns vapid-config-error when setVapidDetails throws', async () => {
    await svc.savePushSubscription('vapid-user', { endpoint, keys })
    ;(webPush.setVapidDetails as jest.Mock).mockImplementation(() => {
      throw new Error('bad key')
    })
    const result = await svc.sendPush('vapid-user', { title: 't', content: 'c' })
    expect(result).toMatchObject({ success: false, reason: 'vapid-config-error' })
  })
})
