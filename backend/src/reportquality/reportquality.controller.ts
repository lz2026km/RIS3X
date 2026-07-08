import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Report-qualityService } from './report-quality.service';
@ApiTags('report-quality')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/report-quality')
export class Report-qualityController {
  constructor(private readonly svc: Report-qualityService) {}
  @Get('score-rules')
  listScoreRules(@Param('id') id: string) {
    return this.svc.listScoreRules(id);
  }

  @Post('score-rules')
  createScoreRule(@Body() body: any) {
    return this.svc.createScoreRule(body);
  }

  @Put('score-rules/:id')
  updateScoreRule(@Param('id') id: string, @Body() body: any) {
    return this.svc.updateScoreRule(id, body);
  }

  @Get('defect-library')
  listDefectLibrary(@Param('id') id: string) {
    return this.svc.listDefectLibrary(id);
  }

  @Post('defect-library')
  createDefectEntry(@Body() body: any) {
    return this.svc.createDefectEntry(body);
  }

  @Put('defect-library/:id')
  updateDefectEntry(@Param('id') id: string, @Body() body: any) {
    return this.svc.updateDefectEntry(id, body);
  }

  @Get('ai-report-drafts')
  listAiReportDrafts(@Param('id') id: string) {
    return this.svc.listAiReportDrafts(id);
  }

  @Post('ai-report-drafts')
  createAiReportDraft(@Body() body: any) {
    return this.svc.createAiReportDraft(body);
  }

  @Get('stats')
  getReportQualityStats(@Param('id') id: string) {
    return this.svc.getReportQualityStats(id);
  }
}
