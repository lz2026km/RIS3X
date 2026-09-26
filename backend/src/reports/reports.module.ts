/**
 * G005 放射RIS系统 v3.0.1 - 报告模块
 * v3.0.1 新增(原 v3.0.0 缺此文件导致 AppModule 启动失败)
 * 简版:list / get / 14 态枚举对齐
 * [G005 W8-Report] + 真实签名服务 / 内容版本快照 / 召回通知 / 分级审核规则
 */
import { Module } from '@nestjs/common'
import { QueueModule } from '../queue/queue.module'
import { NotificationsModule } from '../notifications/notifications.module'
// [v3.0.6.11-100 Wave2C P3] 报告→随访自动触发: ReportsModule 依赖 FollowUpService (导出)
import { FollowUpModule } from '../modules/followup/followup.module'
// [v3.0.6.11-100 Wave 6A (D-4)] 报告→病灶追踪联动: GET /reports/:id/lesions 依赖 LesionTrackingService
import { LesionTrackingModule } from '../modules/lesion-tracking/lesion-tracking.module'
// [G005 W8-Report] 真实签名 (ReportSigningService) + 分级审核 (ReviewTierService)
import { ReportSignV2Module } from '../modules/report-sign-v2/report-sign-v2.module'
import { ReportRulesModule } from '../modules/report-rules/report-rules.module'
import { ReportsService } from './reports.service'
import { ReportsController } from './reports.controller'
import { ReportRevisionContentStore } from './report-revision-content.store'
import { ReportRecallService } from './report-recall.service'

@Module({
  imports: [QueueModule, NotificationsModule, FollowUpModule, LesionTrackingModule, ReportSignV2Module, ReportRulesModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportRevisionContentStore, ReportRecallService],
  exports: [ReportsService, ReportRevisionContentStore, ReportRecallService],
})
export class ReportsModule {}
