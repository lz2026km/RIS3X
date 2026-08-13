// [G005 Wave1A P0] 眼科亚专科 controller — /eye/subspecialty/* + /eye/low-vision/*
// 形状与 MSW eyeHandlers.ts eyeSubspecialtyDepthModule 对齐 (success/data)
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { EyeSubspecialtyService } from './eye-subspecialty.service'
import { z } from 'zod'

const LooseBodySchema = z.object({}).passthrough()

@ApiTags('eye-subspecialty')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('eye/subspecialty')
export class EyeSubspecialtyController {
  constructor(private readonly svc: EyeSubspecialtyService) {}

  // ── 记录 CRUD (按亚专科) ──
  @Get(':sub/records')
  @ApiOperation({ summary: '亚专科检查记录列表 (Exam 派生 + seed)' })
  listRecords(@Param('sub') sub: string, @Query('patientId') patientId?: string) {
    return this.svc.listRecords(sub, { patientId })
  }

  @Post(':sub/records')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: '创建亚专科检查记录 (内存)' })
  createRecord(@Param('sub') sub: string, @Body(new ZodValidationPipe(LooseBodySchema)) body: any) {
    return this.svc.createRecord(sub, body)
  }

  @Get('refractive/prescription')
  @ApiOperation({ summary: '屈光手术处方 (最近记录)' })
  getRefractivePrescription() {
    return this.svc.refractivePrescription({})
  }

  @Post('refractive/prescription')
  @ApiOperation({ summary: '开具屈光手术处方' })
  refractivePrescription(@Body(new ZodValidationPipe(LooseBodySchema)) body: any) {
    return this.svc.refractivePrescription(body)
  }

  // ── 页面动作端点 (SubspecialtyExamsPage 直调) ──
  @Post('strabismus/synoptophore')
  synoptophore(@Body(new ZodValidationPipe(LooseBodySchema)) body: any) {
    return this.svc.synoptophore(body)
  }

  @Post('neuro/color-vision')
  colorVision(@Body(new ZodValidationPipe(LooseBodySchema)) body: any) {
    return this.svc.colorVision(body)
  }

  @Post('neuro/pvep')
  pvep(@Body(new ZodValidationPipe(LooseBodySchema)) body: any) {
    return this.svc.pvep(body)
  }

  @Post('oncology/exophthalmometry')
  exophthalmometry(@Body(new ZodValidationPipe(LooseBodySchema)) body: any) {
    return this.svc.exophthalmometry(body)
  }

  @Post('cornea/pentacam')
  pentacam(@Body(new ZodValidationPipe(LooseBodySchema)) body: any) {
    return this.svc.pentacam(body)
  }

  @Post('cataract/lens-opacity')
  lensOpacity(@Body(new ZodValidationPipe(LooseBodySchema)) body: any) {
    return this.svc.lensOpacity(body)
  }

  // 兼容旧路径: GET /eye/subspecialty/:sub (列表)
  @Get(':sub')
  @ApiOperation({ summary: '亚专科检查记录列表 (旧路径)' })
  listBySub(@Param('sub') sub: string, @Query('patientId') patientId?: string) {
    return this.svc.listRecords(sub, { patientId })
  }
}

@ApiTags('eye-low-vision')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('eye/low-vision')
export class EyeLowVisionController {
  constructor(private readonly svc: EyeSubspecialtyService) {}

  @Get('prescription')
  @ApiOperation({ summary: '低视力处方 (最近记录)' })
  getPrescription() {
    return this.svc.lowVisionPrescription({})
  }

  @Post('prescription')
  @ApiOperation({ summary: '开具低视力助视器处方' })
  prescription(@Body(new ZodValidationPipe(LooseBodySchema)) body: any) {
    return this.svc.lowVisionPrescription(body)
  }
}
