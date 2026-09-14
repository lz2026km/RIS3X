/**
 * G005 放射RIS系统 v3.0.6.11-104 Wave 3B - 对比剂安全闭环控制器
 * 端点 (全部 200, 孤儿模块可无 DB 启动, 内存 overlay + seed 回退):
 *   - POST /contrast/allergy-test                    记录过敏试验
 *   - GET  /contrast/allergy-test/:patientId         患者过敏试验历史
 *   - POST /contrast/pre-injection-check             注射前核查 → { passed, blockers }
 *   - POST /contrast/injection                       增强注射 (前置核查门禁, 未通过 400 PRE_INJECTION_CHECK_FAILED)
 *   - POST /contrast/observation/start               开始注射后留观 (默认 30 分钟)
 *   - GET  /contrast/observation                     留观列表 (可按患者过滤)
 *   - GET  /contrast/observation/:id                 留观状态 (剩余时间 + 观察记录)
 *   - POST /contrast/observation/:id/record          追加观察记录
 *   - POST /contrast/observation/:id/discharge       留观结束离院确认 (需满时长或医生放行)
 *
 * [v3.0.6.11-105 Wave 1B] 对比剂外渗事件 (extravasation):
 *   - POST /contrast/extravasation                   记录外渗事件 (严重度/部位/外渗量/处置措施)
 *   - GET  /contrast/extravasation                   外渗列表 (患者/日期/严重度筛选, 分页)
 *   - GET  /contrast/extravasation/stats             外渗统计 (发生率‰ = 外渗例数/同期增强CT例数×1000)
 *   - POST /contrast/extravasation/:id/handle        处置闭环 (处置措施/随访/状态 resolved)
 */
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ContrastSafetyService } from './contrast-safety.service'
import {
  ContrastInjectionSchema,
  HandleExtravasationSchema,
  ListExtravasationSchema,
  ObservationDischargeSchema,
  ObservationRecordSchema,
  ObservationStartSchema,
  PreInjectionCheckSchema,
  RecordAllergyTestSchema,
  RecordExtravasationSchema,
} from './contrast-safety.schema'

@ApiTags('contrast-safety')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('contrast')
export class ContrastSafetyController {
  constructor(private readonly svc: ContrastSafetyService) {}

  @Post('allergy-test')
  @HttpCode(200)
  recordAllergyTest(@Body(new ZodValidationPipe(RecordAllergyTestSchema)) body: z.infer<typeof RecordAllergyTestSchema>) {
    return this.svc.recordAllergyTest(body)
  }

  @Get('allergy-test/:patientId')
  listAllergyTests(@Param('patientId') patientId: string) {
    return this.svc.listAllergyTests(patientId)
  }

  @Post('pre-injection-check')
  @HttpCode(200)
  preInjectionCheck(@Body(new ZodValidationPipe(PreInjectionCheckSchema)) body: z.infer<typeof PreInjectionCheckSchema>) {
    return this.svc.preInjectionCheck(body)
  }

  @Post('injection')
  @HttpCode(200)
  inject(@Body(new ZodValidationPipe(ContrastInjectionSchema)) body: z.infer<typeof ContrastInjectionSchema>) {
    return this.svc.runInjection(body)
  }

  @Post('observation/start')
  @HttpCode(200)
  startObservation(@Body(new ZodValidationPipe(ObservationStartSchema)) body: z.infer<typeof ObservationStartSchema>) {
    return this.svc.startObservation(body)
  }

  @Get('observation')
  listObservations(@Query('patientId') patientId?: string) {
    return this.svc.listObservations(patientId)
  }

  @Get('observation/:id')
  getObservation(@Param('id') id: string) {
    return this.svc.getObservation(id)
  }

  @Post('observation/:id/record')
  @HttpCode(200)
  addRecord(@Param('id') id: string, @Body(new ZodValidationPipe(ObservationRecordSchema)) body: z.infer<typeof ObservationRecordSchema>) {
    return this.svc.addObservationRecord(id, body)
  }

  @Post('observation/:id/discharge')
  @HttpCode(200)
  discharge(@Param('id') id: string, @Body(new ZodValidationPipe(ObservationDischargeSchema)) body?: z.infer<typeof ObservationDischargeSchema>) {
    return this.svc.dischargeObservation(id, body ?? {})
  }

  // ===== [v3.0.6.11-105 Wave 1B] 对比剂外渗事件 =====

  @Post('extravasation')
  @HttpCode(200)
  recordExtravasation(
    @Body(new ZodValidationPipe(RecordExtravasationSchema)) body: z.infer<typeof RecordExtravasationSchema>,
  ) {
    return this.svc.recordExtravasation(body)
  }

  @Get('extravasation/stats')
  extravasationStats() {
    return this.svc.extravasationStats()
  }

  @Get('extravasation')
  listExtravasations(@Query() query: Record<string, unknown>) {
    const parsed = ListExtravasationSchema.safeParse(query)
    return this.svc.listExtravasations(parsed.success ? parsed.data : {})
  }

  @Post('extravasation/:id/handle')
  @HttpCode(200)
  handleExtravasation(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(HandleExtravasationSchema)) body?: z.infer<typeof HandleExtravasationSchema>,
  ) {
    return this.svc.handleExtravasation(id, body ?? {})
  }
}
