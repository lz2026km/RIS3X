import { Module } from '@nestjs/common'
import { Dicom4dController } from './dicom-4d.controller'
import { Dicom4dService } from './dicom-4d.service'

@Module({
  controllers: [Dicom4dController],
  providers: [Dicom4dService],
  exports: [Dicom4dService],
})
export class Dicom4dModule {}
