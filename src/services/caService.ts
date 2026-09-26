// ============================================================
// G005 放射RIS系统 v2.1.0 - Web Crypto CA 数字证书
// Phase R9 W6: 纯前端 RSA-SHA256 证书签发/验证
// ============================================================

// ============================================================
// 类型定义
// ============================================================

export type CaUserRole = 'doctor' | 'resident' | 'attending' | 'tech' | 'reviewer' | 'admin';

export interface CertificateSubject {
  commonName: string;          // CN
  organization?: string;       // O
  organizationalUnit?: string; // OU
  country?: string;            // C
  email?: string;              // emailAddress
  userId: string;              // 自定义
  role: CaUserRole;
  licenseNumber?: string;      // 医师执照号
}

export interface Certificate {
  version: 1;
  serialNumber: string;
  subject: CertificateSubject;
  issuer: { commonName: string; organization?: string; userId: string };
  publicKeyJwk: JsonWebKey;
  notBefore: string;           // ISO
  notAfter: string;            // ISO
  signatureAlgorithm: 'RSA-SHA256';
  signature: string;           // base64
  // 应用扩展
  keyUsage: Array<'digitalSignature' | 'nonRepudiation' | 'keyEncipherment' | 'dataEncipherment' | 'keyCertSign'>;
  extendedKeyUsage?: Array<'clientAuth' | 'emailProtection' | 'codeSigning'>;
  fingerprint: { sha256: string; sha1: string };
}

export interface SignedReportPayload {
  reportId: string;
  contentHash: string;          // SHA-256 of report content (base64)
  timestamp: string;            // ISO
  authorId: string;
  certSerial: string;
  signature: string;            // base64
  certChain?: string[];         // base64 cert JSONs
  action: 'created' | 'updated' | 'signed' | 'finalized' | 'amended' | 'cancelled';
  reason?: string;
}

export interface CaConfig {
  name: string;                  // CA 名称
  organization: string;
  country?: string;
  validityDays: number;          // 证书有效期
}

export interface IssuedCertificate {
  cert: Certificate;
  privateKey: CryptoKey | null;  // null 表示外部导入
}

// ============================================================
// SHA-256 helper
// ============================================================

export async function sha256(data: string | Uint8Array | ArrayBuffer): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data)
    : data instanceof ArrayBuffer ? new Uint8Array(data)
    : data;
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return arrayBufferToBase64(hash);
}

export async function sha1(data: string | Uint8Array): Promise<string> {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest('SHA-1', bytes);
  return arrayBufferToBase64(hash);
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i] ?? 0);
  return btoa(bin);
}

function arrayBufferFromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ============================================================
// 密钥生成 / 导入导出
// ============================================================

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true, ['sign', 'verify'],
  );
}

export async function exportPublicKeyJwk(key: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', key);
}

export async function importPublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, true, ['verify']);
}

// ============================================================
// CA 自身密钥（Root CA）
// ============================================================

let ROOT_CA_KEY_PAIR: CryptoKeyPair | null = null;
let ROOT_CA_CERT: Certificate | null = null;

const ROOT_CA_KEY_STORAGE = 'g005.rootCa.privateKey.jwk';

