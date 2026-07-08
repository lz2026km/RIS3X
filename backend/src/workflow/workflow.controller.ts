import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@nestjs/passport'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { WorkflowService } from './workflow.service'

@ApiTags('workflow')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('workflow')
export class WorkflowController {
  constructor(private readonly svc: WorkflowService) {}

  @Get('definitions')
  listDefinitions() { return this.svc.listDefinitions() }

  @Post('definitions')
  createDefinition(@Body() body: any) { return this.svc.createDefinition(body) }

  @Get('definitions/:id')
  getDefinition(@Param('id') id: string) { return this.svc.getDefinition(id) }

  @Put('definitions/:id')
  updateDefinition(@Param('id') id: string, @Body() body: any) { return this.svc.updateDefinition(id, body) }

  @Delete('definitions/:id')
  deleteDefinition(@Param('id') id: string) { return this.svc.deleteDefinition(id) }

  @Post('definitions/:id/activate')
  activateDefinition(@Body() body: any) { return this.svc.activateDefinition(body) }

  @Get('definitions/:id/steps')
  listSteps(@Param('id') id: string) { return this.svc.listSteps(id) }

  @Post('definitions/:id/steps')
  addStep(@Body() body: any) { return this.svc.addStep(body) }

  @Get('sla-policies')
  listSlaPolicies() { return this.svc.listSlaPolicies() }

  @Post('sla-policies')
  createSlaPolicy(@Body() body: any) { return this.svc.createSlaPolicy(body) }

  @Put('sla-policies/:id')
  updateSlaPolicy(@Param('id') id: string, @Body() body: any) { return this.svc.updateSlaPolicy(id, body) }

  @Get('routing-rules')
  listRoutingRules() { return this.svc.listRoutingRules() }

  @Post('routing-rules')
  createRoutingRule(@Body() body: any) { return this.svc.createRoutingRule(body) }

  @Put('routing-rules/:id')
  updateRoutingRule(@Param('id') id: string, @Body() body: any) { return this.svc.updateRoutingRule(id, body) }

  @Delete('routing-rules/:id')
  deleteRoutingRule(@Param('id') id: string) { return this.svc.deleteRoutingRule(id) }
}
