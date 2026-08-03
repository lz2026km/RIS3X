/**
 * G005 放射RIS系统 v3.0.2.2 - 报告质量模块
 * 5 端点:GET rules / POST evaluate / GET history / GET trend / POST re-evaluate
 */
import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { ReportsQualityController } from './reports-quality.controller'
import { ReportsQualityService } from './reports-quality.service'
import { ReportQualityController } from './reportquality.controller'
import { ReportQualityService } from './reportquality.service'

@Module({
  imports: [PrismaModule],
  controllers: [ReportsQualityController, ReportQualityController],
  providers: [ReportsQualityService, ReportQualityService],
  exports: [ReportsQualityService, ReportQualityService],
})
export class ReportsQualityModule {}
