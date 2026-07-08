/**
 * G005 放射RIS系统 v3.0.6.0 - FHIR R4/R5 客户端(出站)
 * 30 升级点:read / search / create / update / patch / delete / history
 *      Bearer Token / 重试 / 超时 / Prefer
 */

import type {
  FhirVersion, FhirClientConfig, FhirClientResponse,
  FhirBundle, FhirSearchResult, FhirOperationOutcome,
} from '../../../types/integration';
import type { FhirResourceType } from '../../../types/R3/R3.INTEGRATION';

const DEFAULT_CONFIG: FhirClientConfig = {
  baseUrl: 'https://fhir.hospital.com/api/FHIR/R4',
  version: 'R4',
  auth: { type: 'none' },
  timeoutMs: 15_000,
  retries: 2,
  prefer: 'return=representation',
  pretty: false,
};

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  ifMatch?: string;
  ifNoneMatch?: string;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
}

export class FhirClient {
  private config: FhirClientConfig;
  private audit: { ts: string; method: string; url: string; status: number; durationMs: number }[] = [];

  constructor(config?: Partial<FhirClientConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...(config ?? {}) };
    if (config?.auth) this.config.auth = { ...DEFAULT_CONFIG.auth, ...config.auth };
  }

  getConfig(): FhirClientConfig { return { ...this.config }; }
  updateConfig(patch: Partial<FhirClientConfig>): void {
    this.config = { ...this.config, ...patch };
    if (patch.auth) this.config.auth = { ...this.config.auth, ...patch.auth };
  }

  // ---------------- 资源 API ----------------
  async read<T = Record<string, unknown>>(type: FhirResourceType | string, id: string, opts: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<FhirClientResponse<T>> {
    return this.request<T>(`${type}/${encodeURIComponent(id)}`, { ...opts, method: 'GET' });
  }

  async vread<T = Record<string, unknown>>(type: FhirResourceType | string, id: string, versionId: string, opts: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<FhirClientResponse<T>> {
    return this.request<T>(`${type}/${encodeURIComponent(id)}/_history/${versionId}`, { ...opts, method: 'GET' });
  }

  async search<T = Record<string, unknown>>(type: FhirResourceType | string, params: Record<string, string | number | boolean | undefined> = {}, opts: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<FhirClientResponse<FhirSearchResult> | FhirClientResponse<FhirBundle>> {
    return this.request<FhirSearchResult>(type, { ...opts, method: 'GET', query: params });
  }

  async create<T = Record<string, unknown>>(type: FhirResourceType | string, resource: T, opts: Omit<RequestOptions, 'method'> = {}): Promise<FhirClientResponse<T>> {
    return this.request<T>(type, { ...opts, method: 'POST', body: resource });
  }

  async update<T = Record<string, unknown>>(type: FhirResourceType | string, id: string, resource: T, ifMatch?: string, opts: Omit<RequestOptions, 'method' | 'body' | 'ifMatch'> = {}): Promise<FhirClientResponse<T>> {
    return this.request<T>(`${type}/${encodeURIComponent(id)}`, { ...opts, method: 'PUT', body: resource, ifMatch });
  }

  async patch<T = Record<string, unknown>>(type: FhirResourceType | string, id: string, patch: unknown, ifMatch?: string, opts: Omit<RequestOptions, 'method' | 'body' | 'ifMatch'> = {}): Promise<FhirClientResponse<T>> {
    return this.request<T>(`${type}/${encodeURIComponent(id)}`, { ...opts, method: 'PATCH', body: patch, ifMatch });
  }

  async delete(type: FhirResourceType | string, id: string, opts: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<FhirClientResponse<FhirOperationOutcome>> {
    return this.request<FhirOperationOutcome>(`${type}/${encodeURIComponent(id)}`, { ...opts, method: 'DELETE' });
  }

  async history<T = Record<string, unknown>>(type: FhirResourceType | string, id: string, opts: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<FhirClientResponse<FhirBundle>> {
    return this.request<FhirBundle>(`${type}/${encodeURIComponent(id)}/_history`, { ...opts, method: 'GET' });
  }

  async capabilityStatement(opts: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<FhirClientResponse<Record<string, unknown>>> {
    return this.request<Record<string, unknown>>('metadata', { ...opts, method: 'GET' });
  }

  async transaction(bundle: FhirBundle, opts: Omit<RequestOptions, 'method' | 'body'> = {}): Promise<FhirClientResponse<FhirBundle>> {
    return this.request<FhirBundle>('/', { ...opts, method: 'POST', body: bundle });
  }

  // ---------------- 核心请求实现(Mock) ----------------
  private async request<T>(path: string, options: RequestOptions = {}): Promise<FhirClientResponse<T>> {
    const start = Date.now();
    const method = options.method ?? 'GET';
    const url = this.buildUrl(path, options.query);
    let attempt = 0;
    let lastError: string | null = null;
    while (attempt <= this.config.retries) {
      attempt += 1;
      try {
        const res = await this.send<T>(url, method, options);
        this.audit.push({ ts: new Date().toISOString(), method, url, status: res.status, durationMs: res.durationMs });
        if (this.audit.length > 500) this.audit.shift();
        return res;
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
        if (attempt > this.config.retries) {
          this.audit.push({ ts: new Date().toISOString(), method, url, status: 0, durationMs: Date.now() - start });
          throw new Error(`FHIR ${method} ${url} 失败: ${lastError}`);
        }
      }
    }
    throw new Error(lastError ?? 'FHIR request failed');
  }

  private async send<T>(url: string, method: string, options: RequestOptions): Promise<FhirClientResponse<T>> {
    // 浏览器中 fetch 不可达外部 FHIR 服务器时,降级为 mock
    if (typeof fetch === 'undefined' || url.startsWith('mock://')) {
      return this.mockSend<T>(url, method, options);
    }
    const headers = this.buildHeaders(options);
    const init: RequestInit = { method, headers, signal: options.signal };
    if (options.body !== undefined && method !== 'GET' && method !== 'DELETE') {
      init.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeoutMs);
    init.signal = options.signal ?? controller.signal;
    const start = Date.now();
    try {
      const res = await fetch(url, init);
      const text = await res.text();
      let body: T | undefined;
      if (text) {
        try { body = JSON.parse(text) as T; } catch { body = text as unknown as T; }
      }
      const hdrs: Record<string, string> = {};
      res.headers.forEach((v, k) => { hdrs[k] = v; });
      return {
        status: res.status,
        ok: res.ok,
        headers: hdrs,
        body,
        etag: res.headers.get('etag') ?? undefined,
        lastModified: res.headers.get('last-modified') ?? undefined,
        location: res.headers.get('location') ?? undefined,
        durationMs: Date.now() - start,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  private buildUrl(path: string, query?: Record<string, string | number | boolean | undefined>): string {
    const base = this.config.baseUrl.replace(/\/$/, '');
    const cleanPath = path.replace(/^\//, '');
    let url = `${base}/${cleanPath}`;
    if (query) {
      const sp = new URLSearchParams();
      Object.entries(query).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        sp.set(k, String(v));
      });
      const s = sp.toString();
      if (s) url += `?${s}`;
    }
    if (this.config.pretty) url += (url.includes('?') ? '&' : '?') + '_pretty=true';
    return url;
  }

  private buildHeaders(options: RequestOptions): Record<string, string> {
    const headers: Record<string, string> = {
      'Accept': `application/fhir+json; fhirVersion=${this.config.version}`,
      'Content-Type': 'application/fhir+json; charset=utf-8',
      'Prefer': this.config.prefer,
      'User-Agent': 'G005-RIS-FHIR-Client/3.0.6.0',
    };
    if (this.config.auth?.type === 'bearer' && this.config.auth.token) {
      headers['Authorization'] = `Bearer ${this.config.auth.token}`;
    } else if (this.config.auth?.type === 'basic' && this.config.auth.token) {
      headers['Authorization'] = `Basic ${this.config.auth.token}`;
    } else if (this.config.auth?.type === 'smart' && this.config.auth.token) {
      headers['Authorization'] = `Bearer ${this.config.auth.token}`;
      headers['X-SMART-Client-Id'] = this.config.auth.clientId ?? 'g005-ris';
    }
    if (options.ifMatch) headers['If-Match'] = options.ifMatch;
    if (options.ifNoneMatch) headers['If-None-Match'] = options.ifNoneMatch;
    return headers;
  }

  // ---------------- Mock 实现(浏览器中无 fetch 或远端不可达时) ----------------
  private mockSend<T>(url: string, method: string, options: RequestOptions): Promise<FhirClientResponse<T>> {
    const start = Date.now();
    return new Promise((resolve) => {
      setTimeout(() => {
        // 模拟成功响应
        const status = method === 'POST' ? 201 : method === 'DELETE' ? 204 : 200;
        const id = `mock-${Math.random().toString(36).slice(2, 10)}`;
        const body = (method === 'GET' || method === 'POST' || method === 'PUT' || method === 'PATCH') ? {
          resourceType: url.split('/').filter((p) => !p.startsWith('?') && !p.includes('=')).slice(-2, -1)[0] ?? 'Resource',
          id: url.split('/').filter((p) => p && !p.startsWith('?')).slice(-1)[0] ?? id,
          meta: { versionId: '1', lastUpdated: new Date().toISOString() },
        } as unknown as T : undefined;
        resolve({
          status, ok: status < 400,
          headers: { 'content-type': 'application/fhir+json' },
          body,
          etag: `W/"1"`,
          lastModified: new Date().toUTCString(),
          location: url,
          durationMs: Date.now() - start,
        });
      }, 80);
    });
  }

  getAuditLog() { return [...this.audit]; }
}

// 单例
let defaultClient: FhirClient | null = null;

export function getDefaultFhirClient(): FhirClient {
  if (!defaultClient) defaultClient = new FhirClient();
  return defaultClient;
}

export function resetDefaultFhirClient(): void {
  defaultClient = null;
}

export type { RequestOptions };
