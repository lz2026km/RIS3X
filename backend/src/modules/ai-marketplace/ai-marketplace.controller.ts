import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AiMarketplaceService } from './ai-marketplace.service'

const DeploySchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  modality: z.string().min(1),
  description: z.string().default(''),
})

@ApiTags('ai-marketplace')
@ApiBearerAuth()
@Controller('ai-marketplace')
export class AiMarketplaceController {
  constructor(private readonly service: AiMarketplaceService) {}

  @Get('models')
  list() {
    return this.service.list()
  }

  @Post('models/deploy')
  deploy(@Body(new ZodValidationPipe(DeploySchema)) body: z.infer<typeof DeploySchema>) {
    return this.service.deploy(body.name, body.version, body.modality, body.description)
  }

  @Delete('models/:id')
  remove(@Param('id') id: string) {
    this.service.remove(id)
    return { ok: true }
  }

  @Get('models/:id/status')
  getStatus(@Param('id') id: string) {
    return this.service.getStatus(id)
  }
}
