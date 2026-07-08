/**
 * G005 放射RIS系统 v3.0.6.0 - FHIR R4/R5 资源服务器(浏览器内 Mock)
 * 50 升级点:CapabilityStatement / CRUD / Search / Bundle / 验证
 *      资源仓库 / 索引 / ETag / If-Match
 */

import type {
  FhirVersion, FhirResourceEnvelope, FhirBundle, FhirBundleEntry,
  FhirSearchResult, FhirOperationOutcome, FhirCapabilityStatement,
  FhirOperationOutcomeIssue, FhirSearchParam,
} from '../../../types/integration';
import type { FhirResourceType } from '../../../types/R3/R3.INTEGRATION';

const RESOURCE_TYPES: readonly FhirResourceType[] = [
  'Patient', 'Practitioner', 'Organization', 'Encounter',
  'DiagnosticReport', 'Observation', 'ImagingStudy', 'Media',
  'ServiceRequest', 'Procedure', 'Condition', 'MedicationStatement',
  'Composition', 'DocumentReference', 'Bundle', 'OperationOutcome',
  'CarePlan', 'CareTeam', 'Goal', 'Task', 'Appointment', 'Slot',
];

// 内置搜索参数(简化)
const SEARCH_PARAMS: Record<string, FhirSearchParam[]> = {
  Patient: [
    { name: '_id', type: 'token', documentation: '资源 ID' },
    { name: 'identifier', type: 'token', documentation: '标识符' },
    { name: 'name', type: 'string', documentation: '姓名' },
    { name: 'family', type: 'string', documentation: '姓' },
    { name: 'given', type: 'string', documentation: '名' },
    { name: 'gender', type: 'token', documentation: '性别' },
    { name: 'birthdate', type: 'date', documentation: '出生日期' },
    { name: 'phone', type: 'token', documentation: '电话' },
  ],
  DiagnosticReport: [
    { name: '_id', type: 'token', documentation: '资源 ID' },
    { name: 'status', type: 'token', documentation: '状态' },
    { name: 'patient', type: 'reference', documentation: '患者引用' },
    { name: 'category', type: 'token', documentation: '类别' },
    { name: 'code', type: 'token', documentation: '代码' },
    { name: 'date', type: 'date', documentation: '生效日期' },
    { name: 'issued', type: 'date', documentation: '签发日期' },
  ],
  Observation: [
    { name: '_id', type: 'token', documentation: '资源 ID' },
    { name: 'code', type: 'token', documentation: '观察代码' },
    { name: 'patient', type: 'reference', documentation: '患者' },
    { name: 'category', type: 'token', documentation: '类别' },
    { name: 'value-quantity', type: 'quantity', documentation: '数值' },
    { name: 'date', type: 'date', documentation: '日期' },
  ],
  ServiceRequest: [
    { name: '_id', type: 'token', documentation: '资源 ID' },
    { name: 'status', type: 'token', documentation: '状态' },
    { name: 'patient', type: 'reference', documentation: '患者' },
    { name: 'code', type: 'token', documentation: '代码' },
    { name: 'orderer', type: 'reference', documentation: '开单者' },
  ],
  ImagingStudy: [
    { name: '_id', type: 'token', documentation: '资源 ID' },
    { name: 'patient', type: 'reference', documentation: '患者' },
    { name: 'modality', type: 'token', documentation: '成像模态' },
    { name: 'started', type: 'date', documentation: '开始时间' },
  ],
};

interface StoredResource {
  type: string;
  id: string;
  versionId: string;
  lastUpdated: string;
  resource: Record<string, unknown>;
  tags: string[];
  search: Record<string, string[]>;
}

function nowIso(): string { return new Date().toISOString(); }
function genId(): string { return `rid-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`; }

