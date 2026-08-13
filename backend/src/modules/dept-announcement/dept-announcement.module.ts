import { Module } from '@nestjs/common'
import { DeptAnnouncementController } from './dept-announcement.controller'
import { DeptAnnouncementService } from './dept-announcement.service'

@Module({
  controllers: [DeptAnnouncementController],
  providers: [DeptAnnouncementService],
  exports: [DeptAnnouncementService],
})
export class DeptAnnouncementModule {}
