import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { SignService } from './sign.service'
import { RequestCertificateSchema, RevokeCertificateSchema, SignReportSchema, IssueTimestampSchema } from './sign.schema'
import { z } from 'zod'

type RequestCertificateDto = z.infer<typeof RequestCertificateSchema>
type RevokeCertificateDto = z.infer<typeof RevokeCertificateSchema>
type SignReportDto = z.infer<typeof SignReportSchema>
type IssueTimestampDto = z.infer<typeof IssueTimestampSchema>

@ApiTags('sign')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('sign')
export class SignController {
  constructor(private readonly svc: SignService) {}

  @Get('certs')
  listCertificates(@Query('status') status?: string, @Query('pageSize') pageSize?: string) {
    return this.svc.listCertificates({ status, pageSize: pageSize ? Number(pageSize) : undefined })
  }

  @Post('certs')
  requestCertificate(@Body(new ZodValidationPipe(RequestCertificateSchema)) body: RequestCertificateDto) {
    return this.svc.requestCertificate(body)
  }

  @Post('certs/:id/revoke')
  revokeCertificate(@Param('id') id: string, @Body(new ZodValidationPipe(RevokeCertificateSchema)) body: RevokeCertificateDto) {
    return this.svc.revokeCertificate(id, body)
  }

  @Post('reports/:reportId/sign')
  signReport(@Param('reportId') reportId: string, @Body(new ZodValidationPipe(SignReportSchema)) body: SignReportDto) {
    return this.svc.signReport(reportId, body)
  }

  @Get('verify/:signatureHash')
  verifySignature(@Param('signatureHash') signatureHash: string) {
    return this.svc.verifySignature(signatureHash)
  }

  @Post('timestamp')
  issueTimestamp(@Body(new ZodValidationPipe(IssueTimestampSchema)) body: IssueTimestampDto) {
    return this.svc.issueTimestamp(body)
  }

  @Get('blockchain/proofs')
  getBlockchainProof(@Query('reportId') reportId: string) {
    return this.svc.getBlockchainProof(reportId)
  }
}
