// [G005 v3.0.6.11-101 Wave 6A F11] 报告质控规则引擎模块 (孤儿模块, 无 DB 可启动)
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { ReportRulesController } from './report-rules.controller'
import { ReportRulesService } from './report-rules.service'

@Module({
  imports: [PrismaModule],
  controllers: [ReportRulesController],
  providers: [ReportRulesService],
  exports: [ReportRulesService],
})
export class ReportRulesModule {}
