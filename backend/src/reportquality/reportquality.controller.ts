import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ReportQualityService } from './reportquality.service'

@ApiTags('report-quality')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('report-quality')
export class ReportQualityController {
  constructor(private readonly svc: ReportQualityService) {}

  @Get('score-rules')
  listScoreRules() { return this.svc.listScoreRules() }

  @Post('score-rules')
  createScoreRule(@Body() body: any) { return this.svc.createScoreRule(body) }

  @Put('score-rules/:id')
  updateScoreRule(@Param('id') id: string, @Body() body: any) { return this.svc.updateScoreRule(id, body) }

  @Get('defect-library')
  listDefectLibrary() { return this.svc.listDefectLibrary() }

  @Post('defect-library')
  createDefectEntry(@Body() body: any) { return this.svc.createDefectEntry(body) }

  @Put('defect-library/:id')
  updateDefectEntry(@Param('id') id: string, @Body() body: any) { return this.svc.updateDefectEntry(id, body) }

  @Get('ai-report-drafts')
  listAiReportDrafts() { return this.svc.listAiReportDrafts() }

  @Post('ai-report-drafts')
  createAiReportDraft(@Body() body: any) { return this.svc.createAiReportDraft(body) }

  @Get('stats')
  getReportQualityStats() { return this.svc.getReportQualityStats() }
}
