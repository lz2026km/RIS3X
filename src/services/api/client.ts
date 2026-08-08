import type { ApiResponse } from "./types";
import { withRetry } from "./retry";
import { getToken, refreshToken } from "../../utils/auth";
import {
  checkAccess,
  type AccessContext,
  type ResourceType,
} from "../auth/rbacService";

// ────────────────────────────────────────────────────────────────────────────
// API Mode: real | mock
// v3.0.6.11-50: 支持 localStorage 运行时覆盖(用于登录后从 mock 切到 real)。
//   - localStorage key: 'ris_api_mode' -> 'real' | 'mock'
//   - 未设置时回退到 import.meta.env.VITE_API_MODE, 仍未设置回退到 'mock'
//   - 注意: mode 改变后必须 reload 页面以确保缓存/状态正确
// ────────────────────────────────────────────────────────────────────────────
type ApiMode = "real" | "mock";

function normalizeApiMode(value: string | undefined): ApiMode | undefined {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "real" || normalized === "api" || normalized === "backend")
    return "real";
  if (normalized === "mock" || normalized === "msw") return "mock";
  return undefined;
}

function resolveApiMode(): ApiMode {
  if (typeof window !== "undefined") {
    try {
      const storedMode = normalizeApiMode(
        window.localStorage.getItem("ris_api_mode") ?? undefined,
      );
      if (storedMode) return storedMode;
    } catch (e) {
      console.warn("[F03] Error:", (e as Error)?.message);
    }
  }
  const envMode = normalizeApiMode(import.meta.env.VITE_API_MODE);
  if (envMode) return envMode;
  const legacyMswMode = import.meta.env.VITE_USE_MSW?.trim().toLowerCase();
  if (
    legacyMswMode === "false" ||
    legacyMswMode === "0" ||
    legacyMswMode === "off"
  )
    return "real";
  return "mock";
}

function resolveApiBaseUrl(): string | undefined {
  if (typeof window !== "undefined") {
    try {
      const ls = window.localStorage.getItem("ris_api_base_url");
      if (ls) return ls;
    } catch (err) {
      console.error("[ApiClient] resolveApiBaseUrl failed:", err);
    }
  }
  return import.meta.env.VITE_API_BASE_URL;
}

const API_MODE: ApiMode = resolveApiMode();
const API_BASE =
  API_MODE === "real"
    ? (resolveApiBaseUrl() || "http://localhost:3001/api").replace(/\/$/, "")
    : "/api/v1";
export { API_BASE };

// ────────────────────────────────────────────────────────────────────────────
// 内联 JWT 解码 (无额外依赖,仅提取 payload)
// ────────────────────────────────────────────────────────────────────────────
interface JwtPayload {
  sub?: string;
  tenantId?: string;
  role?: string;
  [key: string]: unknown;
}

function decodeJwt(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const raw = atob(parts[1]!.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(raw) as JwtPayload;
  } catch {
    return null;
  }
}

function getTenantId(): string | undefined {
  const token = getToken();
  if (!token) return undefined;
  const payload = decodeJwt(token);
  return payload?.tenantId;
}

// F14: 缓存 key 携带租户维度,防止跨租户串数据
function cacheKeyFor(url: string): string {
  return `${getTenantId() ?? "anon"}:${url}`;
}

// F14: 超时时间参数化,支持 VITE_API_TIMEOUT(毫秒)配置
function resolveTimeoutMs(): number {
  const raw =
    import.meta.env.VITE_API_TIMEOUT ??
    (typeof process !== "undefined" ? process.env.VITE_API_TIMEOUT : undefined);
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30000;
}

const API_TIMEOUT_MS = resolveTimeoutMs();

