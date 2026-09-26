// [G005 W8-Report] 报告数据签名/证书/时间戳 — 类型定义
// 摘要算法: SHA-256 (默认) | SM3 (国密, 纯 JS 实现); 签名算法: RSA-SHA256 (node:crypto, 真实非对称签名)

export type DigestAlgorithm = 'SHA-256' | 'SM3'
export type CertStatus = 'valid' | 'revoked'
export type SignatureStatus = 'valid' | 'superseded' | 'revoked'
export type CertUsage = 'signature' | 'timestamp'

export interface CertificateRecord {
  serial: string
  subject: string
  issuer: string
  algorithm: DigestAlgorithm
  usage: CertUsage
  notBefore: string
  notAfter: string
  status: CertStatus
  keyId: string
  revocationReason?: string
  revokedAt?: string
}

export interface CrlEntry {
  serial: string
  revocationDate: string
  reason: string
}

export interface CrlView {
  issuer: string
  algorithm: string
  thisUpdate: string
  nextUpdate: string
  entryCount: number
  entries: CrlEntry[]
}

export interface SignatureContentSnapshot {
  findings: string
  impression: string
  conclusion: string
  diagnosis: string
  recommendations: string
  qualityScore: number | null
  version: number
}

export interface ReportSignature {
  reportId: string
  signatureId: string
  algorithm: DigestAlgorithm
  /** 规范化内容的十六进制摘要 */
  digest: string
  /** RSA-SHA256 签名 (base64) */
  signature: string
  signedById: string
  signedAt: string
  /** RFC3161-like TSA token (base64) */
  tsaToken: string
  certificateSerial: string
  status: SignatureStatus
  content: SignatureContentSnapshot
  supersededBy?: string
  supersededAt?: string
}

export interface SignatureVerification {
  valid: boolean
  reportId: string
  signatureId: string | null
  algorithm: DigestAlgorithm | null
  reasons: string[]
  digestMatch: boolean
  signatureMatch: boolean
  certificateValid: boolean
  notRevoked: boolean
  tsaValid: boolean
  certificate: CertificateRecord | null
  signedAt: string | null
  signedById: string | null
  computedDigest: string | null
  verifiedAt: string
}

export interface SignReportInput {
  reportId: string
  content: SignatureContentSnapshot
  signedById: string
  certificateSerial?: string
  signedAt?: string
}
