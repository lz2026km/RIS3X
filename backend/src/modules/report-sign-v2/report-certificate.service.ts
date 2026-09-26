// [G005 W8-Report] 证书注册表 (DB-less-safe, seed 内置) + CRL + 吊销。
// 提供 list/query/revoke/crl/isValid 供报告签名验签使用。
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { DEMO_CA_KEY_ID } from './report-signing-keys'
import type { CertificateRecord, CertStatus, CrlView } from './report-signing.types'

const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString()

const ISSUER = 'CN=G005 RIS Demo CA, O=G005 Hospital, C=CN'

const SEED_CERTIFICATES: CertificateRecord[] = [
  {
    serial: '05A1B2C3D4E5F607',
    subject: 'CN=张明远 (医师签名证书), OU=放射科, O=G005 Hospital',
    issuer: ISSUER,
    algorithm: 'SHA-256',
    usage: 'signature',
    notBefore: iso(-365),
    notAfter: iso(365),
    status: 'valid',
    keyId: DEMO_CA_KEY_ID,
  },
  {
    serial: '05B1C2D3E4F50617',
    subject: 'CN=李慧敏 (医师签名证书), OU=放射科, O=G005 Hospital',
    issuer: ISSUER,
    algorithm: 'SHA-256',
    usage: 'signature',
    notBefore: iso(-180),
    notAfter: iso(545),
    status: 'valid',
    keyId: DEMO_CA_KEY_ID,
  },
  {
    serial: '05C1D2E3F4051627',
    subject: 'CN=G005 RIS 国密测试证书, OU=信息科, O=G005 Hospital',
    issuer: ISSUER,
    algorithm: 'SM3',
    usage: 'signature',
    notBefore: iso(-90),
    notAfter: iso(275),
    status: 'valid',
    keyId: DEMO_CA_KEY_ID,
  },
  {
    serial: '05D1E2F304152637',
    subject: 'CN=王建华 (医师签名证书, 已吊销), OU=放射科, O=G005 Hospital',
    issuer: ISSUER,
    algorithm: 'SHA-256',
    usage: 'signature',
    notBefore: iso(-400),
    notAfter: iso(100),
    status: 'revoked',
    keyId: DEMO_CA_KEY_ID,
    revocationReason: '私钥疑似泄露 (keyCompromise)',
    revokedAt: iso(-30),
  },
]

@Injectable()
export class ReportCertificateService {
  private readonly certs: CertificateRecord[] = SEED_CERTIFICATES.map((c) => ({ ...c }))
  private readonly defaultSerial = SEED_CERTIFICATES[0]!.serial

  /** 证书列表 (可按状态/关键字过滤) */
  list(filter?: { status?: CertStatus; keyword?: string }): { source: 'demo'; generatedAt: string; total: number; data: CertificateRecord[] } {
    const keyword = filter?.keyword?.trim().toLowerCase()
    const data = this.certs
      .filter((c) => !filter?.status || c.status === filter.status)
      .filter(
        (c) =>
          !keyword ||
          c.serial.toLowerCase().includes(keyword) ||
          c.subject.toLowerCase().includes(keyword) ||
          c.issuer.toLowerCase().includes(keyword),
      )
      .map((c) => ({ ...c }))
    return { source: 'demo', generatedAt: new Date().toISOString(), total: data.length, data }
  }

  get(serial: string): CertificateRecord {
    const cert = this.certs.find((c) => c.serial === serial)
    if (!cert) throw new NotFoundException(`证书 ${serial} 不存在`)
    return { ...cert }
  }

  find(serial: string): CertificateRecord | null {
    const cert = this.certs.find((c) => c.serial === serial)
    return cert ? { ...cert } : null
  }

  /** 默认可用签名证书 serial (首个 valid) */
  defaultCertificateSerial(): string {
    return this.certs.find((c) => c.status === 'valid')?.serial ?? this.defaultSerial
  }

  /** 吊销证书 (幂等: 已吊销返回现状) */
  revoke(serial: string, reason: string, at = new Date().toISOString()): CertificateRecord {
    const cert = this.certs.find((c) => c.serial === serial)
    if (!cert) throw new NotFoundException(`证书 ${serial} 不存在`)
    if (!reason?.trim()) throw new BadRequestException('吊销原因不能为空')
    if (cert.status === 'revoked') return { ...cert }
    cert.status = 'revoked'
    cert.revocationReason = reason.trim()
    cert.revokedAt = at
    return { ...cert }
  }

  /** 是否已吊销 */
  isRevoked(serial: string): boolean {
    return this.certs.find((c) => c.serial === serial)?.status === 'revoked'
  }

  /** 在给定时刻证书是否在有效期内 */
  isValidAt(serial: string, at: string): boolean {
    const cert = this.certs.find((c) => c.serial === serial)
    if (!cert) return false
    const t = new Date(at).getTime()
    return t >= new Date(cert.notBefore).getTime() && t <= new Date(cert.notAfter).getTime()
  }

  /** CRL (证书吊销列表) — 仅含 revoked 证书 */
  crl(): CrlView {
    const entries = this.certs
      .filter((c) => c.status === 'revoked')
      .map((c) => ({ serial: c.serial, revocationDate: c.revokedAt ?? new Date().toISOString(), reason: c.revocationReason ?? 'unspecified' }))
    return {
      issuer: ISSUER,
      algorithm: 'RSA-SHA256',
      thisUpdate: new Date().toISOString(),
      nextUpdate: iso(7),
      entryCount: entries.length,
      entries,
    }
  }
}