// ────────────────────────────────────────────────────────────────────────────
// v3.0.6.13 内存 LRU 缓存 (替代原先依赖 Service Worker CLEAR_API_CACHE 的方案)
// mockServiceWorker.js 不识别 CLEAR_API_CACHE 消息,改为 client 内部维护缓存。
// 仅 GET 且无请求体时启用缓存;非 2xx 响应不入缓存。
// ────────────────────────────────────────────────────────────────────────────
const MAX_CACHE_ENTRIES = 100;
const CACHE_TTL_MS = 60_000;

type CacheEntry = { body: ApiResponse<unknown>; ts: number };
const responseCache = new Map<string, CacheEntry>();
const invalidatedUrls = new Map<string, number>();

function readCache(url: string, method: string): ApiResponse<unknown> | null {
  if (method !== "GET") return null;
  const key = cacheKeyFor(url);
  const entry = responseCache.get(key);
  if (!entry) return null;
  const invalidatedAt = invalidatedUrls.get(key);
  if (invalidatedAt !== undefined && invalidatedAt >= entry.ts) {
    responseCache.delete(key);
    return null;
  }
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    responseCache.delete(key);
    return null;
  }
  responseCache.delete(key);
  responseCache.set(key, entry);
  return entry.body;
}

function writeCache(
  url: string,
  method: string,
  body: ApiResponse<unknown>,
): void {
  if (method !== "GET") return;
  if (!body || body.success !== true) return;
  const key = cacheKeyFor(url);
  responseCache.delete(key);
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldest = responseCache.keys().next().value;
    if (oldest !== undefined) responseCache.delete(oldest);
  }
  responseCache.set(key, { body, ts: Date.now() });
}

function dropCacheByPrefix(fullPrefix: string): void {
  const now = Date.now();
  const keyPrefix = cacheKeyFor(fullPrefix);
  for (const key of Array.from(responseCache.keys())) {
    if (key.startsWith(keyPrefix)) {
      invalidatedUrls.set(key, now);
      responseCache.delete(key);
    }
  }
}

function captureCsrfToken(response: Response): void {
  const token = response.headers.get("x-csrf-token");
  if (token && typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem("ris_csrf_token", token);
    } catch {
      /* noop */
    }
  }
}

function getCsrfToken(): string {
  const storageKey = "ris_csrf_token";
  if (typeof window !== "undefined") {
    try {
      const existing = window.sessionStorage.getItem(storageKey);
      if (existing) return existing;
    } catch {
      /* noop */
    }
  }
  const token = crypto.randomUUID().replace(/-/g, "");
  if (typeof window !== "undefined") {
    try {
      window.sessionStorage.setItem(storageKey, token);
    } catch {
      /* noop */
    }
  }
  return token;
}

function apiError(
  body: unknown,
  status: number,
): { code: string; message: string } {
  if (body && typeof body === "object") {
    const value = body as Record<string, unknown>;
    const nested =
      value.error && typeof value.error === "object"
        ? (value.error as Record<string, unknown>)
        : undefined;
    // F14: 兼容 ok / success / message / error 多种错误协议字段
    const message = nested?.message ?? value.message ?? value.error;
    const code = nested?.code ?? value.code;
    const base = {
      code: typeof code === "string" ? code : `HTTP_${status}`,
      message: typeof message === "string" ? message : `请求失败 (${status})`,
    };
    // F14: 透出 errors[] 具体字段信息 (支持 string[] / {field,message,code}[])
    const errors = nested?.errors ?? value.errors;
    if (Array.isArray(errors) && errors.length > 0) {
      const details: string[] = [];
      for (const item of errors) {
        if (typeof item === "string") {
          details.push(item);
        } else if (item && typeof item === "object") {
          const e = item as Record<string, unknown>;
          const field = typeof e.field === "string" ? e.field : undefined;
          const msg =
            typeof e.message === "string"
              ? e.message
              : typeof e.code === "string"
                ? e.code
                : JSON.stringify(e);
          details.push(field ? `${field}: ${msg}` : msg);
        }
      }
      if (details.length > 0)
        base.message = `${base.message}；${details.join("；")}`;
    }
    return base;
  }
  return { code: `HTTP_${status}`, message: `请求失败 (${status})` };
}

