import { Module } from '@nestjs/common';
import { Data-reportController } from './data-report.controller';
import { Data-reportService } from './data-report.service';

@Module({
  controllers: [Data-reportController],
  providers: [Data-reportService],
  exports: [Data-reportService],
})
export class Data-reportModule {}
