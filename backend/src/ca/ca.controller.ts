import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CaService } from './ca.service'

@ApiTags('ca')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('ca')
export class CaController {
  constructor(private readonly svc: CaService) {}

  @Get('certificates')
  listCertificates() { return this.svc.listCertificates() }

  @Post('certificates')
  uploadCertificate(@Body() body: any) { return this.svc.uploadCertificate(body) }

  @Delete('certificates/:id')
  revokeCertificate(@Param('id') id: string) { return this.svc.revokeCertificate(id) }

  @Post('sign')
  signDocument(@Body() body: any) { return this.svc.signDocument(body) }

  @Get('signatures')
  listSignatures() { return this.svc.listSignatures() }

  @Post('verify')
  verifySignature(@Body() body: any) { return this.svc.verifySignature(body) }

  @Get('config')
  getCaConfig() { return this.svc.getCaConfig() }

  @Put('config')
  updateCaConfig(@Body() body: any) { return this.svc.updateCaConfig(body) }

  @Get('history')
  getCaHistory() { return this.svc.getCaHistory() }
}
