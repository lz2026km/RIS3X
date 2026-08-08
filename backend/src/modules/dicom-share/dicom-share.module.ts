import { Module } from '@nestjs/common'
import { DicomShareController } from './dicom-share.controller'
import { DicomShareService } from './dicom-share.service'

@Module({
  controllers: [DicomShareController],
  providers: [DicomShareService],
})
export class DicomShareModule {}
