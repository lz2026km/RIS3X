import type { ApiResponse } from './types'
import { withRetry } from './retry'
import { getToken } from '../../utils/auth'
import { checkAccess, type AccessContext, type ResourceType } from '../auth/rbacService'

const API_BASE = '/api/v1'

// ────────────────────────────────────────────────────────────────────────────
// v3.0.6.13 内存 LRU 缓存 (替代原先依赖 Service Worker CLEAR_API_CACHE 的方案)
// mockServiceWorker.js 不识别 CLEAR_API_CACHE 消息,改为 client 内部维护缓存。
// 仅 GET 且无请求体时启用缓存;非 2xx 响应不入缓存。
// ────────────────────────────────────────────────────────────────────────────
const MAX_CACHE_ENTRIES = 100
const CACHE_TTL_MS = 60_000

type CacheEntry = { body: ApiResponse<unknown>; ts: number }
const responseCache = new Map<string, CacheEntry>()
const invalidatedUrls = new Map<string, number>()

function readCache(url: string, method: string): ApiResponse<unknown> | null {
  if (method !== 'GET') return null
  const entry = responseCache.get(url)
  if (!entry) return null
  const invalidatedAt = invalidatedUrls.get(url)
  if (invalidatedAt !== undefined && invalidatedAt >= entry.ts) {
    responseCache.delete(url)
    return null
  }
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    responseCache.delete(url)
    return null
  }
  responseCache.delete(url)
  responseCache.set(url, entry)
  return entry.body
}

function writeCache(url: string, method: string, body: ApiResponse<unknown>): void {
  if (method !== 'GET') return
  if (!body || body.success !== true) return
  responseCache.delete(url)
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = responseCache.keys().next().value
    if (oldest !== undefined) responseCache.delete(oldest)
  }
  responseCache.set(url, { body, ts: Date.now() })
}

function dropCacheByPrefix(fullPrefix: string): void {
  const now = Date.now()
  for (const key of Array.from(responseCache.keys())) {
    if (key.startsWith(fullPrefix)) {
      invalidatedUrls.set(key, now)
      responseCache.delete(key)
    }
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${path}`
  const method = (options.method || 'GET').toUpperCase()
  const token = getToken()

  if (method === 'GET' && !options.body) {
    const cached = readCache(url, method)
    if (cached) return cached as ApiResponse<T>
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  const mergedOptions: RequestInit = {
    ...options,
    headers,
    signal: controller.signal,
  };

  try {
    const res = await withRetry(() => fetch(url, mergedOptions));
    clearTimeout(timeoutId);
    if (res.status === 204) return { success: true, data: null as unknown as T }
    const body = await res.json()
    if (!res.ok) {
      console.error(`[API] ${method} ${url} failed:`, body)
      return { success: false, data: null as unknown as T, error: body.error }
    }
    writeCache(url, method, body)
    return body
  } catch (err) {
    clearTimeout(timeoutId);
    console.error(`[API] Network error ${method} ${url}:`, err)
    return {
      success: false,
      data: null as unknown as T,
      error: { code: 'NETWORK_ERROR', message: '网络错误，请检查连接' },
    }
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

// ────────────────────────────────────────────────────────────────────────────
// RBAC 资源级访问控制包装
// ────────────────────────────────────────────────────────────────────────────

export interface AccessGuard {
  user: { role: string; userId: string; department: string };
  resource: { type: ResourceType; ownerDept?: string; ownerId?: string };
  action: 'create' | 'read' | 'update' | 'delete' | 'approve';
}

/**
 * protectedRequest: 自动执行 RBAC 资源级访问检查,失败时短路并返回 ACCESS_DENIED 错误
 * 不修改原 request,以便在不需要资源级检查的接口继续使用 api.*
 */
export async function protectedRequest<T>(
  guard: AccessGuard,
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const ctx: AccessContext = {
    user: { role: guard.user.role, userId: guard.user.userId, department: guard.user.department },
    resource: { type: guard.resource.type, ownerDept: guard.resource.ownerDept, ownerId: guard.resource.ownerId },
    action: guard.action,
    environment: { time: new Date() },
  }
  if (!checkAccess(ctx)) {
    console.warn('[RBAC] Access denied', { path, guard })
    return {
      success: false,
      data: null as unknown as T,
      error: { code: 'ACCESS_DENIED', message: '当前用户无权访问该资源' },
    }
  }
  return request<T>(path, options)
}

// ────────────────────────────────────────────────────────────────────────────
// v3.0.6.13 内存缓存失效辅助 (替代原先的 Service Worker postMessage 方案)
// ────────────────────────────────────────────────────────────────────────────

/**
 * 使指定 URL 的内存缓存失效,下次 GET 会重新走网络。
 *
 * 适用于 POST/PUT/DELETE 后,避免展示 stale-while-revalidate 旧值。
 * 同时写入 invalidation log,即便该 URL 当前不在缓存中,
 * 后续若被重新填充也能在 request() 阶段被识别为"刚被失效过"。
 *
 * @param path API 路径(相对 `/api/v1` 基地址或绝对 URL 均可)
 *
 * @example
 *   await api.post('/reports/123/sign', {});
 *   await invalidateApiCache('/reports/123');
 */
export function invalidateApiCache(path: string): Promise<void> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  invalidatedUrls.set(url, Date.now());
  responseCache.delete(url);
  return Promise.resolve();
}

/**
 * 按前缀批量失效内存缓存中的 URL。
 *
 * 适用于"创建一条新检查 → 失效整个 worklist 缓存"这类场景。
 *
 * @param prefix URL 前缀,如 `/api/v1/worklist`
 */
export function invalidateApiCacheByPrefix(prefix: string): Promise<void> {
  const fullPrefix = prefix.startsWith('http') ? prefix : `${API_BASE}${prefix}`;
  dropCacheByPrefix(fullPrefix);
  return Promise.resolve();
}

/**
 * 仅供测试使用:清空整个内存缓存。
 */
export function __clearApiCacheForTest(): void {
  responseCache.clear();
  invalidatedUrls.clear();
}
