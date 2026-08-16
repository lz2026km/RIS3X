/**
 * [v3.0.6.11-101 Wave 2C] 影像分割深化 — SegmentationV2 模块
 * 依赖: VolumeModule (真实体数据) + LesionTrackingModule (测量联动)
 */
import { Module } from '@nestjs/common'
import { VolumeModule } from '../volume/volume.module'
import { LesionTrackingModule } from '../lesion-tracking/lesion-tracking.module'
import { SegmentationV2Controller } from './segmentation-v2.controller'
import { SegmentationV2Service } from './segmentation-v2.service'

@Module({
  imports: [VolumeModule, LesionTrackingModule],
  controllers: [SegmentationV2Controller],
  providers: [SegmentationV2Service],
  exports: [SegmentationV2Service],
})
export class SegmentationV2Module {}
