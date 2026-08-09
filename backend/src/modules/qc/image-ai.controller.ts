import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ImageAiService, type AiScoreDto, type AiScoreDtoV2, type AiAssessDto, type AiStatsQuery } from './image-ai.service'

// [G005 Wave4A] G-24 三维度自动质控: POST /qc/image-ai/assess
const AssessSchema = z.object({
  studyId: z.string().min(1),
  instanceId: z.string().optional(),
  modality: z.string().optional(),
  bodyPart: z.string().optional(),
})

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

const ScoreV2Schema = z.object({
  instanceId: z.string().min(1),
  modality: z.string().min(1),
  artifactScores: z.object({
    motion: z.number().min(1).max(5),
    metal: z.number().min(1).max(5),
    ring: z.number().min(1).max(5),
  }),
  positioningScores: z.object({
    setup: z.number().min(1).max(5),
    rotation: z.number().min(1).max(5),
    offset: z.number().min(1).max(5),
  }),
  exposure: z.object({
    value: z.enum(['不足', '正常', '过度']),
    score: z.number().min(1).max(5),
  }),
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

  // [G005 Wave4A] G-24 AI 自动质控三维度评估 (伪影/曝光/体位)
  @Post('assess')
  assess(@Body(new ZodValidationPipe(AssessSchema)) body: AiAssessDto) {
    return this.service.assess(body)
  }

  @Post('score-v2')
  scoreV2(@Body(new ZodValidationPipe(ScoreV2Schema)) body: AiScoreDtoV2) {
    return this.service.scoreV2(body)
  }

  @Get('result/:instanceId')
  getResult(@Param('instanceId') instanceId: string) {
    return this.service.getResult(instanceId)
  }

  @Get('result-v2')
  listV2(
    @Query('modality') modality?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('operatorId') operatorId?: string,
  ) {
    const query: AiStatsQuery = { modality, dateFrom, dateTo, operatorId }
    return this.service.listV2(query)
  }

  @Get('result-v2/:instanceId')
  getResultV2(@Param('instanceId') instanceId: string) {
    return this.service.getResultV2(instanceId)
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

  @Get('stats-v2')
  statsV2(
    @Query('modality') modality?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('operatorId') operatorId?: string,
  ) {
    const query: AiStatsQuery = { modality, dateFrom, dateTo, operatorId }
    return this.service.statsV2(query)
  }
}
