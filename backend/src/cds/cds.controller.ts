import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CdsService } from './cds.service';
@ApiTags('cds')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/cds')
export class CdsController {
  constructor(private readonly svc: CdsService) {}
  @Get('guidelines')
  listGuidelines(@Param('id') id: string) {
    return this.svc.listGuidelines(id);
  }

  @Get('guidelines/:id')
  getGuideline(@Param('id') id: string) {
    return this.svc.getGuideline(id);
  }

  @Post('guidelines')
  createGuideline(@Body() body: any) {
    return this.svc.createGuideline(body);
  }

  @Get('alerts')
  listAlerts(@Param('id') id: string) {
    return this.svc.listAlerts(id);
  }

  @Post('alerts/:id/acknowledge')
  acknowledgeAlert(@Body() body: any) {
    return this.svc.acknowledgeAlert(body);
  }

  @Get('dose-monitoring')
  getDoseMonitoring(@Param('id') id: string) {
    return this.svc.getDoseMonitoring(id);
  }

  @Get('statistics')
  getCdsStatistics(@Param('id') id: string) {
    return this.svc.getCdsStatistics(id);
  }

  @Get('rules')
  listCdsRules(@Param('id') id: string) {
    return this.svc.listCdsRules(id);
  }

  @Post('rules')
  createCdsRule(@Body() body: any) {
    return this.svc.createCdsRule(body);
  }

  @Get('management')
  getCdsManagement(@Param('id') id: string) {
    return this.svc.getCdsManagement(id);
  }
}
