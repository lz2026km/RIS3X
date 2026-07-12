import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ImageAiService, type AiScoreDto, type AiStatsQuery } from './image-ai.service'

const ScoreSchema = z.object({
  instanceId: z.string().min(1),
  modality: z.string().min(1),
  motionArtifact: z.number().min(1).max(5),
  metalArtifact: z.number().min(1).max(5),
  ringArtifact: z.number().min(1).max(5),
  exposureLow: z.number().min(1).max(5),
  exposureNormal: z.number().min(1).max(5),
  exposureOver: z.number().min(1).max(5),
  positioningCorrect: z.number().min(1).max(5),
  positioningMildRotation: z.number().min(1).max(5),
  positioningSevereOffset: z.number().min(1).max(5),
  overall: z.number().min(1).max(5),
  operatorId: z.string().optional(),
})

@ApiTags('qc', 'image-ai')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('qc/image-ai')
export class ImageAiController {
  constructor(private readonly service: ImageAiService) {}

  @Post('score')
  score(@Body(new ZodValidationPipe(ScoreSchema)) body: AiScoreDto) {
    return this.service.score(body)
  }

  @Get('result/:instanceId')
  getResult(@Param('instanceId') instanceId: string) {
    return this.service.getResult(instanceId)
  }

  @Get('stats')
  stats(
    @Query('modality') modality?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('operatorId') operatorId?: string,
  ) {
    const query: AiStatsQuery = { modality, dateFrom, dateTo, operatorId }
    return this.service.stats(query)
  }
}
