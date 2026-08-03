/**
 * G005 放射RIS系统 v3.0.6.11-53 - PWA Service Worker (injectManifest)
 * Phase 1.5: 恢复 PWA + 危急值 Web Push
 *
 * - precache: vite-plugin-pwa 注入的 dist 构建产物 (454 entries)
 * - runtime: document NetworkFirst / assets SWR / images+fonts CacheFirst
 * - push: 危急值等 Web Push 离线通知 (Notification API)
 * - MSW 仅在 dev 模式启用,本 SW 仅在 build 产物生效,无冲突
 */

/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

declare const self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()

// 自动收集 dist 产物到 precache(vite-plugin-pwa 注入 self.__WB_MANIFEST)
precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

const SW_BASE = self.registration.scope

// ── 离线缓存核心路由 ──────────────────────────────────────────────
// SPA 导航兜底(离线打开任意路由 → index.html); API / MSW / SW 自身排除
const navigationRoute = new NavigationRoute(createHandlerBoundToURL('index.html'), {
  denylist: [/^\/api\//, /\/mockServiceWorker\.js$/, /\/sw\.js$/, /\/registerSW\.js$/],
})
registerRoute(navigationRoute)

// 文档: 网络优先(带超时回退缓存)
registerRoute(
  ({ request }) => request.destination === 'document',
  new NetworkFirst({ cacheName: 'html-cache', networkTimeoutSeconds: 3 }),
)

// JS/CSS/worker: 增量更新
registerRoute(
  ({ request }) => ['style', 'script', 'worker'].includes(request.destination),
  new StaleWhileRevalidate({ cacheName: 'asset-cache' }),
)

// 图片: 缓存优先 + 过期清理
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'image-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 }),
    ],
  }),
)

// 字体: 缓存优先(长期)
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: 'font-cache',
    plugins: [
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 365 * 24 * 60 * 60 }),
    ],
  }),
)

// ── 危急值 Web Push ───────────────────────────────────────────────
interface PushMessage {
  title?: string
  body?: string
  tag?: string
  icon?: string
  badge?: string
  url?: string
  data?: Record<string, unknown>
  requireInteraction?: boolean
  actions?: Array<{ action: string; title: string }>
}

function parsePushData(data: unknown): PushMessage {
  if (typeof data !== 'object' || data === null) return {}
  const raw = data as Record<string, unknown>
  return {
    title: typeof raw['title'] === 'string' ? raw['title'] : undefined,
    body: typeof raw['body'] === 'string' ? raw['body'] : undefined,
    tag: typeof raw['tag'] === 'string' ? raw['tag'] : undefined,
    icon: typeof raw['icon'] === 'string' ? raw['icon'] : undefined,
    badge: typeof raw['badge'] === 'string' ? raw['badge'] : undefined,
    url: typeof raw['url'] === 'string' ? raw['url'] : undefined,
    data: typeof raw['data'] === 'object' && raw['data'] !== null ? (raw['data'] as Record<string, unknown>) : undefined,
    requireInteraction: typeof raw['requireInteraction'] === 'boolean' ? raw['requireInteraction'] : undefined,
    actions: Array.isArray(raw['actions'])
      ? (raw['actions'] as Array<{ action: string; title: string }>)
      : undefined,
  }
}

// 后台推送(危急值/报告完成/预约提醒/系统公告) → 系统通知
  self.addEventListener('push', (event) => {
    const message: PushMessage = event.data ? parsePushData(event.data.json()) : {}
    const title = message.title || 'G005 放射RIS'
    const options: NotificationOptions & { actions?: Array<{ action: string; title: string }> } = {
      body: message.body || '您有一条新的通知',
      tag: message.tag || 'g005-critical',
      icon: message.icon || `${SW_BASE}icons/icon-192x192.svg`,
      badge: message.badge || `${SW_BASE}icons/icon-192x192.svg`,
      data: message.data || { url: message.url || SW_BASE },
      requireInteraction: message.requireInteraction ?? true,
      actions: message.actions,
    }
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(title, options)
      // 同步给打开的页面,更新应用内通知列表
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clients) {
        client.postMessage({
          type: 'push-notification',
          payload: {
            title,
            body: options.body,
            tag: options.tag,
            data: options.data,
          },
        })
      }
    })(),
  )
})

// 点击通知 → 聚焦/打开对应页面
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = (event.notification.data ?? {}) as Record<string, unknown>
  const target = typeof data['url'] === 'string' ? data['url'] : SW_BASE
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clients) {
        if (typeof client.focus === 'function') {
          await client.focus()
          if ('navigate' in client && client.url !== target) {
            await client.navigate(target)
          }
          return
        }
      }
      if ('openWindow' in self.clients) {
        await self.clients.openWindow(target)
      }
    })(),
  )
})

// 通知关闭(可选: 上报统计)
self.addEventListener('notificationclose', () => {
  // no-op: 预留统计埋点
})

export {}
