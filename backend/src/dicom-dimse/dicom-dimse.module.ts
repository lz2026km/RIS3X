import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from '../prisma/prisma.module'
import { DicomDimseController } from './dicom-dimse.controller'
import { DicomDimseService } from './dicom-dimse.service'

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [DicomDimseController],
  providers: [DicomDimseService],
  exports: [DicomDimseService],
})
export class DicomDimseModule {}
