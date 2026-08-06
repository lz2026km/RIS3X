/**
 * G005 放射RIS系统 v3.0.6.11-75 (W4-2) - 实时推送客户端 (socket.io)
 *
 *  - 单例 socket, 懒连接 + 自动重连 (指数退避, socket.io 内置)
 *  - JWT 从内存 TokenStore 读取 (utils/auth.getToken), 回退 localStorage 兼容键
 *  - 事件订阅: notify / worklist-refresh / yjs:* / connect / disconnect / error
 *  - 后端不可达时静默降级: 页面保留轮询兜底
 */
import { io, type Socket } from 'socket.io-client'
import { API_BASE } from './api/client'
import { getToken } from '../utils/auth'

export type RealtimeEvent =
  | 'notify'
  | 'worklist-refresh'
  | 'yjs:sync'
  | 'yjs:join'
  | 'yjs:leave'
  | 'connect'
  | 'disconnect'
  | 'connect_error'
  | 'error'

export interface RealtimePayload {
  event?: string
  type?: string
  action?: string
  title?: string
  content?: string
  notification?: Record<string, unknown> | null
  timestamp?: number
  [key: string]: unknown
}

export type RealtimeHandler = (payload: RealtimePayload) => void
export type RealtimeStateHandler = (payload?: RealtimePayload) => void

const RECONNECT_DELAY_MS = 1000
const RECONNECT_DELAY_MAX_MS = 30_000

function resolveSocketUrl(): string {
  if (typeof window === 'undefined') return ''
  if (API_BASE.startsWith('http')) {
    try {
      return new URL(API_BASE).origin
    } catch {
      /* fallthrough */
    }
  }
  return window.location.origin
}

function resolveToken(): string | null {
  const inMemory = getToken()
  if (inMemory) return inMemory
  try {
    for (const key of ['ris_access_token', 'ris_token']) {
      const raw = window.localStorage.getItem(key)
      if (raw) return raw
    }
  } catch {
    /* ignore */
  }
  return null
}

interface RealtimeClient {
  connect(): void
  disconnect(): void
  isConnected(): boolean
  subscribe(event: RealtimeEvent, handler: RealtimeHandler | RealtimeStateHandler): () => void
  emit(event: RealtimeEvent, payload?: unknown): boolean
  getSocket(): Socket | null
}

class SocketRealtimeClient implements RealtimeClient {
  private socket: Socket | null = null
  private handlers = new Map<RealtimeEvent, Set<RealtimeHandler | RealtimeStateHandler>>()
  private connected = false
  private started = false

  private ensureSocket(): Socket | null {
    if (this.socket) return this.socket
    const url = resolveSocketUrl()
    if (!url) return null
    const token = resolveToken()
    this.socket = io(url, {
      auth: token ? { token } : {},
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: RECONNECT_DELAY_MS,
      reconnectionDelayMax: RECONNECT_DELAY_MAX_MS,
      randomizationFactor: 0.5,
      timeout: 10_000,
    })
    const s = this.socket
    s.on('connect', () => {
      this.connected = true
      this.dispatch('connect', { type: 'connect', timestamp: Date.now() })
    })
    s.on('disconnect', () => {
      this.connected = false
      this.dispatch('disconnect', { type: 'disconnect', timestamp: Date.now() })
    })
    s.on('connect_error', (err) => {
      this.dispatch('connect_error', { type: 'connect_error', content: err?.message, timestamp: Date.now() })
    })
    s.on('error', (payload) => {
      this.dispatch('error', (payload ?? {}) as RealtimePayload)
    })
    s.on('notify', (payload) => this.dispatch('notify', payload as RealtimePayload))
    s.on('worklist-refresh', (payload) => this.dispatch('worklist-refresh', payload as RealtimePayload))
    s.on('yjs:sync', (payload) => this.dispatch('yjs:sync', payload as RealtimePayload))
    s.on('yjs:join', (payload) => this.dispatch('yjs:join', payload as RealtimePayload))
    s.on('yjs:leave', (payload) => this.dispatch('yjs:leave', payload as RealtimePayload))
    return s
  }

  private dispatch(event: RealtimeEvent, payload: RealtimePayload | undefined): void {
    const set = this.handlers.get(event)
    if (!set) return
    for (const h of Array.from(set)) {
      try {
        ;(h as (p?: RealtimePayload) => void)(payload)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(`[realtime] handler error on "${event}"`, err)
      }
    }
  }

  connect(): void {
    if (this.started) return
    this.started = true
    this.ensureSocket()
  }

  disconnect(): void {
    this.started = false
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected
  }

  subscribe(event: RealtimeEvent, handler: RealtimeHandler | RealtimeStateHandler): () => void {
    let set = this.handlers.get(event)
    if (!set) {
      set = new Set()
      this.handlers.set(event, set)
    }
    set.add(handler)
    return () => {
      set?.delete(handler)
    }
  }

  emit(event: RealtimeEvent, payload?: unknown): boolean {
    const s = this.socket
    if (!s || !this.connected) return false
    s.emit(event, payload)
    return true
  }

  getSocket(): Socket | null {
    return this.socket
  }
}

export const realtime: RealtimeClient = new SocketRealtimeClient()
export default realtime
