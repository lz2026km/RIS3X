/**
 * [G005 W12-PatientService] 通知渠道模块 (orphan module, DB-less-safe)
 */
import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { NotificationChannelController } from './notification-channel.controller'
import { NotificationChannelService } from './notification-channel.service'

@Module({
  imports: [PrismaModule],
  controllers: [NotificationChannelController],
  providers: [NotificationChannelService],
  exports: [NotificationChannelService],
})
export class NotificationChannelModule {}
