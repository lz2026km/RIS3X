/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 8A - 报告检索 V2 模块 (孤儿模块: 无 Prisma, 无外部依赖)
 * 能力: 关键词全文 + 结构化条件 + 自然语言解析 + 跨机构检索 + 高亮片段 + 聚合统计 (确定性)
 */
import { Module } from '@nestjs/common'
import { ReportSearchV2Controller } from './report-search-v2.controller'
import { ReportSearchV2Service } from './report-search-v2.service'

@Module({
  controllers: [ReportSearchV2Controller],
  providers: [ReportSearchV2Service],
  exports: [ReportSearchV2Service],
})
export class ReportSearchV2Module {}
