// [v3.0.6.11-99 Wave 4A] 病灶追踪模块
// [v3.0.6.11-101 Wave 2C] 导出 LesionTrackingService (segmentation-v2 测量联动复用)
import { Module } from '@nestjs/common'
import { LesionTrackingController } from './lesion-tracking.controller'
import { LesionTrackingService } from './lesion-tracking.service'

@Module({
  controllers: [LesionTrackingController],
  providers: [LesionTrackingService],
  exports: [LesionTrackingService],
})
export class LesionTrackingModule {}
