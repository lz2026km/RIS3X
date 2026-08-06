// ============================================================
// G005 放射RIS系统 v3.0.6 - MFA 多因素认证服务
// MfaService - TOTP / SMS / Email / FIDO2 / Backup Code
// ============================================================
import { v4 as uuidv4 } from 'uuid';
import type {
  MfaEnrollment, MfaChallenge, MfaMethod, MfaVerificationResult,
} from '../../../types/security';
import { verifyTotp, generateSecret, buildQrPayload, base32Encode } from './TotpService';

const STORAGE_KEY = 'g005.security.mfa.v1';
let enrollments: MfaEnrollment[] = [];

function load(): MfaEnrollment[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as MfaEnrollment[];
  } catch { /* ignore */ }
  return [];
}
function save(): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(enrollments)); } catch { /* ignore */ }
}
enrollments = load();

// 内存中的活跃挑战
const activeChallenges = new Map<string, MfaChallenge>();

function newCode(): string {
  const buf = new Uint8Array(6);
  crypto.getRandomValues(buf);
  return Array.from(buf).map(b => (b % 10).toString()).join('');
}

function defaultBackupCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const buf = new Uint8Array(4);
    crypto.getRandomValues(buf);
    codes.push(Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join(''));
  }
  return codes;
}

export class MfaService {
  /** 注册 MFA */
  enroll(opts: { userId: string; primaryMethod: MfaMethod; phoneNumber?: string; email?: string; existingSecret?: string }): MfaEnrollment {
    const existing = enrollments.find(e => e.userId === opts.userId);
    const enrollment: MfaEnrollment = existing ?? {
      userId: opts.userId,
      methods: [],
      primaryMethod: opts.primaryMethod,
      backupCodes: defaultBackupCodes(),
      enrolledAt: new Date().toISOString(),
      enabled: false,
    };
    if (opts.primaryMethod === 'totp' && !enrollment.totpSecret) {
      enrollment.totpSecret = opts.existingSecret ?? generateSecret();
    }
    if (opts.phoneNumber) enrollment.phoneNumber = opts.phoneNumber;
    if (opts.email) enrollment.email = opts.email;
    if (!enrollment.methods.includes(opts.primaryMethod)) enrollment.methods.push(opts.primaryMethod);
    enrollment.primaryMethod = opts.primaryMethod;
    enrollment.enabled = true;
    if (!existing) enrollments.push(enrollment);
    save();
    return enrollment;
  }

  /** 取消注册 */
  unenroll(userId: string, method: MfaMethod): boolean {
    const e = enrollments.find(x => x.userId === userId);
    if (!e) return false;
    e.methods = e.methods.filter(m => m !== method);
    if (e.methods.length === 0) {
      enrollments = enrollments.filter(x => x.userId !== userId);
    } else if (e.primaryMethod === method) {
      e.primaryMethod = e.methods[0]!;
    }
    save();
    return true;
  }

  /** 获取注册信息 */
  getEnrollment(userId: string): MfaEnrollment | undefined {
    return enrollments.find(e => e.userId === userId);
  }

  /** 生成 TOTP QR 码 payload */
  getTotpQrPayload(userId: string, accountName: string, issuer = 'G005-RIS'): { uri: string; secret: string } | null {
    const e = this.getEnrollment(userId);
    if (!e?.totpSecret) return null;
    return buildQrPayload(e.totpSecret, accountName, issuer);
  }

  /** 发起挑战 */
  issueChallenge(opts: { userId: string; method: MfaMethod; ipAddress: string }): MfaChallenge {
    const code = opts.method === 'totp' ? '' /* 用户输入 */ : newCode();
    const challenge: MfaChallenge = {
      challengeId: uuidv4(),
      userId: opts.userId,
      method: opts.method,
      code,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + (opts.method === 'totp' ? 5 * 60_000 : 10 * 60_000)).toISOString(),
      attempts: 0,
      maxAttempts: 5,
      status: 'pending',
      ipAddress: opts.ipAddress,
    };
    activeChallenges.set(challenge.challengeId, challenge);

