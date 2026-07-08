import { Module } from '@nestjs/common';
import { DentalController } from './dental.controller';
import { DentalService } from './dental.service';

@Module({
  controllers: [DentalController],
  providers: [DentalService],
  exports: [DentalService],
})
export class DentalModule {}
