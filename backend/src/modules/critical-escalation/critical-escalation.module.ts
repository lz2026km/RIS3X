/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 6B (critical-escalation) - 危急值升级链 V2 模块
 * 孤儿模块: 无新增 DB 表, DB 不可用自动回退确定性种子, 可无 DB 启动
 */
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { CriticalEscalationController } from './critical-escalation.controller'
import { CriticalEscalationService } from './critical-escalation.service'

@Module({
  imports: [PrismaModule],
  controllers: [CriticalEscalationController],
  providers: [CriticalEscalationService],
  exports: [CriticalEscalationService],
})
export class CriticalEscalationModule {}
