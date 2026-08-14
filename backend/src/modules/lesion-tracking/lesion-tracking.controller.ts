// [v3.0.6.11-99 Wave 4A] 病灶追踪 (Lesion Tracking) — 登记/测量/趋势/对比/统计/随访联动
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { z } from 'zod'
import { LesionTrackingService, type LesionType, type ResponseClass } from './lesion-tracking.service'

const LESION_TYPES = ['肺结节', '肝占位', '淋巴结', '其他'] as const
const RESPONSES = ['CR', 'PR', 'SD', 'PD', 'NE'] as const

const CreateLesionSchema = z.object({
  patientId: z.string().min(1),
  name: z.string().min(1),
  site: z.string().min(1),
  type: z.enum(LESION_TYPES).optional(),
  initialSizeMm: z.number().nonnegative().optional(),
  modality: z.string().optional(),
  studyId: z.string().optional(),
})

const UpdateLesionSchema = z.object({
  name: z.string().min(1).optional(),
  site: z.string().min(1).optional(),
  type: z.enum(LESION_TYPES).optional(),
  modality: z.string().optional(),
})

const CreateMeasurementSchema = z.object({
  studyId: z.string().min(1),
  sizeMm: z.number().nonnegative(),
  date: z.string().min(1),
  response: z.enum(RESPONSES).optional(),
  notes: z.string().optional(),
})

const CompareSchema = z.object({
  studyIdA: z.string().min(1),
  studyIdB: z.string().min(1),
})

const FollowupSchema = z.object({
  followupId: z.string().min(1),
})

@ApiTags('lesion-tracking')
@ApiBearerAuth()
@Roles('DOCTOR', 'DIRECTOR', 'ADMIN', 'TECHNICIAN', 'NURSE')
@Controller('lesion-tracking')
export class LesionTrackingController {
  constructor(private readonly svc: LesionTrackingService) {}

  // ⚠️ 静态子路由 (stats) 必须先于 :id, 避免被 :id 通配拦截
  @Get('stats')
  @ApiOperation({ summary: '病灶统计 (总数/新发/进展/稳定/消失)' })
  stats(@Query('patientId') patientId: string) {
    return this.svc.stats(patientId ?? '')
  }

  @Get('lesions')
  @ApiOperation({ summary: '病灶列表 (patientId → 病灶 + 历次测量)' })
  list(@Query('patientId') patientId: string) {
    return this.svc.list(patientId ?? '')
  }

  @Post('lesions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '新建病灶 (含初始尺寸测量)' })
  create(@Body(new ZodValidationPipe(CreateLesionSchema)) body: z.infer<typeof CreateLesionSchema>) {
    return this.svc.create(body)
  }

  @Get('lesions/:id')
  @ApiOperation({ summary: '病灶详情 (基本信息 + 测量序列)' })
  get(@Param('id') id: string) {
    return this.svc.get(id)
  }

  @Patch('lesions/:id')
  @ApiOperation({ summary: '编辑病灶' })
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateLesionSchema)) body: z.infer<typeof UpdateLesionSchema>) {
    return this.svc.update(id, body)
  }

  @Delete('lesions/:id')
  @ApiOperation({ summary: '删除病灶' })
  remove(@Param('id') id: string) {
    return this.svc.remove(id)
  }

  @Post('lesions/:id/measurements')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '新增测量 (sizeMm/date/response)' })
  addMeasurement(@Param('id') id: string, @Body(new ZodValidationPipe(CreateMeasurementSchema)) body: z.infer<typeof CreateMeasurementSchema>) {
    return this.svc.addMeasurement(id, body)
  }

  @Get('lesions/:id/measurements')
  @ApiOperation({ summary: '测量序列' })
  measurements(@Param('id') id: string) {
    return this.svc.listMeasurements(id)
  }

  @Get('lesions/:id/trend')
  @ApiOperation({ summary: '趋势数据 (按日期尺寸序列)' })
  trend(@Param('id') id: string) {
    return this.svc.trend(id)
  }

  @Post('lesions/:id/compare')
  @ApiOperation({ summary: '跨期对比 (RECIST-like CR/PR/SD/PD)' })
  compare(@Param('id') id: string, @Body(new ZodValidationPipe(CompareSchema)) body: z.infer<typeof CompareSchema>) {
    return this.svc.compare(id, body)
  }

  @Post('lesions/:id/followup')
  @ApiOperation({ summary: '关联随访计划 (Wave 3B 联动)' })
  linkFollowup(@Param('id') id: string, @Body(new ZodValidationPipe(FollowupSchema)) body: z.infer<typeof FollowupSchema>) {
    return this.svc.linkFollowup(id, body)
  }
}

export type { LesionType, ResponseClass }
