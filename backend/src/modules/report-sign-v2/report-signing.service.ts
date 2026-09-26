// [G005 W8-Report] 报告数据签名服务 — 真实密码学摘要 + RSA-SHA256 签名 + TSA + 验签。
// 无真实 HSM: 使用内嵌演示 CA 密钥 (见 report-signing-keys.ts), 但摘要/签名/验签均为真实算法。
// DB-less-safe: 签名记录内存存储; 可选 PrismaService 仅用于审计落库 (失败静默)。
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { createHash, createSign, createVerify } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { ReportCertificateService } from './report-certificate.service'
import { ReportTsaService } from './report-tsa.service'
import { DEMO_CA_PRIVATE_KEY_PEM, DEMO_CA_PUBLIC_KEY_PEM } from './report-signing-keys'
import { sm3Hex } from './report-sm3'
import type {
  DigestAlgorithm,
  ReportSignature,
  SignatureContentSnapshot,
  SignatureVerification,
  SignReportInput,
} from './report-signing.types'

@Injectable()
export class ReportSigningService {
  private readonly logger = new Logger(ReportSigningService.name)
  /** reportId → 签名历史 (新→旧) */
  private readonly signatures = new Map<string, ReportSignature[]>()
  private seq = 0

  constructor(
    private readonly certificates: ReportCertificateService,
    private readonly tsa: ReportTsaService,
    private readonly prisma?: PrismaService,
  ) {}

  /** 规范序列化报告内容 (字段顺序固定 → 确定性摘要) */
  canonicalContent(content: SignatureContentSnapshot): string {
    return JSON.stringify({
      findings: content.findings ?? '',
      impression: content.impression ?? '',
      conclusion: content.conclusion ?? '',
      diagnosis: content.diagnosis ?? '',
      recommendations: content.recommendations ?? '',
      qualityScore: content.qualityScore ?? null,
      version: content.version ?? 0,
    })
  }

  /** 真实摘要: SHA-256 (node:crypto) 或 SM3 (纯 JS 实现) */
  computeDigest(content: SignatureContentSnapshot, algorithm: DigestAlgorithm = 'SHA-256'): string {
    const canonical = this.canonicalContent(content)
    if (algorithm === 'SM3') return sm3Hex(canonical)
    return createHash('sha256').update(canonical).digest('hex')
  }

  /** 对报告内容执行服务端签名 (含 TSA token), 并作废旧的有效签名 (superseded) */
  signReport(input: SignReportInput): ReportSignature {
    const certSerial = input.certificateSerial ?? this.certificates.defaultCertificateSerial()
    const cert = this.certificates.get(certSerial)
    if (cert.status === 'revoked') {
      throw new NotFoundException(`证书 ${certSerial} 已吊销, 不可用于签名`)
    }
    const signedAt = input.signedAt ?? new Date().toISOString()
    const digest = this.computeDigest(input.content, cert.algorithm)
    const signature = createSign('RSA-SHA256').update(digest).sign(DEMO_CA_PRIVATE_KEY_PEM, 'base64')
    const tsaToken = this.tsa.issue({ digest, serial: certSerial, algorithm: cert.algorithm, tsaTime: signedAt })

    // 作废旧有效签名
    this.supersede(input.reportId, signedAt)

    const record: ReportSignature = {
      reportId: input.reportId,
      signatureId: `sig-${(++this.seq).toString().padStart(6, '0')}`,
      algorithm: cert.algorithm,
      digest,
      signature,
      signedById: input.signedById,
      signedAt,
      tsaToken,
      certificateSerial: certSerial,
      status: 'valid',
      content: { ...input.content, qualityScore: input.content.qualityScore ?? null, version: input.content.version ?? 0 },
    }
    const list = this.signatures.get(input.reportId) ?? []
    list.unshift(record)
    this.signatures.set(input.reportId, list)
    void this.persistAudit('REPORT_SIGNED_CRYPTO', {
      reportId: input.reportId,
      signatureId: record.signatureId,
      algorithm: record.algorithm,
      digest: record.digest,
      certificateSerial: certSerial,
    })
    return { ...record, content: { ...record.content } }
  }

  /** 作废某报告当前有效签名 (修订/补发时调用) — 状态置 superseded */
  supersede(reportId: string, at = new Date().toISOString()): number {
    const list = this.signatures.get(reportId)
    if (!list) return 0
    let n = 0
    for (const sig of list) {
      if (sig.status === 'valid') {
        sig.status = 'superseded'
        sig.supersededAt = at
        n += 1
      }
    }
    if (n > 0) void this.persistAudit('REPORT_SIGNATURE_SUPERSEDED', { reportId, count: n, at })
    return n
  }

  /** 证书吊销联动: 作废所有使用该证书的签名 */
  revokeByCertificate(serial: string, at = new Date().toISOString()): number {
    let n = 0
    for (const list of this.signatures.values()) {
      for (const sig of list) {
        if (sig.certificateSerial === serial && sig.status !== 'revoked') {
          sig.status = 'revoked'
          sig.supersededAt = at
          n += 1
        }
      }
    }
    if (n > 0) void this.persistAudit('REPORT_SIGNATURE_CERT_REVOKED', { serial, count: n, at })
    return n
  }

