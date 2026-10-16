import { Module } from '@nestjs/common';
import { PrivacyController } from './privacy.controller';
import { DicomDeidService } from './dicom-deid.service';

/**
 * [G005 v3.0.6.16-0] 隐私模块: DICOM PS3.15 去标识化
 */
@Module({
  controllers: [PrivacyController],
  providers: [DicomDeidService],
  exports: [DicomDeidService],
})
export class PrivacyModule {}
