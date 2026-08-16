/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 8A - 报告对比 V2 模块 (孤儿模块: 无 Prisma, 无外部依赖)
 * 能力: 同患者不同时点 / 双阅双报告 / 医生与 AI 报告 逐段 diff + 关键字段 + 相似度 (确定性)
 */
import { Module } from '@nestjs/common'
import { ReportCompareV2Controller } from './report-compare-v2.controller'
import { ReportCompareV2Service } from './report-compare-v2.service'

@Module({
  controllers: [ReportCompareV2Controller],
  providers: [ReportCompareV2Service],
  exports: [ReportCompareV2Service],
})
export class ReportCompareV2Module {}
