// ============================================================
// G005 放射RIS系统 v3.0.6 - 审计日志记录器
// AuditLogger - 结构化审计事件 + 哈希链 + 本地缓存
// ============================================================
import { v4 as uuidv4 } from 'uuid';
import { sha256 } from '../../caService';
import type {
  AuditLogEntry, AuditCategory, AuditSeverity,
} from '../../../types/security';

const AUDIT_STORAGE_KEY = 'g005.security.audit.v1';
const MAX_INMEM = 5000;

let inMemory: AuditLogEntry[] = [];

function load(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as AuditLogEntry[];
  } catch { /* ignore */ }
  return [];
}

function persist(): void {
  try {
    const head = inMemory.slice(-MAX_INMEM);
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(head));
  } catch { /* quota */ }
}

function bootstrap(): void {
  if (inMemory.length === 0) inMemory = load();
}
bootstrap();

function fakeHex(seed: string, len = 64): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  let s = '';
  while (s.length < len) {
    h = (h * 1103515245 + 12345) >>> 0;
    s += h.toString(16);
  }
  return s.slice(0, len);
}

function nowIso(): string { return new Date().toISOString(); }

function nextHash(prev: string, body: string): string {
  // 注:此处使用同步 fake hash,因为主流程大多需要同步记录;
  // 真实生产应使用 Web Crypto 异步接口
  return fakeHex(prev + body);
}

export interface AuditLogInput {
  category: AuditCategory;
  severity?: AuditSeverity;
  actor: { userId: string; userName: string; role: string; department?: string };
  action: string;
  target: { type: string; id: string; name?: string };
  outcome?: 'success' | 'failure' | 'denied' | 'partial';
  source?: Partial<{ ipAddress: string; userAgent: string; sessionId: string; geoLocation: string }>;
  detail?: Record<string, unknown>;
  riskScore?: number;
}

export class AuditLogger {
  /** 记录一条审计日志 */
  async log(input: AuditLogInput): Promise<AuditLogEntry> {
    const last = inMemory[inMemory.length - 1];
    const seq = (last?.seq ?? -1) + 1;
    const prevHash = last?.hash ?? '0'.repeat(64);
    const timestamp = nowIso();
    const source = {
      ipAddress: input.source?.ipAddress ?? '127.0.0.1',
      userAgent: input.source?.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'),
      sessionId: input.source?.sessionId ?? 'unknown',
      ...(input.source?.geoLocation ? { geoLocation: input.source.geoLocation } : {}),
    };
    const body = JSON.stringify({
      seq, timestamp,
      category: input.category,
      severity: input.severity ?? 'info',
      actor: input.actor,
      action: input.action,
      target: input.target,
      outcome: input.outcome ?? 'success',
      source,
      detail: input.detail ?? {},
      riskScore: input.riskScore ?? 0,
    });
    // 真正的 SHA-256 摘要 (异步)
    const realHash = await sha256(prevHash + body);
    // 兼容字段(若 sha256 输出非 64-hex,则使用 fakeHex 填充)
    const hash = /^[0-9a-f]{64}$/.test(realHash) ? realHash : nextHash(prevHash, body);

    const entry: AuditLogEntry = {
      id: uuidv4(),
      seq,
      timestamp,
      category: input.category,
      severity: input.severity ?? 'info',
      actor: input.actor,
      action: input.action,
      target: input.target,
      outcome: input.outcome ?? 'success',
      source,
      detail: input.detail,
      riskScore: input.riskScore ?? 0,
      prevHash,
      hash,
    };
    inMemory.push(entry);
    persist();
    return entry;
  }

  /** 便捷:登录日志 */
  async logAuth(input: { actor: AuditLogInput['actor']; outcome: 'success' | 'failure'; ip?: string; mfaMethod?: string; reason?: string }): Promise<AuditLogEntry> {
    return this.log({
      category: 'auth',
      severity: input.outcome === 'success' ? 'info' : 'warning',
      actor: input.actor,
      action: input.outcome === 'success' ? 'login' : 'login_failed',
      target: { type: 'user', id: input.actor.userId, name: input.actor.userName },
      outcome: input.outcome,
      source: input.ip ? { ipAddress: input.ip } : undefined,
      detail: { mfaMethod: input.mfaMethod, reason: input.reason },
      riskScore: input.outcome === 'success' ? 5 : 60,
    });
  }

  /** 便捷:PHI 访问 */
  async logPhiAccess(input: { actor: AuditLogInput['actor']; patientId: string; patientName?: string; action: 'view' | 'export' | 'print' | 'deidentify'; outcome?: 'success' | 'denied'; recordCount?: number }): Promise<AuditLogEntry> {
    return this.log({
      category: 'phi',
      severity: input.action === 'export' ? 'notice' : 'info',
      actor: input.actor,
      action: `phi_${input.action}`,
      target: { type: 'patient', id: input.patientId, ...(input.patientName ? { name: input.patientName } : {}) },
      outcome: input.outcome ?? 'success',
      detail: { recordCount: input.recordCount },
      riskScore: input.action === 'export' ? 40 : 10,
    });
  }