export async function ensureRootCa(config: CaConfig): Promise<{ cert: Certificate; keyPair: CryptoKeyPair }> {
  if (ROOT_CA_CERT && ROOT_CA_KEY_PAIR) {
    return { cert: ROOT_CA_CERT, keyPair: ROOT_CA_KEY_PAIR };
  }
  // 尝试从 localStorage 恢复
  try {
    const stored = localStorage.getItem(ROOT_CA_KEY_STORAGE);
    if (stored) {
      const jwk = JSON.parse(stored) as JsonWebKey;
      const priv = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, true, ['sign', 'verify']);
      const pub = await crypto.subtle.importKey('jwk', { ...jwk, d: undefined, p: undefined, q: undefined }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, true, ['verify']);
      ROOT_CA_KEY_PAIR = { privateKey: priv, publicKey: pub };
    }
  } catch { /* ignore */ }

  if (!ROOT_CA_KEY_PAIR) {
    ROOT_CA_KEY_PAIR = await generateKeyPair();
    const exported = await crypto.subtle.exportKey('jwk', ROOT_CA_KEY_PAIR.privateKey);
    try { localStorage.setItem(ROOT_CA_KEY_STORAGE, JSON.stringify(exported)); } catch { /* quota */ }
  }

  // 自签证书
  const pubJwk = await crypto.subtle.exportKey('jwk', ROOT_CA_KEY_PAIR.publicKey);
  const now = new Date();
  const notAfter = new Date(now.getTime() + 365 * 24 * 3600 * 1000 * 10); // CA 10 年
  const subject: CertificateSubject = {
    commonName: config.name,
    organization: config.organization,
    country: config.country ?? 'CN',
    userId: 'root-ca',
    role: 'admin',
  };
  const tbs = canonicalJson({ subject, pubJwk, notBefore: now.toISOString(), notAfter: notAfter.toISOString() });
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', ROOT_CA_KEY_PAIR.privateKey, new TextEncoder().encode(tbs));
  const cert: Certificate = {
    version: 1,
    serialNumber: await genSerial(),
    subject,
    issuer: { commonName: config.name, organization: config.organization, userId: 'root-ca' },
    publicKeyJwk: pubJwk,
    notBefore: now.toISOString(),
    notAfter: notAfter.toISOString(),
    signatureAlgorithm: 'RSA-SHA256',
    signature: arrayBufferToBase64(sig),
    keyUsage: ['keyCertSign', 'digitalSignature'],
    extendedKeyUsage: ['clientAuth'],
    fingerprint: { sha256: '', sha1: '' },
  };
  cert.fingerprint = {
    sha256: await sha256(JSON.stringify(cert)),
    sha1: await sha1(JSON.stringify(cert)),
  };
  ROOT_CA_CERT = cert;
  return { cert, keyPair: ROOT_CA_KEY_PAIR };
}

export function getRootCaCert(): Certificate | null {
  return ROOT_CA_CERT;
}

export async function resetRootCa(): Promise<void> {
  ROOT_CA_CERT = null;
  ROOT_CA_KEY_PAIR = null;
  try { localStorage.removeItem(ROOT_CA_KEY_STORAGE); } catch { /* ignore */ }
}

// ============================================================
// 用户证书签发
// ============================================================

export async function issueCertificate(opts: {
  subject: CertificateSubject;
  userKeyPair: CryptoKeyPair;
  caConfig: CaConfig;
  validityDays?: number;
}): Promise<IssuedCertificate> {
  const { subject, userKeyPair, caConfig, validityDays = 365 } = opts;
  const { keyPair: caKey, cert: caCert } = await ensureRootCa(caConfig);

  const pubJwk = await crypto.subtle.exportKey('jwk', userKeyPair.publicKey);
  const now = new Date();
  const notAfter = new Date(now.getTime() + validityDays * 24 * 3600 * 1000);

  const serial = await genSerial();
  // 证书 issuer 字段（仅 commonName/organization/userId）
  const issuer = {
    commonName: caCert.subject.commonName,
    organization: caCert.subject.organization,
    userId: caCert.subject.userId,
  };
  const tbs = canonicalJson({
    serial,
    subject,
    pubJwk,
    notBefore: now.toISOString(),
    notAfter: notAfter.toISOString(),
    issuer,
  });
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', caKey.privateKey, new TextEncoder().encode(tbs));

  const cert: Certificate = {
    version: 1,
    serialNumber: serial,
    subject,
    issuer,
    publicKeyJwk: pubJwk,
    notBefore: now.toISOString(),
    notAfter: notAfter.toISOString(),
    signatureAlgorithm: 'RSA-SHA256',
    signature: arrayBufferToBase64(sig),
    keyUsage: ['digitalSignature', 'nonRepudiation'],
    extendedKeyUsage: ['clientAuth', 'emailProtection'],
    fingerprint: { sha256: '', sha1: '' },
  };
  cert.fingerprint = {
    sha256: await sha256(JSON.stringify(cert)),
    sha1: await sha1(JSON.stringify(cert)),
  };
  return { cert, privateKey: userKeyPair.privateKey };
}

// ============================================================
// 验证证书
// ============================================================

export interface VerificationResult {
  valid: boolean;
  reason?: string;
  trustChain?: Certificate[];
}

