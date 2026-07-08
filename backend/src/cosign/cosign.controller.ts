import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CosignService } from './cosign.service';
@ApiTags('cosign')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/cosign')
export class CosignController {
  constructor(private readonly svc: CosignService) {}
  @Get('pending')
  listPendingCosigns(@Param('id') id: string) {
    return this.svc.listPendingCosigns(id);
  }

  @Get('pending/:id')
  getPendingCosign(@Param('id') id: string) {
    return this.svc.getPendingCosign(id);
  }

  @Post('pending/:id/approve')
  approveCosign(@Body() body: any) {
    return this.svc.approveCosign(body);
  }

  @Post('pending/:id/reject')
  rejectCosign(@Body() body: any) {
    return this.svc.rejectCosign(body);
  }

  @Get('history')
  listCosignHistory(@Param('id') id: string) {
    return this.svc.listCosignHistory(id);
  }

  @Get('rules')
  listCosignRules(@Param('id') id: string) {
    return this.svc.listCosignRules(id);
  }

  @Post('rules')
  createCosignRule(@Body() body: any) {
    return this.svc.createCosignRule(body);
  }

  @Get('stats')
  getCosignStats(@Param('id') id: string) {
    return this.svc.getCosignStats(id);
  }
}
