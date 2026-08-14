import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CadRadsService } from './cad-rads.service'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'

const LungSchema = z.object({ noduleSizeMm: z.number().nonnegative().optional(), spiculatedMargin: z.boolean().optional(), solidComponent: z.boolean().optional(), location: z.string().optional() })
const BreastSchema = z.object({ massSizeMm: z.number().nonnegative().optional(), massShape: z.string().optional(), massMargin: z.string().optional(), calcificationType: z.string().optional(), calcificationDistribution: z.string().optional(), biradsCategory: z.string().optional() })
const ProstateSchema = z.object({ lesionZone: z.enum(['PZ', 'TZ', 'AFS']).optional(), lesionSizeMm: z.number().nonnegative().optional(), dwiSignal: z.enum(['low', 'mild', 'high']).optional(), adcValue: z.number().nonnegative().optional(), t2Signal: z.enum(['low', 'mild', 'high']).optional() })
// v3.0.6.11-60: LI-RADS (肝脏)
const LiverSchema = z.object({
  sizeMm: z.number().nonnegative().optional(),
  observationType: z.enum(['nodule', 'nonnodular', 'cystic']).optional(),
  arterialPhaseEnhancement: z.enum(['nonrim', 'rim', 'nodule-in-nodule', 'corona', 'none']).optional(),
  washout: z.enum(['yes', 'no']).optional(),
  enhancingCapsule: z.enum(['yes', 'no']).optional(),
  thresholdGrowth: z.enum(['yes', 'no']).optional(),
  tumorInVein: z.enum(['yes', 'no']).optional(),
})
// v3.0.6.11-60: TI-RADS (甲状腺)
const ThyroidSchema = z.object({
  composition: z.enum(['cystic', 'spongiform', 'mixed', 'solid']).optional(),
  echogenicity: z.enum(['anechoic', 'hyper', 'iso', 'hypo']).optional(),
  shape: z.enum(['wider-than-tall', 'taller-than-wide']).optional(),
  margins: z.enum(['smooth', 'ill-defined', 'lobulated', 'irregular', 'extrathyroidal']).optional(),
  echogenicFoci: z.enum(['none', 'comet', 'macrocalc', 'rim', 'punctate']).optional(),
})

class RadsLungDto {
  noduleSizeMm?: number
  spiculatedMargin?: boolean
  solidComponent?: boolean
  location?: string
}

class RadsBreastDto {
  massSizeMm?: number
  massShape?: string
  massMargin?: string
  calcificationType?: string
  calcificationDistribution?: string
  biradsCategory?: string
}

class RadsProstateDto {
  lesionZone?: 'PZ' | 'TZ' | 'AFS'
  lesionSizeMm?: number
  dwiSignal?: 'low' | 'mild' | 'high'
  adcValue?: number
  t2Signal?: 'low' | 'mild' | 'high'
}

class RadsLiverDto {
  sizeMm?: number
  observationType?: 'nodule' | 'nonnodular' | 'cystic'
  arterialPhaseEnhancement?: 'nonrim' | 'rim' | 'nodule-in-nodule' | 'corona' | 'none'
  washout?: 'yes' | 'no'
  enhancingCapsule?: 'yes' | 'no'
  thresholdGrowth?: 'yes' | 'no'
  tumorInVein?: 'yes' | 'no'
}

class RadsThyroidDto {
  composition?: 'cystic' | 'spongiform' | 'mixed' | 'solid'
  echogenicity?: 'anechoic' | 'hyper' | 'iso' | 'hypo'
  shape?: 'wider-than-tall' | 'taller-than-wide'
  margins?: 'smooth' | 'ill-defined' | 'lobulated' | 'irregular' | 'extrathyroidal'
  echogenicFoci?: 'none' | 'comet' | 'macrocalc' | 'rim' | 'punctate'
}

// v3.0.6.11-99 G-20: 统一评分端点 {type, findings} → 确定性评分
const ScoreSchema = z.object({
  type: z.enum(['lung', 'breast', 'prostate', 'liver', 'thyroid']),
  findings: z.record(z.unknown()).optional(),
})

class RadsScoreDto {
  type!: 'lung' | 'breast' | 'prostate' | 'liver' | 'thyroid'
  findings?: Record<string, unknown>
}

@ApiTags('ai/cad/rads')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('ai/cad/rads')
export class CadRadsController {
  constructor(private readonly service: CadRadsService) {}

  // [v3.0.6.11-99 G-20] 评分规则表 (criteria/level 映射)
  @Get('rules')
  getRules() {
    return this.service.getRules()
  }

  // [v3.0.6.11-99 G-20] 统一确定性评分: {type, findings} → level + description
  @Post('score')
  score(@Body(new ZodValidationPipe(ScoreSchema)) dto: RadsScoreDto) {
    return this.service.score(dto.type, dto.findings ?? {})
  }

  // [v3.0.6.11-99 G-20] 评分统计
  @Get('stats')
  getStats() {
    return this.service.getStats()
  }

  @Post('lung')
  scoreLung(@Body(new ZodValidationPipe(LungSchema)) dto: RadsLungDto) {
    return this.service.scoreLung(dto as Record<string, any>)
  }

  @Post('breast')
  scoreBreast(@Body(new ZodValidationPipe(BreastSchema)) dto: RadsBreastDto) {
    return this.service.scoreBreast(dto as Record<string, any>)
  }

  @Post('prostate')
  scoreProstate(@Body(new ZodValidationPipe(ProstateSchema)) dto: RadsProstateDto) {
    return this.service.scoreProstate(dto as Record<string, any>)
  }

  // v3.0.6.11-60: PI-RADS (前列腺) 兼容别名
  @Post('pi-rads')
  scorePiRads(@Body(new ZodValidationPipe(ProstateSchema)) dto: RadsProstateDto) {
    return this.service.scoreProstate(dto as Record<string, any>)
  }

  // v3.0.6.11-60: LI-RADS (肝脏)
  @Post('li-rads')
  scoreLiRads(@Body(new ZodValidationPipe(LiverSchema)) dto: RadsLiverDto) {
    return this.service.scoreLiver(dto as Record<string, any>)
  }

  // v3.0.6.11-60: TI-RADS (甲状腺)
  @Post('ti-rads')
  scoreTiRads(@Body(new ZodValidationPipe(ThyroidSchema)) dto: RadsThyroidDto) {
    return this.service.scoreThyroid(dto as Record<string, any>)
  }

  @Get('history/:patientId')
  getHistory(@Param('patientId') patientId: string) {
    return this.service.getHistory(patientId)
  }
}
