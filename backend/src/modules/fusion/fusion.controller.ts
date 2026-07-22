import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { FusionService } from './fusion.service'

const RegisterSchema = z.object({
  fixedSeriesUid: z.string().min(1),
  movingSeriesUid: z.string().min(1),
  transformType: z.enum(['rigid', 'affine', 'deformable']).default('rigid'),
})

const RenderSchema = z.object({
  fixedSeriesUid: z.string().min(1),
  movingSeriesUid: z.string().min(1),
  plane: z.enum(['axial', 'coronal', 'sagittal']).default('axial'),
  sliceIndex: z.number().int().min(0),
  alpha: z.number().min(0).max(1).default(0.5),
  windowWidth: z.number().positive().default(1200),
  windowLevel: z.number().default(400),
  fusionWindowWidth: z.number().positive().default(800),
  fusionWindowLevel: z.number().default(200),
})

@ApiTags('fusion')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('fusion')
export class FusionController {
  constructor(private readonly svc: FusionService) {}

  @Post('register')
  @ApiOperation({ summary: 'Multi-modal image registration' })
  register(@Body(new ZodValidationPipe(RegisterSchema)) dto: z.infer<typeof RegisterSchema>) {
    return this.svc.register(dto)
  }

  @Post('render')
  @ApiOperation({ summary: 'Render fusion frame' })
  render(@Body(new ZodValidationPipe(RenderSchema)) dto: z.infer<typeof RenderSchema>) {
    return this.svc.render(dto)
  }

  @Get('series/:patientId')
  @ApiOperation({ summary: 'Query multi-modal series for a patient' })
  getSeries(@Param('patientId') patientId: string) {
    return this.svc.getSeries(patientId)
  }
}
