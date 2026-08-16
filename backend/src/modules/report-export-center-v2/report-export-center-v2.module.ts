import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { ReportExportCenterV2Controller } from './report-export-center-v2.controller'
import { ReportExportCenterV2Service } from './report-export-center-v2.service'

/**
 * [G005 v3.0.6.11-101 Wave 7B F15] 报告导出中心 V2 (孤儿模块, 不注册进 app.module,
 * spec 直接注入测试; DB 不可用时 seed 回退)
 */
@Module({
  imports: [PrismaModule],
  controllers: [ReportExportCenterV2Controller],
  providers: [ReportExportCenterV2Service],
  exports: [ReportExportCenterV2Service],
})
export class ReportExportCenterV2Module {}
