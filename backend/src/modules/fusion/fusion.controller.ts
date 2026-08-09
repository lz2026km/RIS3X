import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { FusionService } from './fusion.service'

const num = (key: string, fallback: number): number => {
  const raw = process.env[key]
  const n = raw === undefined ? NaN : Number(raw)
  return Number.isFinite(n) ? n : fallback
}

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
  windowWidth: z.number().positive().default(num('DICOM_WINDOW_WIDTH_LUNG', 1200)),
  windowLevel: z.number().default(num('DICOM_WINDOW_LEVEL_LUNG', -600)),
  fusionWindowWidth: z.number().positive().default(num('DICOM_WINDOW_WIDTH_MEDIASTINAL', 400)),
  fusionWindowLevel: z.number().default(num('DICOM_WINDOW_LEVEL_MEDIASTINAL', 40)),
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

  // [G005 Wave1B P1] fusionApi 3 端点: list / registration/:id / DELETE :id
  @Get()
  @ApiOperation({ summary: '融合记录列表 (内存注册记录 + FusionJob 派生)' })
  list(@Query('patientId') patientId?: string, @Query('status') status?: string) {
    return this.svc.list({ patientId, status })
  }

  @Get('registration/:id')
  @ApiOperation({ summary: '融合注册记录详情' })
  getRegistration(@Param('id') id: string) {
    return this.svc.getRegistration(id)
  }

  // [G005 Wave4A G-06] SUV 定量: Exam(PET) 派生 + 确定性 seed
  @Get('suv/:studyId')
  @ApiOperation({ summary: 'PET-CT SUV 定量 (SUVmax/SUVmean/SUVpeak + 病灶, Exam(PET) 派生)' })
  getSuv(@Param('studyId') studyId: string) {
    return this.svc.getSuv(studyId)
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除融合注册记录' })
  delete(@Param('id') id: string) {
    return this.svc.delete(id)
  }
}
