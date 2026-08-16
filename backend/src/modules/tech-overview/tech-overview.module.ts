/**
 * G005 RIS v3.0.6.11-101 Wave 5 (tech-overview) - 技师工作站 V2 收尾:
 * 患者预约分布 + 技师值班大屏 (孤儿模块, 无 DB 可启动, seed 回退)
 */
import { Module } from '@nestjs/common'
import { TechOverviewController } from './tech-overview.controller'
import { TechOverviewService } from './tech-overview.service'

@Module({
  controllers: [TechOverviewController],
  providers: [TechOverviewService],
  exports: [TechOverviewService],
})
export class TechOverviewModule {}
