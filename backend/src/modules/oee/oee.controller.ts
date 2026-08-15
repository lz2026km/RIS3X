import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { OeeService } from './oee.service'

@ApiTags('oee')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'TECHNICIAN')
@Controller('oee')
export class OeeController {
  constructor(private readonly service: OeeService) {}

  @Get('list')
  list() { return this.service.getList() }

  @Get('detail/:deviceId')
  detail(@Param('deviceId') deviceId: string) { return this.service.getDetail(deviceId) }

  @Get('trend/:deviceId')
  trend(@Param('deviceId') deviceId: string) { return this.service.getTrend(deviceId) }

  @Get('stats')
  stats() { return this.service.getStats() }

  // ================= [W10E-3] 扩展端点 (OEE 总览 / 模态对比 / 30日趋势 / 停机分析) =================

  @Get('overview')
  overview() { return this.service.getOverview() }

  @Get('by-modality')
  byModality() { return this.service.getByModality() }

  @Get('daily-trend')
  dailyTrend(@Query('days') days?: string) {
    const parsed = Number(days)
    return this.service.getDailyTrend(Number.isFinite(parsed) && parsed > 0 ? parsed : 30)
  }

  @Get(':id/downtime-analysis')
  downtimeAnalysis(@Param('id') id: string) { return this.service.getDowntimeAnalysis(id) }
}
