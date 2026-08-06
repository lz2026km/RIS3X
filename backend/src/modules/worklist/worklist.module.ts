import { Module } from '@nestjs/common'
import { NotificationsModule } from '../../notifications/notifications.module'
import { WorklistController } from './worklist.controller'
import { WorklistService } from './worklist.service'

@Module({
  imports: [NotificationsModule],
  controllers: [WorklistController],
  providers: [WorklistService],
  exports: [WorklistService],
})
export class WorklistModule {}