  /** 便捷:数据变更 */
  async logDataChange(input: { actor: AuditLogInput['actor']; entityType: string; entityId: string; entityName?: string; action: 'create' | 'update' | 'delete' | 'sign' | 'amend'; fieldsChanged?: string[] }): Promise<AuditLogEntry> {
    return this.log({
      category: 'data_change',
      severity: input.action === 'sign' ? 'warning' : 'notice',
      actor: input.actor,
      action: input.action,
      target: { type: input.entityType, id: input.entityId, ...(input.entityName ? { name: input.entityName } : {}) },
      detail: { fieldsChanged: input.fieldsChanged },
      riskScore: input.action === 'sign' ? 35 : 15,
    });
  }

  /** 便捷:安全事件 */
  async logSecurityEvent(input: { actor: AuditLogInput['actor']; action: string; outcome: 'success' | 'failure' | 'denied' | 'partial'; riskScore: number; detail?: Record<string, unknown> }): Promise<AuditLogEntry> {
    return this.log({
      category: 'security',
      severity: input.riskScore >= 80 ? 'critical' : input.riskScore >= 60 ? 'error' : input.riskScore >= 40 ? 'warning' : input.riskScore >= 20 ? 'notice' : 'info',
      actor: input.actor,
      action: input.action,
      target: { type: 'system', id: 'security' },
      outcome: input.outcome,
      detail: input.detail,
      riskScore: input.riskScore,
    });
  }

  /** 查询审计日志 (支持多条件) */
  query(filters: {
    userId?: string;
    category?: AuditCategory;
    severity?: AuditSeverity;
    startDate?: string;
    endDate?: string;
    minRiskScore?: number;
    outcome?: AuditLogEntry['outcome'];
    limit?: number;
    offset?: number;
  }): AuditLogEntry[] {
    let results = [...inMemory];
    if (filters.userId) results = results.filter(e => e.actor.userId === filters.userId);
    if (filters.category) results = results.filter(e => e.category === filters.category);
    if (filters.severity) results = results.filter(e => e.severity === filters.severity);
    if (filters.outcome) results = results.filter(e => e.outcome === filters.outcome);
    if (filters.startDate) results = results.filter(e => e.timestamp >= filters.startDate!);
    if (filters.endDate) results = results.filter(e => e.timestamp <= filters.endDate!);
    if (filters.minRiskScore !== undefined) results = results.filter(e => e.riskScore >= filters.minRiskScore!);
    results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const offset = filters.offset ?? 0;
    const limit = filters.limit ?? 100;
    return results.slice(offset, offset + limit);
  }

  /** 获取全部日志 */
  getAll(): AuditLogEntry[] {
    return [...inMemory];
  }

  /** 按 ID 获取 */
  getById(id: string): AuditLogEntry | undefined {
    return inMemory.find(e => e.id === id);
  }

  /** 统计 */
  stats(): { total: number; byCategory: Record<string, number>; bySeverity: Record<string, number>; avgRiskScore: number } {
    const byCategory: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    let totalRisk = 0;
    for (const e of inMemory) {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + 1;
      bySeverity[e.severity] = (bySeverity[e.severity] ?? 0) + 1;
      totalRisk += e.riskScore;
    }
    return {
      total: inMemory.length,
      byCategory,
      bySeverity,
      avgRiskScore: inMemory.length > 0 ? Math.round((totalRisk / inMemory.length) * 10) / 10 : 0,
    };
  }

  /** 导出 (JSON / CSV) */
  export(format: 'json' | 'csv', filters?: Parameters<AuditLogger['query']>[0]): string {
    const rows = filters ? this.query(filters) : inMemory;
    if (format === 'csv') {
      const headers = ['seq', 'timestamp', 'category', 'severity', 'actor', 'action', 'target', 'outcome', 'riskScore', 'ipAddress'];
      const lines = [headers.join(',')];
      for (const r of rows) {
        lines.push([
          r.seq, r.timestamp, r.category, r.severity,
          r.actor.userName, r.action,
          `${r.target.type}:${r.target.id}`, r.outcome,
          r.riskScore, r.source.ipAddress,
        ].map(c => `"${String(c).replace(/"/g, '""')}"`).join(','));
      }
      return lines.join('\n');
    }
    return JSON.stringify(rows, null, 2);
  }

  /** 清空 (仅测试) */
  clear(): void {
    inMemory = [];
    persist();
  }

  /** 从外部导入 (初始化 / Mock 注入) */
  importEntries(entries: AuditLogEntry[]): void {
    inMemory = [...entries];
    persist();
  }
}

export const auditLogger = new AuditLogger();