import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { SimilarCaseService } from './similar-case.service'

const SearchSchema = z.object({
  reportId: z.string().optional(),
  reportText: z.string().optional(),
  modality: z.string().optional(),
  bodyPart: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
})

const FeedbackSchema = z.object({
  reportId: z.string().min(1),
  targetReportId: z.string().min(1),
  useful: z.boolean(),
  comment: z.string().optional(),
})

const ImageSearchSchema = z.object({
  seriesUID: z.string().optional(),
  studyUid: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
}).refine((v) => v.seriesUID || v.studyUid, { message: 'seriesUID or studyUid required' })

const HybridSearchSchema = z.object({
  reportId: z.string().optional(),
  reportText: z.string().optional(),
  seriesUID: z.string().optional(),
  studyUid: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
})

@ApiTags('similar-case')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('similar-case')
export class SimilarCaseController {
  constructor(private readonly service: SimilarCaseService) {}

  @Post('search')
  search(@Body(new ZodValidationPipe(SearchSchema)) body: z.infer<typeof SearchSchema>) {
    return this.service.search(body)
  }

  /** v3.0.6.11-62: 影像级相似检索 (seriesUID/studyUid → Top 10 匿名相似影像) */
  @Post('image-search')
  imageSearch(@Body(new ZodValidationPipe(ImageSearchSchema)) body: z.infer<typeof ImageSearchSchema>) {
    return this.service.imageSearch(body)
  }

  /** v3.0.6.11-62: 融合检索 (文本相似 + 影像特征) */
  @Post('hybrid-search')
  hybridSearch(@Body(new ZodValidationPipe(HybridSearchSchema)) body: z.infer<typeof HybridSearchSchema>) {
    return this.service.hybridSearch(body)
  }

  /** v3.0.6.11-62: 影像检索序列列表 (前端选择器) */
  @Get('series')
  series() {
    return this.service.listImageSeries()
  }

  @Get(':reportId')
  findByReport(@Param('reportId') reportId: string) {
    return this.service.findByReport(reportId)
  }

  @Post('feedback')
  feedback(@Body(new ZodValidationPipe(FeedbackSchema)) body: z.infer<typeof FeedbackSchema>) {
    return this.service.feedback(body)
  }
}
