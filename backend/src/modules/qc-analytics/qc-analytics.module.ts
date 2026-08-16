/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 8B (qc-analytics) - 报告质控闭环与趋势分析模块
 * 孤儿模块: 无新增 DB 表, DB 不可用自动回退确定性种子, 可无 DB 启动
 */
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { QcAnalyticsController } from './qc-analytics.controller'
import { QcAnalyticsService } from './qc-analytics.service'

@Module({
  imports: [PrismaModule],
  controllers: [QcAnalyticsController],
  providers: [QcAnalyticsService],
  exports: [QcAnalyticsService],
})
export class QcAnalyticsModule {}
