import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { FusionV2Service } from './fusion-v2.service'

const num = (key: string, fallback: number): number => {
  const raw = process.env[key]
  const n = raw === undefined ? NaN : Number(raw)
  return Number.isFinite(n) ? n : fallback
}

const RegisterSchema = z.object({
  fixedSeriesUid: z.string().min(1),
  movingSeriesUid: z.string().min(1),
  transformType: z.enum(['rigid', 'affine', 'deformable', 'nonlinear']).default('rigid'),
})

const RenderSchema = z.object({
  fixedSeriesUid: z.string().min(1),
  movingSeriesUid: z.string().min(1),
  plane: z.enum(['axial', 'coronal', 'sagittal']).default('axial'),
  sliceIndex: z.number().int().min(0),
  alpha: z.number().min(0).max(1).default(0.5),
  windowWidth: z.number().positive().default(num('DICOM_WINDOW_WIDTH_LUNG', 1200)),
  windowLevel: z.number().default(num('DICOM_WINDOW_LEVEL_LUNG', -600)),
  fusionWindowWidth: z.number().positive().default(num('DICOM_WINDOW_WIDTH_MEDIASTINAL', 400)),
  fusionWindowLevel: z.number().default(num('DICOM_WINDOW_LEVEL_MEDIASTINAL', 40)),
})

@ApiTags('fusion-v2')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('fusion-v2')
export class FusionV2Controller {
  constructor(private readonly svc: FusionV2Service) {}

  @Post('register')
  @ApiOperation({ summary: 'Multi-modal image registration (rigid/affine/deformable/nonlinear)' })
  register(@Body(new ZodValidationPipe(RegisterSchema)) dto: z.infer<typeof RegisterSchema>) {
    return this.svc.register(dto)
  }

  @Post('render')
  @ApiOperation({ summary: 'Render fusion frame with registration matrix' })
  render(@Body(new ZodValidationPipe(RenderSchema)) dto: z.infer<typeof RenderSchema>) {
    return this.svc.render(dto)
  }

  @Get('series/:patientId')
  @ApiOperation({ summary: 'Query multi-modal series for patient' })
  getSeries(@Param('patientId') patientId: string) {
    return this.svc.getSeries(patientId)
  }
}
