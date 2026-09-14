/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 1A - 放射影像专业医疗质量控制指标 (2024 年版) 控制器
 * 端点 (孤儿模块可无 DB 启动, seed 回退):
 *   - GET  /rqi-2024/indicators?period=&dateFrom=&dateTo=  7 指标当期汇总 (分子/分母/比率/目标/达标)
 *   - GET  /rqi-2024/detail/:code                          单指标分子/分母明细清单 (可下钻)
 *   - GET  /rqi-2024/trend?code=&months=12                 指标月度趋势
 *   - GET  /rqi-2024/dashboard                             总览 (7 指标 + 达标数/率 + 环比)
 *   - GET  /rqi-2024/config                                目标值/阈值配置
 *   - PUT  /rqi-2024/config                                目标值/阈值配置更新 (zod 校验)
 *   - POST /rqi-2024/export                                导出 (CSV/JSON)
 */
import { Body, Controller, Get, HttpCode, Param, Post, Put, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { Roles } from '../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { INDICATOR_CODES, type IndicatorCode } from './rqi-2024.types'
import { Rqi2024Service, type RqiWindowQuery } from './rqi-2024.service'

const IndicatorCodeSchema = z.enum([...INDICATOR_CODES] as [IndicatorCode, ...IndicatorCode[]])

const UpdateConfigSchema = z.object({
  items: z
    .array(
      z.object({
        code: IndicatorCodeSchema,
        target: z.number().min(0),
        warnMargin: z.number().min(0).optional(),
        direction: z.enum(['higher', 'lower']).optional(),
      }),
    )
    .min(1),
})

const ExportSchema = z.object({
  format: z.enum(['csv', 'json']),
  period: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

@ApiTags('rqi-2024')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('rqi-2024')
export class Rqi2024Controller {
  constructor(private readonly service: Rqi2024Service) {}

  @Get('indicators')
  async getIndicators(@Query('period') period?: string, @Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string) {
    const query: RqiWindowQuery = { period, dateFrom, dateTo }
    return { success: true, data: await this.service.getIndicators(query) }
  }

  @Get('detail/:code')
  async getDetail(@Param('code') code: string, @Query('period') period?: string, @Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string) {
    const query: RqiWindowQuery = { period, dateFrom, dateTo }
    return { success: true, data: await this.service.getDetail(code, query) }
  }

  @Get('trend')
  async getTrend(@Query('code') code?: string, @Query('months') months?: string) {
    const parsed = Number(months)
    return { success: true, data: await this.service.getTrend(code ?? '', Number.isFinite(parsed) ? parsed : 12) }
  }

  @Get('dashboard')
  async getDashboard(@Query('period') period?: string, @Query('dateFrom') dateFrom?: string, @Query('dateTo') dateTo?: string) {
    const query: RqiWindowQuery = { period, dateFrom, dateTo }
    return { success: true, data: await this.service.getDashboard(query) }
  }

  @Get('config')
  getConfig() {
    return { success: true, data: this.service.getConfig() }
  }

  @Put('config')
  updateConfig(@Body(new ZodValidationPipe(UpdateConfigSchema)) body: z.infer<typeof UpdateConfigSchema>) {
    return { success: true, data: this.service.updateConfig(body.items) }
  }

  @Post('export')
  @HttpCode(200)
  async export(@Body(new ZodValidationPipe(ExportSchema)) body: z.infer<typeof ExportSchema>) {
    return { success: true, data: await this.service.export(body) }
  }
}
