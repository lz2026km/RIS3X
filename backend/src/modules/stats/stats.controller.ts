import { Controller, Get, Query, Res } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger'
import { Response } from 'express'
import {
  StatsService,
  StatsDashboardData,
  DailyStatsData,
  WeeklyStatsData,
  WorkloadRow,
  QualityData,
  ModalityStats,
  TrendPoint,
  StatsEnvelope,
  TopDeviceRow,
  TopModalityRow,
} from './stats.service'

// stats 端点真实化 (v3.0.6.11-73 P1): 从 Prisma 真实聚合 + 确定性 seed 回退
// 所有端点对已认证角色开放 — HomePage(全角色)/CommandCenter/GreenIT 均消费
@ApiTags('stats')
@ApiBearerAuth()
@Roles('DOCTOR', 'TECHNICIAN', 'NURSE', 'ADMIN', 'DIRECTOR')
@Controller('stats')
export class StatsController {
  constructor(private readonly service: StatsService) {}

  @Get('daily')
  getDaily(): Promise<StatsEnvelope<DailyStatsData>> {
    return this.service.getDaily()
  }

  @Get('weekly')
  getWeekly(): Promise<StatsEnvelope<WeeklyStatsData>> {
    return this.service.getWeekly()
  }

  @Get('workload')
  getWorkload(): Promise<StatsEnvelope<WorkloadRow[]>> {
    return this.service.getWorkload()
  }

  @Get('quality')
  getQuality(): Promise<StatsEnvelope<QualityData>> {
    return this.service.getQuality()
  }

  @Get('by-modality')
  getByModality(): Promise<StatsEnvelope<Record<string, ModalityStats>>> {
    return this.service.getByModality()
  }

  @Get('trend')
  @ApiQuery({ name: 'days', required: false, description: '趋势天数, 默认 30, 范围 1-90' })
  getTrend(@Query('days') days?: string): Promise<StatsEnvelope<TrendPoint[]>> {
    return this.service.getTrend(Number(days))
  }

  @Get('dashboard')
  getDashboard(): Promise<StatsEnvelope<StatsDashboardData>> {
    return this.service.getDashboardData()
  }

  // [G005 Wave1A P0] Top N 设备 (StatsReportPage / EquipmentEfficiencyPage 在用)
  @Get('top-devices')
  @ApiQuery({ name: 'limit', required: false, description: '返回条数, 默认 10, 范围 1-50' })
  getTopDevices(@Query('limit') limit?: string): Promise<TopDeviceRow[]> {
    return this.service.getTopDevices(Number(limit))
  }

  // [G005 Wave1A P0] Top N 模态
  @Get('top-modalities')
  @ApiQuery({ name: 'limit', required: false, description: '返回条数, 默认 10, 范围 1-50' })
  getTopModalities(@Query('limit') limit?: string): Promise<TopModalityRow[]> {
    return this.service.getTopModalities(Number(limit))
  }

  // [G005 Wave1A P0] CSV 导出 (复用 daily/trend 数据, text/csv 流式下载)
  @Get('export.csv')
  async exportCsv(@Res() res: Response) {
    const csv = await this.service.exportCsv()
    res.setHeader('Content-Type', 'text/csv; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="stats-daily-${new Date().toISOString().slice(0, 10)}.csv"`)
    res.send(csv)
  }
}
