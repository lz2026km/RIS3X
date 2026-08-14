import { Module } from '@nestjs/common'
import { ReportAnnotationController } from './report-annotation.controller'
import { ReportAnnotationService } from './report-annotation.service'

@Module({
  controllers: [ReportAnnotationController],
  providers: [ReportAnnotationService],
  exports: [ReportAnnotationService],
})
export class ReportAnnotationModule {}
