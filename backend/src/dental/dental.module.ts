import { Module } from '@nestjs/common';
import { DentalController } from './dental.controller';
import { DentalImagingController } from './dental-imaging.controller';
import { DentalService } from './dental.service';
import { DentalImagingService } from './dental-imaging.service';

@Module({
  controllers: [DentalController, DentalImagingController],
  providers: [DentalService, DentalImagingService],
  exports: [DentalService, DentalImagingService],
})
export class DentalModule {}
