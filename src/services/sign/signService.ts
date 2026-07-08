/**
 * G005 放射RIS系统 v3.0.5.1 - R3.SIGN 签章 Service
 * A5-REPORT / 100 点
 *
 * 签章主链路: selectCert -> auth -> biometric -> computeHash -> rsaSign -> timestamp -> blockchain -> persist
 */

import type {
  CertificateInfo,
  SignLogEntry,
  SignatureTimestamp,
  SignRevokeRequest,
  UnlockRequest,
  VerifyResult,
  SignProgress,
  SignatureAlgorithm,
  SignKPI,
} from '../../types/R3/R3.SIGN';
import { QUALITY_GATE } from '../../types/R3/R3.SIGN';
import type {
  BiometricModality,
  MultiModalSignPayload,
  MultiModalSignResult,
  ApprovalStatusSnapshot,
  ApprovalLookupParams,
} from '../../types/sign';
import { BlockchainService } from './blockchainService';
import {
  SIGN_CERTIFICATES,
  SIGN_LOGS,
  SIGN_REVOKE_REQUESTS,
  SIGN_TIMESTAMPS,
  UNLOCK_REQUESTS,
  VERIFY_RESULTS,
  SIGN_KPI,
} from '../../data/reportSignMock';

const MIN_DELAY_MS = 250;
const MAX_DELAY_MS = 600;
const HASH_ALGO = 'SHA-256';

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function randomDelay(): Promise<void> {
  return delay(MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS));
}

async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const buf = await crypto.subtle.digest(HASH_ALGO, enc);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  let h = 0;
  for (let i = 0; i < text.length; i++) {
    h = (h << 5) - h + text.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h).toString(16).padStart(8, '0').repeat(8);
}

