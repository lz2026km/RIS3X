// [v3.0.6.11-99 Wave 4A] 病灶追踪模块
import { Module } from '@nestjs/common'
import { LesionTrackingController } from './lesion-tracking.controller'
import { LesionTrackingService } from './lesion-tracking.service'

@Module({
  controllers: [LesionTrackingController],
  providers: [LesionTrackingService],
})
export class LesionTrackingModule {}