    // 模拟 SMS/Email 发送
    if (opts.method === 'sms' || opts.method === 'email') {
      const e = this.getEnrollment(opts.userId);
      const channel = opts.method === 'sms' ? 'SMS' : 'Email';
      const target = opts.method === 'sms' ? e?.phoneNumber : e?.email;
      // 真实环境: 调用 SMS 网关 / 邮件服务
      // 此处仅在控制台输出 (允许 warn)
      console.info(`[MFA-MOCK] ${channel} ${target}: 验证码 ${code}`);
    }
    return challenge;
  }

  /** 验证挑战 */
  async verifyChallenge(challengeId: string, code: string): Promise<MfaVerificationResult> {
    const ch = activeChallenges.get(challengeId);
    if (!ch) return { success: false, method: 'totp', reason: 'challenge_not_found' };
    if (ch.status === 'expired') return { success: false, method: ch.method, reason: 'challenge_expired' };
    if (ch.status === 'locked') return { success: false, method: ch.method, reason: 'challenge_locked' };
    if (new Date(ch.expiresAt) < new Date()) {
      ch.status = 'expired';
      return { success: false, method: ch.method, reason: 'challenge_expired' };
    }
    ch.attempts++;
    if (ch.attempts > ch.maxAttempts) {
      ch.status = 'locked';
      return { success: false, method: ch.method, reason: 'too_many_attempts' };
    }

    const e = this.getEnrollment(ch.userId);
    if (!e) {
      ch.status = 'failed';
      return { success: false, method: ch.method, reason: 'no_enrollment' };
    }

    // 备用码优先
    if (e.backupCodes.includes(code)) {
      e.backupCodes = e.backupCodes.filter(c => c !== code);
      e.lastUsedAt = new Date().toISOString();
      ch.status = 'verified';
      save();
      return { success: true, method: 'backup-code' };
    }

    if (ch.method === 'totp') {
      if (!e.totpSecret) {
        ch.status = 'failed';
        return { success: false, method: 'totp', reason: 'no_totp_secret' };
      }
      const r = await verifyTotp(e.totpSecret, code, { digits: 6, period: 30, algorithm: 'SHA-1' });
      if (r.valid) {
        e.lastUsedAt = new Date().toISOString();
        ch.status = 'verified';
        save();
        return { success: true, method: 'totp', trustScore: 95 };
      }
      ch.status = ch.attempts >= ch.maxAttempts ? 'locked' : 'failed';
      return { success: false, method: 'totp', reason: 'invalid_code', remainingAttempts: ch.maxAttempts - ch.attempts };
    }

    // SMS / Email / Push
    if (ch.code === code) {
      e.lastUsedAt = new Date().toISOString();
      ch.status = 'verified';
      save();
      return { success: true, method: ch.method, trustScore: 75 };
    }
    ch.status = ch.attempts >= ch.maxAttempts ? 'locked' : 'failed';
    return { success: false, method: ch.method, reason: 'invalid_code', remainingAttempts: ch.maxAttempts - ch.attempts };
  }

  /** 生成新的备用码 */
  regenerateBackupCodes(userId: string): string[] {
    const e = this.getEnrollment(userId);
    if (!e) return [];
    e.backupCodes = defaultBackupCodes();
    save();
    return e.backupCodes;
  }

  /** 列出活跃挑战 */
  listActiveChallenges(userId?: string): MfaChallenge[] {
    const all = Array.from(activeChallenges.values());
    return userId ? all.filter(c => c.userId === userId) : all;
  }

  /** 列出所有注册 */
  listEnrollments(): MfaEnrollment[] {
    return [...enrollments];
  }

  /** 计算 MFA 覆盖度 */
  coverageStats(): { total: number; enrolled: number; byMethod: Record<MfaMethod, number> } {
    const byMethod: Record<MfaMethod, number> = { totp: 0, sms: 0, email: 0, push: 0, fido2: 0, 'backup-code': 0 };
    for (const e of enrollments) {
      if (e.enabled) {
        for (const m of e.methods) byMethod[m]++;
      }
    }
    return { total: enrollments.length, enrolled: enrollments.filter(e => e.enabled).length, byMethod };
  }

  /** 是否需要 MFA */
  isRequiredFor(operation: string): boolean {
    const sensitiveOps = new Set([
      'report.sign', 'report.publish', 'report.delete',
      'patient.delete', 'user.create', 'user.delete',
      'config.change', 'permission.grant', 'phi.bulk-export',
    ]);
    return sensitiveOps.has(operation);
  }
}

export const mfaService = new MfaService();

// 工具: 序列号生成 (TOTP secret 转 base32 显示用)
export function displaySecret(secret: string): string {
  return secret.match(/.{1,4}/g)?.join(' ') ?? secret;
}

// 工具: 生成随机 FIDO2 challenge 占位
export function generateChallenge(): string {
  return base32Encode(crypto.getRandomValues(new Uint8Array(20)));
}