export async function verifyCertificate(cert: Certificate, caCert?: Certificate): Promise<VerificationResult> {
  const ca = caCert ?? ROOT_CA_CERT;
  if (!ca) return { valid: false, reason: 'No CA cert available' };

  // 1) 有效期
  const now = new Date();
  if (new Date(cert.notBefore) > now) return { valid: false, reason: 'Certificate not yet valid' };
  if (new Date(cert.notAfter) < now) return { valid: false, reason: 'Certificate expired' };

  // 2) 签名
  const caKey = await importPublicKey(ca.publicKeyJwk);
  const tbs = canonicalJson({
    serial: cert.serialNumber,
    subject: cert.subject,
    pubJwk: cert.publicKeyJwk,
    notBefore: cert.notBefore,
    notAfter: cert.notAfter,
    issuer: cert.issuer,
  });
  const sigBytes = arrayBufferFromBase64(cert.signature);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', caKey, sigBytes, new TextEncoder().encode(tbs));
  if (!ok) return { valid: false, reason: 'Invalid CA signature' };

  // 3) 发行者匹配
  if (cert.issuer.userId !== ca.subject.userId) {
    return { valid: false, reason: 'Issuer mismatch' };
  }

  return { valid: true, trustChain: [ca, cert] };
}

// ============================================================
// 报告签名 / 验证
// ============================================================

export async function signReport(opts: {
  reportId: string;
  content: string;
  authorId: string;
  privateKey: CryptoKey;
  cert: Certificate;
  action: SignedReportPayload['action'];
  reason?: string;
}): Promise<SignedReportPayload> {
  const { reportId, content, authorId, privateKey, cert, action, reason } = opts;
  const contentHash = await sha256(content);
  const timestamp = new Date().toISOString();
  const tbs = canonicalJson({ reportId, contentHash, timestamp, authorId, certSerial: cert.serialNumber, action, reason });
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(tbs));
  return {
    reportId,
    contentHash,
    timestamp,
    authorId,
    certSerial: cert.serialNumber,
    signature: arrayBufferToBase64(sig),
    certChain: ROOT_CA_CERT ? [JSON.stringify(ROOT_CA_CERT), JSON.stringify(cert)] : [JSON.stringify(cert)],
    action,
    reason,
  };
}

export async function verifyReportSignature(payload: SignedReportPayload, expectedContent: string): Promise<VerificationResult> {
  // 1) 验证内容哈希
  const expectedHash = await sha256(expectedContent);
  if (expectedHash !== payload.contentHash) {
    return { valid: false, reason: 'Content hash mismatch' };
  }
  // 2) 解析证书
  if (!payload.certChain || payload.certChain.length === 0) {
    return { valid: false, reason: 'No certificate chain' };
  }
  const cert: Certificate = JSON.parse(payload.certChain[payload.certChain.length - 1] as string);
  const ca: Certificate = JSON.parse(payload.certChain[0] as string);

  // 3) 验证证书
  const certValid = await verifyCertificate(cert, ca);
  if (!certValid.valid) return certValid;

  // 4) 验证签名
  const pubKey = await importPublicKey(cert.publicKeyJwk);
  const tbs = canonicalJson({
    reportId: payload.reportId,
    contentHash: payload.contentHash,
    timestamp: payload.timestamp,
    authorId: payload.authorId,
    certSerial: payload.certSerial,
    action: payload.action,
    reason: payload.reason,
  });
  const sigBytes = arrayBufferFromBase64(payload.signature);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', pubKey, sigBytes, new TextEncoder().encode(tbs));
  if (!ok) return { valid: false, reason: 'Invalid signature' };

  return { valid: true, trustChain: [ca, cert] };
}

// ============================================================
// 序列化
// ============================================================

export function serializeCert(cert: Certificate): string {
  return JSON.stringify(cert);
}

export function deserializeCert(s: string): Certificate {
  return JSON.parse(s) as Certificate;
}

// ============================================================
// 实用
// ============================================================

async function genSerial(): Promise<string> {
  const buf = crypto.getRandomValues(new Uint8Array(16));
  return arrayBufferToBase64(buf.buffer);
}

export function isExpired(cert: Certificate, atDate: Date = new Date()): boolean {
  return new Date(cert.notAfter) < atDate;
}

export function daysUntilExpiry(cert: Certificate, atDate: Date = new Date()): number {
  return Math.floor((new Date(cert.notAfter).getTime() - atDate.getTime()) / (24 * 3600 * 1000));
}

// ============================================================
// Canonical JSON (sorted keys, RFC 8785 风格)
// ============================================================

export function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(v: unknown): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(canonicalize);
  const obj = v as Record<string, unknown>;
  const sorted: Record<string, unknown> = {};
  Object.keys(obj).sort().forEach(k => { sorted[k] = canonicalize(obj[k]); });
  return sorted;
}
