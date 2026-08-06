import { Controller, Get, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger'
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
}
