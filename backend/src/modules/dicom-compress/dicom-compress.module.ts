import { Module } from '@nestjs/common'
import { DicomCompressController } from './dicom-compress.controller'
import { DicomCompressService } from './dicom-compress.service'

@Module({
  controllers: [DicomCompressController],
  providers: [DicomCompressService],
  exports: [DicomCompressService],
})
export class DicomCompressModule {}
