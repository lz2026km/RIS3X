import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { CreateCriticalRuleSchema, UpdateCriticalRuleSchema, AutoDetectCriticalSchema, CloseCriticalLoopSchema } from './criticalext.schema'
import { CriticalExtService } from './criticalext.service'

@ApiTags('critical-ext')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('criticals')
export class CriticalExtController {
  constructor(private readonly svc: CriticalExtService) {}

  @Get('rules')
  listCriticalRules() { return this.svc.listCriticalRules() }

  @Post('rules')
  createCriticalRule(@Body(new ZodValidationPipe(CreateCriticalRuleSchema)) body: z.infer<typeof CreateCriticalRuleSchema>) { return this.svc.createCriticalRule(body) }

  @Put('rules/:id')
  updateCriticalRule(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateCriticalRuleSchema)) body: z.infer<typeof UpdateCriticalRuleSchema>) { return this.svc.updateCriticalRule(id, body) }

  @Delete('rules/:id')
  deleteCriticalRule(@Param('id') id: string) { return this.svc.deleteCriticalRule(id) }

  @Get('stats')
  getCriticalStats() { return this.svc.getCriticalStats() }

  @Get('stats/summary')
  getCriticalSummary() { return this.svc.getCriticalSummary() }

  @Get('stats/timeline')
  getCriticalTimeline() { return this.svc.getCriticalTimeline() }

  @Get('center')
  listCriticalCenter() { return this.svc.listCriticalCenter() }

  @Get('center/:id')
  getCriticalCenterItem(@Param('id') id: string) { return this.svc.getCriticalCenterItem(id) }

  @Post('auto-detect')
  autoDetectCritical(@Body(new ZodValidationPipe(AutoDetectCriticalSchema)) body: z.infer<typeof AutoDetectCriticalSchema>) { return this.svc.autoDetectCritical(body) }

  @Post('close-loop')
  closeCriticalLoop(@Body(new ZodValidationPipe(CloseCriticalLoopSchema)) body: z.infer<typeof CloseCriticalLoopSchema>) { return this.svc.closeCriticalLoop(body) }

  @Get('receiver')
  getReceiverPortal() { return this.svc.getReceiverPortal() }
}