function indexResource(r: Record<string, unknown>): Record<string, string[]> {
  const idx: Record<string, string[]> = {};
  const add = (k: string, v: unknown) => {
    if (v === null || v === undefined) return;
    if (Array.isArray(v)) v.forEach((vv) => add(k, vv));
    else if (typeof v === 'object') {
      const o = v as Record<string, unknown>;
      add(k, o.value);
      add(k, o.display);
      add(k, o.reference);
    } else {
      const s = String(v).trim();
      if (s) (idx[k] ??= []).push(s.toLowerCase());
    }
  };
  add('id', r['id']);
  add('status', r['status']);
  add('gender', r['gender']);
  const subject = r['subject'] as Record<string, unknown> | undefined;
  add('subject', subject?.['reference']);
  const code = r['code'] as Record<string, unknown> | undefined;
  const coding = code?.['coding'] as Array<Record<string, unknown>> | undefined;
  coding?.forEach((c) => { add('code', c['code']); add('code', c['display']); });
  const name = r['name'] as Array<Record<string, unknown>> | undefined;
  name?.forEach((n) => { add('name', n['text']); add('family', n['family']); add('given', (n['given'] as string[] | undefined)?.join(' ')); });
  add('birthDate', r['birthDate']);
  return idx;
}

// ============================================================
// 1. FhirServer 类
// ============================================================
export class FhirServer {
  private version: FhirVersion;
  private baseUrl: string;
  private store: Map<string, StoredResource> = new Map<string, StoredResource>();
  private idCounter = 0;
  private storageLimit: number;
  private auditLog: { ts: string; op: string; type: string; id: string }[] = [];

  constructor(opts: { baseUrl?: string; version?: FhirVersion; storageLimit?: number } = {}) {
    this.baseUrl = opts.baseUrl ?? 'https://fhir.g005.local/r4';
    this.version = opts.version ?? 'R4';
    this.storageLimit = opts.storageLimit ?? 10_000;
  }

