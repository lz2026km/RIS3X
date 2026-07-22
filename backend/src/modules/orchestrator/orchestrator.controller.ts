import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags, ApiQuery } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { OrchestratorService, type CreateFlowDto, type TriggerStepDto, type SlaConfigDto } from './orchestrator.service'

const FlowStepSchema = z.object({
  name: z.string().min(1),
  stepType: z.string().min(1),
  assigneeRole: z.string().optional(),
  timeoutMinutes: z.number().int().positive().optional(),
  autoDispatch: z.boolean().optional(),
  condition: z.string().optional(),
  slaMinutes: z.number().int().positive().optional(),
  config: z.record(z.unknown()).optional(),
})

const CreateFlowSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  steps: z.array(FlowStepSchema).min(1),
  slaConfigId: z.string().optional(),
})

const TriggerStepSchema = z.object({
  executionId: z.string().optional(),
  context: z.record(z.unknown()).optional(),
})

const SlaConfigSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(200),
  stepType: z.string().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  targetMinutes: z.number().int().positive(),
  warningMinutes: z.number().int().positive(),
  autoEscalate: z.boolean().optional(),
  escalateRole: z.string().optional(),
  notifyOnBreach: z.boolean().optional(),
})

@ApiTags('orchestrator')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('orchestrator')
export class OrchestratorController {
  constructor(private readonly service: OrchestratorService) {}

  @Post('flow')
  createFlow(@Body(new ZodValidationPipe(CreateFlowSchema)) body: CreateFlowDto) {
    return this.service.createFlow(body)
  }

  @Get('flow/:id')
  getFlow(@Param('id') id: string) {
    return this.service.getFlow(id)
  }

  @Post('flow/:id/trigger')
  triggerFlow(@Param('id') id: string, @Body(new ZodValidationPipe(TriggerStepSchema)) body: TriggerStepDto) {
    return this.service.triggerFlow(id, body)
  }

  @Post('flow/:id/next')
  triggerNextStep(@Param('id') id: string) {
    return this.service.triggerNextStep(id)
  }

  @Get('flows')
  getFlows() {
    return this.service.getFlows()
  }

  @Get('executions')
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  getExecutions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    return this.service.getExecutions(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      status,
    )
  }

  @Put('sla')
  upsertSlaConfig(@Body(new ZodValidationPipe(SlaConfigSchema)) body: SlaConfigDto) {
    return this.service.upsertSlaConfig(body)
  }

  @Get('sla')
  getSlaConfigs() {
    return this.service.getSlaConfigs()
  }

  @Get('sla/stats')
  getSlaStats() {
    return this.service.getSlaStats()
  }
}
