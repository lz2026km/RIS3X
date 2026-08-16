/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 4A (tech-v2) - 技师工作站 V2 控制器
 *
 * 端点 (全部 200, 孤儿模块可无 DB 启动):
 *   - GET  /tech-v2/meta                        技师名册 + 检查室
 *   - GET  /tech-v2/rotation/rules              轮转规则 (班次 × 技能矩阵 × 工作量均衡)
 *   - POST /tech-v2/rotation/generate           轮转计划生成 (确定性贪心)
 *   - GET  /tech-v2/rotation/plan               当前/指定范围轮转计划
 *   - GET  /tech-v2/rotation/history            轮转历史 (计划 + 执行记录)
 *   - POST /tech-v2/rotation/assignments/:id/execute  轮转执行记录
 *   - GET  /tech-v2/forecast                    未来 N 天工作量预测 (每日/每时段 + 置信区间)
 *   - GET  /tech-v2/forecast/technician/:technicianId 技师级别预测
 *   - GET  /tech-v2/workload/balance            技师累计工作量均衡指标
 */
import { BadRequestException, Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { TechV2Service } from './tech-v2.service'

const GenerateSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate 格式应为 YYYY-MM-DD'),
  days: z.number().int().min(1).max(14).optional(),
  balanceWeight: z.number().min(0).max(1).optional(),
})

const ExecuteSchema = z
  .object({
    note: z.string().max(200).optional(),
  })
  .optional()
  .default({})

@ApiTags('tech-v2')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('tech-v2')
export class TechV2Controller {
  constructor(private readonly service: TechV2Service) {}

  @Get('meta')
  meta() {
    return { success: true, data: { technicians: this.service.getTechnicians(), rooms: this.service.getRooms() } }
  }

  // ==================== 轮转规则 ====================

  @Get('rotation/rules')
  rotationRules() {
    return { success: true, data: this.service.getRotationRules() }
  }

  // ==================== 轮转计划生成 (确定性) ====================

  @Post('rotation/generate')
  @HttpCode(200)
  generate(@Body(new ZodValidationPipe(GenerateSchema)) body: z.infer<typeof GenerateSchema>) {
    return { success: true, data: this.service.generatePlan(body) }
  }

  // ==================== 轮转计划查询 ====================

  @Get('rotation/plan')
  rotationPlan(@Query('startDate') startDate?: string, @Query('days') days?: string) {
    return { success: true, data: this.service.getRotationPlan({ startDate, days }) }
  }

  @Get('rotation/history')
  rotationHistory() {
    return { success: true, data: this.service.getRotationHistory() }
  }

  // ==================== 轮转执行记录 ====================

  @Post('rotation/assignments/:id/execute')
  @HttpCode(200)
  executeAssignment(@Param('id') id: string, @Body(new ZodValidationPipe(ExecuteSchema)) body?: { note?: string }) {
    return { success: true, data: this.service.executeAssignment(id, body ?? {}) }
  }

  // ==================== 工作量预测 ====================

  @Get('forecast')
  forecast(
    @Query('startDate') startDate?: string,
    @Query('days') days?: string,
    @Query('technicianId') technicianId?: string,
  ) {
    const daysNum = days !== undefined && days !== '' ? Number(days) : undefined
    if (daysNum !== undefined && (!Number.isFinite(daysNum) || daysNum < 1 || daysNum > 30)) {
      throw new BadRequestException('days 应为 1-30')
    }
    return { success: true, data: this.service.forecast({ startDate, days: daysNum, technicianId }) }
  }

  @Get('forecast/technician/:technicianId')
  technicianForecast(
    @Param('technicianId') technicianId: string,
    @Query('startDate') startDate?: string,
    @Query('days') days?: string,
  ) {
    const daysNum = days !== undefined && days !== '' ? Number(days) : undefined
    if (daysNum !== undefined && (!Number.isFinite(daysNum) || daysNum < 1 || daysNum > 30)) {
      throw new BadRequestException('days 应为 1-30')
    }
    const forecast = this.service.forecast({ startDate, days: daysNum, technicianId })
    return {
      success: true,
      data: {
        technicianId,
        startDate: forecast.startDate,
        days: forecast.days,
        daily: forecast.daily.map((d) => ({ date: d.date, weekday: d.weekday, label: d.label, technicianValue: d.value })),
        byDate: forecast.perTechnician.filter((t) => t.technicianId === technicianId),
      },
    }
  }

  // ==================== 工作量均衡指标 ====================

  @Get('workload/balance')
  workloadBalance() {
    return { success: true, data: this.service.getWorkloadBalance() }
  }
}
