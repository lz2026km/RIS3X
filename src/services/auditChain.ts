// ============================================================
// G005 放射RIS系统 v3.0.6 - 审计链 (Merkle Tree)
// Phase R9 W7: 不可篡改的操作日志
// v3.0.6: 桥接到 AuditLogger (支持结构化审计事件)
// ============================================================

import { sha256, canonicalJson } from './caService';
import { auditLogger } from './security/audit/AuditLogger';
import { integrityChecker } from './security/audit/IntegrityChecker';
import type { AuditLogEntry as NewAuditEntry } from '../types/security';

// 重新导出新审计模块的类型/函数,保持向后兼容
export type { NewAuditEntry };

export type AuditAction =
  | 'created' | 'updated' | 'signed' | 'finalized' | 'amended' | 'cancelled'
  | 'reviewed' | 'printed' | 'exported' | 'shared' | 'locked' | 'unlocked'
  | 'image-viewed' | 'annotation-added' | 'critical-notified' | 'collaboration-joined'
  | 'login' | 'logout' | 'permission-changed';

export interface AuditEntry {
  seq: number;                // 序列号
  timestamp: string;          // ISO
  reportId: string;           // 关联报告
  actor: string;              // 用户 ID
  action: AuditAction;
  detail?: string;            // 操作详情
  prevHash: string;           // 前一个 hash
  hash: string;               // 当前 hash
  // 签名
  signature?: string;         // base64
  certSerial?: string;
}

export interface MerkleProof {
  leafIndex: number;
  leafHash: string;
  siblings: Array<{ hash: string; position: 'left' | 'right' }>;
  rootHash: string;
}

export interface MerkleTree {
  leaves: string[];           // 叶子节点 hash
  layers: string[][];         // 0=leaves, 1=parents, ..., last=[root]
  root: string;
}

const AUDIT_KEY = 'g005.auditLog.v1';

function loadLog(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_KEY);
    return raw ? JSON.parse(raw) as AuditEntry[] : [];
  } catch (err) { console.error('[AuditChain] loadLog failed:', err); return []; }
}

function saveLog(log: AuditEntry[]): void {
  try { localStorage.setItem(AUDIT_KEY, JSON.stringify(log)); } catch (err) { console.error('[AuditChain] saveLog quota exceeded:', err); }
}

async function hmacLike(data: string): Promise<string> {
  return sha256(data);
}

export async function appendAudit(opts: {
  reportId: string;
  actor: string;
  action: AuditAction;
  detail?: string;
  signer?: { privateKey: CryptoKey; certSerial: string; sign: (d: string) => Promise<string> };
  actorName?: string;
  actorRole?: string;
  actorDepartment?: string;
  targetName?: string;
  ipAddress?: string;
  sessionId?: string;
  riskScore?: number;
}): Promise<AuditEntry> {
  // v3.0.6: 同步写入新 AuditLogger (结构化事件)
  const dataCategory: 'data_change' | 'auth' | 'authorization' | 'phi' | 'security' = (
    opts.action === 'login' || opts.action === 'logout' || opts.action === 'permission-changed' ? 'auth'
    : opts.action === 'image-viewed' || opts.action === 'annotation-added' ? 'phi'
    : opts.action === 'printed' || opts.action === 'exported' || opts.action === 'shared' ? 'data_change'
    : 'data_change'
  );
  await auditLogger.log({
    category: dataCategory,
    severity: opts.riskScore && opts.riskScore >= 70 ? 'warning' : 'info',
    actor: {
      userId: opts.actor,
      userName: opts.actorName ?? opts.actor,
      role: opts.actorRole ?? 'unknown',
      ...(opts.actorDepartment ? { department: opts.actorDepartment } : {}),
    },
    action: opts.action,
    target: {
      type: opts.action === 'login' || opts.action === 'logout' ? 'user' : 'report',
      id: opts.reportId,
      ...(opts.targetName ? { name: opts.targetName } : {}),
    },
    detail: opts.detail ? { message: opts.detail } : undefined,
    source: {
      ipAddress: opts.ipAddress ?? '127.0.0.1',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      sessionId: opts.sessionId ?? 'auditChain',
    },
    riskScore: opts.riskScore ?? 10,
  });

  // 保持向后兼容的 localStorage 链
  const log = loadLog();
  const seq = log.length;
  const timestamp = new Date().toISOString();
  const prevHash = seq === 0 ? '0'.repeat(64) : (log[seq - 1]?.hash ?? '0'.repeat(64));

  const tbs = canonicalJson({ seq, timestamp, reportId: opts.reportId, actor: opts.actor, action: opts.action, detail: opts.detail, prevHash });
  const hash = await hmacLike(tbs);
  let signature: string | undefined;
  if (opts.signer) {
    signature = await opts.signer.sign(tbs);
  }
  const entry: AuditEntry = {
    seq, timestamp,
    reportId: opts.reportId,
    actor: opts.actor,
    action: opts.action,
    detail: opts.detail,
    prevHash, hash,
    signature,
    certSerial: opts.signer?.certSerial,
  };
  log.push(entry);
  saveLog(log);
  return entry;
}

