import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { CrossModalService } from './cross-modal.service'

const SearchSchema = z.object({
  query: z.string().default(''),
})

const SimilarSchema = z.object({
  imageId: z.string().min(1),
})

const ReindexSchema = z.object({
  modality: z.string().optional(),
})

@ApiTags('cross-modal')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('cross-modal')
export class CrossModalController {
  constructor(private readonly service: CrossModalService) {}

  @Post('search')
  search(@Body(new ZodValidationPipe(SearchSchema)) body: z.infer<typeof SearchSchema>) {
    return this.service.search(body.query)
  }

  @Post('similar')
  similar(@Body(new ZodValidationPipe(SimilarSchema)) body: z.infer<typeof SimilarSchema>) {
    return this.service.findSimilar(body.imageId)
  }

  // [G005 Wave1B P1] 3 扩展: index-status / reindex / suggestions
  @Get('index-status')
  @ApiOperation({ summary: '跨模态索引状态 (Exam 统计派生)' })
  getIndexStatus() {
    return this.service.getIndexStatus()
  }

  @Post('reindex')
  @ApiOperation({ summary: '重建跨模态索引' })
  reindex(@Body(new ZodValidationPipe(ReindexSchema)) body: z.infer<typeof ReindexSchema>) {
    return this.service.reindex(body.modality)
  }

  @Get('suggestions')
  @ApiOperation({ summary: '跨模态搜索建议' })
  suggestions(@Query('q') q?: string) {
    return this.service.suggestions(q ?? '')
  }
}
