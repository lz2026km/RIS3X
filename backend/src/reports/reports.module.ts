/**
 * G005 放射RIS系统 v3.0.1 - 报告模块
 * v3.0.1 新增(原 v3.0.0 缺此文件导致 AppModule 启动失败)
 * 简版:list / get / 14 态枚举对齐
 */
import { Module } from '@nestjs/common'
import { QueueModule } from '../queue/queue.module'
import { NotificationsModule } from '../notifications/notifications.module'
// [v3.0.6.11-100 Wave2C P3] 报告→随访自动触发: ReportsModule 依赖 FollowUpService (导出)
import { FollowUpModule } from '../modules/followup/followup.module'
// [v3.0.6.11-100 Wave 6A (D-4)] 报告→病灶追踪联动: GET /reports/:id/lesions 依赖 LesionTrackingService
import { LesionTrackingModule } from '../modules/lesion-tracking/lesion-tracking.module'
import { ReportsService } from './reports.service'
import { ReportsController } from './reports.controller'

@Module({
  imports: [QueueModule, NotificationsModule, FollowUpModule, LesionTrackingModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
