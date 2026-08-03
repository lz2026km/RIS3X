/**
 * G005 放射RIS系统 v3.0.2.2 - DICOMweb 模块
 * 6 端点:QIDO-RS search + WADO-RS retrieve + STOW-RS store
 * 对标:DICOM Part 18 Web Services
 */
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from '../prisma/prisma.module'
import { DicomWebController } from './dicom-web.controller'
import { DicomWebService } from './dicom-web.service'

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [DicomWebController],
  providers: [DicomWebService],
  exports: [DicomWebService],
})
export class DicomWebModule {}
