import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { ReportQualityService } from './reportquality.service'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { CreateAiReportDraftSchema, CreateDefectEntrySchema, CreateScoreRuleSchema, UpdateDefectEntrySchema, UpdateScoreRuleSchema } from './reportquality.schema'
import { z } from 'zod'

type CreateScoreRuleDto = z.infer<typeof CreateScoreRuleSchema>
type UpdateScoreRuleDto = z.infer<typeof UpdateScoreRuleSchema>
type CreateDefectEntryDto = z.infer<typeof CreateDefectEntrySchema>
type UpdateDefectEntryDto = z.infer<typeof UpdateDefectEntrySchema>
type CreateAiReportDraftDto = z.infer<typeof CreateAiReportDraftSchema>

@ApiTags('report-quality')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('report-quality')
export class ReportQualityController {
  constructor(private readonly svc: ReportQualityService) {}

  @Get('score-rules')
  listScoreRules() { return this.svc.listScoreRules() }

  @Post('score-rules')
  createScoreRule(@Body(new ZodValidationPipe(CreateScoreRuleSchema)) body: CreateScoreRuleDto) { return this.svc.createScoreRule(body) }

  @Put('score-rules/:id')
  updateScoreRule(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateScoreRuleSchema)) body: UpdateScoreRuleDto) { return this.svc.updateScoreRule(id, body) }

  @Get('defect-library')
  listDefectLibrary() { return this.svc.listDefectLibrary() }

  @Post('defect-library')
  createDefectEntry(@Body(new ZodValidationPipe(CreateDefectEntrySchema)) body: CreateDefectEntryDto) { return this.svc.createDefectEntry(body) }

  @Put('defect-library/:id')
  updateDefectEntry(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateDefectEntrySchema)) body: UpdateDefectEntryDto) { return this.svc.updateDefectEntry(id, body) }

  @Get('ai-report-drafts')
  listAiReportDrafts() { return this.svc.listAiReportDrafts() }

  @Post('ai-report-drafts')
  createAiReportDraft(@Body(new ZodValidationPipe(CreateAiReportDraftSchema)) body: CreateAiReportDraftDto) { return this.svc.createAiReportDraft(body) }

  @Get('stats')
  getReportQualityStats() { return this.svc.getReportQualityStats() }
}
