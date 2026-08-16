/**
 * G005 RIS v3.0.6.11-101 Wave 7A — AI 报告助理 V2 (F1) 控制器
 * 路由前缀 /ai-draft-v2 (全局 /api 前缀 → /api/ai-draft-v2/*)
 * 端点:
 *  POST /ai-draft-v2/extract-fields  结构化字段自动提取 (部位/征象/测量值/对比/结论 + 置信度)
 *  POST /ai-draft-v2/generate        多模态报告草稿生成 (模板 + 字段, 逐段溯源)
 *  POST /ai-draft-v2/suggest         对已有报告逐段给出修改建议
 *  GET  /ai-draft-v2/drafts          内存草稿历史 (seed 回退, 无 DB 可用)
 */
import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { Roles } from '../../common/decorators/roles.decorator'
import {
  AiDraftV2Service,
  type GenerateDraftV2Request,
  type SuggestRequest,
} from './ai-draft-v2.service'
import type { ExtractFieldsRequest } from './field-extractor'
import type { ReportParagraphInput } from './suggestions'

const ExtractFieldsSchema = z.object({
  findings: z.string().max(20000).default(''),
  modality: z.string().max(10).optional(),
  bodyPart: z.string().max(50).optional(),
})

const GenerateSchema = z.object({
  patientId: z.string().min(1).max(64),
  examId: z.string().min(1).max(64),
  modality: z.string().min(1).max(10),
  bodyPart: z.string().min(1).max(50),
  findings: z.string().max(20000).optional(),
  clinicalHistory: z.string().max(2000).optional(),
  keywords: z.array(z.string().max(50)).max(20).optional(),
})

const SuggestSchema = z.object({
  paragraphs: z
    .array(
      z.object({
        heading: z.string().max(100),
        content: z.string().max(20000),
      }),
    )
    .max(30)
    .default([]),
  modality: z.string().max(10).optional(),
  bodyPart: z.string().max(50).optional(),
})

@ApiTags('ai-draft-v2')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('ai-draft-v2')
export class AiDraftV2Controller {
  constructor(private readonly service: AiDraftV2Service) {}

  @Post('extract-fields')
  @HttpCode(200)
  @ApiOperation({ summary: '结构化字段自动提取 (规则+字典, 确定性, 字段置信度)' })
  extractFields(@Body(new ZodValidationPipe(ExtractFieldsSchema)) body: ExtractFieldsRequest) {
    return this.service.extractFields(body)
  }

  @Post('generate')
  @HttpCode(200)
  @ApiOperation({ summary: '多模态报告草稿生成 (模板 + 结构化字段, 逐段溯源)' })
  generate(@Body(new ZodValidationPipe(GenerateSchema)) body: GenerateDraftV2Request) {
    return this.service.generateDraft(body)
  }

  @Post('suggest')
  @HttpCode(200)
  @ApiOperation({ summary: '对已有报告逐段给出修改建议 (确定性规则)' })
  suggest(@Body(new ZodValidationPipe(SuggestSchema)) body: SuggestRequest) {
    return this.service.suggest(body)
  }

  @Get('drafts')
  @ApiOperation({ summary: '内存草稿历史 (seed 回退, 无 DB 也可用)' })
  drafts() {
    return this.service.listMemoryDrafts()
  }
}

export type { ExtractFieldsRequest, ReportParagraphInput }