export function getAuditLog(): AuditEntry[] {
  return loadLog();
}

export function getReportAudit(reportId: string): AuditEntry[] {
  return loadLog().filter(e => e.reportId === reportId);
}

export function getActorAudit(actor: string): AuditEntry[] {
  return loadLog().filter(e => e.actor === actor);
}

/** v3.0.6 新增: 通过 AuditLogger 查询 (结构化字段) */
export function queryStructuredAudit(filters: Parameters<typeof auditLogger.query>[0]): NewAuditEntry[] {
  return auditLogger.query(filters);
}

/** v3.0.6 新增: 审计日志完整性校验 */
export function verifyIntegrity(entries?: AuditEntry[]): ReturnType<typeof integrityChecker.verifyChain> {
  return integrityChecker.verifyChain((entries ?? loadLog()) as unknown as NewAuditEntry[]);
}

export { verifyCertificate } from './caService';

// ============================================================
// 验证链
// ============================================================

export async function verifyAuditChain(entries: AuditEntry[]): Promise<{ valid: boolean; brokenAt?: number; reason?: string }> {
  let prevHash = '0'.repeat(64);
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    if (e.prevHash !== prevHash) {
      return { valid: false, brokenAt: i, reason: `prevHash mismatch at #${i}` };
    }
    const tbs = canonicalJson({
      seq: e.seq,
      timestamp: e.timestamp,
      reportId: e.reportId,
      actor: e.actor,
      action: e.action,
      detail: e.detail,
      prevHash: e.prevHash,
    });
    const expected = await hmacLike(tbs);
    if (expected !== e.hash) {
      return { valid: false, brokenAt: i, reason: `hash mismatch at #${i}` };
    }
    prevHash = e.hash;
  }
  return { valid: true };
}

// ============================================================
// Merkle 树
// ============================================================

export async function buildMerkleTree(leaves: string[]): Promise<MerkleTree> {
  if (leaves.length === 0) {
    return { leaves: [], layers: [], root: '0'.repeat(64) };
  }
  const layers: string[][] = [leaves.slice()];
  if (leaves.length === 1) {
    const root = await syncHash(leaves[0]! + leaves[0]!);
    return { leaves, layers: [leaves, [root]], root };
  }
  while (layers[layers.length - 1]!.length > 1) {
    const prev = layers[layers.length - 1]!;
    const next: string[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      const left = prev[i]!;
      const right = i + 1 < prev.length ? prev[i + 1]! : left;
      const combined = (i + 1 < prev.length) ? left + right : left + left;
      next.push(await syncHash(combined));
    }
    layers.push(next);
  }
  return { leaves, layers, root: layers[layers.length - 1]![0]! };
}

async function syncHash(data: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const bytes = new TextEncoder().encode(data);
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256Fallback(data);
}

