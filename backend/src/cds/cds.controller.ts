import { Controller, Get, HttpCode, HttpStatus, Post, Put, Delete, Param, Body, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CdsService, type RuleEvaluateRequest, type RulePriorityRequest } from './cds.service'
import { z } from 'zod'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { AcknowledgeAlertSchema, CreateCdsRuleSchema, CreateGuidelineSchema } from './cds.schema'

const RuleEvaluateSchema = z.object({
  ruleId: z.string().min(1),
  patientId: z.string().min(1),
  context: z.record(z.unknown()).default({}),
})
const RulePrioritySchema = z.object({ ruleId: z.string().min(1), priority: z.number().int() })

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
  createGuideline(@Body(new ZodValidationPipe(CreateGuidelineSchema)) body: Record<string, unknown>) { return this.svc.createGuideline(body) }

  @Get('alerts')
  listAlerts() { return this.svc.listAlerts() }

  @Post('alerts/:id/acknowledge')
  acknowledgeAlert(@Body(new ZodValidationPipe(AcknowledgeAlertSchema)) body: Record<string, unknown>) { return this.svc.acknowledgeAlert(body) }

  @Get('dose-monitoring')
  getDoseMonitoring() { return this.svc.getDoseMonitoring() }

  @Get('statistics')
  getCdsStatistics() { return this.svc.getCdsStatistics() }

  @Get('rules')
  listCdsRules() { return this.svc.listCdsRules() }

  @Post('rules')
  @HttpCode(HttpStatus.CREATED)
  createCdsRule(@Body(new ZodValidationPipe(CreateCdsRuleSchema)) body: Record<string, unknown>) { return this.svc.createCdsRule(body) }

  @Get('management')
  getCdsManagement() { return this.svc.getCdsManagement() }

  @Post('rule/evaluate')
  evaluateRule(@Body(new ZodValidationPipe(RuleEvaluateSchema)) body: RuleEvaluateRequest) { return this.svc.evaluateRule(body) }

  @Put('rule/priority')
  updateRulePriority(@Body(new ZodValidationPipe(RulePrioritySchema)) body: RulePriorityRequest) { return this.svc.updateRulePriority(body) }
}
