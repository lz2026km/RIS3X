import { Module } from '@nestjs/common'
import { VolumeController } from './volume.controller'
import { VolumeService } from './volume.service'
import { SegmentationService } from './segmentation.service'
import { VolumeV2Controller } from './volume-v2.controller'
import { VolumeV2Service } from './volume-v2.service'

@Module({
  controllers: [VolumeController, VolumeV2Controller],
  providers: [VolumeService, SegmentationService, VolumeV2Service],
  exports: [VolumeService, SegmentationService, VolumeV2Service],
})
export class VolumeModule {}
