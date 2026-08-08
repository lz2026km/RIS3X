import { Controller, Get, Post, Put, Delete, Param, Body, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { AiPlatformService } from './aiplatform.service'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import {
  CreateAiModelSchema,
  CreateAiJobSchema,
  CreateAiOrchestrationSchema,
  CreateWorkflowIntegrationSchema,
  DeployAiModelSchema,
  GenerateStructuredReportSchema,
  TestAiModelSchema,
  TriggerWorkflowEventSchema,
} from './aiplatform.schema'

@ApiTags('ai-platform')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('ai-platform')
export class AiPlatformController {
  constructor(private readonly svc: AiPlatformService) {}

  // ==================== 模型注册表 ====================

  @Get('models')
  listAiModels() { return this.svc.listAiModels() }

  @Get('models/:id')
  getAiModel(@Param('id') id: string) { return this.svc.getAiModel(id) }

  @Post('models')
  createAiModel(@Body(new ZodValidationPipe(CreateAiModelSchema)) body: Record<string, unknown>) { return this.svc.createAiModel(body) }

  @Post('models/:id/deploy')
  deployAiModel(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(DeployAiModelSchema.partial())) body: Record<string, unknown>,
  ) { return this.svc.deployAiModel(id, body) }

  @Post('models/:id/undeploy')
  undeployAiModel(@Param('id') id: string) { return this.svc.undeployAiModel(id) }

  @Post('models/:id/test')
  testAiModel(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(TestAiModelSchema.partial())) body: Record<string, unknown>,
  ) { return this.svc.testAiModel(id, body) }

  // ==================== 工作流集成 ====================

  @Get('workflow/integrations')
  listWorkflowIntegrations() { return this.svc.listWorkflowIntegrations() }

  @Post('workflow/integrations')
  createWorkflowIntegration(@Body(new ZodValidationPipe(CreateWorkflowIntegrationSchema)) body: Record<string, unknown>) { return this.svc.createWorkflowIntegration(body) }

  @Post('workflow/trigger')
  triggerWorkflowEvent(@Body(new ZodValidationPipe(TriggerWorkflowEventSchema)) body: Record<string, unknown>) {
    return this.svc.matchWorkflowTriggers({
      trigger: String(body['trigger']),
      examId: String(body['examId']),
      modality: body['modality'] as string | undefined,
      bodyPart: body['bodyPart'] as string | undefined,
      payload: body['payload'] as Record<string, unknown> | undefined,
    })
  }

  // ==================== 推理任务 ====================

  @Get('jobs')
  listAiJobs(@Query('status') status?: string, @Query('modelId') modelId?: string) {
    return this.svc.listAiJobs({ status, modelId })
  }

  @Get('jobs/:id')
  getAiJob(@Param('id') id: string) { return this.svc.getAiJob(id) }

  @Post('jobs')
  triggerAiJob(@Body(new ZodValidationPipe(CreateAiJobSchema)) body: Record<string, unknown>) { return this.svc.triggerAiJob(body) }

  // ==================== 既有端点 ====================

  @Get('stats')
  getAiPlatformStats() { return this.svc.getStats() }

  @Get('qc')
  listAiQcResults() { return this.svc.listAiQcResults() }

  @Get('qc/:id')
  getAiQcResult(@Param('id') id: string) { return this.svc.getAiQcResult(id) }

  @Get('structured-reports')
  listAiStructuredReports() { return this.svc.listAiStructuredReports() }

  @Post('structured-reports')
  generateStructuredReport(@Body(new ZodValidationPipe(GenerateStructuredReportSchema)) body: Record<string, unknown>) { return this.svc.generateStructuredReport(body) }

  @Get('medical-devices')
  listAiMedicalDevices() { return this.svc.listAiMedicalDevices() }

  @Get('orchestration')
  getAiOrchestration() { return this.svc.getAiOrchestration() }

  @Post('orchestration')
  createAiOrchestration(@Body(new ZodValidationPipe(CreateAiOrchestrationSchema)) body: Record<string, unknown>) { return this.svc.createAiOrchestration(body) }

  @Get('fusion')
  getAiFusionWorkspace() { return this.svc.getAiFusionWorkspace() }

  @Get('assist')
  getAiAssist() { return this.svc.getAiAssist() }

  @Get('marketplace')
  getAiMarketplace() { return this.svc.getAiMarketplace() }
}
