import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from '../prisma/prisma.module'
import { DicomDimseController } from './dicom-dimse.controller'
import { DicomDimseService } from './dicom-dimse.service'
import { MwlService } from './mwl.service'
import { TechExecutionService } from './tech-execution.service'
import { ExamTechController, ProtocolsController } from './exam-tech.controller'

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [DicomDimseController, ProtocolsController, ExamTechController],
  providers: [DicomDimseService, MwlService, TechExecutionService],
  exports: [DicomDimseService, MwlService, TechExecutionService],
})
export class DicomDimseModule {}
