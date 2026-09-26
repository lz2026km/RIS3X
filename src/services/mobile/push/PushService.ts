/**
 * G005 放射RIS系统 v3.0.6.6 - 移动端推送服务 (Web Push + APNs + FCM)
 * 30 升级点:渠道抽象 / 权限请求 / 订阅管理 / 本地通知 / 静默推送 / 去重 / 话题过滤
 *
 * v3.0.6.11-53 (Phase 1.5): 对接真实 Web Push
 *   - SW 注册 URL 改为 import.meta.env.BASE_URL + sw.js (vite-plugin-pwa 产物)
 *   - VAPID 公钥从后端 GET /notifications/vapid-public-key 获取(失败回退内置演示密钥)
 *   - 订阅成功后同步到后端 POST /notifications/push-subscribe
 *   - SW 监听 push 事件(src/sw.ts)展示系统通知
 */

import type { PushPayload, PushChannel, PushSubscription } from '../../../types/mobile';
import { API_BASE } from '../../api/client';

type PushPermission = 'granted' | 'denied' | 'default' | 'unsupported';

interface PushEventHandler {
  onNotification?: (payload: PushPayload) => void;
  onNotificationClick?: (payload: PushPayload) => void;
  onSubscribe?: (subscription: PushSubscription) => void;
  onUnsubscribe?: (endpoint: string) => void;
  onError?: (error: Error) => void;
}

const STORAGE_KEY = 'g005-push-subscription';
// 演示 VAPID 密钥对 (后端未配置时回退; 生产从 GET /notifications/vapid-public-key 获取)
const DEMO_VAPID_PUBLIC_KEY =
  'BK-yELa-ndXqb0Qr5gdFEnEtYjaPWadKr25P1ApwdgNcbgtPIAaWdTwdwyy1eyP8ntlQSWM-XH5GK2Lk6S1hb88';

class PushService {
  private handlers: Set<PushEventHandler> = new Set();
  private swRegistration: ServiceWorkerRegistration | null = null;
  private cachedPermission: PushPermission = 'default';

  get permission(): PushPermission {
    return this.cachedPermission;
  }