async function readBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${path}`;
  const method = (options.method || "GET").toUpperCase();

  if (method === "GET" && !options.body) {
    const cached = readCache(url, method);
    if (cached) return cached as ApiResponse<T>;
  }

  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;
  const baseHeaders: Record<string, string> = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(options.headers as Record<string, string>),
  };
  if (API_MODE === "real") {
    const tenantId = getTenantId();
    if (tenantId) baseHeaders["X-Tenant-Id"] = tenantId;
    if (!["GET", "HEAD", "OPTIONS"].includes(method))
      baseHeaders["X-CSRF-Token"] = getCsrfToken();
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

  try {
    const res = await withRetry(
      async () => {
        const headers = { ...baseHeaders };
        const currentToken = getToken();
        if (currentToken) headers.Authorization = `Bearer ${currentToken}`;
        const response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal,
          credentials: API_MODE === "real" ? "include" : options.credentials,
        });
        if (
          response.status === 401 ||
          response.status === 429 ||
          response.status >= 500
        ) {
          const error = apiError(await readBody(response), response.status);
          throw { status: response.status, ...error };
        }
        return response;
      },
      { onUnauthorized: refreshToken },
    );
    if (res.status === 204) {
      captureCsrfToken(res);
      return { success: true, data: null as unknown as T };
    }
    captureCsrfToken(res);
    const body = await readBody(res);
    if (!res.ok) {
      return {
        success: false,
        data: null as unknown as T,
        error: apiError(body, res.status),
      };
    }
    // F14: 同时兼容 success / ok 两种布尔成功字段
    let normalized: ApiResponse<T>;
    if (body && typeof body === "object") {
      const flags = body as Record<string, unknown>;
      const okFlag =
        typeof flags.success === "boolean"
          ? flags.success
          : typeof flags.ok === "boolean"
            ? flags.ok
            : undefined;
      if (okFlag === true) {
        // [G005 P0] 登录/刷新响应归一化:
        //   - 后端 /auth/login: { accessToken, user, success, data:{token,...} }
        //   - MSW /auth/login:  { success, data:{token,...} }
        //   - 后端 /auth/refresh: { success, data:{token,...} }
        // 统一映射为 response.data.token 可用 (token ?? accessToken 兼容),
        // 前后端协议均不改动, 仅前端归一化层吸收差异。
        const raw = body as Record<string, unknown>;
        const nested =
          raw?.data && typeof raw.data === "object"
            ? (raw.data as Record<string, unknown>)
            : undefined;
        const accessToken =
          typeof raw?.accessToken === "string" ? raw.accessToken : undefined;
        const nestedToken =
          nested && typeof nested.token === "string" ? nested.token : undefined;
        if (raw && (accessToken !== undefined || nestedToken !== undefined)) {
          const merged: Record<string, unknown> = { ...raw };
          if (typeof merged.token !== "string") {
            merged.token = accessToken ?? nestedToken;
          }
          normalized = { ...(body as ApiResponse<T>), data: merged as T };
        } else {
          normalized = body as ApiResponse<T>;
        }
      } else if (okFlag === false) {
        normalized = {
          success: false,
          data: null as unknown as T,
          error: apiError(body, res.status),
        };
      } else {
        normalized = { success: true, data: body as T };
      }
    } else {
      normalized = { success: true, data: body as T };
    }
    writeCache(url, method, normalized);
    return normalized;
  } catch (err) {
    const value = err as {
      status?: number;
      code?: string;
      message?: string;
      name?: string;
    };
    if (value.status || value.code) {
      return {
        success: false,
        data: null as unknown as T,
        error: {
          code: value.code ?? `HTTP_${value.status}`,
          message: value.message ?? `请求失败 (${value.status})`,
        },
      };
    }
    const timedOut = value.name === "AbortError";
    return {
      success: false,
      data: null as unknown as T,
      error: {
        code: timedOut ? "TIMEOUT" : "NETWORK_ERROR",
        message: timedOut
          ? "请求超时，请稍后重试"
          : value.message || "网络错误，请检查连接",
      },
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "DELETE",
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    }),
  // [G005 P0] 列表响应归一化: 兼容两种后端形状
  //   - MSW 旧 handler: data 为裸数组 { success, data: [...] }
  //   - Nest CRUD:      data 为 { items: [], total: number }
  getList: <T>(path: string) => requestList<T>(path),
};

// ────────────────────────────────────────────────────────────────────────────
// [G005 P0] 列表形状归一化 (方案 B: client 层统一收敛)
// 返回统一 { data: T[], total } 形状, 页面无需再判断 Array.isArray / items。
// ────────────────────────────────────────────────────────────────────────────
export interface ListData<T> {
  data: T[];
  total: number;
}

async function requestList<T>(path: string): Promise<ApiResponse<ListData<T>>> {
  const res = await request<unknown>(path, { method: "GET" });
  if (!res.success) {
    return {
      success: false,
      data: { data: [], total: 0 },
      error: res.error,
    };
  }
  const d = res.data;
  if (Array.isArray(d)) {
    return { success: true, data: { data: d as T[], total: d.length } };
  }
  if (d && typeof d === "object") {
    const obj = d as Record<string, unknown>;
    if (Array.isArray(obj.items)) {
      const items = obj.items as T[];
      return {
        success: true,
        data: {
          data: items,
          total: typeof obj.total === "number" ? obj.total : items.length,
        },
      };
    }
  }
  return {
    success: false,
    data: { data: [], total: 0 },
    error: { code: "INVALID_LIST", message: "列表响应格式无效" },
  };
}

// ────────────────────────────────────────────────────────────────────────────
// RBAC 资源级访问控制包装
// ────────────────────────────────────────────────────────────────────────────

export interface AccessGuard {
  user: { role: string; userId: string; department: string };
  resource: { type: ResourceType; ownerDept?: string; ownerId?: string };
  action: "create" | "read" | "update" | "delete" | "approve";
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
    user: {
      role: guard.user.role,
      userId: guard.user.userId,
      department: guard.user.department,
    },
    resource: {
      type: guard.resource.type,
      ownerDept: guard.resource.ownerDept,
      ownerId: guard.resource.ownerId,
    },
    action: guard.action,
    environment: { time: new Date() },
  };
  if (!checkAccess(ctx)) {
    console.warn("[RBAC] Access denied", { path, guard });
    return {
      success: false,
      data: null as unknown as T,
      error: { code: "ACCESS_DENIED", message: "当前用户无权访问该资源" },
    };
  }
  return request<T>(path, options);
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
  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const key = cacheKeyFor(url);
  invalidatedUrls.set(key, Date.now());
  responseCache.delete(key);
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
  const fullPrefix = prefix.startsWith("http")
    ? prefix
    : `${API_BASE}${prefix}`;
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

/**
 * v3.0.6.11-21: 在运行时切换 API mode(写入 localStorage 后调用方负责 reload)。
 * 用于"用户登录后从 mock 切到 real"。
 *
 * @example
 *   await switchApiMode('real');
 *   window.location.reload();
 */
export async function switchApiMode(
  mode: ApiMode,
  baseUrl?: string,
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("ris_api_mode", mode);
    if (baseUrl !== undefined) {
      if (baseUrl) window.localStorage.setItem("ris_api_base_url", baseUrl);
      else window.localStorage.removeItem("ris_api_base_url");
    }
  } catch {
    /* noop */
  }
}

/**
 * v3.0.6.11-21: 返回当前生效的 mode(每次调用重新解析,避免 `switchApiMode` 后 stale)。
 */
export function currentApiMode(): ApiMode {
  return resolveApiMode();
}
