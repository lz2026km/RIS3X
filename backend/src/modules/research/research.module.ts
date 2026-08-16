import { Module } from '@nestjs/common'
import { ResearchController } from './research.controller'
import { ResearchService } from './research.service'
import { ResearchExportService } from './research-export.service'

@Module({
  controllers: [ResearchController],
  providers: [ResearchService, ResearchExportService],
})
export class ResearchModule {}
