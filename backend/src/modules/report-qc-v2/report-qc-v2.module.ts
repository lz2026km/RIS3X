/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 6B (report-qc-v2) - 报告质控 V2 模块
 * 孤儿模块: 无新增 DB 表, DB 不可用自动回退确定性种子, 可无 DB 启动
 */
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { ReportQcV2Controller } from './report-qc-v2.controller'
import { ReportQcV2Service } from './report-qc-v2.service'

@Module({
  imports: [PrismaModule],
  controllers: [ReportQcV2Controller],
  providers: [ReportQcV2Service],
  exports: [ReportQcV2Service],
})
export class ReportQcV2Module {}
