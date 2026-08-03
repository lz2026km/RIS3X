import { Module } from '@nestjs/common'
import { VolumeController } from './volume.controller'
import { VolumeService } from './volume.service'
import { SegmentationService } from './segmentation.service'

@Module({
  controllers: [VolumeController],
  providers: [VolumeService, SegmentationService],
  exports: [VolumeService, SegmentationService],
})
export class VolumeModule {}
