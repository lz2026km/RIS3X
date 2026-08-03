/**
 * G005 放射RIS系统 v3.0.6.11-53 - PWA Push Service (真实 Web Push)
 * Phase 1.5: 由 MockPushService 升级为真实实现
 *   - Notification API 权限
 *   - SW pushManager 订阅 (VAPID)
 *   - 订阅同步到后端 POST /notifications/push-subscribe
 *   - 本地通知展示
 * 测试 (pwa-b2.test.tsx) 在 jsdom 中无 Notification/PushManager, 自动降级为 unsupported
 */

import { API_BASE } from '../api/client'

export interface PushNotificationPayload {
  title: string
  body: string
  data?: Record<string, unknown>
  tag?: string
}

export interface PushSubscriptionInfo {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export interface IPushService {
  readonly supported: boolean
  subscribe(): Promise<PushSubscriptionInfo | null>
  unsubscribe(): Promise<boolean>
  sendLocalNotification(payload: PushNotificationPayload): void
}

const SW_URL = `${import.meta.env.BASE_URL}sw.js`
const STORAGE_KEY = 'g005-pwa-push-subscription'

function isSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(b64)
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function getVapidPublicKey(): Promise<string> {
  try {
    const res = await fetch(`${API_BASE}/notifications/vapid-public-key`, { method: 'GET' })
    if (!res.ok) throw new Error(`vapid-key ${res.status}`)
    const data = (await res.json()) as { publicKey?: string }
    if (data.publicKey) return data.publicKey
  } catch {
    // 后端不可达时回退到内置演示密钥
  }
  return 'BK-yELa-ndXqb0Qr5gdFEnEtYjaPWadKr25P1ApwdgNcbgtPIAaWdTwdwyy1eyP8ntlQSWM-XH5GK2Lk6S1hb88'
}

class WebPushService implements IPushService {
  private reg: ServiceWorkerRegistration | null = null

  get supported(): boolean {
    return isSupported()
  }

  private async getRegistration(): Promise<ServiceWorkerRegistration | null> {
    if (this.reg) return this.reg
    try {
      this.reg = await navigator.serviceWorker.register(SW_URL)
      return this.reg
    } catch {
      return null
    }
  }

  async subscribe(): Promise<PushSubscriptionInfo | null> {
    if (!this.supported) return null
    try {
      const perm = await Notification.requestPermission()
      if (perm !== 'granted') return null
      const reg = await this.getRegistration()
      if (!reg) return null
      const vapidKey = await getVapidPublicKey()
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      const json = sub.toJSON() as { p256dh?: string; auth?: string }
      const info: PushSubscriptionInfo = {
        endpoint: sub.endpoint,
        keys: { p256dh: json.p256dh ?? '', auth: json.auth ?? '' },
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(info))
      } catch {
        // localStorage 不可用时忽略
      }
      // 同步到后端 (异步, 失败不阻断)
      void fetch(`${API_BASE}/notifications/push-subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'demo-user', endpoint: info.endpoint, keys: info.keys }),
      }).catch(() => undefined)
      return info
    } catch {
      return null
    }
  }

  async unsubscribe(): Promise<boolean> {
    if (!this.supported) return true
    try {
      const reg = await this.getRegistration()
      if (reg) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          const endpoint = sub.endpoint
          await sub.unsubscribe()
          void fetch(`${API_BASE}/notifications/push-unsubscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint }),
          }).catch(() => undefined)
        }
      }
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        // ignore
      }
      return true
    } catch {
      return false
    }
  }

  sendLocalNotification(payload: PushNotificationPayload): void {
    if (!this.supported || Notification.permission !== 'granted') return
    try {
      new Notification(payload.title, {
        body: payload.body,
        data: payload.data,
        tag: payload.tag ?? 'g005-default',
        icon: `${import.meta.env.BASE_URL}icons/icon-192x192.svg`,
      })
    } catch {
      // Notification 不可用时忽略
    }
  }
}

let _pushService: IPushService | null = null

export function getPushService(): IPushService {
  if (!_pushService) {
    _pushService = new WebPushService()
  }
  return _pushService
}

export function sendTestNotification(): void {
  const svc = getPushService()
  svc.sendLocalNotification({
    title: 'G005 RIS',
    body: '推送通知测试成功',
    tag: 'g005-test',
  })
}
