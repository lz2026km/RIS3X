/**
 * G005 放射RIS系统 v3.0.2.2 - 通知 WebSocket Gateway(简化)
 * 真实实装需 @nestjs/websockets + socket.io
 * 此处用纯 Node EventEmitter 模拟推送,便于测试
 *
 * v3.0.6.11-7: 添加 Yjs 协同编辑消息转发端点
 */
import { Injectable, Logger } from '@nestjs/common'
import { NotificationsService } from './notifications.service'

@Injectable()
export class NotificationsGateway {
  private readonly logger = new Logger(NotificationsGateway.name)
  private listeners = new Map<string, Array<(payload: any) => void>>()
  // Yjs 房间订阅: roomId -> Set<userId>
  private yjsRooms = new Map<string, Set<string>>()
  // Yjs 房间消息缓冲区
  private yjsMessageBuffer = new Map<string, Array<{ userId: string; data: Uint8Array; timestamp: number }>>()

  constructor(private readonly service: NotificationsService) {}

  /**
   * 订阅用户通知流
   */
  subscribe(userId: string, cb: (payload: any) => void) {
    if (!this.listeners.has(userId)) {
      this.listeners.set(userId, [])
    }
    this.listeners.get(userId)!.push(cb)
    return () => {
      const arr = this.listeners.get(userId) ?? []
      this.listeners.set(
        userId,
        arr.filter((x) => x !== cb)
      )
    }
  }

  /**
   * 推送通知(由 service.create 触发)
   */
  push(userId: string, notification: any) {
    const subs = this.listeners.get(userId) ?? []
    subs.forEach((cb) => {
      try {
        cb(notification)
      } catch (e) {
        this.logger.error('push failed', e)
      }
    })
    this.logger.log(`pushed to userId=${userId} count=${subs.length}`)
  }

  /**
   * 广播
   */
  broadcastAll(userIds: string[], notification: any) {
    userIds.forEach((u) => this.push(u, notification))
  }

  // ──────────── Yjs 协同编辑转发 ────────────

  /**
   * 用户加入 Yjs 房间
   */
  joinYjsRoom(roomId: string, userId: string) {
    if (!this.yjsRooms.has(roomId)) {
      this.yjsRooms.set(roomId, new Set())
    }
    this.yjsRooms.get(roomId)!.add(userId)
    this.logger.log(`Yjs: user=${userId} joined room=${roomId}`)
    this.broadcastYjsRoom(roomId, {
      type: 'yjs:join',
      userId,
      roomId,
      timestamp: Date.now(),
    })
  }

  /**
   * 用户离开 Yjs 房间
   */
  leaveYjsRoom(roomId: string, userId: string) {
    const room = this.yjsRooms.get(roomId)
    if (room) {
      room.delete(userId)
      if (room.size === 0) {
        this.yjsRooms.delete(roomId)
        this.yjsMessageBuffer.delete(roomId)
      }
    }
    this.logger.log(`Yjs: user=${userId} left room=${roomId}`)
    this.broadcastYjsRoom(roomId, {
      type: 'yjs:leave',
      userId,
      roomId,
      timestamp: Date.now(),
    })
  }

  /**
   * 转发 Yjs 同步消息给房间内其他用户
   */
  relayYjsMessage(roomId: string, senderId: string, data: Uint8Array) {
    const room = this.yjsRooms.get(roomId)
    if (!room) return

    // 缓存消息用于滞后加入者
    if (!this.yjsMessageBuffer.has(roomId)) {
      this.yjsMessageBuffer.set(roomId, [])
    }
    const buffer = this.yjsMessageBuffer.get(roomId)!
    buffer.push({ userId: senderId, data, timestamp: Date.now() })
    // 仅保留最近 50 条
    if (buffer.length > 50) buffer.splice(0, buffer.length - 50)

    room.forEach((targetId) => {
      if (targetId !== senderId) {
        this.push(targetId, {
          type: 'yjs:sync',
          roomId,
          senderId,
          data: Array.from(data),
        })
      }
    })
  }

  /**
   * 获取 Yjs 房间的在线用户
   */
  getYjsRoomUsers(roomId: string): string[] {
    return Array.from(this.yjsRooms.get(roomId) ?? [])
  }

  /**
   * 获取 Yjs 房间消息历史（滞后加入者同步）
   */
  getYjsRoomHistory(roomId: string) {
    return this.yjsMessageBuffer.get(roomId) ?? []
  }

  private broadcastYjsRoom(roomId: string, payload: any) {
    const room = this.yjsRooms.get(roomId)
    if (room) {
      room.forEach((uid) => this.push(uid, payload))
    }
  }
}
