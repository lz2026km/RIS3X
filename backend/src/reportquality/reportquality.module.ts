import { Module } from '@nestjs/common'
import { ReportQualityController } from './reportquality.controller'
import { ReportQualityService } from './reportquality.service'

@Module({
  controllers: [ReportQualityController],
  providers: [ReportQualityService],
  exports: [ReportQualityService],
})
export class ReportQualityModule {}
