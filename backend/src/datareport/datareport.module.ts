import { Module } from '@nestjs/common';
import { DataReportController } from './datareport.controller';
import { DataReportService } from './datareport.service';

@Module({
  controllers: [DataReportController],
  providers: [DataReportService],
  exports: [DataReportService],
})
export class DataReportModule {}
