import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { RadiomicsService, type ExtractRequest, type CompareRequest } from './radiomics.service'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'

const RoiSchema = z.object({ instanceId: z.string().min(1), type: z.enum(['rectangle', 'ellipse', 'polygon']), coordinates: z.array(z.number()).min(4) })
const ExtractSchema = z.object({ instanceId: z.string().min(1), roi: RoiSchema })
const CompareSchema = z.object({ instanceIds: z.array(z.string().min(1)).min(1), rois: z.array(RoiSchema).min(1) }).refine((value) => value.instanceIds.length === value.rois.length, { message: 'instanceIds and rois must have equal lengths' })

@ApiTags('radiomics')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('radiomics')
export class RadiomicsController {
  constructor(private readonly service: RadiomicsService) {}

  @Post('extract')
  extract(@Body(new ZodValidationPipe(ExtractSchema)) body: ExtractRequest) {
    return this.service.extract(body)
  }

  @Get('features/:instanceId')
  getFeatures(@Param('instanceId') instanceId: string) {
    return this.service.getFeatures(instanceId)
  }

  @Post('compare')
  compare(@Body(new ZodValidationPipe(CompareSchema)) body: CompareRequest) {
    return this.service.compare(body)
  }
}
