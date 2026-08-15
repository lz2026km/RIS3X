/**
 * G005 RIS v3.0.6.11-100 Wave 3A (G-19) — AI 草稿深化端点
 * GET  /ai-draft/providers           可用模型列表 (mock/deepseek/hunyuan)
 * GET  /ai-draft/rag-context?reportId=  既往报告摘要 + 匹配 SNOMED 术语
 * POST /ai-draft/generate-advanced    LLM 生成草稿 + confidenceScore + sources[]
 * POST /ai-draft/generate-structured  自动填充 现病史/检查所见/诊断意见 段落
 */
import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import {
  ReportDraftService,
  type GenerateAdvancedRequest,
  type GenerateStructuredRequest,
} from './report-draft.service'
import { LlmProviderIdSchema } from './llm-provider.schema'

const GenerateAdvancedSchema = z.object({
  reportId: z.string().min(1),
  provider: LlmProviderIdSchema.optional(),
  includeRag: z.boolean().optional(),
})

const GenerateStructuredSchema = z.object({
  reportId: z.string().min(1),
})

@ApiTags('ai-draft')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('ai-draft')
export class AiDraftAdvancedController {
  constructor(private readonly service: ReportDraftService) {}

  /** 可用模型列表 */
  @Get('providers')
  providers() {
    return this.service.getProviders()
  }

  /** RAG 上下文: 当前报告摘要 + 匹配术语 + 既往报告 */
  @Get('rag-context')
  ragContext(@Query('reportId') reportId: string) {
    return this.service.getRagContext(reportId)
  }

  /** 高级生成: LLM (mock/deepseek/hunyuan) + 可选 RAG */
  @Post('generate-advanced')
  generateAdvanced(@Body(new ZodValidationPipe(GenerateAdvancedSchema)) body: GenerateAdvancedRequest) {
    return this.service.generateAdvanced(body)
  }

  /** 结构化字段生成: 现病史/检查所见/诊断意见 */
  @Post('generate-structured')
  generateStructured(@Body(new ZodValidationPipe(GenerateStructuredSchema)) body: GenerateStructuredRequest) {
    return this.service.generateStructured(body)
  }
}
