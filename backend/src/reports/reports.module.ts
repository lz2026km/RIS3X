/**
 * G005 放射RIS系统 v3.0.1 - 报告模块
 * v3.0.1 新增(原 v3.0.0 缺此文件导致 AppModule 启动失败)
 * 简版:list / get / 14 态枚举对齐
 */
import { Module } from '@nestjs/common'
import { QueueModule } from '../queue/queue.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { ReportsService } from './reports.service'
import { ReportsController } from './reports.controller'

@Module({
  imports: [QueueModule, NotificationsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
