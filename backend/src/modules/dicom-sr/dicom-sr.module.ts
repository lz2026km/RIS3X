import { Module } from '@nestjs/common'
import { DicomSrController } from './dicom-sr.controller'
import { DicomSrService } from './dicom-sr.service'

@Module({
  controllers: [DicomSrController],
  providers: [DicomSrService],
  exports: [DicomSrService],
})
export class DicomSrModule {}
