import { Body, Controller, Post } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import {
  AiDraftService,
  type AiDraftRequest,
  type AiDraftRewriteRequest,
  type AiDraftContinueRequest,
} from './ai-draft.service'

const GenerateSchema = z.object({
  patientId: z.string().min(1),
  examId: z.string().min(1),
  modality: z.string().min(1),
  bodyPart: z.string().min(1),
  clinicalHistory: z.string().optional(),
  keywords: z.array(z.string()).optional(),
})

const RewriteSchema = z.object({
  content: z.string().min(1),
  instruction: z.string().min(1),
  modality: z.string().optional(),
})

const ContinueSchema = z.object({
  existingParagraphs: z.array(z.object({
    heading: z.string(),
    content: z.string(),
  })),
  prompt: z.string().min(1),
  modality: z.string().optional(),
})

@ApiTags('ai-draft')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('ai-draft')
export class AiDraftController {
  constructor(private readonly service: AiDraftService) {}

  @Post('generate')
  generate(@Body(new ZodValidationPipe(GenerateSchema)) body: AiDraftRequest) {
    return this.service.generateDraft(body)
  }

  @Post('rewrite')
  rewrite(@Body(new ZodValidationPipe(RewriteSchema)) body: AiDraftRewriteRequest) {
    return this.service.rewriteParagraph(body)
  }

  @Post('continue')
  continueDraft(@Body(new ZodValidationPipe(ContinueSchema)) body: AiDraftContinueRequest) {
    return this.service.continueDraft(body)
  }
}
