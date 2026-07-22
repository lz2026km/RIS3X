import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { AiPlatformService } from './aiplatform.service'

@ApiTags('ai-platform')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('ai-platform')
export class AiPlatformController {
  constructor(private readonly svc: AiPlatformService) {}

  @Get('models')
  listAiModels() { return this.svc.listAiModels() }

  @Get('models/:id')
  getAiModel(@Param('id') id: string) { return this.svc.getAiModel(id) }

  @Post('models/:id/deploy')
  deployAiModel(@Body() body: Record<string, unknown>) { return this.svc.deployAiModel(body) }

  @Get('qc')
  listAiQcResults() { return this.svc.listAiQcResults() }

  @Get('qc/:id')
  getAiQcResult(@Param('id') id: string) { return this.svc.getAiQcResult(id) }

  @Get('structured-reports')
  listAiStructuredReports() { return this.svc.listAiStructuredReports() }

  @Post('structured-reports')
  generateStructuredReport(@Body() body: Record<string, unknown>) { return this.svc.generateStructuredReport(body) }

  @Get('medical-devices')
  listAiMedicalDevices() { return this.svc.listAiMedicalDevices() }

  @Get('orchestration')
  getAiOrchestration() { return this.svc.getAiOrchestration() }

  @Post('orchestration')
  createAiOrchestration(@Body() body: Record<string, unknown>) { return this.svc.createAiOrchestration(body) }

  @Get('fusion')
  getAiFusionWorkspace() { return this.svc.getAiFusionWorkspace() }

  @Get('assist')
  getAiAssist() { return this.svc.getAiAssist() }

  @Get('marketplace')
  getAiMarketplace() { return this.svc.getAiMarketplace() }
}