function sha256Fallback(data: string): string {
  function rrot(x: number, n: number): number { return (x >>> n) | (x << (32 - n)); }
  const K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
  const enc = new TextEncoder();
  const m = enc.encode(data);
  const bitLen = m.length * 8;
  const padded: number[] = [];
  for (let i = 0; i < m.length; i++) padded.push(m[i]!);
  padded.push(0x80);
  while ((padded.length * 8) % 512 !== 448) padded.push(0);
  for (let i = 7; i >= 0; i--) padded.push((bitLen >>> (i * 8)) & 0xff);
  const H = new Uint32Array([0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]);
  for (let i = 0; i < padded.length; i += 64) {
    const W = new Uint32Array(64);
    for (let t = 0; t < 16; t++) W[t] = (padded[i + t * 4]! << 24) | (padded[i + t * 4 + 1]! << 16) | (padded[i + t * 4 + 2]! << 8) | padded[i + t * 4 + 3]!;
    for (let t = 16; t < 64; t++) {
      const s0 = rrot(W[t - 15]!, 7) ^ rrot(W[t - 15]!, 18) ^ (W[t - 15]! >>> 3);
      const s1 = rrot(W[t - 2]!, 17) ^ rrot(W[t - 2]!, 19) ^ (W[t - 2]! >>> 10);
      W[t] = (W[t - 16]! + s0 + W[t - 7]! + s1) >>> 0;
    }
    let a = H[0]!, b = H[1]!, c = H[2]!, d = H[3]!, e = H[4]!, f = H[5]!, g = H[6]!, h = H[7]!;
    for (let t = 0; t < 64; t++) {
      const S1 = rrot(e, 6) ^ rrot(e, 11) ^ rrot(e, 25);
      const ch = (e & f) ^ ((~e >>> 0) & g);
      const temp1 = (h + S1 + ch + K[t]! + W[t]!) >>> 0;
      const S0 = rrot(a, 2) ^ rrot(a, 13) ^ rrot(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    H[0] = (H[0]! + a) >>> 0; H[1] = (H[1]! + b) >>> 0; H[2] = (H[2]! + c) >>> 0; H[3] = (H[3]! + d) >>> 0;
    H[4] = (H[4]! + e) >>> 0; H[5] = (H[5]! + f) >>> 0; H[6] = (H[6]! + g) >>> 0; H[7] = (H[7]! + h) >>> 0;
  }
  let hex = '';
  for (let i = 0; i < 8; i++) hex += H[i]!.toString(16).padStart(8, '0');
  return hex;
}

export function merkleProof(tree: MerkleTree, leafIndex: number): MerkleProof | null {
  if (leafIndex < 0 || leafIndex >= tree.leaves.length) return null;
  const siblings: Array<{ hash: string; position: 'left' | 'right' }> = [];
  let idx = leafIndex;
  for (let layer = 0; layer < tree.layers.length - 1; layer++) {
    const current = tree.layers[layer]!;
    const pairIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    const sibling = pairIdx < current.length ? current[pairIdx]! : current[idx]!;
    const position: 'left' | 'right' = idx % 2 === 0 ? 'right' : 'left';
    siblings.push({ hash: sibling, position });
    idx = Math.floor(idx / 2);
  }
  return {
    leafIndex,
    leafHash: tree.leaves[leafIndex]!,
    siblings,
    rootHash: tree.root,
  };
}

export async function verifyMerkleProof(proof: MerkleProof): Promise<boolean> {
  let current = proof.leafHash;
  let idx = proof.leafIndex;
  for (const s of proof.siblings) {
    const isLeft = idx % 2 === 0;
    const combined = isLeft ? current + s.hash : s.hash + current;
    current = await syncHash(combined);
    idx = Math.floor(idx / 2);
  }
  return current === proof.rootHash;
}

// 工具：从审计日志构建 Merkle 树
export async function merkleFromAudit(entries: AuditEntry[]): Promise<MerkleTree> {
  const leaves = entries.map(e => e.hash);
  return await buildMerkleTree(leaves);
}

// 导出审计快照
export function exportAuditSnapshot(entries: AuditEntry[]) {
  return {
    exportedAt: new Date().toISOString(),
    count: entries.length,
    entries,
    firstHash: entries[0]?.hash ?? null,
    lastHash: entries[entries.length - 1]?.hash ?? null,
  };
}

// 清除（仅测试）
export function clearAudit(): void {
  saveLog([]);
}
