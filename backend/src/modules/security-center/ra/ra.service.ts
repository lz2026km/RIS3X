// [G005 W13-Security] RA (注册机构) 服务: 证书请求 申请→审批→颁发→续期 / 驳回。
// 与 HSM 活动密钥、证书注册表 (ReportCertificateService) 联动。
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ReportCertificateService } from '../../report-sign-v2/report-certificate.service'
import type { CertificateRecord, DigestAlgorithm } from '../../report-sign-v2/report-signing.types'
import { HsmService } from '../hsm/hsm.service'

export type RaRequestType = 'issue' | 'renew' | 'revoke'
export type RaRequestStatus = 'pending' | 'approved' | 'rejected'

export interface RaCertificateRequest {
  id: string
  type: RaRequestType
  subject: string
  applicant: string
  applicantId?: string
  algorithm: DigestAlgorithm
  usage: 'signature' | 'timestamp'
  reason?: string
  sourceSerial?: string
  status: RaRequestStatus
  requestedAt: string
  decidedAt?: string
  decidedBy?: string
  rejectReason?: string
  issuedSerial?: string
}

const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * 86_400_000).toISOString()

@Injectable()
export class RaService {
  private readonly logger = new Logger(RaService.name)
  private readonly requests: RaCertificateRequest[] = []
  private seq = 0

  constructor(
    private readonly certificates: ReportCertificateService,
    private readonly hsm: HsmService,
  ) {
    // 内置演示请求 (确定性)
    this.requests.push(
      {
        id: 'ra-0001',
        type: 'issue',
        subject: 'CN=赵星辰 (医师签名证书), OU=放射科, O=G005 Hospital',
        applicant: '赵星辰',
        applicantId: 'D1001',
        algorithm: 'SHA-256',
        usage: 'signature',
        reason: '新入职医师签名证书申请',
        status: 'pending',
        requestedAt: iso(-1),
      },
      {
        id: 'ra-0002',
        type: 'renew',
        subject: 'CN=李慧敏 (医师签名证书续期), OU=放射科, O=G005 Hospital',
        applicant: '李慧敏',
        applicantId: 'D1002',
        algorithm: 'SHA-256',
        usage: 'signature',
        sourceSerial: '05B1C2D3E4F50617',
        reason: '证书临近到期续期',
        status: 'pending',
        requestedAt: iso(-2),
      },
    )
    this.seq = this.requests.length
  }

  list(filter?: { status?: RaRequestStatus; type?: RaRequestType }): RaCertificateRequest[] {
    return this.requests
      .filter((r) => !filter?.status || r.status === filter.status)
      .filter((r) => !filter?.type || r.type === filter.type)
      .map((r) => ({ ...r }))
  }

  get(id: string): RaCertificateRequest {
    const r = this.requests.find((x) => x.id === id)
    if (!r) throw new NotFoundException(`证书请求 ${id} 不存在`)
    return { ...r }
  }

  create(input: {
    type?: RaRequestType
    subject: string
    applicant: string
    applicantId?: string
    algorithm?: DigestAlgorithm
    usage?: 'signature' | 'timestamp'
    reason?: string
    sourceSerial?: string
  }): RaCertificateRequest {
    if (!input.subject?.trim()) throw new BadRequestException('subject 不能为空')
    if (!input.applicant?.trim()) throw new BadRequestException('applicant 不能为空')
    const type: RaRequestType = input.type ?? 'issue'
    if (type === 'renew') {
      if (!input.sourceSerial) throw new BadRequestException('续期请求必须提供 sourceSerial')
      const src = this.certificates.find(input.sourceSerial)
      if (!src) throw new NotFoundException(`源证书 ${input.sourceSerial} 不存在`)
      if (src.status === 'revoked') throw new BadRequestException('源证书已吊销, 不可续期')
    }
    if (type === 'revoke' && !input.sourceSerial) throw new BadRequestException('吊销请求必须提供 sourceSerial')
    const req: RaCertificateRequest = {
      id: `ra-${(++this.seq).toString().padStart(4, '0')}`,
      type,
      subject: input.subject.trim(),
      applicant: input.applicant.trim(),
      applicantId: input.applicantId,
      algorithm: input.algorithm ?? 'SHA-256',
      usage: input.usage ?? 'signature',
      reason: input.reason,
      sourceSerial: input.sourceSerial,
      status: 'pending',
      requestedAt: new Date().toISOString(),
    }
    this.requests.unshift(req)
    return { ...req }
  }

  /** 审批通过: issue → 颁发新证书; renew → 续期; revoke → 吊销。 */
  approve(id: string, input: { approvedBy?: string; days?: number } = {}): { request: RaCertificateRequest; certificate: CertificateRecord } {
    const req = this.requests.find((x) => x.id === id)
    if (!req) throw new NotFoundException(`证书请求 ${id} 不存在`)
    if (req.status !== 'pending') throw new BadRequestException(`请求 ${id} 已处理 (${req.status}), 不可重复审批`)
    let certificate: CertificateRecord
    if (req.type === 'renew' && req.sourceSerial) {
      certificate = this.certificates.renew(req.sourceSerial, { days: input.days, keyId: this.hsm.activeKey().keyId })
    } else if (req.type === 'revoke' && req.sourceSerial) {
      certificate = this.certificates.revoke(req.sourceSerial, req.reason?.trim() || 'RA 审批吊销')
    } else {
      certificate = this.certificates.issue({
        subject: req.subject,
        algorithm: req.algorithm,
        usage: req.usage,
        keyId: this.hsm.activeKey().keyId,
        days: input.days,
      })
    }
    req.status = 'approved'
    req.decidedAt = new Date().toISOString()
    req.decidedBy = input.approvedBy?.trim() || 'RA-Admin'
    req.issuedSerial = certificate.serial
    this.logger.log(`RA approved ${id} (${req.type}) -> ${certificate.serial}`)
    return { request: { ...req }, certificate }
  }

  reject(id: string, reason: string, rejectedBy?: string): RaCertificateRequest {
    const req = this.requests.find((x) => x.id === id)
    if (!req) throw new NotFoundException(`证书请求 ${id} 不存在`)
    if (req.status !== 'pending') throw new BadRequestException(`请求 ${id} 已处理 (${req.status})`)
    if (!reason?.trim()) throw new BadRequestException('驳回原因不能为空')
    req.status = 'rejected'
    req.decidedAt = new Date().toISOString()
    req.decidedBy = rejectedBy?.trim() || 'RA-Admin'
    req.rejectReason = reason.trim()
    return { ...req }
  }

  stats(): { total: number; pending: number; approved: number; rejected: number; issuedCertificates: number } {
    return {
      total: this.requests.length,
      pending: this.requests.filter((r) => r.status === 'pending').length,
      approved: this.requests.filter((r) => r.status === 'approved').length,
      rejected: this.requests.filter((r) => r.status === 'rejected').length,
      issuedCertificates: this.certificates.count().total,
    }
  }
}
