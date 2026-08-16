import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { TemplateApprovalController } from './template-approval.controller'
import { TemplateApprovalService } from './template-approval.service'

/**
 * G005 v3.0.6.11-101 - 模板审批流 V2 (孤儿模块: 不注册进 app.module,
 * 由 spec 直接注入测试; 服务内置 seed 回退, 可独立运行)。
 */
@Module({
  imports: [PrismaModule],
  controllers: [TemplateApprovalController],
  providers: [TemplateApprovalService],
  exports: [TemplateApprovalService],
})
export class TemplateApprovalModule {}
