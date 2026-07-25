import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { WorkflowService } from './workflow.service'
import { z } from 'zod'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'

const JsonObjectSchema = z.record(z.unknown())
const CreateDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(''),
  stepConfig: JsonObjectSchema.or(z.array(z.unknown())).default([]),
  version: z.number().int().positive().default(1),
  active: z.boolean().default(true),
})
const UpdateDefinitionSchema = CreateDefinitionSchema.partial()
const ActivateDefinitionSchema = z.object({ id: z.string().min(1) })
const CreateStepSchema = z.object({
  workflowId: z.string().min(1),
  name: z.string().min(1),
  stepType: z.string().min(1),
  assigneeRole: z.string().optional(),
  timeoutMinutes: z.number().int().positive().optional(),
  escalationRole: z.string().optional(),
  config: JsonObjectSchema.default({}),
  orderIndex: z.number().int().nonnegative(),
})
const CreateSlaSchema = z.object({
  name: z.string().min(1),
  modality: z.string().optional(),
  priority: z.string().default('NORMAL'),
  targetMinutes: z.number().int().positive(),
  warningMinutes: z.number().int().positive(),
  escalationRole: z.string().optional(),
  active: z.boolean().default(true),
})
const UpdateSlaSchema = CreateSlaSchema.partial()
const CreateRoutingRuleSchema = z.object({
  name: z.string().min(1),
  modality: z.string().optional(),
  bodyPart: z.string().optional(),
  sourceDept: z.string().optional(),
  targetDept: z.string().min(1),
  priority: z.number().int().default(0),
  active: z.boolean().default(true),
})
const UpdateRoutingRuleSchema = CreateRoutingRuleSchema.partial()

@ApiTags('workflow')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('workflow')
export class WorkflowController {
  constructor(private readonly svc: WorkflowService) {}

  @Get('definitions')
  listDefinitions() { return this.svc.listDefinitions() }

  @Post('definitions')
  createDefinition(@Body(new ZodValidationPipe(CreateDefinitionSchema)) body: Record<string, unknown>) { return this.svc.createDefinition(body) }

  @Get('definitions/:id')
  getDefinition(@Param('id') id: string) { return this.svc.getDefinition(id) }

  @Put('definitions/:id')
  updateDefinition(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateDefinitionSchema)) body: Record<string, unknown>) { return this.svc.updateDefinition(id, body) }

  @Delete('definitions/:id')
  deleteDefinition(@Param('id') id: string) { return this.svc.deleteDefinition(id) }

  @Post('definitions/:id/activate')
  activateDefinition(@Body(new ZodValidationPipe(ActivateDefinitionSchema)) body: Record<string, unknown>) { return this.svc.activateDefinition(body) }

  @Get('definitions/:id/steps')
  listSteps(@Param('id') id: string) { return this.svc.listSteps(id) }

  @Post('definitions/:id/steps')
  addStep(@Body(new ZodValidationPipe(CreateStepSchema)) body: Record<string, unknown>) { return this.svc.addStep(body) }

  @Get('sla-policies')
  listSlaPolicies() { return this.svc.listSlaPolicies() }

  @Post('sla-policies')
  createSlaPolicy(@Body(new ZodValidationPipe(CreateSlaSchema)) body: Record<string, unknown>) { return this.svc.createSlaPolicy(body) }

  @Put('sla-policies/:id')
  updateSlaPolicy(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateSlaSchema)) body: Record<string, unknown>) { return this.svc.updateSlaPolicy(id, body) }

  @Get('routing-rules')
  listRoutingRules() { return this.svc.listRoutingRules() }

  @Post('routing-rules')
  createRoutingRule(@Body(new ZodValidationPipe(CreateRoutingRuleSchema)) body: Record<string, unknown>) { return this.svc.createRoutingRule(body) }

  @Put('routing-rules/:id')
  updateRoutingRule(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateRoutingRuleSchema)) body: Record<string, unknown>) { return this.svc.updateRoutingRule(id, body) }

  @Delete('routing-rules/:id')
  deleteRoutingRule(@Param('id') id: string) { return this.svc.deleteRoutingRule(id) }
}
