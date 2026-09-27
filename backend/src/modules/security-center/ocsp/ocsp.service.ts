// [G005 W13-Security] OCSP 响应器 (RFC 6960 语义简化版)。
// 支持 GET /ocsp/:serial 与 POST /ocsp {serial} / {request}。
// 返回 good / revoked / unknown; 响应摘要由 HSM 活动密钥签名 (可选)。
import { BadRequestException, Injectable } from '@nestjs/common'
import { ReportCertificateService } from '../../report-sign-v2/report-certificate.service'
import { HsmService } from '../hsm/hsm.service'

export type OcspStatus = 'good' | 'revoked' | 'unknown'

export interface OcspResponse {
  serial: string
  status: OcspStatus
  producedAt: string
  thisUpdate: string
  nextUpdate: string
  revocationTime?: string
  revocationReason?: string
  certificateStatus: 'valid' | 'revoked'
  certificate?: {
    serial: string
    subject: string
    issuer: string
    algorithm: string
    notBefore: string
    notAfter: string
  }
  /** 响应签名 (HSM 活动密钥) */
  responseSignature?: string
  signatureAlgorithm?: string
  signingKeyId?: string
}

@Injectable()
export class OcspService {
  constructor(
    private readonly certificates: ReportCertificateService,
    private readonly hsm: HsmService,
  ) {}

  /** 单证书状态查询 */
  respond(serial: string): OcspResponse {
    const clean = serial?.trim()
    if (!clean) throw new BadRequestException('serial 不能为空')
    const cert = this.certificates.find(clean)
    const now = new Date()
    const base: OcspResponse = {
      serial: clean,
      status: cert ? (cert.status === 'revoked' ? 'revoked' : 'good') : 'unknown',
      producedAt: now.toISOString(),
      thisUpdate: now.toISOString(),
      nextUpdate: new Date(now.getTime() + 24 * 3600 * 1000).toISOString(),
      certificateStatus: cert?.status ?? 'valid',
    }
    if (cert) {
      base.revocationTime = cert.revokedAt
      base.revocationReason = cert.revocationReason
      base.certificate = {
        serial: cert.serial,
        subject: cert.subject,
        issuer: cert.issuer,
        algorithm: cert.algorithm,
        notBefore: cert.notBefore,
        notAfter: cert.notAfter,
      }
    }
    try {
      const active = this.hsm.activeKey()
      const digest = `${base.serial}|${base.status}|${base.producedAt}`
      const result = this.hsm.sign(digest, undefined, active.keyId)
      base.responseSignature = result.signature
      base.signatureAlgorithm = result.algorithm
      base.signingKeyId = result.keyId
    } catch {
      /* 无可用密钥时返回未签名响应 */
    }
    return base
  }

  /** 批量查询 (OCSP 请求可含多个 serial) */
  respondBatch(serials: string[]): { responses: OcspResponse[] } {
    if (!Array.isArray(serials) || serials.length === 0) throw new BadRequestException('serials 不能为空')
    return { responses: serials.map((s) => this.respond(s)) }
  }

  /** 解析 POST /ocsp 请求体 (支持 {serial}, {serials}, {request:{serial}}) */
  handleRequest(body: { serial?: string; serials?: string[]; request?: { serial?: string } }): OcspResponse | { responses: OcspResponse[] } {
    if (body.serials && body.serials.length > 0) return this.respondBatch(body.serials)
    const serial = body.serial ?? body.request?.serial
    if (!serial) throw new BadRequestException('请求缺少 serial')
    return this.respond(serial)
  }
}
