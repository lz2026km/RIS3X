import { Module } from '@nestjs/common';
import { Report-qualityController } from './report-quality.controller';
import { Report-qualityService } from './report-quality.service';

@Module({
  controllers: [Report-qualityController],
  providers: [Report-qualityService],
  exports: [Report-qualityService],
})
export class Report-qualityModule {}
