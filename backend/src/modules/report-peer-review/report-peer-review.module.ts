/**
 * G005 RIS v3.0.6.11-101 Wave 7C - 报告互评模块 (孤儿模块: 无 Prisma, 无外部依赖)
 */
import { Module } from '@nestjs/common'
import { ReportPeerReviewController } from './report-peer-review.controller'
import { ReportPeerReviewService } from './report-peer-review.service'

@Module({
  controllers: [ReportPeerReviewController],
  providers: [ReportPeerReviewService],
  exports: [ReportPeerReviewService],
})
export class ReportPeerReviewModule {}