function uuid(): string {
  return 'sig-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

function nowIso(): string {
  return new Date().toISOString();
}

export interface SignPayload {
  reportId: string;
  content: string;
  certificateId: string;
  password: string;
  algorithm: SignatureAlgorithm;
  qualityScore: number;
  includeBlockchain: boolean;
  includeTimestamp: boolean;
}

export interface SignResult {
  signatureId: string;
  reportId: string;
  contentHash: string;
  signatureValue: string;
  certificateSerial: string;
  algorithm: SignatureAlgorithm;
  signedAt: string;
  timestampId?: string;
  blockchainId?: string;
  progress: SignProgress[];
}

export class SignService {
  private certificates: CertificateInfo[] = [...SIGN_CERTIFICATES];
  private logs: SignLogEntry[] = [...SIGN_LOGS];
  private timestamps: SignatureTimestamp[] = [...SIGN_TIMESTAMPS];
  private revokeRequests: SignRevokeRequest[] = [...SIGN_REVOKE_REQUESTS];
  private unlockRequests: UnlockRequest[] = [...UNLOCK_REQUESTS];
  private blockchainService = new BlockchainService();

  async listCertificates(): Promise<CertificateInfo[]> {
    await randomDelay();
    return [...this.certificates];
  }

  async getCertificate(id: string): Promise<CertificateInfo | null> {
    await randomDelay();
    return this.certificates.find((c) => c.id === id) ?? null;
  }

  async getCertificateBySerial(serial: string): Promise<CertificateInfo | null> {
    await randomDelay();
    return this.certificates.find((c) => c.serialNumber === serial) ?? null;
  }

  async getActiveCertificateForUser(userId: string): Promise<CertificateInfo | null> {
    await randomDelay();
    return (
      this.certificates.find((c) => c.subject.userId === userId && c.status === 'active') ?? null
    );
  }

  async uploadCertificate(cert: Omit<CertificateInfo, 'id' | 'usageCount' | 'createdAt'>): Promise<CertificateInfo> {
    await randomDelay();
    const created: CertificateInfo = {
      ...cert,
      id: uuid(),
      usageCount: 0,
      createdAt: nowIso(),
    };
    this.certificates.push(created);
    return created;
  }

  async deleteCertificate(id: string): Promise<boolean> {
    await randomDelay();
    const idx = this.certificates.findIndex((c) => c.id === id);
    if (idx < 0) return false;
    this.certificates.splice(idx, 1);
    return true;
  }

  async validateCertificate(id: string): Promise<{ valid: boolean; reason?: string; cert: CertificateInfo }> {
    await randomDelay();
    const cert = this.certificates.find((c) => c.id === id);
    if (!cert) return { valid: false, reason: 'NOT_FOUND', cert: { id, serialNumber: '', subject: { commonName: '', userId: '', role: '' }, issuer: { commonName: '', userId: '' }, certType: 'RSA-SHA256', publicKeyFingerprint: '', notBefore: '', notAfter: '', status: 'expired', usageCount: 0, createdAt: '', createdBy: '' } };
    const now = new Date();
    if (new Date(cert.notAfter) < now) {
      return { valid: false, reason: 'EXPIRED', cert };
    }
    if (cert.status === 'revoked') {
      return { valid: false, reason: 'REVOKED', cert };
    }
    if (cert.status === 'suspended') {
      return { valid: false, reason: 'SUSPENDED', cert };
    }
    return { valid: true, cert };
  }

  async checkQualityGate(qualityScore: number): Promise<{ pass: boolean; reason?: string }> {
    await randomDelay();
    if (!QUALITY_GATE.required) return { pass: true };
    if (qualityScore < QUALITY_GATE.minimumScore) {
      return { pass: false, reason: `质量分 ${qualityScore} < ${QUALITY_GATE.minimumScore} 门禁` };
    }
    return { pass: true };
  }

  async signReport(payload: SignPayload): Promise<SignResult> {
    const progress: SignProgress[] = [];
    const startedAt = Date.now();

    const push = (p: SignProgress) => {
      progress.push(p);
    };

    push({ stage: 'idle', percent: 0, message: '开始签章', startedAt: nowIso() });
    await delay(150);

    const cert = await this.getCertificate(payload.certificateId);
    if (!cert) {
      push({ stage: 'failed', percent: 0, message: '证书不存在', finishedAt: nowIso() });
      throw new Error('Certificate not found');
    }

    push({ stage: 'select-cert', percent: 10, message: `已选择证书 ${cert.serialNumber}` });
    await delay(180);

    push({ stage: 'auth-verify', percent: 25, message: '校验签章密码' });
    await delay(200);
    if (payload.password.length < 6) {
      push({ stage: 'failed', percent: 25, message: '密码错误', finishedAt: nowIso() });
      throw new Error('Invalid password');
    }

    const gate = await this.checkQualityGate(payload.qualityScore);
    if (!gate.pass) {
      push({ stage: 'failed', percent: 25, message: gate.reason ?? '质量门禁未通过', finishedAt: nowIso() });
      throw new Error(gate.reason ?? 'Quality gate failed');
    }

    push({ stage: 'biometric', percent: 40, message: '人脸/指纹二次校验（mock）' });
    await delay(220);

    push({ stage: 'compute-hash', percent: 55, message: `计算 ${HASH_ALGO} 摘要` });
    const contentHash = await sha256Hex(`${payload.reportId}|${payload.content}|${payload.algorithm}`);
    await delay(180);

    push({ stage: 'rsa-sign', percent: 70, message: `${payload.algorithm} 私钥签名` });
    const sigSeed = `${payload.reportId}|${contentHash}|mock|${nowIso()}`;
    const signatureValue = await sha256Hex(sigSeed);
    await delay(200);

    let timestampId: string | undefined;
    if (payload.includeTimestamp) {
      push({ stage: 'timestamp', percent: 82, message: '请求 TSA 时间戳' });
      const ts = await this.requestTimestamp(payload.reportId, contentHash);
      timestampId = ts.id;
    }

    let blockchainId: string | undefined;
    if (payload.includeBlockchain) {
      push({ stage: 'blockchain-anchor', percent: 92, message: '区块链存证' });
      const bc = await this.blockchainService.anchorToBlockchain({
        reportId: payload.reportId,
        contentHash,
        signerId: cert.subject.userId,
        certificateSerial: cert.serialNumber,
      });
      blockchainId = bc.id;
    }

    push({ stage: 'complete', percent: 100, message: '签章完成', finishedAt: nowIso() });

    const signatureId = uuid();
    const log: SignLogEntry = {
      id: 'slog-' + Date.now().toString(36),
      reportId: payload.reportId,
      signerId: cert.subject.userId,
      signerName: cert.subject.commonName,
      signerTitle: cert.subject.title ?? '',
      certificateSerial: cert.serialNumber,
      algorithm: payload.algorithm,
      signedAt: nowIso(),
      ipAddress: '127.0.0.1',
      device: 'web-browser',
      action: 'sign',
      success: true,
      signatureValue,
      contentHash,
    };
    this.logs.push(log);

    cert.usageCount += 1;

    const finishedMs = Date.now() - startedAt;
    void finishedMs;

    return {
      signatureId,
      reportId: payload.reportId,
      contentHash,
      signatureValue,
      certificateSerial: cert.serialNumber,
      algorithm: payload.algorithm,
      signedAt: log.signedAt,
      timestampId,
      blockchainId,
      progress,
    };
  }

  async requestTimestamp(reportId: string, contentHash: string): Promise<SignatureTimestamp> {
    await randomDelay();
    const ts: SignatureTimestamp = {
      id: 'ts-' + Date.now().toString(36),
      reportId,
      timestamp: nowIso(),
      tsaName: 'G005 医院 TSA',
      tsaSerial: 'GHTSA-' + Date.now(),
      hashBefore: contentHash,
      hashAfter: contentHash.slice(0, 16) + '-ts',
      trustLevel: 'hospital',
      isValid: true,
    };
    this.timestamps.push(ts);
    return ts;
  }

  async listTimestamps(): Promise<SignatureTimestamp[]> {
    await randomDelay();
    return [...this.timestamps];
  }

  async listLogs(reportId?: string): Promise<SignLogEntry[]> {
    await randomDelay();
    if (!reportId) return [...this.logs];
    return this.logs.filter((l) => l.reportId === reportId);
  }

  async revokeSignature(req: Omit<SignRevokeRequest, 'id' | 'status' | 'createdAt'>): Promise<SignRevokeRequest> {
    await randomDelay();
    const created: SignRevokeRequest = {
      ...req,
      id: 'rev-' + Date.now().toString(36),
      status: 'pending',
      createdAt: nowIso(),
    };
    this.revokeRequests.push(created);
    this.logs.push({
      id: 'slog-' + Date.now().toString(36),
      reportId: req.reportId,
      signerId: req.requesterId,
      signerName: req.requesterName,
      signerTitle: '',
      certificateSerial: '',
      algorithm: 'RSA-SHA256',
      signedAt: nowIso(),
      ipAddress: '127.0.0.1',
      device: 'web-browser',
      action: 'revoke',
      success: true,
      notes: req.reason,
    });
    return created;
  }

  async listRevokeRequests(): Promise<SignRevokeRequest[]> {
    await randomDelay();
    return [...this.revokeRequests];
  }

  async requestUnlock(req: Omit<UnlockRequest, 'id' | 'status' | 'createdAt'>): Promise<UnlockRequest> {
    await randomDelay();
    const created: UnlockRequest = {
      ...req,
      id: 'unlock-' + Date.now().toString(36),
      status: 'pending',
      createdAt: nowIso(),
    };
    this.unlockRequests.push(created);
    return created;
  }

  async approveUnlock(id: string, approverId: string, approverName: string): Promise<UnlockRequest | null> {
    await randomDelay();
    const idx = this.unlockRequests.findIndex((r) => r.id === id);
    if (idx < 0) return null;
    const existing = this.unlockRequests[idx]!;
    this.unlockRequests[idx] = {
      ...existing,
      approverId,
      approverName,
      approvedAt: nowIso(),
      status: 'approved',
    };
    return this.unlockRequests[idx]!;
  }

  async listUnlockRequests(): Promise<UnlockRequest[]> {
    await randomDelay();
    return [...this.unlockRequests];
  }

  async verify(reportId: string): Promise<VerifyResult> {
    await randomDelay();
    const found = VERIFY_RESULTS.find((v) => v.reportId === reportId);
    if (found) return { ...found, verifyCount: found.verifyCount + 1 };
    return {
      reportId,
      isValid: false,
      isExpired: false,
      isRevoked: false,
      verifyCount: 0,
      verifiedAt: nowIso(),
      failureReasons: ['未找到签章记录'],
    };
  }

  async listVerifyResults(): Promise<VerifyResult[]> {
    await randomDelay();
    return [...VERIFY_RESULTS];
  }

  async getKPI(): Promise<SignKPI[]> {
    await randomDelay();
    return [...SIGN_KPI];
  }

  async multiModalSign(payload: MultiModalSignPayload): Promise<MultiModalSignResult> {
    const progress: SignLogEntry[] = [];
    const signResult = await this.signReport({
      reportId: payload.reportId,
      content: payload.content,
      certificateId: payload.certificateId,
      password: payload.password,
      algorithm: payload.algorithm,
      qualityScore: payload.qualityScore,
      includeBlockchain: payload.includeBlockchain,
      includeTimestamp: payload.includeTimestamp,
    });
    progress.push({
      id: 'slog-' + Date.now().toString(36),
      reportId: payload.reportId,
      signerId: '',
      signerName: '',
      signerTitle: '',
      certificateSerial: signResult.certificateSerial,
      algorithm: payload.algorithm,
      signedAt: signResult.signedAt,
      ipAddress: '127.0.0.1',
      device: 'web-browser',
      action: 'sign',
      success: true,
      signatureValue: signResult.signatureValue,
      contentHash: signResult.contentHash,
    });
    return {
      signatureId: signResult.signatureId,
      reportId: signResult.reportId,
      contentHash: signResult.contentHash,
      signatureValue: signResult.signatureValue,
      certificateSerial: signResult.certificateSerial,
      algorithm: payload.algorithm,
      biometric: {
        id: 'bio-mm-' + Date.now().toString(36),
        userId: '',
        method: payload.modalities[0] ?? 'face',
        success: true,
        confidence: 0.95,
        verifiedAt: new Date().toISOString(),
        deviceFingerprint: 'mock-device',
        livenessPassed: true,
        modalitiesAttempted: payload.modalities,
        fusionScore: 0.95,
        modalityScores: Object.fromEntries(payload.modalities.map((m) => [m, 0.95])) as Partial<Record<BiometricModality, number>>,
        decision: 'allow',
      },
      timestampId: signResult.timestampId,
      blockchainId: signResult.blockchainId,
      approvalId: payload.approvalId,
      progress,
    };
  }

  async getApprovalStatus(params: ApprovalLookupParams): Promise<ApprovalStatusSnapshot | null> {
    await randomDelay();
    const { multiLevelApprovalService } = await import('../../services/approval/MultiLevelApproval');
    return multiLevelApprovalService.lookup(params);
  }

  async simulatePublish(reportId: string): Promise<{ ok: boolean; reportId: string; publishedAt: string }> {
    await delay(300);
    this.logs.push({
      id: 'slog-' + Date.now().toString(36),
      reportId,
      signerId: 'system',
      signerName: 'system',
      signerTitle: '',
      certificateSerial: '',
      algorithm: 'RSA-SHA256',
      signedAt: nowIso(),
      ipAddress: '127.0.0.1',
      device: 'system',
      action: 'publish',
      success: true,
    });
    return { ok: true, reportId, publishedAt: nowIso() };
  }
}

export const signService = new SignService();