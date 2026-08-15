// [G005 v3.0.6.11-100 Wave 4A] 移动审批模块
import { Module } from '@nestjs/common'
import { MobileApprovalController } from './mobile-approval.controller'
import { MobileApprovalService } from './mobile-approval.service'

@Module({
  controllers: [MobileApprovalController],
  providers: [MobileApprovalService],
  exports: [MobileApprovalService],
})
export class MobileApprovalModule {}
