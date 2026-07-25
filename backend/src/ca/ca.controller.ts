import { Controller, Get, HttpCode, HttpStatus, Post, Put, Delete, Param, Body, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CaService } from './ca.service'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { SignDocumentSchema, UpdateCaConfigSchema, UploadCertificateSchema, VerifySignatureSchema } from './ca.schema'

@ApiTags('ca')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('ca')
export class CaController {
  constructor(private readonly svc: CaService) {}

  @Get('certificates')
  listCertificates() { return this.svc.listCertificates() }

  @Post('certificates')
  @HttpCode(HttpStatus.CREATED)
  uploadCertificate(@Body(new ZodValidationPipe(UploadCertificateSchema)) body: Record<string, unknown>) { return this.svc.uploadCertificate(body) }

  @Delete('certificates/:id')
  revokeCertificate(@Param('id') id: string) { return this.svc.revokeCertificate(id) }

  @Post('sign')
  @HttpCode(HttpStatus.CREATED)
  signDocument(@Body(new ZodValidationPipe(SignDocumentSchema)) body: Record<string, unknown>) { return this.svc.signDocument(body) }

  @Get('signatures')
  listSignatures() { return this.svc.listSignatures() }

  @Post('verify')
  @HttpCode(HttpStatus.CREATED)
  verifySignature(@Body(new ZodValidationPipe(VerifySignatureSchema)) body: Record<string, unknown>) { return this.svc.verifySignature(body) }

  @Get('config')
  getCaConfig() { return this.svc.getCaConfig() }

  @Put('config')
  updateCaConfig(@Body(new ZodValidationPipe(UpdateCaConfigSchema)) body: Record<string, unknown>) { return this.svc.updateCaConfig(body) }

  @Get('history')
  getCaHistory() { return this.svc.getCaHistory() }
}