  // ----------------- 能力声明 -----------------
  capabilityStatement(): FhirCapabilityStatement {
    return {
      resourceType: 'CapabilityStatement',
      status: 'active',
      date: nowIso(),
      publisher: 'G005 RIS Integration',
      kind: 'instance',
      software: { name: 'G005-FHIR-Server', version: '3.0.6.0' },
      fhirVersion: this.version,
      format: ['json', 'xml'],
      rest: [{
        mode: 'server',
        security: { cors: true, service: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/restful-security-service', code: 'SMART-on-FHIR' }] }] },
        resource: RESOURCE_TYPES.map((t) => ({
          type: t,
          interaction: [
            { code: 'read' },
            { code: 'search-type' },
            { code: 'create' },
            { code: 'update' },
            { code: 'delete' },
          ],
          searchParam: SEARCH_PARAMS[t] ?? [{ name: '_id', type: 'token', documentation: '资源 ID' }],
          versioning: 'versioned-update',
        })),
      }],
    };
  }

  // ----------------- 元数据 -----------------
  metadata(): { server: string; fhirVersion: FhirVersion; total: number; types: string[]; lastUpdated: string } {
    const types = new Set<string>();
    for (const v of this.store.values()) types.add(v.type);
    return {
      server: 'G005-FHIR-Server',
      fhirVersion: this.version,
      total: this.store.size,
      types: Array.from(types),
      lastUpdated: nowIso(),
    };
  }

  // ----------------- CRUD -----------------
  read(type: string, id: string): { resource: StoredResource; etag: string } | null {
    const key = this.key(type, id);
    const stored = this.store.get(key);
    if (!stored) return null;
    this.audit('read', type, id);
    return { resource: stored, etag: `W/"${stored.versionId}"` };
  }

  vread(type: string, id: string, versionId: string): StoredResource | null {
    const stored = this.read(type, id);
    if (!stored) return null;
    if (stored.resource.versionId !== versionId) return null;
    return stored.resource;
  }

  create(resource: Record<string, unknown>, typeOverride?: string): { ok: true; resource: StoredResource; etag: string; status: 201 } | { ok: false; outcome: FhirOperationOutcome; status: number } {
    const type = (typeOverride ?? (resource['resourceType'] as string) ?? '').trim();
    if (!type) return this.fail(400, 'invalid', '缺少 resourceType');
    if (!RESOURCE_TYPES.includes(type as FhirResourceType)) {
      // 仍允许非预置类型(自定义)
    }
    if (!resource['id']) resource['id'] = genId();
    const id = String(resource['id']);
    const versionId = '1';
    const stored: StoredResource = {
      type, id, versionId,
      lastUpdated: nowIso(),
      resource,
      tags: [],
      search: indexResource(resource),
    };
    this.store.set(this.key(type, id), stored);
    this.idCounter += 1;
    this.audit('create', type, id);
    if (this.store.size > this.storageLimit) {
      // 驱逐最旧
      const oldestKey = this.store.keys().next().value;
      if (oldestKey) this.store.delete(oldestKey);
    }
    return { ok: true, resource: stored, etag: `W/"${versionId}"`, status: 201 };
  }

  update(type: string, id: string, resource: Record<string, unknown>, ifMatch?: string): { ok: true; resource: StoredResource; etag: string; status: 200 } | { ok: false; outcome: FhirOperationOutcome; status: number } {
    const key = this.key(type, id);
    const existing = this.store.get(key);
    if (!existing) return this.fail(404, 'not-found', `资源 ${type}/${id} 不存在`);
    if (ifMatch && ifMatch !== `W/"${existing.versionId}"`) {
      return this.fail(412, 'conflict', `ETag 不匹配: 期望 ${ifMatch}, 实际 W/"${existing.versionId}"`);
    }
    const versionId = String(Number(existing.versionId) + 1);
    const updated: StoredResource = {
      type, id, versionId, lastUpdated: nowIso(),
      resource: { ...resource, id, resourceType: type },
      tags: existing.tags,
      search: indexResource(resource),
    };
    this.store.set(key, updated);
    this.audit('update', type, id);
    return { ok: true, resource: updated, etag: `W/"${versionId}"`, status: 200 };
  }

  patch(type: string, id: string, patch: Record<string, unknown>): { ok: true; resource: StoredResource; etag: string; status: 200 } | { ok: false; outcome: FhirOperationOutcome; status: number } {
    const existing = this.store.get(this.key(type, id));
    if (!existing) return this.fail(404, 'not-found', `资源 ${type}/${id} 不存在`);
    const merged: Record<string, unknown> = { ...existing.resource, ...patch, id, resourceType: type };
    return this.update(type, id, merged);
  }

  delete(type: string, id: string): { ok: true; status: 204 } | { ok: false; outcome: FhirOperationOutcome; status: number } {
    const key = this.key(type, id);
    if (!this.store.has(key)) return this.fail(404, 'not-found', `资源 ${type}/${id} 不存在`);
    this.store.delete(key);
    this.audit('delete', type, id);
    return { ok: true, status: 204 };
  }

  // ----------------- 搜索 -----------------
  search(type: string, params: Record<string, string> = {}): FhirSearchResult | FhirOperationOutcome {
    const all = Array.from(this.store.values()).filter((r) => r.type === type);
    let filtered = all;
    for (const [k, v] of Object.entries(params)) {
      if (k === '_id') { filtered = filtered.filter((r) => r.id === v); continue; }
      if (k === '_count') continue;
      if (k === '_offset') continue;
      if (k === '_sort') continue;
      if (k === '_include') continue;
      const lower = v.toLowerCase();
      filtered = filtered.filter((r) => r.search[k]?.some((sv) => sv.includes(lower)) ?? false);
    }
    const count = Math.min(Number(params['_count'] ?? '20'), 200);
    const offset = Number(params['_offset'] ?? '0');
    const paged = filtered.slice(offset, offset + count);
    const entry: FhirSearchResult['entry'] = paged.map((r) => ({
      fullUrl: `${this.baseUrl}/${r.type}/${r.id}`,
      resource: r.resource,
      search: { mode: 'match' },
    }));
    const url = `${this.baseUrl}/${type}?${new URLSearchParams(params).toString()}`;
    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: filtered.length,
      link: [
        { relation: 'self', url },
        ...(offset + count < filtered.length ? [{ relation: 'next' as const, url: `${this.baseUrl}/${type}?_offset=${offset + count}` }] : []),
      ],
      entry,
    };
  }

