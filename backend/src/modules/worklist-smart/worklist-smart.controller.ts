import { Body, Controller, Get, Post, Put } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { WorklistSmartService, type SmartScoreInput, type SmartWeightConfig } from './worklist-smart.service'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'

const SmartScoreSchema = z.object({
  id: z.string().min(1),
  urgency: z.number().min(-3).max(3),
  waitingMinutes: z.number().nonnegative(),
  age: z.number().int().nonnegative().max(150).optional(),
  modality: z.string().optional(),
  bodyPart: z.string().optional(),
  patientType: z.string().optional(),
  priority: z.string().optional(),
  criticalFinding: z.boolean().optional(),
})
const ReorderSchema = z.object({ items: z.array(SmartScoreSchema) })
const WeightSchema = z.object({
  urgencyWeight: z.number().min(0).max(1).optional(),
  waitWeight: z.number().min(0).max(1).optional(),
  ageWeight: z.number().min(0).max(1).optional(),
  examTypeWeight: z.number().min(0).max(1).optional(),
})

@ApiTags('worklist-smart')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('worklist-smart')
export class WorklistSmartController {
  constructor(private readonly service: WorklistSmartService) {}

  @Post('score')
  score(@Body(new ZodValidationPipe(SmartScoreSchema)) body: SmartScoreInput) {
    return this.service.score(body)
  }

  @Post('reorder')
  reorder(@Body(new ZodValidationPipe(ReorderSchema)) body: { items: SmartScoreInput[] }) {
    return this.service.reorder(body.items ?? [])
  }

  @Get('weights')
  async getWeights(): Promise<SmartWeightConfig> {
    return this.service.getWeights()
  }

  @Get('priorities')
  priorities() {
    return this.service.getPriorities()
  }

  @Put('weights')
  @Roles('ADMIN')
  async setWeights(@Body(new ZodValidationPipe(WeightSchema)) body: Partial<SmartWeightConfig>): Promise<SmartWeightConfig> {
    return this.service.setWeights(body)
  }
}
