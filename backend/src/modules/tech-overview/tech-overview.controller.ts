/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 5 (tech-overview) - 技师工作站 V2 收尾控制器
 * 端点 (全部 200, 孤儿模块可无 DB 启动, DB 不可用自动回退确定性种子):
 *   - GET /tech-overview/meta                           房间/技师/模态/时段元数据
 *   - GET /tech-overview/appointments/distribution      预约分布 (检查类型/时段/星期/设备分桶 + 时段×星期热力图)
 *   - GET /tech-overview/appointments/peaks             预约波峰分析 (高峰时段识别 + 峰值日)
 *   - GET /tech-overview/appointments/attendance        预约 vs 实到 (爽约率/到检率)
 *   - GET /tech-overview/dashboard/overview             值班概览 (在岗技师/房间状态/进行中检查/待处理紧急)
 *   - GET /tech-overview/dashboard/rooms                房间实时状态流 (状态 + 事件)
 */
import { Controller, Get, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { TechOverviewService } from './tech-overview.service'

@ApiTags('tech-overview')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('tech-overview')
export class TechOverviewController {
  constructor(private readonly service: TechOverviewService) {}

  @Get('meta')
  meta() {
    return { success: true, data: this.service.getMeta() }
  }

  // ================= 患者预约分布 =================

  @Get('appointments/distribution')
  distribution(@Query('startDate') startDate?: string, @Query('days') days?: string) {
    return { success: true, data: this.service.getAppointmentDistribution({ startDate, days }) }
  }

  @Get('appointments/peaks')
  peaks(@Query('startDate') startDate?: string, @Query('days') days?: string) {
    return { success: true, data: this.service.getAppointmentPeaks({ startDate, days }) }
  }

  @Get('appointments/attendance')
  attendance(@Query('startDate') startDate?: string, @Query('days') days?: string) {
    return { success: true, data: this.service.getAppointmentAttendance({ startDate, days }) }
  }

  // ================= 技师值班大屏 =================

  @Get('dashboard/overview')
  overview() {
    return { success: true, data: this.service.getDashboardOverview() }
  }

  @Get('dashboard/rooms')
  rooms() {
    return { success: true, data: this.service.getRoomStatusStream() }
  }
}
