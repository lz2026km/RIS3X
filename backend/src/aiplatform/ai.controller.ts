import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { AiService, AiGenerateDto, AiReviewDto, AiScoreDto } from './ai.service'
import { ReportStyleSchema } from './report-templates'
import { z } from 'zod'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'

const GenerateSchema = z.object({
  modality: z.string().min(1),
  bodyPart: z.string().min(1),
  findings: z.string(),
  impression: z.string().optional(),
  clinicalHistory: z.string().optional(),
  clinicalInfo: z.string().optional(),
})
const ReviewSchema = z.object({ reportText: z.string(), findings: z.string(), conclusion: z.string() })
const ScoreSchema = ReviewSchema.extend({ radsCategory: z.string().optional(), hasCritical: z.boolean().optional() })

@ApiTags('ai')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('ai')
export class AiController {
  constructor(private readonly service: AiService) {}

  /** v3.0.6.11-61: 环境式报告生成, 支持 ?style=concise|standard|detailed */
  @Post('generate')
  generate(
    @Body(new ZodValidationPipe(GenerateSchema)) dto: AiGenerateDto,
    @Query('style') style?: string,
  ) {
    const parsedStyle = ReportStyleSchema.safeParse(style)
    return this.service.generateReport({ ...dto, style: parsedStyle.success ? parsedStyle.data : undefined })
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
}
