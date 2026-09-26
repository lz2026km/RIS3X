// [G005 W8-Report] 证书中心 / CRL / 签名验签 Controller
// certificates: list/get/revoke; crl; signatures: stats/get/verify
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { Roles } from '../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ReportCertificateService } from './report-certificate.service'
import { ReportSigningService } from './report-signing.service'

const RevokeSchema = z.object({
  reason: z.string().min(1).max(200),
})

const ContentSchema = z.object({
  findings: z.string().max(50000).optional(),
  impression: z.string().max(20000).optional(),
  conclusion: z.string().max(20000).optional(),
  diagnosis: z.string().max(20000).optional(),
  recommendations: z.string().max(20000).optional(),
  qualityScore: z.number().int().min(0).max(100).nullable().optional(),
  version: z.number().int().min(0).optional(),
})

const VerifySchema = z.object({
  signatureId: z.string().max(64).optional(),
  content: ContentSchema.optional(),
})

@ApiTags('report-signing')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('report-signing')
export class ReportSigningController {
  constructor(
    private readonly certificates: ReportCertificateService,
    private readonly signing: ReportSigningService,
  ) {}

  @Get('certificates')
  listCertificates(@Query('status') status?: string, @Query('keyword') keyword?: string) {
    const statusFilter = status === 'valid' || status === 'revoked' ? status : undefined
    return this.certificates.list({ status: statusFilter, keyword })
  }

  @Get('certificates/:serial')
  getCertificate(@Param('serial') serial: string) {
    return this.certificates.get(serial)
  }

  @Post('certificates/:serial/revoke')
  @HttpCode(HttpStatus.OK)
  revokeCertificate(@Param('serial') serial: string, @Body(new ZodValidationPipe(RevokeSchema)) body: z.infer<typeof RevokeSchema>) {
    const cert = this.certificates.revoke(serial, body.reason)
    // 证书吊销联动: 作废所有使用该证书的签名 (验签将因 CRL 失败)
    this.signing.revokeByCertificate(serial)
    return cert
  }

  @Get('crl')
  crl() {
    return this.certificates.crl()
  }

  @Get('signatures/stats')
  stats() {
    return this.signing.stats()
  }

  @Get('signatures/:reportId')
  listSignatures(@Param('reportId') reportId: string) {
    const signature = this.signing.getSignature(reportId)
    return { reportId, signed: Boolean(signature), signature, history: this.signing.listSignatures(reportId) }
  }

  @Post('signatures/:reportId/verify')
  @HttpCode(HttpStatus.OK)
  verify(@Param('reportId') reportId: string, @Body(new ZodValidationPipe(VerifySchema)) body: z.infer<typeof VerifySchema>) {
    return this.signing.verifySignature(reportId, body as Parameters<ReportSigningService['verifySignature']>[1])
  }
}
