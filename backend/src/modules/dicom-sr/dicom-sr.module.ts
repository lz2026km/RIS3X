import { Module } from '@nestjs/common'
import { DicomSrController } from './dicom-sr.controller'
import { DicomSrService } from './dicom-sr.service'
import { Hl7Module } from '../../hl7/hl7.module'

@Module({
  imports: [Hl7Module],
  controllers: [DicomSrController],
  providers: [DicomSrService],
  exports: [DicomSrService],
})
export class DicomSrModule {}
