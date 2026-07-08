import { Module } from '@nestjs/common';
import { Patient-portalController } from './patient-portal.controller';
import { Patient-portalService } from './patient-portal.service';

@Module({
  controllers: [Patient-portalController],
  providers: [Patient-portalService],
  exports: [Patient-portalService],
})
export class Patient-portalModule {}