  /** 吊销某报告签名 (证书吊销联动) */
  revokeByReport(reportId: string, at = new Date().toISOString()): number {
    const list = this.signatures.get(reportId)
    if (!list) return 0
    let n = 0
    for (const sig of list) {
      if (sig.status !== 'revoked') {
        sig.status = 'revoked'
        sig.supersededAt = at
        n += 1
      }
    }
    return n
  }

  /** 该报告最新签名 (无则 null) */
  getSignature(reportId: string): ReportSignature | null {
    const list = this.signatures.get(reportId)
    if (!list || list.length === 0) return null
    const sig = list[0]!
    return { ...sig, content: { ...sig.content } }
  }

  /** 签名历史 (新→旧) */
  listSignatures(reportId: string): ReportSignature[] {
    return (this.signatures.get(reportId) ?? []).map((s) => ({ ...s, content: { ...s.content } }))
  }

  /** 统计 */
  stats(): { total: number; valid: number; superseded: number; revoked: number; reports: number } {
    let total = 0
    let valid = 0
    let superseded = 0
    let revoked = 0
    for (const list of this.signatures.values()) {
      for (const s of list) {
        total += 1
        if (s.status === 'valid') valid += 1
        else if (s.status === 'superseded') superseded += 1
        else revoked += 1
      }
    }
    return { total, valid, superseded, revoked, reports: this.signatures.size }
  }

  /**
   * 验签: 证书有效性 + CRL 未吊销 + 摘要匹配 + RSA 签名 + TSA 校验。
   * 可选传入 content: 若与签名时快照不同 → 摘要不匹配 (篡改检测)。
   */
  verifySignature(reportId: string, input?: { content?: SignatureContentSnapshot; signatureId?: string }): SignatureVerification {
    const list = this.signatures.get(reportId) ?? []
    const sig = input?.signatureId ? list.find((s) => s.signatureId === input.signatureId) ?? null : list[0] ?? null
    const verifiedAt = new Date().toISOString()
    if (!sig) {
      return {
        valid: false,
        reportId,
        signatureId: null,
        algorithm: null,
        reasons: ['NO_SIGNATURE: 该报告没有签名记录'],
        digestMatch: false,
        signatureMatch: false,
        certificateValid: false,
        notRevoked: false,
        tsaValid: false,
        certificate: null,
        signedAt: null,
        signedById: null,
        computedDigest: null,
        verifiedAt,
      }
    }
    const content = input?.content ?? sig.content
    const computedDigest = this.computeDigest(content, sig.algorithm)
    const digestMatch = computedDigest === sig.digest
    const certificate = this.certificates.find(sig.certificateSerial)
    const certificateValid = certificate ? this.certificates.isValidAt(sig.certificateSerial, sig.signedAt) : false
    const notRevoked = certificate ? !this.certificates.isRevoked(sig.certificateSerial) : false
    const tsaValid = this.tsa.verify(sig.tsaToken, sig.digest, sig.certificateSerial)
    let signatureMatch = false
    try {
      signatureMatch = createVerify('RSA-SHA256').update(sig.digest).verify(DEMO_CA_PUBLIC_KEY_PEM, sig.signature, 'base64')
    } catch {
      signatureMatch = false
    }

    const reasons: string[] = []
    if (!digestMatch) reasons.push('DIGEST_MISMATCH: 内容摘要与签名不一致 (疑似篡改)')
    if (!signatureMatch) reasons.push('SIGNATURE_INVALID: 数字签名校验失败')
    if (!certificateValid) reasons.push('CERT_EXPIRED: 签名证书不在有效期内')
    if (!notRevoked) reasons.push('CERT_REVOKED: 签名证书已被吊销 (CRL)')
    if (!tsaValid) reasons.push('TSA_INVALID: 时间戳令牌校验失败')
    if (sig.status === 'superseded') reasons.push('SUPERSEDED: 该签名已被后续修订签名取代')
    if (sig.status === 'revoked') reasons.push('REVOKED: 该签名已被吊销')

    const valid = digestMatch && signatureMatch && certificateValid && notRevoked && tsaValid && sig.status === 'valid'
    // 记录验签审计
    void this.persistAudit('REPORT_SIGNATURE_VERIFIED', {
      reportId,
      signatureId: sig.signatureId,
      valid,
      reasons,
    })
    return {
      valid,
      reportId,
      signatureId: sig.signatureId,
      algorithm: sig.algorithm,
      reasons,
      digestMatch,
      signatureMatch,
      certificateValid,
      notRevoked,
      tsaValid,
      certificate,
      signedAt: sig.signedAt,
      signedById: sig.signedById,
      computedDigest,
      verifiedAt,
    }
  }

  private async persistAudit(action: string, detail: Record<string, unknown>): Promise<void> {
    try {
      await this.prisma?.auditLog.create({
        data: { action, resource: 'report-signature', detail: detail as Prisma.InputJsonValue, tenantId: 'tenant-demo' },
      })
    } catch (err) {
      this.logger.warn(`[ReportSigning] persist ${action} failed (seed 回退): ${(err as Error).message}`)
    }
  }
}
