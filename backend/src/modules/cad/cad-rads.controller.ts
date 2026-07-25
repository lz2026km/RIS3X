import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { CadRadsService } from './cad-rads.service'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'

const LungSchema = z.object({ noduleSizeMm: z.number().nonnegative().optional(), spiculatedMargin: z.boolean().optional(), solidComponent: z.boolean().optional(), location: z.string().optional() })
const BreastSchema = z.object({ massSizeMm: z.number().nonnegative().optional(), massShape: z.string().optional(), massMargin: z.string().optional(), calcificationType: z.string().optional(), calcificationDistribution: z.string().optional(), biradsCategory: z.string().optional() })
const ProstateSchema = z.object({ lesionZone: z.enum(['PZ', 'TZ', 'AFS']).optional(), lesionSizeMm: z.number().nonnegative().optional(), dwiSignal: z.enum(['low', 'mild', 'high']).optional(), adcValue: z.number().nonnegative().optional(), t2Signal: z.enum(['low', 'mild', 'high']).optional() })

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

@ApiTags('ai/cad/rads')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('ai/cad/rads')
export class CadRadsController {
  constructor(private readonly service: CadRadsService) {}

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

  @Get('history/:patientId')
  getHistory(@Param('patientId') patientId: string) {
    return this.service.getHistory(patientId)
  }
}
