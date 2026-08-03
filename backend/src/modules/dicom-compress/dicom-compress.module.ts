import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { DicomCompressController } from './dicom-compress.controller'
import { DicomCompressService } from './dicom-compress.service'

@Module({
  imports: [PrismaModule],
  controllers: [DicomCompressController],
  providers: [DicomCompressService],
  exports: [DicomCompressService],
})
export class DicomCompressModule {}
