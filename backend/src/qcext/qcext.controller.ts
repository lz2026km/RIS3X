import { Controller, Get, HttpCode, HttpStatus, Post, Put, Delete, Param, Body, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { QcExtService } from './qcext.service'

@ApiTags('qc-ext')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('qc-ext')
export class QcExtController {
  constructor(private readonly svc: QcExtService) {}

  @Get('dashboard')
  getQcDashboard() { return this.svc.getQcDashboard() }

  @Get('dashboard/:id')
  getQcDashboardItem(@Param('id') id: string) { return this.svc.getQcDashboardItem(id) }

  @Get('image')
  listQcImages() { return this.svc.listQcImages() }

  @Get('image/:id')
  getQcImage(@Param('id') id: string) { return this.svc.getQcImage(id) }

  @Post('image/:id/rate')
  rateQcImage(@Body() body: Record<string, unknown>) { return this.svc.rateQcImage(body) }

  @Get('radiologist-annual')
  listRadiologistAnnual() { return this.svc.listRadiologistAnnual() }

  @Get('radiologist-annual/:id')
  getRadiologistAnnual(@Param('id') id: string) { return this.svc.getRadiologistAnnual(id) }

  @Get('defect')
  listQcDefects() { return this.svc.listQcDefects() }

  @Post('defect')
  reportQcDefect(@Body() body: Record<string, unknown>) { return this.svc.reportQcDefect(body) }

  @Get('stats')
  getQcStats() { return this.svc.getQcStats() }

  @Get('scores')
  listQcScores() { return this.svc.listQcScores() }
}
