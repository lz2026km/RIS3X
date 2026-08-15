/**
 * G005 放射RIS系统 v3.0.6.11-75 (W4-2) - 通知 WebSocket Gateway (真实 socket.io)
 *
 * 实装 @nestjs/websockets + socket.io:
 *  - 连接鉴权: JWT 从 handshake.auth.token / query.token / Authorization header 解析,
 *    复用 jwt.strategy 的校验逻辑 (HS256 + tokenVersion + active), 无 token 或非法 token 拒绝连接
 *  - 房间: 每用户个人房间 notifications:user:{id} + 全局房间 notifications:global
 *  - 事件: notify (新通知/危急值/报告状态), worklist-refresh (工作列表变化)
 *  - Yjs 协同房间转发保留: joinYjsRoom / relayYjsMessage / 房间用户 & 历史
 *
 * 兼容旧 API: push / broadcastAll / subscribe (FHIR 服务仍依赖 gateway.push('*', ...))
 */
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets'
import { Logger, Optional, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { Server, Socket } from 'socket.io'
import { PrismaService } from '../prisma/prisma.service'
import { StatsService } from '../modules/stats/stats.service'

export interface YjsBufferedMessage {
  userId: string
  data: Uint8Array
  timestamp: number
}

interface GatewayAuthUser {
  sub: string
  username: string
  role: string
  tenantId: string
  totpPending: boolean
}

const ROOM_PREFIX = 'notifications:user:'
const GLOBAL_ROOM = 'notifications:global'
const YJS_ROOM_PREFIX = 'yjs:'
const OPS_PUSH_INTERVAL_MS = 30_000

/**
 * [G005 Wave3A G-23] BI ops-update 快照载荷 (kpi + occupancy)
 */
export interface OpsSnapshotDto {
  event: 'ops-update'
  type: 'ops-update'
  timestamp: number
  kpi: { examsToday: number; reportsToday: number; criticalsToday: number; onlineUsers: number }
  occupancy: { modality: string; utilization: number; count: number }[]
}

/**
 * 无操作网关: 供单元测试/无 socket 场景注入 (push/broadcast 全部静默)
 */
export function createNoopGateway(): NotificationsGateway {
  const noop = {
    push: () => undefined,
    broadcastAll: () => undefined,
    emitToUser: () => undefined,
    emitWorklistRefresh: () => undefined,
    emitRoomStatusRefresh: () => undefined,
    emitOpsUpdate: () => undefined,
    subscribe: () => () => undefined,
    joinYjsRoom: () => undefined,
    leaveYjsRoom: () => undefined,
    relayYjsMessage: () => undefined,
    getYjsRoomUsers: () => [] as string[],
    getYjsRoomHistory: () => [] as YjsBufferedMessage[],
  }
  return noop as unknown as NotificationsGateway
}

@WebSocketGateway({
  namespace: '/',
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
})
export class NotificationsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationsGateway.name)

  @WebSocketServer()
  server!: Server

  // 旧版 in-memory 订阅 (兼容 FHIR 等同步调用方)
  private listeners = new Map<string, Array<(payload: any) => void>>()
  // Yjs 房间: roomId -> Set<userId> (在线用户, 由 joinYjsRoom 维护)
  private yjsRooms = new Map<string, Set<string>>()
  // Yjs 房间消息缓冲区 (滞后加入者同步, 保留最近 50 条)
  private yjsMessageBuffer = new Map<string, YjsBufferedMessage[]>()
  // socketId -> userId (断线清理用)
  private readonly socketUser = new Map<string, string>()
  // [G005 Wave3A G-23] ops 快照定时器 (30s)
  private opsTimer: NodeJS.Timeout | null = null

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Optional() private readonly statsService?: StatsService,
  ) {}

  afterInit(server: Server): void {
    this.server = server
    this.logger.log('Real-time WebSocket Gateway (socket.io) initialized')
    // [G005 Wave3A G-23] BI 定时推送: 30s 一次 ops 快照 (无 StatsService 注入时跳过, 如单测)
    if (this.statsService) {
      void this.pushOpsSnapshot()
      this.opsTimer = setInterval(() => void this.pushOpsSnapshot(), OPS_PUSH_INTERVAL_MS)
      this.opsTimer.unref?.()
      this.logger.log(`ops-update snapshot timer started (every ${OPS_PUSH_INTERVAL_MS / 1000}s)`)
    }
  }

  onModuleDestroy(): void {
    if (this.opsTimer) {
      clearInterval(this.opsTimer)
      this.opsTimer = null
    }
  }

  // ──────────── 连接鉴权 ────────────

  /**
   * 解析并校验 JWT (复用 jwt.strategy 逻辑: HS256 + sub/tokenVersion + 用户 active)
   * 支持 handshake.auth.token / query.token / Authorization: Bearer xxx
   */
  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client)
      if (!token) throw new UnauthorizedException('缺少访问令牌 (auth.token / query.token / Authorization)')
      const user = await this.authenticate(token)
      client.data.userId = user.sub
      client.data.username = user.username
      client.data.role = user.role
      client.data.tenantId = user.tenantId
      this.socketUser.set(client.id, user.sub)
      await client.join(GLOBAL_ROOM)
      await client.join(`${ROOM_PREFIX}${user.sub}`)
      this.logger.log(`socket connected userId=${user.sub} socketId=${client.id}`)
    } catch (e) {
      const message = e instanceof Error ? e.message : '鉴权失败'
      this.logger.warn(`socket auth rejected: ${message} (socketId=${client.id})`)
      client.emit('error', { code: 'UNAUTHORIZED', message: `连接被拒绝: ${message}` })
      client.disconnect(true)
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const userId = client.data?.userId as string | undefined
    if (userId) {
      this.logger.log(`socket disconnected userId=${userId} socketId=${client.id}`)
    }
    this.socketUser.delete(client.id)
  }

  private extractToken(client: Socket): string | null {
    const auth = (client.handshake.auth ?? {}) as Record<string, unknown>
    const query = (client.handshake.query ?? {}) as Record<string, unknown>
    const headerAuth = client.handshake.headers?.authorization
    const candidates: unknown[] = [
      auth.token,
      query.token,
      typeof headerAuth === 'string' ? headerAuth.replace(/^Bearer\s+/i, '') : undefined,
    ]
    for (const c of candidates) {
      if (typeof c === 'string' && c.trim().length > 0) return c.trim()
    }
    return null
  }

  private async authenticate(token: string): Promise<GatewayAuthUser> {
    const secret = this.config.get<string>('JWT_SECRET')
    if (!secret) throw new UnauthorizedException('服务端 JWT_SECRET 未配置')
    let payload: { sub?: string; tokenVersion?: number; totpPending?: boolean }
    try {
      payload = await this.jwtService.verifyAsync(token, { secret, algorithms: ['HS256'] })
    } catch {
      throw new UnauthorizedException('Token 无效或已过期')
    }
    if (!payload?.sub || !Number.isInteger(payload.tokenVersion)) {
      throw new UnauthorizedException('无效 Token 载荷')
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { username: true, role: true, tenantId: true, tokenVersion: true, active: true },
    })
    if (!user || !user.active) throw new UnauthorizedException('用户不存在或已停用')
    if (user.tokenVersion !== payload.tokenVersion) {
      throw new UnauthorizedException('Token 已过期，请重新登录')
    }
    return {
      sub: payload.sub,
      username: user.username,
      role: user.role,
      tenantId: user.tenantId,
      totpPending: payload.totpPending === true,
    }
  }

  // ──────────── 服务端推送 (HTTP 层调用) ────────────

  /**
   * 推送单用户 (旧 API 兼容): userId === '*' 时推送到全局房间
   */
  push(userId: string, payload: any): void {
    if (this.server) {
      if (userId === '*') {
        this.server.to(GLOBAL_ROOM).emit('notify', payload)
      } else {
        this.server.to(`${ROOM_PREFIX}${userId}`).emit('notify', payload)
      }
    }
    const subs = this.listeners.get(userId) ?? []
    subs.forEach((cb) => {
      try {
        cb(payload)
      } catch (e) {
        this.logger.error('push (legacy listener) failed', e)
      }
    })
    this.logger.log(`pushed to userId=${userId} sockets=online listeners=${subs.length}`)
  }

  broadcastAll(userIds: string[], payload: any): void {
    userIds.forEach((u) => this.push(u, payload))
  }

  /**
   * 向用户房间推送任意事件
   */
  emitToUser(userId: string, event: string, payload: any): void {
    if (!this.server) return
    if (userId === '*') {
      this.server.to(GLOBAL_ROOM).emit(event, payload)
    } else {
      this.server.to(`${ROOM_PREFIX}${userId}`).emit(event, payload)
    }
  }

  /**
   * 工作列表变化推送: 默认广播给所有在线用户, 可指定目标用户
   */
  emitWorklistRefresh(userId?: string): void {
    const payload = { type: 'worklist-refresh', timestamp: Date.now() }
    if (userId) {
      this.emitToUser(userId, 'worklist-refresh', payload)
    } else {
      this.server?.to(GLOBAL_ROOM).emit('worklist-refresh', payload)
      this.logger.log(`worklist-refresh broadcast to global room`)
    }
  }

  /**
   * [v3.0.6.11-100 Wave 1B] 检查间实时状态看板推送: 工作列表变化 → 房间看板客户端重新拉取
   */
  emitRoomStatusRefresh(): void {
    const payload = { type: 'room-status-refresh', timestamp: Date.now() }
    this.server?.to(GLOBAL_ROOM).emit('room-status-refresh', payload)
    this.logger.log('room-status-refresh broadcast to global room')
  }

  // ──────────── [G005 Wave3A G-23] BI ops-update 推送 ────────────

  /**
   * 推送 ops 快照到全局房间 (RealtimeOpsDashboard 订阅)
   */
  emitOpsUpdate(payload: OpsSnapshotDto): void {
    this.server?.to(GLOBAL_ROOM).emit('ops-update', payload)
    const subs = this.listeners.get('*') ?? []
    subs.forEach((cb) => {
      try {
        cb(payload)
      } catch (e) {
        this.logger.error('ops-update (legacy listener) failed', e)
      }
    })
    this.logger.log(`ops-update pushed to global room (online=${payload.kpi.onlineUsers})`)
  }

  /**
   * 定时构建 ops 快照: kpi (今日检查/报告/危急值/在线用户) + occupancy (模态利用率)
   */
  private async pushOpsSnapshot(): Promise<void> {
    if (!this.server || !this.statsService) return
    try {
      const onlineUsers = this.server.sockets.sockets.size
      const [daily, byModality, dashboard] = await Promise.all([
        this.statsService.getDaily(),
        this.statsService.getByModality(),
        this.statsService.getDashboardData(),
      ])
      const occupancy = Object.entries(byModality?.data ?? {}).map(([modality, st]) => ({
        modality,
        utilization: Math.min(100, Math.round(Number((st as { avg?: number }).avg ?? 0) * 100 / 12)),
        count: Number((st as { total?: number }).total ?? 0),
      }))
      const snapshot: OpsSnapshotDto = {
        event: 'ops-update',
        type: 'ops-update',
        timestamp: Date.now(),
        kpi: {
          examsToday: daily?.data?.examCount ?? dashboard?.data?.today?.exams ?? 0,
          reportsToday: daily?.data?.reportCount ?? dashboard?.data?.today?.reports ?? 0,
          criticalsToday: daily?.data?.criticalCount ?? dashboard?.data?.today?.critical ?? 0,
          onlineUsers,
        },
        occupancy,
      }
      this.emitOpsUpdate(snapshot)
    } catch (e) {
      this.logger.warn(`ops-update snapshot failed: ${(e as Error).message}`)
    }
  }

  /**
   * 旧 API: 内存订阅 (兼容同步调用方)
   */
  subscribe(userId: string, cb: (payload: any) => void): () => void {
    if (!this.listeners.has(userId)) this.listeners.set(userId, [])
    this.listeners.get(userId)!.push(cb)
    return () => {
      const arr = this.listeners.get(userId) ?? []
      this.listeners.set(userId, arr.filter((x) => x !== cb))
    }
  }

  // ──────────── Yjs 协同编辑转发 ────────────

  @SubscribeMessage('yjs:join')
  async onYjsJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId?: string },
  ): Promise<{ users: string[]; history: YjsBufferedMessage[] }> {
    const userId = this.requireUserId(client)
    const roomId = this.requireRoomId(body?.roomId)
    await client.join(`${YJS_ROOM_PREFIX}${roomId}`)
    if (!this.yjsRooms.has(roomId)) this.yjsRooms.set(roomId, new Set())
    this.yjsRooms.get(roomId)!.add(userId)
    client.to(`${YJS_ROOM_PREFIX}${roomId}`).emit('yjs:join', {
      type: 'yjs:join',
      userId,
      roomId,
      timestamp: Date.now(),
    })
    this.logger.log(`Yjs: user=${userId} joined room=${roomId}`)
    return { users: this.getYjsRoomUsers(roomId), history: this.getYjsRoomHistory(roomId) }
  }

  @SubscribeMessage('yjs:leave')
  async onYjsLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId?: string },
  ): Promise<void> {
    const userId = this.requireUserId(client)
    const roomId = this.requireRoomId(body?.roomId)
    this.leaveYjsRoomInternal(client, roomId, userId)
  }

  @SubscribeMessage('yjs:sync')
  async onYjsSync(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { roomId?: string; data?: unknown },
  ): Promise<void> {
    const userId = this.requireUserId(client)
    const roomId = this.requireRoomId(body?.roomId)
    const data = this.toUint8Array(body?.data)
    this.bufferYjsMessage(roomId, userId, data)
    client.to(`${YJS_ROOM_PREFIX}${roomId}`).emit('yjs:sync', {
      type: 'yjs:sync',
      roomId,
      senderId: userId,
      data,
      timestamp: Date.now(),
    })
  }

  @SubscribeMessage('yjs:users')
  onYjsUsers(@MessageBody() body: { roomId?: string }): { users: string[] } {
    return { users: this.getYjsRoomUsers(this.requireRoomId(body?.roomId)) }
  }

  @SubscribeMessage('yjs:history')
  onYjsHistory(@MessageBody() body: { roomId?: string }): { history: YjsBufferedMessage[] } {
    return { history: this.getYjsRoomHistory(this.requireRoomId(body?.roomId)) }
  }

  /** 旧 API: 用户加入 Yjs 房间 (由 HTTP 层调用) */
  joinYjsRoom(roomId: string, userId: string): void {
    if (!this.yjsRooms.has(roomId)) this.yjsRooms.set(roomId, new Set())
    this.yjsRooms.get(roomId)!.add(userId)
    this.logger.log(`Yjs(HTTP): user=${userId} joined room=${roomId}`)
    this.broadcastYjsRoom(roomId, {
      type: 'yjs:join',
      userId,
      roomId,
      timestamp: Date.now(),
    })
  }

  /** 旧 API: 用户离开 Yjs 房间 */
  leaveYjsRoom(roomId: string, userId: string): void {
    const room = this.yjsRooms.get(roomId)
    if (room) {
      room.delete(userId)
      if (room.size === 0) {
        this.yjsRooms.delete(roomId)
        this.yjsMessageBuffer.delete(roomId)
      }
    }
    this.logger.log(`Yjs(HTTP): user=${userId} left room=${roomId}`)
    this.broadcastYjsRoom(roomId, {
      type: 'yjs:leave',
      userId,
      roomId,
      timestamp: Date.now(),
    })
  }

  /** 旧 API: 转发 Yjs 同步消息给房间内其他用户 */
  relayYjsMessage(roomId: string, senderId: string, data: Uint8Array): void {
    const room = this.yjsRooms.get(roomId)
    if (!room) return
    this.bufferYjsMessage(roomId, senderId, data)
    room.forEach((targetId) => {
      if (targetId !== senderId) {
        this.emitToUser(targetId, 'yjs:sync', {
          type: 'yjs:sync',
          roomId,
          senderId,
          data: Array.from(data),
        })
      }
    })
  }

  /** 旧 API: 在线用户列表 */
  getYjsRoomUsers(roomId: string): string[] {
    return Array.from(this.yjsRooms.get(roomId) ?? [])
  }

  /** 旧 API: 房间消息历史 (滞后加入者同步) */
  getYjsRoomHistory(roomId: string): YjsBufferedMessage[] {
    return this.yjsMessageBuffer.get(roomId) ?? []
  }

  // ──────────── 内部工具 ────────────

  private requireUserId(client: Socket): string {
    const userId = client.data?.userId as string | undefined
    if (!userId) throw new WsException('未认证连接')
    return userId
  }

  private requireRoomId(roomId: unknown): string {
    if (typeof roomId !== 'string' || roomId.trim().length === 0) {
      throw new WsException('roomId 必填')
    }
    return roomId.trim()
  }

  private leaveYjsRoomInternal(client: Socket, roomId: string, userId: string): void {
    void client.leave(`${YJS_ROOM_PREFIX}${roomId}`)
    const room = this.yjsRooms.get(roomId)
    if (room) {
      room.delete(userId)
      if (room.size === 0) {
        this.yjsRooms.delete(roomId)
        this.yjsMessageBuffer.delete(roomId)
      }
    }
    client.to(`${YJS_ROOM_PREFIX}${roomId}`).emit('yjs:leave', {
      type: 'yjs:leave',
      userId,
      roomId,
      timestamp: Date.now(),
    })
    this.logger.log(`Yjs: user=${userId} left room=${roomId}`)
  }

  private bufferYjsMessage(roomId: string, userId: string, data: Uint8Array): void {
    if (!this.yjsMessageBuffer.has(roomId)) this.yjsMessageBuffer.set(roomId, [])
    const buffer = this.yjsMessageBuffer.get(roomId)!
    buffer.push({ userId, data, timestamp: Date.now() })
    if (buffer.length > 50) buffer.splice(0, buffer.length - 50)
  }

  private toUint8Array(data: unknown): Uint8Array {
    if (data instanceof Uint8Array) return data
    if (Array.isArray(data)) return Uint8Array.from(data)
    if (data instanceof ArrayBuffer) return new Uint8Array(data)
    if (Buffer.isBuffer(data)) return Uint8Array.from(data)
    return Uint8Array.from([])
  }

  private broadcastYjsRoom(roomId: string, payload: any): void {
    if (!this.server) return
    this.server.to(`${YJS_ROOM_PREFIX}${roomId}`).emit(payload.type ?? 'yjs:join', payload)
  }
}
