/**
 * G005 放射RIS系统 v3.0.2 - 危急值通知
 * 2 端点:POST notify / POST escalate
 * v3.0.6.11-75 (W4-2): 实时推送 — 危急值创建/通知/状态变化经 socket.io 网关推送
 */
import { Module } from '@nestjs/common'
import { PrismaModule } from '../prisma/prisma.module'
import { NotificationsModule } from '../notifications/notifications.module'
import { CriticalsController } from './criticals.controller'
import { CriticalsService } from './criticals.service'

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [CriticalsController],
  providers: [CriticalsService],
  exports: [CriticalsService],
})
export class CriticalsModule {}
