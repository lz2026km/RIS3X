/**
 * G005 放射RIS系统 v3.0.6.0 - ATNA(Audit Trail and Node Authentication)审计记录器
 * 20 升级点:AuditMessage 构造 / 哈希链 / 加密标记 / SYSLOG 发送 / 检索
 */

import type { AtnaAuditLogEntry, AtnaAuditMessage, AtnaParticipantObject, AtnaEventOutcome, AtnaEventAction } from '../../../types/integration';

const RETENTION_DAYS_DEFAULT = 2555; // 7 年(医疗合规)

interface LogStorage {
  entries: AtnaAuditLogEntry[];
  capacity: number;
  hashSeed: string;
  retentionDays: number;
}

const storage: LogStorage = {
  entries: [],
  capacity: 100_000,
  hashSeed: 'G005-ATNA-2026',
  retentionDays: RETENTION_DAYS_DEFAULT,
};

let sequence = 0;
const auditSourceID = 'G005-RIS-AUDIT-SOURCE-1';
const enterpriseSiteID = 'urn:oid:1.2.840.113556.1.8000.2554.1';

function nowIso(): string { return new Date().toISOString(); }

function simpleHash(input: string): string {
  // 32-bit FNV-1a
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

function nextHash(prev: AtnaAuditLogEntry | undefined, payload: AtnaAuditMessage): string {
  const base = `${storage.hashSeed}|${prev?.hash ?? ''}|${payload.eventId.code}|${payload.eventDateTime}|${payload.userID}|${sequence}`;
  return simpleHash(base);
}

// ============================================================
// 1. 事件记录 API
// ============================================================
export interface LogEventInput {
  eventId: { code: string; displayName: string; codeSystem: 'DCM' | 'IHE' | '99PERCENT' };
  outcome: AtnaEventOutcome;
  actionCode?: AtnaEventAction;
  userID: string;
  userName?: string;
  sourceID: string;
  sourceAddress?: string;
  alternativeUserID?: string;
  participantObjects: AtnaParticipantObject[];
  auditSourceID?: string;
  enterpriseSiteID?: string;
  encrypted?: boolean;
  signature?: string;
}

export function logEvent(input: LogEventInput): AtnaAuditLogEntry {
  sequence += 1;
  const ts = nowIso();
  const event: AtnaAuditMessage = {
    eventId: input.eventId,
    eventDateTime: ts,
    eventOutcome: input.outcome,
    eventActionCode: input.actionCode,
    userID: input.userID,
    userName: input.userName,
    userIsRequestor: true,
    sourceType: '1',
    sourceID: input.sourceID,
    sourceAddress: input.sourceAddress,
    alternativeUserID: input.alternativeUserID,
    auditSourceID: input.auditSourceID ?? auditSourceID,
    enterpriseSiteID: input.enterpriseSiteID ?? enterpriseSiteID,
    participantObjects: input.participantObjects,
    messageType: 'AuditMessage',
    messageId: `ATNA-${ts}-${sequence}`,
  };
  const prev = storage.entries[storage.entries.length - 1];
  const hash = nextHash(prev, event);
  const entry: AtnaAuditLogEntry = {
    ...event,
    id: `audit-${sequence}`,
    recordedAt: ts,
    hash,
    previousHash: prev?.hash,
    sequence,
    retention: storage.retentionDays,
    encrypted: input.encrypted ?? false,
    signature: input.signature,
  };
  storage.entries.push(entry);
  if (storage.entries.length > storage.capacity) storage.entries.shift();
  return entry;
}

// ============================================================
// 2. 预置便捷 API
// ============================================================
export function logPatientRecordEvent(opts: {
  outcome: AtnaEventOutcome;
  userID: string;
  userName?: string;
  sourceID: string;
  patientId: string;
  patientName?: string;
  actionCode: 'C' | 'R' | 'U' | 'D';
}): AtnaAuditLogEntry {
  return logEvent({
    eventId: { code: '110110', displayName: 'Patient Record', codeSystem: 'DCM' },
    outcome: opts.outcome, userID: opts.userID, userName: opts.userName, sourceID: opts.sourceID,
    actionCode: opts.actionCode,
    participantObjects: [{
      participantObjectType: '1', participantObjectTypeCodeRole: '1',
      participantObjectID: opts.patientId, participantObjectName: opts.patientName,
    }],
  });
}

export function logReportViewEvent(opts: {
  outcome: AtnaEventOutcome; userID: string; userName?: string; sourceID: string;
  reportId: string; patientId: string;
}): AtnaAuditLogEntry {
  return logEvent({
    eventId: { code: '110107', displayName: 'Report', codeSystem: 'DCM' },
    outcome: opts.outcome, userID: opts.userID, userName: opts.userName, sourceID: opts.sourceID,
    actionCode: 'R',
    participantObjects: [{
      participantObjectType: '2', participantObjectTypeCodeRole: '3',
      participantObjectID: opts.reportId,
      participantObjectContainsStudy: [{ studyInstanceUID: opts.patientId }],
    }],
  });
}

export function logDicomExportEvent(opts: {
  outcome: AtnaEventOutcome; userID: string; userName?: string; sourceID: string;
  studyInstanceUID: string;
}): AtnaAuditLogEntry {
  return logEvent({
    eventId: { code: '110106', displayName: 'Export', codeSystem: 'DCM' },
    outcome: opts.outcome, userID: opts.userID, userName: opts.userName, sourceID: opts.sourceID,
    actionCode: 'C',
    participantObjects: [{
      participantObjectType: '2', participantObjectTypeCodeRole: '3',
      participantObjectID: opts.studyInstanceUID,
    }],
  });
}

export function logLoginEvent(opts: {
  outcome: AtnaEventOutcome; userID: string; userName?: string; sourceID: string; sourceAddress?: string;
}): AtnaAuditLogEntry {
  return logEvent({
    eventId: { code: '110122', displayName: 'User Authentication', codeSystem: 'DCM' },
    outcome: opts.outcome, userID: opts.userID, userName: opts.userName, sourceID: opts.sourceID, sourceAddress: opts.sourceAddress,
    participantObjects: [],
  });
}

// ============================================================
// 3. 检索 / 验证
// ============================================================
export interface LogQuery {
  userID?: string;
  eventCode?: string;
  patientId?: string;
  reportId?: string;
  outcome?: AtnaEventOutcome;
  from?: string;
  to?: string;
  limit?: number;
}

export function queryLog(q: LogQuery = {}): AtnaAuditLogEntry[] {
  let arr = storage.entries.slice();
  if (q.userID) arr = arr.filter((e) => e.userID === q.userID);
  if (q.eventCode) arr = arr.filter((e) => e.eventId.code === q.eventCode);
  if (q.outcome) arr = arr.filter((e) => e.eventOutcome === q.outcome);
  if (q.patientId) arr = arr.filter((e) => e.participantObjects.some((p) => p.participantObjectID === q.patientId));
  if (q.reportId) arr = arr.filter((e) => e.participantObjects.some((p) => p.participantObjectID === q.reportId));
  if (q.from) arr = arr.filter((e) => e.recordedAt >= q.from!);
  if (q.to) arr = arr.filter((e) => e.recordedAt <= q.to!);
  if (q.limit) arr = arr.slice(-q.limit);
  return arr;
}

// ============================================================
// 4. 哈希链验证
// ============================================================
export function verifyChain(): { ok: boolean; brokenAt?: number; total: number } {
  let prev: AtnaAuditLogEntry | undefined;
  for (let i = 0; i < storage.entries.length; i++) {
    const e = storage.entries[i];
    if (!e) continue;
    if (prev && e.previousHash !== prev.hash) return { ok: false, brokenAt: i, total: storage.entries.length };
    prev = e;
  }
  return { ok: true, total: storage.entries.length };
}

// ============================================================
// 5. 导出 / 维护
// ============================================================
export function exportLog(format: 'json' | 'csv' = 'json'): string {
  if (format === 'csv') {
    const head = 'id,ts,user,event,outcome,action,hash';
    const rows = storage.entries.map((e) => [e.id, e.recordedAt, e.userID, e.eventId.code, e.eventOutcome, e.eventActionCode ?? '', e.hash].join(','));
    return [head, ...rows].join('\n');
  }
  return JSON.stringify(storage.entries, null, 2);
}

export function purgeExpired(now = new Date()): number {
  const cutoff = now.getTime() - storage.retentionDays * 24 * 60 * 60 * 1000;
  const before = storage.entries.length;
  storage.entries = storage.entries.filter((e) => new Date(e.recordedAt).getTime() > cutoff);
  return before - storage.entries.length;
}

export function clearLog(): void { storage.entries = []; sequence = 0; }
export function getLogStats() { return { count: storage.entries.length, capacity: storage.capacity, retentionDays: storage.retentionDays, sequence }; }
export function setRetentionDays(days: number): void { storage.retentionDays = days; }

// ============================================================
// 6. SYSLOG(RFC5424)格式化
// ============================================================
export function toSyslogRfc5424(e: AtnaAuditLogEntry): string {
  const pri = (13 * 8) + 6; // local0.info
  const ts = e.recordedAt;
  const hostname = e.sourceID;
  const appName = e.auditSourceID;
  const msgID = e.eventId.code;
  const sd = `[audit@32473 event="${e.eventId.code}" outcome="${e.eventOutcome}" user="${e.userID}" actorType="user"]`;
  return `<${pri}>1 ${ts} ${hostname} ${appName} ${e.id} ${msgID} ${sd} ATNA: ${e.eventId.displayName}`;
}
