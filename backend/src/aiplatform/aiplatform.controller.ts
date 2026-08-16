import { Controller, Get, Post, Put, Delete, Param, Body, Query, HttpCode } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { AiPlatformService } from './aiplatform.service'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import {
  CreateAiModelSchema,
  CreateAiJobSchema,
  CreateAiOrchestrationSchema,
  CreateWorkflowIntegrationSchema,
  DenoiseImageSchema,
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

  // ==================== [G005 v3.0.6.11-90 Wave 4B (G-10)] DL 降噪 ====================

  @Post('denoise')
  @HttpCode(200)
  @ApiOperation({ summary: 'DL 降噪: 可配置核 (Median/Gaussian/Bilateral/NL-means/DL) + 噪声估计 + 3 档预设' })
  denoiseImage(@Body(new ZodValidationPipe(DenoiseImageSchema)) body: Record<string, unknown>) {
    return this.svc.denoiseImage(body)
  }

  // ==================== [G005 v3.0.6.11-101 Wave 1B (G-10)] 降噪处理历史 ====================

  @Get('denoise/history')
  @ApiOperation({ summary: '[G-10] DL 降噪处理历史 (内存 ring buffer, 最近 20 条)' })
  denoiseHistory() {
    return this.svc.denoiseHistory()
  }

  @Post('denoise/history/clear')
  @HttpCode(200)
  @ApiOperation({ summary: '[G-10] 清空降噪处理历史' })
  clearDenoiseHistory() {
    return this.svc.clearDenoiseHistory()
  }

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
