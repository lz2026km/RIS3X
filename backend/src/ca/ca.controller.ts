import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CaService } from './ca.service';
@ApiTags('ca')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/ca')
export class CaController {
  constructor(private readonly svc: CaService) {}
  @Get('certificates')
  listCertificates(@Param('id') id: string) {
    return this.svc.listCertificates(id);
  }

  @Post('certificates')
  uploadCertificate(@Body() body: any) {
    return this.svc.uploadCertificate(body);
  }

  @Delete('certificates/:id')
  revokeCertificate(@Param('id') id: string) {
    return this.svc.revokeCertificate(id);
  }

  @Post('sign')
  signDocument(@Body() body: any) {
    return this.svc.signDocument(body);
  }

  @Get('signatures')
  listSignatures(@Param('id') id: string) {
    return this.svc.listSignatures(id);
  }

  @Post('verify')
  verifySignature(@Body() body: any) {
    return this.svc.verifySignature(body);
  }

  @Get('config')
  getCaConfig(@Param('id') id: string) {
    return this.svc.getCaConfig(id);
  }

  @Put('config')
  updateCaConfig(@Param('id') id: string, @Body() body: any) {
    return this.svc.updateCaConfig(id, body);
  }

  @Get('history')
  getCaHistory(@Param('id') id: string) {
    return this.svc.getCaHistory(id);
  }
}
