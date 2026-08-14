import { Module } from '@nestjs/common'
import { OlapModule } from '../olap/olap.module'
import { StatsModule } from '../stats/stats.module'
import { BiModule } from '../bi/bi.module'
import { NotificationsModule } from '../../notifications/notifications.module'
import { CustomReportController } from './custom-report.controller'
import { CustomReportService } from './custom-report.service'

// [G005 v3.0.6.11-99 Wave 5A] 自定义报表模块
//   - 数据派生: olap (executeQuery) / stats (快照字段) / bi (快照字段)
//   - 联动: Wave 5B 通知模块 (schedule 保存后 → notifications/report-generated)
@Module({
  imports: [OlapModule, StatsModule, BiModule, NotificationsModule],
  controllers: [CustomReportController],
  providers: [CustomReportService],
  exports: [CustomReportService],
})
export class CustomReportModule {}
