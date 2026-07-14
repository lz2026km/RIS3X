import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { AiService, AiGenerateDto, AiReviewDto, AiScoreDto } from './ai.service'
import { AiDraftService, type DicomMetadata } from './ai-draft.service'

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
  generate(@Body() dto: AiGenerateDto) {
    return this.service.generateReport(dto)
  }

  @Post('review')
  review(@Body() dto: AiReviewDto) {
    return this.service.reviewReport(dto)
  }

  @Post('score')
  score(@Body() dto: AiScoreDto) {
    return this.service.scoreReport(dto)
  }

  @Get('providers')
  getProviders() {
    return { providers: ['mock'], active: 'mock' }
  }

  @Post('draft')
  draft(@Body() meta: DicomMetadata) {
    return this.draftService.draft(meta)
  }

  @Post('draft/continue')
  continueDraft(@Body() body: { meta: DicomMetadata; existingContent: string }) {
    return this.draftService.continueDraft(body.meta, body.existingContent)
  }

  @Post('draft/rewrite')
  rewriteDraft(@Body() body: { meta: DicomMetadata; targetParagraph: string; instruction: string }) {
    return this.draftService.rewriteDraft(body.meta, body.targetParagraph, body.instruction)
  }

  @Get('draft/templates')
  getDraftTemplates(@Query('modality') modality?: string) {
    return this.draftService.getTemplates(modality)
  }
}
