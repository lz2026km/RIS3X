import { Controller, Get, HttpCode, HttpStatus, Post, Put, Delete, Param, Body, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CdsService } from './cds.service'

@ApiTags('cds')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('cds')
export class CdsController {
  constructor(private readonly svc: CdsService) {}

  @Get('guidelines')
  listGuidelines() { return this.svc.listGuidelines() }

  @Get('guidelines/:id')
  getGuideline(@Param('id') id: string) { return this.svc.getGuideline(id) }

  @Post('guidelines')
  @HttpCode(HttpStatus.CREATED)
  createGuideline(@Body() body: any) { return this.svc.createGuideline(body) }

  @Get('alerts')
  listAlerts() { return this.svc.listAlerts() }

  @Post('alerts/:id/acknowledge')
  acknowledgeAlert(@Body() body: any) { return this.svc.acknowledgeAlert(body) }

  @Get('dose-monitoring')
  getDoseMonitoring() { return this.svc.getDoseMonitoring() }

  @Get('statistics')
  getCdsStatistics() { return this.svc.getCdsStatistics() }

  @Get('rules')
  listCdsRules() { return this.svc.listCdsRules() }

  @Post('rules')
  @HttpCode(HttpStatus.CREATED)
  createCdsRule(@Body() body: any) { return this.svc.createCdsRule(body) }

  @Get('management')
  getCdsManagement() { return this.svc.getCdsManagement() }
}
