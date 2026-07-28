// [DEPRECATED] 此模块已合并到 criticalext，请勿新增引用
import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CriticalExtService } from './criticalext.service'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { AutoDetectCriticalSchema, CloseCriticalLoopSchema, CreateCriticalRuleSchema, UpdateCriticalRuleSchema } from '../criticals/criticalext.schema'
import { z } from 'zod'

type CreateCriticalRuleDto = z.infer<typeof CreateCriticalRuleSchema>
type UpdateCriticalRuleDto = z.infer<typeof UpdateCriticalRuleSchema>
type AutoDetectCriticalDto = z.infer<typeof AutoDetectCriticalSchema>
type CloseCriticalLoopDto = z.infer<typeof CloseCriticalLoopSchema>

@ApiTags('critical-ext')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('critical-ext')
export class CriticalExtController {
  constructor(private readonly svc: CriticalExtService) {}

  @Get('rules')
  listCriticalRules() { return this.svc.listCriticalRules() }

  @Post('rules')
  createCriticalRule(@Body(new ZodValidationPipe(CreateCriticalRuleSchema)) body: CreateCriticalRuleDto) { return this.svc.createCriticalRule(body) }

  @Put('rules/:id')
  updateCriticalRule(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateCriticalRuleSchema)) body: UpdateCriticalRuleDto) { return this.svc.updateCriticalRule(id, body) }

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
  autoDetectCritical(@Body(new ZodValidationPipe(AutoDetectCriticalSchema)) body: AutoDetectCriticalDto) { return this.svc.autoDetectCritical(body) }

  @Post('close-loop')
  closeCriticalLoop(@Body(new ZodValidationPipe(CloseCriticalLoopSchema)) body: CloseCriticalLoopDto) { return this.svc.closeCriticalLoop(body) }

  @Get('receiver')
  getReceiverPortal() { return this.svc.getReceiverPortal() }
}
