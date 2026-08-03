import { Controller, Get, Query, DefaultValuePipe, ParseIntPipe } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { BiService } from './bi.service'

@ApiTags('bi')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'RADIOLOGIST', 'TECHNICIAN')
@Controller('bi')
export class BiController {
  constructor(private readonly service: BiService) {}

  @Get('kpi')
  @ApiOperation({ summary: '今日综合 KPI' })
  getKpi() {
    return this.service.getKpi()
  }

  @Get('report-timeliness')
  @ApiOperation({ summary: '报告时效分布' })
  getReportTimeliness() {
    return this.service.getReportTimeliness()
  }

  @Get('physician-rvu')
  @ApiOperation({ summary: '医生工作量 (报告数/RVU/平均时长)' })
  getPhysicianRvu() {
    return this.service.getPhysicianRvu()
  }

  @Get('device-oee')
  @ApiOperation({ summary: '设备 OEE 实时 (最近 N 天)' })
  getDeviceOee(@Query('days', new DefaultValuePipe(14), new ParseIntPipe({ optional: true })) days = 14) {
    return this.service.getDeviceOee(days)
  }

  @Get('critical-sla')
  @ApiOperation({ summary: '危急值 SLA (响应时长分布/达标率/超时清单)' })
  getCriticalSla() {
    return this.service.getCriticalSla()
  }

  @Get('trend')
  @ApiOperation({ summary: '核心指标趋势' })
  getTrend(@Query('days', new DefaultValuePipe(30), new ParseIntPipe({ optional: true })) days = 30) {
    return this.service.getTrend(days)
  }
}
