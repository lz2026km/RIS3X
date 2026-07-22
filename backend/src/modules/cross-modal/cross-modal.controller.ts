import { Body, Controller, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
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
}