  get supported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  }

  on(handler: PushEventHandler): () => void {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  private emit<K extends keyof PushEventHandler>(event: K, ...args: Parameters<NonNullable<PushEventHandler[K]>>): void {
    for (const h of this.handlers) {
      const fn = h[event] as ((...a: typeof args) => void) | undefined;
      try { fn?.(...args); } catch { /* handler error */ }
    }
  }

  async init(swUrl = `${import.meta.env.BASE_URL}sw.js`): Promise<boolean> {
    if (!this.supported) { this.cachedPermission = 'unsupported'; return false; }
    try {
      this.swRegistration = await navigator.serviceWorker.register(swUrl);
      this.cachedPermission = Notification.permission as PushPermission;
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'push-notification') {
          this.emit('onNotification', event.data.payload as PushPayload);
        }
      });
      return true;
    } catch { return false; }
  }

  /**
   * 获取 VAPID 公钥: 后端优先, 失败回退内置演示密钥
   */
  private async getVapidPublicKey(): Promise<string> {
    try {
      const res = await fetch(`${API_BASE}/notifications/vapid-public-key`, { method: 'GET' });
      if (!res.ok) throw new Error(`vapid-key ${res.status}`);
      const data = (await res.json()) as { publicKey?: string };
      if (data.publicKey) return data.publicKey;
    } catch { /* fallback below */ }
    return DEMO_VAPID_PUBLIC_KEY;
  }

  private currentUserId(): string {
    try {
      const raw = localStorage.getItem('ris_current_user');
      if (raw) {
        const u = JSON.parse(raw) as { id?: string };
        if (u.id) return u.id;
      }
    } catch { /* ignore */ }
    return 'demo-user';
  }

  async requestPermission(): Promise<PushPermission> {
    if (!this.supported) { this.cachedPermission = 'unsupported'; return 'unsupported'; }
    try {
      const perm = await Notification.requestPermission();
      this.cachedPermission = perm as PushPermission;
      return this.cachedPermission;
    } catch {
      this.cachedPermission = 'denied';
      return 'denied';
    }
  }

  async subscribe(vapidPublicKey: string, userId: string, deviceId: string, topics: string[] = []): Promise<PushSubscription | null> {
    if (!this.supported || !this.swRegistration) return null;
    try {
      const key = vapidPublicKey || await this.getVapidPublicKey();
      const sub = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(key),
      });
      const subInfo: PushSubscription = {
        endpoint: sub.endpoint,
        keys: await sub.toJSON() as { p256dh: string; auth: string },
        userId,
        deviceId,
        channel: this.detectChannel(),
        createdAt: new Date().toISOString(),
        topics,
        silent: false,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(subInfo));
      this.emit('onSubscribe', subInfo);
      // 同步到后端 (异步, 失败不阻断)
      void fetch(`${API_BASE}/notifications/push-subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId || this.currentUserId(),
          endpoint: subInfo.endpoint,
          keys: subInfo.keys,
          topics,
        }),
      }).catch(() => undefined);
      return subInfo;
    } catch { return null; }
  }

  async unsubscribe(): Promise<boolean> {
    if (!this.supported || !this.swRegistration) return false;
    try {
      const sub = await this.swRegistration.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        void fetch(`${API_BASE}/notifications/push-unsubscribe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint }),
        }).catch(() => undefined);
        this.emit('onUnsubscribe', endpoint);
      }
      localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch { return false; }
  }

  async getSubscription(): Promise<PushSubscription | null> {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored) as PushSubscription;
    if (!this.supported || !this.swRegistration) return null;
    const sub = await this.swRegistration.pushManager.getSubscription();
    if (!sub) return null;
    const parsed = sub.toJSON() as { p256dh: string; auth: string };
    return {
      endpoint: sub.endpoint,
      keys: parsed,
      userId: '',
      deviceId: '',
      channel: this.detectChannel(),
      createdAt: new Date().toISOString(),
      topics: [],
      silent: false,
    };
  }

  sendLocalNotification(payload: PushPayload): void {
    if (!this.supported || this.cachedPermission !== 'granted') return;
    try {
      new Notification(payload.title, {
        body: payload.body,
        icon: payload.icon ?? '/g005-radiology-ris/icons/icon-192x192.svg',
        badge: payload.badge,
        tag: payload.tag ?? 'g005-default',
        data: payload.data,
        ...({ actions: payload.actions } as Partial<NotificationOptions>),
        requireInteraction: payload.requireInteraction ?? false,
        silent: payload.silent ?? false,
      });
    } catch { /* notification failed */ }
  }

  sendSilentPush(payload: PushPayload): void {
    if (!this.supported || this.cachedPermission !== 'granted') return;
    const silentPayload = { ...payload, silent: true };
    this.emit('onNotification', silentPayload);
  }

  filterByTopic(payload: PushPayload, subscribedTopics: string[]): boolean {
    if (!payload.topic) return true;
    return subscribedTopics.includes(payload.topic);
  }

  async getSWRegistration(): Promise<ServiceWorkerRegistration | null> {
    return this.swRegistration;
  }

  async getNotificationLog(): Promise<Array<{ id: string; payload: PushPayload; receivedAt: string }>> {
    try {
      const raw = localStorage.getItem('g005-push-log');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  private detectChannel(): PushChannel {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('iphone') || ua.includes('ipad')) return 'apns';
    if (ua.includes('android')) return 'fcm';
    return 'web-push';
  }

  private urlBase64ToUint8Array(base64: string): Uint8Array {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = window.atob(b64);
    return Uint8Array.from(raw, c => c.charCodeAt(0));
  }

  async simulatePushFromServer(payload: PushPayload): Promise<void> {
    this.emit('onNotification', payload);
    this.sendLocalNotification(payload);
  }
}

export const pushService = new PushService();
export type { PushEventHandler };
