/**
 * G005 v3.0.6.11-75 (W4-2) - NotificationsGateway 真实 socket.io 集成测试
 * 用真实 socket.io server + client 验证:
 *  - JWT 鉴权 (缺失/非法 token 拒绝; 合法 token 进入用户房间)
 *  - push / emitWorklistRefresh 房间推送
 *  - Yjs 房间 join/sync 转发 + 历史/用户列表
 *  - 旧 API subscribe() 兼容
 */
import { createServer, Server as HttpServer } from 'http'
import { Server } from 'socket.io'
import { io as createClient, Socket as ClientSocket } from 'socket.io-client'
import { NotificationsGateway, createNoopGateway, YjsBufferedMessage } from './notifications.gateway'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe('NotificationsGateway (socket.io)', () => {
  let httpServer: HttpServer
  let ioServer: Server
  let gateway: NotificationsGateway
  let jwtMock: { verifyAsync: jest.Mock }
  let prismaMock: { user: { findUnique: jest.Mock } }

  const validPayload = { sub: 'u1', tokenVersion: 1, totpPending: false }

  beforeAll(async () => {
    jwtMock = { verifyAsync: jest.fn().mockResolvedValue(validPayload) }
    const configMock = { get: (key: string) => (key === 'JWT_SECRET' ? 'test-secret' : undefined) }
    prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          username: 'tester',
          role: 'DOCTOR',
          tenantId: 'default',
          tokenVersion: 1,
          active: true,
        }),
      },
    }
    gateway = new NotificationsGateway(jwtMock as any, configMock as any, prismaMock as any)

    httpServer = createServer()
    ioServer = new Server(httpServer, { cors: { origin: true } })
    // 模拟 Nest 的 socket.io 自动接线 (handleConnection + @SubscribeMessage 路由)
    ioServer.on('connection', (socket) => {
      void gateway.handleConnection(socket as any)
      socket.on('yjs:join', (body: any, ack?: (r: unknown) => void) => {
        gateway
          .onYjsJoin(socket as any, body ?? {})
          .then((r) => ack?.(r))
          .catch(() => ack?.({ error: 'bad-request' }))
      })
      socket.on('yjs:leave', (body: any, ack?: (r: unknown) => void) => {
        gateway
          .onYjsLeave(socket as any, body ?? {})
          .then((r) => ack?.(r))
          .catch(() => ack?.({ error: 'bad-request' }))
      })
      socket.on('yjs:sync', (body: any, ack?: (r: unknown) => void) => {
        gateway
          .onYjsSync(socket as any, body ?? {})
          .then((r) => ack?.(r))
          .catch(() => ack?.({ error: 'bad-request' }))
      })
    })
    await new Promise<void>((resolve) => httpServer.listen(0, resolve))
    gateway.afterInit(ioServer)
  })

  afterAll(async () => {
    ioServer.close()
    await new Promise<void>((resolve) => httpServer.close(() => resolve()))
  })

  afterEach(() => {
    jwtMock.verifyAsync.mockClear()
    prismaMock.user.findUnique.mockClear()
  })

  const url = () => `http://localhost:${(httpServer.address() as { port: number }).port}`
  const connect = async (token?: string, userId = 'u1'): Promise<ClientSocket> => {
    jwtMock.verifyAsync.mockResolvedValue({ sub: userId, tokenVersion: 1, totpPending: false })
    const client = createClient(url(), {
      auth: token ? { token } : {},
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    })
    await new Promise<void>((resolve, reject) => {
      client.on('connect', resolve)
      client.on('connect_error', (err) => reject(new Error(`connect_error: ${err.message}`)))
    })
    await sleep(50)
    return client
  }

  describe('鉴权', () => {
    it('拒绝无 token 连接', async () => {
      const client = createClient(url(), { transports: ['websocket'], forceNew: true, reconnection: false })
      await sleep(300)
      expect(client.connected).toBe(false)
      client.close()
    })

    it('拒绝非法 token (verifyAsync 抛错)', async () => {
      jwtMock.verifyAsync.mockRejectedValue(new Error('jwt expired'))
      const client = createClient(url(), {
        auth: { token: 'expired-token' },
        transports: ['websocket'],
        forceNew: true,
        reconnection: false,
      })
      await sleep(300)
      expect(client.connected).toBe(false)
      client.close()
    })

    it('接受合法 token 并建立连接', async () => {
      const client = await connect('valid-token', 'u1')
      expect(client.connected).toBe(true)
      client.close()
    })
  })

  describe('房间推送', () => {
    it('push(userId) 仅推送到目标用户房间', async () => {
      const target = await connect('t', 'u1')
      const other = await connect('t', 'u2')
      const received: unknown[] = []
      target.on('notify', (p: unknown) => received.push(p))
      const otherReceived: unknown[] = []
      other.on('notify', (p: unknown) => otherReceived.push(p))

      gateway.push('u1', { event: 'notify', type: 'notification', notification: { id: 'n1' } })
      await sleep(150)
      expect(received).toHaveLength(1)
      expect(otherReceived).toHaveLength(0)
      target.close()
      other.close()
    })

    it('emitWorklistRefresh 广播 worklist-refresh 到全局房间', async () => {
      const a = await connect('t', 'u1')
      const b = await connect('t', 'u2')
      const eventsA: unknown[] = []
      const eventsB: unknown[] = []
      a.on('worklist-refresh', (p: unknown) => eventsA.push(p))
      b.on('worklist-refresh', (p: unknown) => eventsB.push(p))

      gateway.emitWorklistRefresh()
      await sleep(150)
      expect(eventsA).toHaveLength(1)
      expect(eventsB).toHaveLength(1)
      a.close()
      b.close()
    })
  })

  describe('Yjs 协同房间', () => {
    it('join 后双方收到 yjs:join, sync 转发给房间内其他用户', async () => {
      const a = await connect('t', 'u1')
      const b = await connect('t', 'u2')

      const joinEventsOnA: unknown[] = []
      const joinEventsOnB: unknown[] = []
      const syncEventsOnB: unknown[] = []
      a.on('yjs:join', (p: unknown) => joinEventsOnA.push(p))
      b.on('yjs:join', (p: unknown) => joinEventsOnB.push(p))
      b.on('yjs:sync', (p: unknown) => syncEventsOnB.push(p))

      const joinAckA = await new Promise<{ users: string[]; history: YjsBufferedMessage[] }>((resolve, reject) => {
        a.emit('yjs:join', { roomId: 'r1' }, (r: unknown) => (r ? resolve(r as never) : reject(new Error('no ack'))))
      })
      await sleep(100)
      expect(joinAckA.users).toEqual(['u1'])

      const joinAckB = await new Promise<{ users: string[]; history: YjsBufferedMessage[] }>((resolve, reject) => {
        b.emit('yjs:join', { roomId: 'r1' }, (r: unknown) => (r ? resolve(r as never) : reject(new Error('no ack'))))
      })
      await sleep(100)
      expect(joinAckB.users).toContain('u1')
      expect(joinAckB.users).toContain('u2')
      // B 加入时广播给房间内其他成员 → A 收到 B 的 yjs:join 事件
      expect(joinEventsOnA.length).toBeGreaterThanOrEqual(1)
      expect(joinEventsOnB).toHaveLength(0)

      const payload = { roomId: 'r1', data: [1, 2, 3, 4] }
      await new Promise<void>((resolve) => {
        a.emit('yjs:sync', payload, () => resolve())
      })
      await sleep(150)
      expect(syncEventsOnB).toHaveLength(1)
      const sync = syncEventsOnB[0] as { senderId: string; data: number[] }
      expect(sync.senderId).toBe('u1')
      expect(Array.from(sync.data)).toEqual([1, 2, 3, 4])

      expect(gateway.getYjsRoomUsers('r1')).toEqual(expect.arrayContaining(['u1', 'u2']))
      expect(gateway.getYjsRoomHistory('r1')).toHaveLength(1)
      a.close()
      b.close()
    })

    it('旧 API relayYjsMessage / joinYjsRoom 兼容', async () => {
      const b = await connect('t', 'u2')
      const syncEventsOnB: unknown[] = []
      b.on('yjs:sync', (p: unknown) => syncEventsOnB.push(p))
      gateway.joinYjsRoom('r-http', 'u2')
      gateway.relayYjsMessage('r-http', 'u1', Uint8Array.from([9, 8, 7]))
      await sleep(150)
      expect(syncEventsOnB).toHaveLength(1)
      b.close()
    })
  })

  describe('旧 API subscribe() 兼容', () => {
    it('内存订阅回调仍可收到 push', () => {
      const received: unknown[] = []
      const unsubscribe = gateway.subscribe('legacy-user', (p) => received.push(p))
      gateway.push('legacy-user', { event: 'notify', type: 'notification' })
      expect(received).toHaveLength(1)
      unsubscribe()
      gateway.push('legacy-user', { event: 'notify', type: 'notification' })
      expect(received).toHaveLength(1)
    })
  })

  describe('createNoopGateway', () => {
    it('noop 网关调用不抛错', () => {
      const noop = createNoopGateway()
      expect(() => {
        noop.push('x', { a: 1 })
        noop.emitWorklistRefresh()
        noop.relayYjsMessage('r', 'u', Uint8Array.from([1]))
        noop.subscribe('x', () => undefined)
      }).not.toThrow()
      expect(noop.getYjsRoomUsers('r')).toEqual([])
      expect(noop.getYjsRoomHistory('r')).toEqual([])
    })
  })
})
