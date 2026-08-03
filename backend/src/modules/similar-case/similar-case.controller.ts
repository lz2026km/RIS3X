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

  @Get(':reportId')
  findByReport(@Param('reportId') reportId: string) {
    return this.service.findByReport(reportId)
  }

  @Post('feedback')
  feedback(@Body(new ZodValidationPipe(FeedbackSchema)) body: z.infer<typeof FeedbackSchema>) {
    return this.service.feedback(body)
  }
}
