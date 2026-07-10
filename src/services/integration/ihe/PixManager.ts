/**
 * G005 放射RIS系统 v3.0.6.0 - PIX Manager 客户端 SDK
 * 25 升级点:IT I-8 Patient Identity Feed / ITI-9 PIX Query / ITI-10 PIX Update Notification
 *      后端代理 / 失败重试 / 超时控制 / 审计联动
 *
 * 浏览器端不直接连 PIX Manager HL7 v2 端点,统一走 backend REST 代理:
 *   POST /api/ihe/pix/feed
 *   POST /api/ihe/pix/query
 *   POST /api/ihe/pix/update-notification
 */

import type { IhePixFeed } from '../../../types/integration';

const DEFAULT_BASE_URL = 'http://localhost:3001/api/ihe';
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_RETRIES = 1;

export interface PixManagerConfig {
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
  authToken?: string;
}

export interface PixManagerResponse<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  durationMs: number;
  transaction?: string;
}

export interface PixFeedResultDto {
  success: boolean;
  ack: 'AA' | 'AE' | 'AR';
  messageId: string;
  errors?: string[];
  transaction?: string;
}

export interface PixQueryRequest {
  patientId: string;
  sourceDomain: string;
  targetDomains: string[];
}

export interface PixQueryResultDto {
  transaction: string;
  count: number;
  patientId: string;
  sourceDomain: string;
  results: {
    patientId: string;
    assigningAuthority: string;
    identifiers: { domain: string; value: string }[];
    name?: { family: string; given: string[] };
  }[];
}

export interface PixUpdateNotificationResult {
  transaction: string;
  success: boolean;
  ack: 'AA' | 'AE' | 'AR';
  messageId: string;
  notifiedDomains: string[];
  errors?: string[];
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export class PixManager {
  private baseUrl: string;
  private timeoutMs: number;
  private retries: number;
  private authToken: string | null;
  private audit: { ts: string; op: string; ok: boolean; durationMs: number; status: number }[] = [];

  constructor(config: PixManagerConfig = {}) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '');
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.retries = config.retries ?? DEFAULT_RETRIES;
    this.authToken = config.authToken ?? null;
  }

  getConfig(): PixManagerConfig {
    return {
      baseUrl: this.baseUrl,
      timeoutMs: this.timeoutMs,
      retries: this.retries,
      authToken: this.authToken ?? undefined,
    };
  }

  updateConfig(patch: PixManagerConfig): void {
    if (patch.baseUrl) this.baseUrl = patch.baseUrl.replace(/\/$/, '');
    if (patch.timeoutMs !== undefined) this.timeoutMs = patch.timeoutMs;
    if (patch.retries !== undefined) this.retries = patch.retries;
    if (patch.authToken !== undefined) this.authToken = patch.authToken ?? null;
  }

  setAuthToken(token: string | null): void {
    this.authToken = token;
  }

  // ---------------- ITI-8 Patient Identity Feed ----------------
  async feed(feed: IhePixFeed): Promise<PixManagerResponse<PixFeedResultDto>> {
    if (!feed?.patientId) {
      return { ok: false, status: 400, error: 'patientId 不能为空', durationMs: 0 };
    }
    if (!feed?.assigningAuthority) {
      return { ok: false, status: 400, error: 'assigningAuthority 不能为空', durationMs: 0 };
    }
    return this.request<PixFeedResultDto>('/pix/feed', { method: 'POST', body: feed }, 'ITI-8');
  }

  // ---------------- ITI-9 PIX Query ----------------
  async query(req: PixQueryRequest): Promise<PixManagerResponse<PixQueryResultDto>> {
    if (!req?.patientId) {
      return { ok: false, status: 400, error: 'patientId 不能为空', durationMs: 0 };
    }
    if (!req?.sourceDomain) {
      return { ok: false, status: 400, error: 'sourceDomain 不能为空', durationMs: 0 };
    }
    if (!Array.isArray(req.targetDomains) || req.targetDomains.length === 0) {
      return { ok: false, status: 400, error: 'targetDomains 至少需要 1 个', durationMs: 0 };
    }
    return this.request<PixQueryResultDto>('/pix/query', { method: 'POST', body: req }, 'ITI-9');
  }

  // ---------------- ITI-10 PIX Update Notification ----------------
  async notifyUpdate(feed: IhePixFeed): Promise<PixManagerResponse<PixUpdateNotificationResult>> {
    if (!feed?.patientId) {
      return { ok: false, status: 400, error: 'patientId 不能为空', durationMs: 0 };
    }
    return this.request<PixUpdateNotificationResult>('/pix/update-notification', { method: 'POST', body: feed }, 'ITI-10');
  }

  // ---------------- 审计 / 工具 ----------------
  getAuditLog() { return [...this.audit]; }

  clearAuditLog() { this.audit = []; }

  // ---------------- 核心请求实现 ----------------
  private async request<T>(path: string, options: RequestOptions = {}, op: string): Promise<PixManagerResponse<T>> {
    const url = `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
    const start = Date.now();
    let attempt = 0;
    let lastError = '';
    let lastStatus = 0;
    while (attempt <= this.retries) {
      attempt += 1;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const headers: Record<string, string> = {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-PIX-Client': 'G005-RIS-PIX-Manager/3.0.6.0',
        };
        if (this.authToken) headers['Authorization'] = `Bearer ${this.authToken}`;
        const init: RequestInit = {
          method: options.method ?? 'POST',
          headers,
          signal: options.signal ?? controller.signal,
        };
        if (options.body !== undefined) {
          init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
        }
        const res = await fetch(url, init);
        const text = await res.text();
        let body: T | undefined;
        if (text) {
          try { body = JSON.parse(text) as T; }
          catch { body = text as unknown as T; }
        }
        clearTimeout(timer);
        lastStatus = res.status;
        const durationMs = Date.now() - start;
        const tx = (body as { transaction?: string } | undefined)?.transaction;
        if (res.ok) {
          this.audit.push({ ts: new Date().toISOString(), op, ok: true, durationMs, status: res.status });
          if (this.audit.length > 200) this.audit.shift();
          return { ok: true, status: res.status, data: body, durationMs, transaction: tx };
        }
        lastError = (body as { error?: string; message?: string } | undefined)?.error
          ?? (body as { message?: string } | undefined)?.message
          ?? `HTTP ${res.status}`;
      } catch (err) {
        clearTimeout(timer);
        lastError = err instanceof Error ? err.message : String(err);
        lastStatus = 0;
      }
      if (attempt > this.retries) {
        const durationMs = Date.now() - start;
        this.audit.push({ ts: new Date().toISOString(), op, ok: false, durationMs, status: lastStatus });
        if (this.audit.length > 200) this.audit.shift();
        return { ok: false, status: lastStatus, error: lastError || 'PIX request failed', durationMs };
      }
      await new Promise((r) => setTimeout(r, Math.min(500, 100 * attempt)));
    }
    const durationMs = Date.now() - start;
    return { ok: false, status: lastStatus, error: lastError || 'PIX request failed', durationMs };
  }
}

let defaultClient: PixManager | null = null;

export function getDefaultPixManager(): PixManager {
  if (!defaultClient) defaultClient = new PixManager();
  return defaultClient;
}

export function resetDefaultPixManager(): void {
  defaultClient = null;
}
