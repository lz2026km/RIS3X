// [G005 Wave1A 17] 视光中心闭环 controller — /eye/optometry/*
// 形状与 MSW eyeHandlers eyeOptometryClosedLoopModule 对齐 (success/data/meta)
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { EyeOptometryService } from './eye-optometry.service'
import { z } from 'zod'

const ScreeningSchema = z.object({
  patientId: z.string().optional(),
  age: z.number().optional(),
  parentRefraction: z.object({ reSphere: z.number().optional(), leSphere: z.number().optional() }).optional(),
}).passthrough()

const OkTrialSchema = z.object({
  patientId: z.string().optional(),
  trialLensId: z.string().optional(),
  fluoresceinPattern: z.string().optional(),
}).passthrough()

const OrthoKOrderSchema = z.object({
  patientId: z.string().optional(),
  patientName: z.string().optional(),
  design: z.record(z.any()).optional(),
  prescriptionId: z.string().optional(),
}).passthrough()

const DefocusOrderSchema = z.object({
  patientId: z.string().optional(),
  patientName: z.string().optional(),
  frameSelection: z.string().optional(),
  lensType: z.string().optional(),
}).passthrough()

const LooseBodySchema = z.object({}).passthrough()

@ApiTags('eye-optometry')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('eye/optometry')
export class EyeOptometryController {
  constructor(private readonly svc: EyeOptometryService) {}

  @Get('stats')
  @ApiOperation({ summary: '近视防控统计 (筛查/OK镜/离焦镜数量)' })
  stats() {
    return this.svc.stats()
  }

  @Post('screening')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '近视筛查记录 (确定性风险规则)' })
  screening(@Body(new ZodValidationPipe(ScreeningSchema)) body: z.infer<typeof ScreeningSchema>) {
    return this.svc.screening(body)
  }

  @Get('refraction-curve/:patientId')
  @ApiOperation({ summary: '屈光发育曲线 (历史屈光度序列)' })
  refractionCurve(@Param('patientId') patientId: string) {
    return this.svc.refractionCurve(patientId)
  }

  @Post('ok-trial')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'OK 镜试戴评估' })
  okTrial(@Body(new ZodValidationPipe(OkTrialSchema)) body: z.infer<typeof OkTrialSchema>) {
    return this.svc.okTrial(body)
  }

  @Post('ortho-k-order')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'OK 镜订单' })
  orthoKOrder(@Body(new ZodValidationPipe(OrthoKOrderSchema)) body: z.infer<typeof OrthoKOrderSchema>) {
    return this.svc.orthoKOrder(body)
  }

  @Post('defocus-order')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '离焦镜订单' })
  defocusOrder(@Body(new ZodValidationPipe(DefocusOrderSchema)) body: z.infer<typeof DefocusOrderSchema>) {
    return this.svc.defocusOrder(body)
  }

  // ── 屈光检查记录 (与 vision-records 兼容) ──

  @Get('refraction')
  @ApiOperation({ summary: '屈光检查记录列表' })
  listRefraction(@Query('patientId') patientId?: string) {
    return this.svc.listRefraction({ patientId })
  }

  @Post('refraction')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建屈光检查记录 (验光处方)' })
  createRefraction(@Body(new ZodValidationPipe(LooseBodySchema)) body: Record<string, unknown>) {
    return this.svc.createRefraction(body)
  }

  // ── OK 镜档案 ──

  @Get('ok-lens')
  @ApiOperation({ summary: 'OK 镜档案列表' })
  listOkLens(@Query('patientId') patientId?: string) {
    return this.svc.listOkLens({ patientId })
  }

  @Post('ok-lens')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建 OK 镜档案 (设计)' })
  createOkLens(@Body(new ZodValidationPipe(LooseBodySchema)) body: Record<string, unknown>) {
    return this.svc.createOkLens(body)
  }

  // ── 视力记录序列 ──

  @Get('vision-record/:patientId')
  @ApiOperation({ summary: '视力记录序列 (历史)' })
  visionRecord(@Param('patientId') patientId: string) {
    return this.svc.visionRecord(patientId)
  }

  @Get('orders/:id')
  @ApiOperation({ summary: '视光订单详情' })
  getOrder(@Param('id') id: string) {
    return this.svc.getOrder(id)
  }
}