  // ----------------- 事务 / Bundle -----------------
  transaction(bundle: FhirBundle): { status: number; body: FhirBundle | FhirOperationOutcome } {
    if (bundle.type !== 'transaction' && bundle.type !== 'batch') {
      return { status: 400, body: this.outcome('error', 'invalid', 'Bundle.type 必须为 transaction 或 batch') };
    }
    const responseEntries: FhirBundleEntry[] = [];
    const allOk = bundle.entry.every((entry) => {
      const req = entry.request;
      if (!req) {
        responseEntries.push({ response: { status: '400' } });
        return false;
      }
      const url = req.url;
      const [type, id] = url.split('/');
      let status: number;
      if (req.method === 'POST') {
        const r = this.create(entry.resource ?? {}, type);
        if (r.ok) {
          status = 201;
          responseEntries.push({ response: { status: '201', location: `${type}/${r.resource.id}` } });
        } else { status = r.status; responseEntries.push({ response: { status: String(status) } }); return false; }
      } else if (req.method === 'PUT' && id) {
        const r = this.update(type ?? '', id, entry.resource ?? {}, req.ifMatch);
        if (r.ok) { status = 200; responseEntries.push({ response: { status: '200', etag: r.etag } }); }
        else { status = r.status; responseEntries.push({ response: { status: String(status) } }); return false; }
      } else if (req.method === 'DELETE' && id) {
        const r = this.delete(type ?? '', id);
        status = r.ok ? 204 : r.status;
        responseEntries.push({ response: { status: String(status) } });
        if (!r.ok) return false;
      } else if (req.method === 'GET' && id) {
        const r = this.read(type ?? '', id);
        status = r ? 200 : 404;
        responseEntries.push({ response: { status: String(status) } });
        if (!r) return false;
      } else {
        responseEntries.push({ response: { status: '400' } });
        return false;
      }
      void status;
      return true;
    });
    const body: FhirBundle = {
      resourceType: 'Bundle',
      type: bundle.type === 'transaction' ? 'transaction-response' : 'batch-response',
      entry: responseEntries,
    };
    return { status: allOk ? 200 : 207, body };
  }

  // ----------------- 内部 -----------------
  private key(type: string, id: string): string { return `${type}/${id}`; }

  private fail(status: number, code: string, diagnostics: string): { ok: false; outcome: FhirOperationOutcome; status: number } {
    return { ok: false, outcome: this.outcome('error', code, diagnostics), status };
  }

  outcome(severity: FhirOperationOutcomeIssue['severity'], code: string, diagnostics?: string): FhirOperationOutcome {
    return {
      resourceType: 'OperationOutcome',
      meta: { lastUpdated: nowIso() },
      issue: [{ severity, code, diagnostics }],
    };
  }

  listResources(): FhirResourceEnvelope[] {
    return Array.from(this.store.values()).map((r) => ({
      resourceType: r.type as FhirResourceType,
      id: r.id,
      meta: { versionId: r.versionId, lastUpdated: r.lastUpdated },
      resource: r.resource,
    }));
  }

  listByType(type: string): FhirResourceEnvelope[] {
    return this.listResources().filter((r) => r.resourceType === type);
  }

  private audit(op: string, type: string, id: string): void {
    this.auditLog.push({ ts: nowIso(), op, type, id });
    if (this.auditLog.length > 1000) this.auditLog.shift();
  }

  getAuditLog() { return [...this.auditLog]; }
  count() { return this.store.size; }
  getBaseUrl() { return this.baseUrl; }
  getVersion() { return this.version; }
  clear() { this.store.clear(); this.auditLog = []; }
}

// ============================================================
// 2. 单例便捷访问
// ============================================================
let defaultServer: FhirServer | null = null;

export function getDefaultFhirServer(): FhirServer {
  if (!defaultServer) defaultServer = new FhirServer();
  return defaultServer;
}

export function resetDefaultFhirServer(): void {
  defaultServer = null;
}

export { RESOURCE_TYPES, SEARCH_PARAMS };
