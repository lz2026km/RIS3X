import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { AiService, AiGenerateDto, AiReviewDto, AiScoreDto } from './ai.service'
import { AiDraftService, type DicomMetadata } from './ai-draft.service'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'

const GenerateSchema = z.object({ modality: z.string().min(1), bodyPart: z.string().min(1), findings: z.string(), impression: z.string().optional(), clinicalHistory: z.string().optional() })
const ReviewSchema = z.object({ reportText: z.string(), findings: z.string(), conclusion: z.string() })
const ScoreSchema = ReviewSchema.extend({ radsCategory: z.string().optional(), hasCritical: z.boolean().optional() })
const MetadataSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().optional(),
  studyInstanceUid: z.string().optional(),
  modality: z.string().min(1),
  bodyPart: z.string().optional(),
  clinicalHistory: z.string().optional(),
  findings: z.string().optional(),
  impression: z.string().optional(),
})
const ContinueSchema = z.object({ meta: MetadataSchema, existingContent: z.string().min(1) })
const RewriteSchema = z.object({ meta: MetadataSchema, targetParagraph: z.string().min(1), instruction: z.string().min(1) })

@ApiTags('ai')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('ai')
export class AiController {
  constructor(
    private readonly service: AiService,
    private readonly draftService: AiDraftService,
  ) {}

  @Post('generate')
  generate(@Body(new ZodValidationPipe(GenerateSchema)) dto: AiGenerateDto) {
    return this.service.generateReport(dto)
  }

  @Post('review')
  review(@Body(new ZodValidationPipe(ReviewSchema)) dto: AiReviewDto) {
    return this.service.reviewReport(dto)
  }

  @Post('score')
  score(@Body(new ZodValidationPipe(ScoreSchema)) dto: AiScoreDto) {
    return this.service.scoreReport(dto)
  }

  @Get('providers')
  getProviders() {
    return { providers: ['mock'], active: 'mock' }
  }

  @Post('draft')
  draft(@Body(new ZodValidationPipe(MetadataSchema)) meta: DicomMetadata) {
    return this.draftService.draft(meta)
  }

  @Post('draft/continue')
  continueDraft(@Body(new ZodValidationPipe(ContinueSchema)) body: { meta: DicomMetadata; existingContent: string }) {
    return this.draftService.continueDraft(body.meta, body.existingContent)
  }

  @Post('draft/rewrite')
  rewriteDraft(@Body(new ZodValidationPipe(RewriteSchema)) body: { meta: DicomMetadata; targetParagraph: string; instruction: string }) {
    return this.draftService.rewriteDraft(body.meta, body.targetParagraph, body.instruction)
  }

  @Get('draft/templates')
  getDraftTemplates(@Query('modality') modality?: string) {
    return this.draftService.getTemplates(modality)
  }
}
